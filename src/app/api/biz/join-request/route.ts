import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/notify/email";
import { joinRequestTemplate } from "@/lib/notify/templates";
import { getCompanyNotificationTarget } from "@/lib/notify/recipients";
/* ⚠️ 依頼は**メールを送るだけで、どこにも残っていなかった**（2026-09-04 に配線）。
      本人が画面を開き直すと、依頼した事実が消えていた。 */
import { recordJoinRequest } from "@/lib/business/joinRequests";

/**
 * POST /api/biz/join-request
 *
 * 既存企業への参加リクエスト。
 * - 管理者ゼロ（OPINIO側で先行登録済み）の場合 → 即時承認して admin に追加、auto_approved: true を返す
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

  // ── 管理者ゼロ = OPINIO側先行登録済み企業 → 即時承認 ──────────────────────
  if (adminList.length === 0) {
    const { error: insertError } = await admin
      .from("ow_company_admins")
      .insert({
        company_id: companyId,
        user_id: requester.id,
        permission: "admin",
        is_active: true,
        // ⚠️ 自動承認で作られた行だと分かるようにする。
        //    2026-08-05 に権限昇格の穴を直したあと「過去に誤承認された行が無いか」を
        //    調べたが、経路を記録していなかったため行の形からは判別できなかった。
        created_via: "join_request",
      });

    if (insertError) {
      console.error("[join-request] auto-approve failed", insertError);
      return NextResponse.json({ error: "自動承認に失敗しました。時間をおいて再度お試しください。" }, { status: 500 });
    }

    /*
      ⚠️ ここには `ow_user_roles` への upsert があったが、**一度も成功していなかった**
         ので消した（2026-08-23）。コメントは「biz dashboard のテナント解決に必要」と
         書いてあったが、事実と違う。

      壊れていた点が2つ:
        ① `role: "company_admin"` は CHECK 違反。
           `ow_user_roles_role_check` が許すのは candidate / company / admin の3つだけ
        ② `onConflict: "user_id,role,tenant_id"` に対応する一意制約が無い。
           実在するのは `UNIQUE (user_id, role)`

      しかも `await` の戻り値を捨てていたので、**エラーが出ても誰も気づけない**
      （CLAUDE.md「Supabase の呼び出しで error を捨てない」）。

      実測（2026-08-23 / 本番）: `ow_user_roles` は candidate 34 / admin 2 の計36行で、
      **`company_admin` も `company` も0行、`tenant_id` は全行 NULL。**

      ⚠️ **書き直す必要は無い。** 企業ロールは設計上 `ow_user_roles` に持たない
         （`lib/roles.ts`: 「company: ow_company_admins の is_active=true 行の存在で判定」）。
         テナント解決も `ow_company_admins` 経由で、**その行はすぐ上の INSERT で作っている。**
         `api/biz/companies/route.ts` のコメントも同じことを書いている。
    */
    /* ⚠️ 即時承認でも記録する。「いつ誰がどの経路で入ったか」を後から追えるようにする
          （`created_via: "join_request"` と同じ理由）。 */
    await recordJoinRequest(admin, { owUserId: requester.id, companyId, approved: true });

    console.info(`[join-request] auto-approved user=${requester.id} for company=${companyId}`);
    return NextResponse.json({ success: true, auto_approved: true });
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
