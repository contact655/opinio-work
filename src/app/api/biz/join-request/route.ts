import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/notify/email";
import { joinRequestTemplate, joinRequestOpsTemplate, ADMIN_EMAIL } from "@/lib/notify/templates";
import { getCompanyNotificationTarget } from "@/lib/notify/recipients";
/* ⚠️ 依頼は**メールを送るだけで、どこにも残っていなかった**（2026-09-04 に配線）。
      本人が画面を開き直すと、依頼した事実が消えていた。 */
import { recordJoinRequest } from "@/lib/business/joinRequests";

/**
 * POST /api/biz/join-request
 *
 * 既存企業への参加リクエスト。
 * - 管理者ゼロ → ★運営の承認待ちにする（2026-10-17 / 柴さんの判断）。依頼を記録して運営にメール、review: "ops" を返す
 *   ⚠️★即時承認に戻さないこと。2026-10-17 まで、ログインしていれば誰でも押した瞬間に管理者になり、
 *      その企業の応募者の氏名・メール・職歴を見られた（運営への通知も無かった）。
 * - 管理者あり → 既存 admin 全員にメール通知
 */
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  let body: { company_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const companyId = (body.company_id ?? "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "company_id が必要です" }, { status: 400 });
  }

  const admin = createAdminClient();

  // リクエスト者の情報を取得
  const { data: requester } = await admin
    .from("ow_users")
    .select("id, name, email")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!requester) {
    return NextResponse.json({ error: "ユーザー情報が見つかりません" }, { status: 404 });
  }

  // 対象企業を確認
  const { data: company } = await admin
    .from("ow_companies")
    .select("id, name")
    .eq("id", companyId)
    .maybeSingle();

  if (!company) {
    return NextResponse.json({ error: "企業が見つかりません" }, { status: 404 });
  }

  // 既にメンバーでないか確認
  const { data: existing } = await admin
    .from("ow_company_admins")
    .select("id")
    .eq("company_id", companyId)
    .eq("user_id", requester.id)
    .eq("is_active", true)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "すでにこの企業のメンバーです" }, { status: 409 });
  }

  /*
    対象企業のアクティブ Admin 一覧。
    ⚠️ この件数が0だと下で**即時承認して admin に追加する**。判定を間違えると
       誰でも他社の管理者になれるので、失敗したら承認せず落とすこと（fail closed）。

    ⚠️ 2026-08-05 に埋め込みの書き方を修正した。ow_users を関係名だけで埋め込むと
         Could not embed because more than one relationship was found
           for 'ow_company_admins' and 'ow_users'
       になる。ow_company_admins には ow_users への外部キーが2本あるため
       （user_id と invited_by_user_id）、どちらを辿るか明示しないと曖昧になる。
       それまでこのクエリは常にエラーで adminMembers が null になり、
         ・既存 admin にメールが1通も飛ばない
         ・adminList が空 → **管理者がいる企業でも即時承認が走る**
       という状態だった。error を受け取っていなかったため無言で落ちていた。
  */
  const { data: adminMembers, error: adminMembersErr } = await admin
    .from("ow_company_admins")
    .select("user_id, ow_users!user_id(name, email)")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .eq("permission", "admin");

  if (adminMembersErr) {
    console.error("[join-request] admin list fetch failed", adminMembersErr.message);
    return NextResponse.json(
      { error: "参加リクエストを処理できませんでした。時間をおいて再度お試しください。" },
      { status: 500 },
    );
  }

  const adminList = (adminMembers ?? []).flatMap((m) => {
    const u = (m.ow_users as unknown) as { name: string; email: string } | null;
    return u?.email ? [{ name: u.name ?? "管理者", email: u.email }] : [];
  });

  // ── 管理者ゼロ → 運営の承認待ち（2026-10-17）──────────────────────────────
  /* ⚠️★記録が運営の承認画面（/admin/company-join-requests）の唯一の入口。記録できなければ 500 にする
        （メールだけ飛んで承認画面に出ない、を作らない）。メールは best-effort。
     ⚠️ ここに以前あった「即時承認＋ ow_user_roles への upsert」の経緯は git の履歴（bd292298 以前）にある。
        企業ロールは ow_company_admins の行で決まる（lib/roles.ts）。 */
  if (adminList.length === 0) {
    const recorded = await recordJoinRequest(admin, { owUserId: requester.id, companyId, approved: false });
    if (!recorded) {
      return NextResponse.json({ error: "依頼を記録できませんでした。時間をおいて再度お試しください。" }, { status: 500 });
    }
    try {
      await sendEmail(joinRequestOpsTemplate({
        to: ADMIN_EMAIL,
        companyName: company.name,
        requesterName: requester.name ?? "",
        requesterEmail: requester.email ?? user.email ?? "",
      }));
    } catch (e) {
      console.error("[join-request] 運営へのメールに失敗:", e instanceof Error ? e.message : e);
    }
    console.info(`[join-request] ops review user=${requester.id} company=${companyId}`);
    return NextResponse.json({ success: true, review: "ops" });
  }

  /*
    ── 管理者あり → メール通知 ────────────────────────────────────────────
    ⚠️ 宛先は getCompanyNotificationRecipients に集約している。ここで引かないこと。
    ⚠️ 上の adminList は消さない。あちらは「管理者が1人もいなければ自動承認する」
       という分岐の判定に使っており、宛先の話とは別。
       notification_emails が設定されていても、管理者ゼロなら自動承認は起きる。
    ⚠️ 宛名は adminList から引ける場合だけ使う。notification_emails で
       上書きされた宛先には対応する氏名が無いので「ご担当者」にする。
  */
  const nameByEmail = new Map(adminList.map((a) => [a.email.trim().toLowerCase(), a.name]));
  const target = await getCompanyNotificationTarget(companyId, "join-request");
  const recipients = target.to;

  const results = await Promise.allSettled(
    recipients.map((to) =>
      sendEmail(
        joinRequestTemplate({
          to,
          adminName: nameByEmail.get(to.toLowerCase()) ?? "ご担当者",
          companyName: company.name,
          companyId: company.id,
          requesterName: requester.name ?? user.email ?? "不明",
          requesterEmail: requester.email ?? user.email ?? "",
          /* ⚠️ 印は同じ判定から出す */
          viaOps: target.viaOps,
        })
      )
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  console.info(`[join-request] sent=${sent}/${recipients.length} for company=${company.id}`);

  /* ★依頼したという事実を残す（2026-09-04）。**メール送信の後に置く。**
     ⚠️ 記録に失敗しても 500 にしない。メールは既に出ているので、
        「届いているのに失敗と出る」ほうが害が大きい（関数の中でログは出す）。 */
  await recordJoinRequest(admin, { owUserId: requester.id, companyId, approved: false });

  return NextResponse.json({ success: true, notified: sent });
}
