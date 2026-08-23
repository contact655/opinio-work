import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
    // Create conversation if not yet linked
    if (!conversationId) {
      const { data: conv, error: convErr } = await admin
        .from("ow_conversations")
        .insert({
          kind: "company",
          stage: "mediated",
          status: "active",
          company_id: scout.company_id,
          candidate_user_id: owMe.id,
          last_message_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (convErr || !conv) {
        console.error("[scout reply] conv insert error:", convErr);
        return NextResponse.json({ error: "会話の作成に失敗しました" }, { status: 500 });
      }
      conversationId = conv.id;

      // Add candidate as initial participant
      const { data: participant, error: partErr } = await admin
        .from("ow_conversation_participants")
        .insert({ conversation_id: conversationId, user_id: owMe.id, role: "candidate" })
        .select("id")
        .single();

      if (partErr || !participant) {
        console.error("[scout reply] participant insert error:", partErr);
      } else if (message?.trim()) {
        // Insert candidate's opening message
        await admin.from("ow_conversation_messages").insert({
          conversation_id: conversationId,
          sender_participant_id: participant.id,
          body: message.trim(),
        });
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
