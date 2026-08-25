import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createConversation } from "@/lib/conversations/createConversation";
import { notify } from "@/lib/notify/email";
import { getCompanyNotificationTarget } from "@/lib/notify/recipients";
import { opsSubject, opsFallbackNotice } from "@/lib/notify/templates";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const scoutId = params.id;
  const body = await req.json().catch(() => ({}));
  const { action, message } = body as { action?: string; message?: string };

  if (action !== "interested" && action !== "declined") {
    return NextResponse.json({ error: "action must be 'interested' or 'declined'" }, { status: 400 });
  }
  if (message && message.length > 1000) {
    return NextResponse.json({ error: "メッセージは1000文字以内で入力してください" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify scout belongs to this user
  const { data: scout } = await admin
    .from("ow_scouts")
    .select("id, company_id, candidate_id, status, conversation_id, message, ow_companies(id, name)")
    .eq("id", scoutId)
    .eq("candidate_id", user.id)
    .maybeSingle();

  if (!scout) return NextResponse.json({ error: "scout not found" }, { status: 404 });
  if (scout.status === "interested" || scout.status === "declined") {
    return NextResponse.json({ error: "すでに返答済みです" }, { status: 409 });
  }

  // Resolve ow_users.id for the candidate
  const { data: owMe } = await admin
    .from("ow_users")
    .select("id, name")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!owMe) return NextResponse.json({ error: "user not found" }, { status: 404 });

  let conversationId: string | null = scout.conversation_id ?? null;

  if (action === "interested") {
    /* 会話がまだ無ければ作る。
       ⚠️ **自前で INSERT しない。`create_conversation` RPC に寄せる。**
          2026-08-25 まで `kind:'company'` × `stage:'mediated'` を直接
          INSERT しており、`ow_conversations_stage_consistency`
          （company は stage='active' のみ）に**必ず違反して 500** だった。
          RPC なら stage を間違えようがなく、
          `ow_conversations_unique_per_relation` に対する ON CONFLICT も
          持っているので、同じ企業から2回目のスカウトでも落ちない。
          候補者の participant も RPC の中で作られる（重複 INSERT は不要）。
       ⚠️ **`admin` ではなく利用者クライアント `supabase` を渡す。**
          RPC は SECURITY DEFINER で、中で
          `ow_users.auth_id = auth.uid()` を確かめる。service_role では
          `auth.uid()` が null になり 42501 で落ちる。 */
    if (!conversationId) {
      try {
        const created = await createConversation(supabase, {
          kind: "company",
          candidateUserId: owMe.id,
          companyId: scout.company_id as string,
        });
        conversationId = created.conversationId;
      } catch (e) {
        console.error("[scout reply] createConversation failed:", e);
        return NextResponse.json({ error: "会話の作成に失敗しました" }, { status: 500 });
      }

      if (message?.trim()) {
        /* 開始メッセージ。participant は RPC が作っているので引き直す。
           ⚠️ 取れなければ**入れない**。`sender_participant_id` を null で
              入れると送信者不明の行になる。 */
        const { data: participant, error: partErr } = await admin
          .from("ow_conversation_participants")
          .select("id")
          .eq("conversation_id", conversationId)
          .eq("user_id", owMe.id)
          .maybeSingle();

        if (partErr || !participant) {
          console.error("[scout reply] participant lookup:", partErr?.message ?? "not found");
        } else {
          const { error: msgErr } = await admin.from("ow_conversation_messages").insert({
            conversation_id: conversationId,
            sender_participant_id: participant.id,
            body: message.trim(),
          });
          if (msgErr) console.error("[scout reply] message insert:", msgErr.message);
        }
      }
    }

    /*
      企業への通知（best-effort）。

      ⚠️ 2026-08-05 まで、この通知は**一度も誰にも届いていなかった**。
         ow_users(name, notify_email) を select していたが ow_users.notify_email は
         存在しないカラムで、クエリがエラーになり companyAdmins が null、
         その下のループが1回も回らなかった。error を受け取っていなかったため
         ログにも何も出ず、無言で落ちていた。
      ⚠️ 宛先は getCompanyNotificationRecipients に集約している。ここで引かないこと。
      ⚠️ 宛名は出さない。上書き先（notification_emails）には氏名が無く、
         「担当者 さん」と書くと誰宛か分からない挨拶になるため。
      ⚠️ 本文だけ lib/notify/templates.ts に無く、ここにインラインで書かれている。
         他の通知はすべてテンプレート化されているので、移すかは別途判断する。
    */
    const companyName = (scout.ow_companies as any)?.name ?? "企業";
    const target = await getCompanyNotificationTarget(
      scout.company_id as string,
      "scout-reply",
    );

    for (const to of target.to) {
      await notify({
        to,
        /* ⚠️ 運営に回ったときの印は `target.viaOps` から出す。
              ここでアドレスを見て判定し直さないこと（嘘の印になる）。 */
        subject: opsSubject(`【OPINIO】${owMe.name} さんがスカウトに興味を示しました`, target.viaOps),
        html: `
          ${opsFallbackNotice(target.viaOps)}
          <p>${owMe.name} さんが <strong>${companyName}</strong> からのスカウトに「話を聞きたい」と回答しました。</p>
          <p><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? "https://opinio.jp"}/biz/conversations">OPINIOで会話を確認する →</a></p>
          <hr style="margin:24px 0; border:none; border-top:1px solid #eee" />
          <p style="font-size:12px; color:#888">OPINIO</p>
        `,
      });
    }
  }

  // Update scout status
  const { error: updateErr } = await admin
    .from("ow_scouts")
    .update({
      status: action,
      replied_at: new Date().toISOString(),
      ...(conversationId ? { conversation_id: conversationId } : {}),
    })
    .eq("id", scoutId);

  if (updateErr) {
    console.error("[scout reply] status update error:", updateErr);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, conversationId });
}
