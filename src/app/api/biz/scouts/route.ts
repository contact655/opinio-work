import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasAgreedTerms } from "@/lib/business/termsAgreement";
import { getTenantContext } from "@/lib/business/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notify/email";
import { unsubscribeUrl } from "@/lib/notify/weeklyRecipients";

export const dynamic = "force-dynamic";

// GET: list scouts sent by this company
export async function GET(_req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: scouts, error } = await admin
    .from("ow_scouts")
    .select("id, status, sent_at, replied_at, conversation_id, message, candidate_id, ow_jobs(id, title)")
    .eq("company_id", ctx.tenantId)
    .order("sent_at", { ascending: false });

  if (error) {
    console.error("[GET /api/biz/scouts]", error);
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }

  if (!scouts?.length) return NextResponse.json({ scouts: [] });

  // Resolve candidate ow_users info via auth_id
  const authIds = Array.from(new Set(scouts.map((s) => s.candidate_id).filter(Boolean)));
  const { data: users } = await admin
    .from("ow_users")
    .select("id, auth_id, name, avatar_color")
    .in("auth_id", authIds)
    .eq("is_test", false);

  const userMap = new Map((users ?? []).map((u) => [u.auth_id, u]));
  const result = scouts.map((s) => ({
    ...s,
    candidate: userMap.get(s.candidate_id) ?? null,
  }));

  return NextResponse.json({ scouts: result });
}

// POST: send a scout to a candidate
export async function POST(req: NextRequest) {
  /* ⚠️ **スカウト送信はまだ止めてある。** 再開は SCOUT_SENDING_ENABLED=true を
        環境変数に入れるだけ。

     ── 止めた理由は解消済み（2026-08-10）──────────────────────────────
     2026-08-09 に止めたのは「送れるが受け取る手段が1つも無い」ためだった。
     受信側を作ったので、その理由は無くなっている。

       求職者側の閲覧UI … `/mypage/scouts`
       アプリ内通知     … `ow_notifications` の type='scout'（下で INSERT）
       メール通知       … `sendScoutEmail`（配信停止を尊重する）
       返答             … 既存の `/api/jobseeker/scouts/[id]/reply`

     ── それでもまだ開けていない理由 ───────────────────────────────────
     ⚠️ `scout_enabled` が null の人には送れない（`can_send_scout` が null を
        false 扱いにする）。2026-08-10 時点で 39人中 true は3人。
     ⚠️ LP の FAQ は「初期設定は『受け取る』」と書いていて実態と違う。
        どちらを直すか決めてから開けること。

     ⚠️ フラグを立てると `/biz/candidates` のボタンも同時に開く。片方だけ変えない。 */
  if (process.env.SCOUT_SENDING_ENABLED !== "true") {
    return NextResponse.json(
      { error: "スカウト機能は現在準備中です。受信側の画面を用意してから再開します。" },
      { status: 503 }
    );
  }

  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  /* 人材紹介利用規約（成功報酬）への同意が要る。
     ⚠️ **画面側（/biz/candidates）と同じ判定にすること。** 片方だけ変えると
        「押せるのに 403」か「押せないのに送れる」になる（スカウトのフラグと同じ形）。 */
  const { data: { user: scoutUser } } = await createClient().auth.getUser();
  if (!scoutUser || !(await hasAgreedTerms(scoutUser.id, "placement"))) {
    return NextResponse.json(
      { error: "人材紹介利用規約への同意が必要です。「候補者を探す」から同意してください。" },
      { status: 403 }
    );
  }

  if (!ctx.isPublished) {
    return NextResponse.json(
      { error: "運営審査が完了するまでスカウトを送信できません" },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { candidate_id, message, job_id } = body as {
    candidate_id?: string;
    message?: string;
    job_id?: string | null;
  };

  if (!candidate_id || typeof candidate_id !== "string") {
    return NextResponse.json({ error: "candidate_id required" }, { status: 400 });
  }
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: "メッセージは2000文字以内で入力してください" }, { status: 400 });
  }

  const admin = createAdminClient();

  // candidate_id は ow_users.id。ow_scouts は auth.users.id を参照する場合もあるため
  // ow_users.auth_id を取得して candidate を特定
  const { data: candidateUser } = await admin
    .from("ow_users")
    .select("id, auth_id")
    .eq("id", candidate_id)
    .maybeSingle();

  if (!candidateUser) {
    return NextResponse.json({ error: "candidate not found" }, { status: 404 });
  }

  // ow_scouts INSERT — trigger が自動でバリデーション + 枠消費
  /* ⚠️ 挿入した行の id が要るので `.select("id").single()` を付ける。
        ⚠️ 列を絞ること。引数なしの `.select()` は全列を返し、
           返却列にも SELECT 権限が要るため権限剥奪列があると 403 になる
           （CLAUDE.md「列単位 GRANT を剥がすときのチェックリスト」）。 */
  const { data: inserted, error } = await admin
    .from("ow_scouts")
    .insert({
      company_id: ctx.tenantId,
      candidate_id: candidateUser.auth_id ?? candidate_id,
      job_id: job_id ?? null,
      message: message.trim(),
      status: "sent",
      sent_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    // トリガーからのエラーコードで判定
    const code = (error as any).code as string ?? "";
    const msg = (error as any).message as string ?? "";
    if (code === "P0001" || msg.includes("P0001") || msg.includes("スカウトを送信できません")) {
      return NextResponse.json({ error_code: "P0001", error: "この候補者にはスカウトを送信できません" }, { status: 422 });
    }
    if (code === "P0002" || msg.includes("P0002") || msg.includes("送信枠")) {
      return NextResponse.json({ error_code: "P0002", error: "今月のスカウト送信枠を使い切りました。追加をご希望の場合はお問い合わせください" }, { status: 422 });
    }
    console.error("[POST /api/biz/scouts]", error);
    return NextResponse.json({ error: "送信に失敗しました" }, { status: 500 });
  }

  /* 受信者に届いたことを知らせる。**これが無いと送っても気づかれない。**
     ⚠️ `recipient_user_id` は **ow_users 空間**。`ow_scouts.candidate_id` は
        auth 空間なので、そちらを渡さないこと（CLAUDE.md「user_id は2つの空間がある」）。
        ここでは API が受け取った `candidate_id`（= ow_users.id）をそのまま使う。
     ⚠️ 通知の失敗でスカウト送信自体を失敗させない（best-effort）。
        ただし握りつぶさずログは必ず出す。届かなかったことに気づけなくなるため。 */
  if (inserted?.id) {
    const { error: notifErr } = await admin.from("ow_notifications").insert({
      recipient_user_id: candidate_id,
      actor_company_id: ctx.tenantId,
      type: "scout",
      scout_id: inserted.id,
    });
    if (notifErr) {
      console.error("[POST /api/biz/scouts] 通知の作成に失敗（スカウトは送信済み）", notifErr.message);
    }

    /* メールでも知らせる。⚠️ アプリ内通知だけだと、来訪しない限り気づけない。
       ⚠️ 配信停止（`email_scout_enabled`）を必ず見る。**ここを外さないこと。**
          止められないメールを送ると、週次メールを止めた理由②に逆戻りする。
       ⚠️ `ow_profiles.user_id` は auth 空間なので `candidateUser.auth_id` で引く。 */
    await sendScoutEmail(admin, {
      candidateAuthId: candidateUser.auth_id,
      candidateOwUserId: candidate_id,
      companyName: ctx.tenantName,
    });
  }

  return NextResponse.json({ ok: true });
}

/**
 * スカウトが届いたことをメールで知らせる。
 *
 * ⚠️ **配信停止の判定をこの関数の中に置いてある。** 呼び出し側で判定すると、
 *    経路が増えたときに片方だけ忘れる（週次メール2本で実際に起きた）。
 *
 * ⚠️ best-effort。メールが送れなくてもスカウト送信は成功扱いにする。
 *    ただし握り潰さずログは出す。
 */
async function sendScoutEmail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  args: { candidateAuthId: string | null; candidateOwUserId: string; companyName: string },
) {
  try {
    if (!args.candidateAuthId) return;

    // ⚠️ ow_profiles.user_id は auth 空間
    const { data: prof } = await admin
      .from("ow_profiles")
      .select("email_scout_enabled")
      .eq("user_id", args.candidateAuthId)
      .maybeSingle();

    // ⚠️ 明示的に true のときだけ送る（読めなかったときに送る向きにしない）
    if (prof?.email_scout_enabled !== true) return;

    const { data: owUser } = await admin
      .from("ow_users")
      .select("email, name")
      .eq("id", args.candidateOwUserId)
      .maybeSingle();
    if (!owUser?.email) return;

    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://opinio.jp";
    const esc = (v: string) =>
      v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const company = esc(args.companyName);

    await notify({
      to: owUser.email,
      subject: `【OPINIO】${args.companyName} からスカウトが届きました`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0F172A">
          <p>${esc(owUser.name ?? "")} さん</p>
          <p><strong>${company}</strong> からスカウトが届きました。</p>
          <p style="margin:24px 0">
            <a href="${base}/mypage/scouts"
               style="background:#002366;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">
              内容を見る
            </a>
          </p>
          <p style="font-size:13px;color:#475569;line-height:1.8">
            返答するかどうかはご自身で決められます。見送っても相手に理由は伝わりません。
          </p>
          <hr style="margin:24px 0;border:none;border-top:1px solid #eee" />
          <p style="font-size:12px;color:#94a3b8">
            スカウトのお知らせが不要な場合は
            <a href="${unsubscribeUrl(base)}" style="color:#94a3b8">プロフィール編集</a>
            から配信を停止できます。
          </p>
          <p style="font-size:12px;color:#94a3b8">OPINIO</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[POST /api/biz/scouts] スカウトメールの送信に失敗（スカウトは送信済み）", err);
  }
}
