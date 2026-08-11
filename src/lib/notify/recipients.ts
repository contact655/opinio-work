import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 企業に届ける通知の宛先を解決する。**企業宛のメールは必ずここを通すこと。**
 *
 * ── なぜ共通化したか（2026-08-05）──────────────────────────────────────────
 * 宛先の取り方が経路ごとに3通りに割れていた。
 *   応募          : どこにも送っていなかった（企業に届かない）
 *   面談・参加申請: ow_company_admins → ow_users.email
 *   スカウト返信  : ow_users.notify_email —— **存在しないカラム**。
 *                   クエリがエラーになり誰にも届いていなかった（error を捨てていたため無言）
 * 経路を足すたびに同じ分岐が増え、届く経路と届かない経路が混ざる状態だったので1本にした。
 *
 * ── 解決順 ────────────────────────────────────────────────────────────────
 *   ① ow_companies.notification_emails に有効なアドレスがあれば、それだけを使う
 *   ② 無ければ ow_company_admins（permission='admin' かつ is_active=true）の
 *      ow_users.email
 *   ③ どちらも無ければ空配列（送らない。エラーにはしない）
 *
 * ⚠️ notification_emails は「既定の宛先の**上書き**」であって「追加」ではない。
 *    企業が明示的に宛先を指定したなら、そこだけに送るのが企業の意図に近い。
 *    ②に足し込むと、企業が外したはずの担当者にも届き続けることになる。
 *
 * ⚠️ 2026-08-05 時点で notification_emails は全85社 null。実際に効いているのは
 *    ②のフォールバックだけ。①が使われ始めるのは企業が /biz/company で設定してから。
 *
 * ⚠️ ow_users.email を読むので service role が要る（RLS 越しには引けない）。
 *    呼び出し側のクライアントに依存しないよう、内部で admin クライアントを作る。
 *
 * ⚠️ best-effort。失敗しても空配列を返し、呼び出し元の処理は止めない。
 *    ただしエラーは必ずログに出す（握り潰さない）。
 */
/*
 * ⚠️ **将来 ③「運営（ADMIN_EMAIL）へのフォールバック」を足すならここ。**
 *    Opinio は有料職業紹介事業者なので、企業担当者が /biz に来ていない企業の
 *    応募・面談を運営が受けて取り次ぐのが本来の形。企業開拓が進むと
 *    「求人はあるが担当者は未登録」の企業が増えるため、そのたびに掲載を
 *    下ろす設計にはできない。
 *
 *    ⚠️ **足す場所をここ1箇所に保つこと。** 面談の可否（lib/company/casualMeeting.ts）も
 *    応募の可否（lib/jobs/application.ts）も、宛先の有無をこの関数だけで判断している。
 *    ここに③を足せば両方が同時に開く。呼び出し側に個別のフォールバックを書かない。
 *
 *    2026-08-11 時点では**実装しない**（足すかどうかは別途判断）。
 */
export async function getCompanyNotificationRecipients(
  companyId: string,
  /** ログにどの経路から呼ばれたか出すためのラベル。例: "applications" */
  source: string,
): Promise<string[]> {
  const admin = createAdminClient();

  // ── ① 企業が指定した宛先（上書き）────────────────────────────────────
  const { data: company, error: companyErr } = await admin
    .from("ow_companies")
    .select("notification_emails")
    .eq("id", companyId)
    .maybeSingle();

  if (companyErr) {
    console.error(`[notify-recipients:${source}] ow_companies`, companyErr.message);
  }

  const overrides = normalizeEmails(company?.notification_emails);
  if (overrides.length > 0) return overrides;

  // ── ② 既定の宛先: 企業の管理者 ────────────────────────────────────────
  const { data: admins, error: adminsErr } = await admin
    .from("ow_company_admins")
    .select("ow_users!user_id(email)")
    .eq("company_id", companyId)
    .eq("permission", "admin")
    .eq("is_active", true)
    .not("user_id", "is", null);

  if (adminsErr) {
    console.error(`[notify-recipients:${source}] ow_company_admins`, adminsErr.message);
  }

  type Row = { ow_users: { email: string | null } | null };
  const fallback = normalizeEmails(
    ((admins ?? []) as unknown as Row[]).map((r) => r.ow_users?.email ?? null),
  );

  // ── ③ 宛先なし ────────────────────────────────────────────────────────
  if (fallback.length === 0) {
    console.info(
      `[notify-recipients:${source}] no recipient for company=${companyId}`
      + " (notification_emails is empty and no active admin)",
    );
  }
  return fallback;
}

/** 前後空白を落とし、@ を含むものだけ残し、重複を除く */
function normalizeEmails(input: unknown): string[] {
  const list = Array.isArray(input) ? input : [];
  return Array.from(
    new Set(
      list
        .map((e) => (typeof e === "string" ? e.trim() : ""))
        .filter((e) => e.includes("@")),
    ),
  );
}

/**
 * 複数企業ぶんの「宛先があるか」をまとめて返す。カード一覧のように N 社を一度に描くとき用。
 *
 * ⚠️ `getCompanyNotificationRecipients` を N 回呼ばないこと。1社あたり2クエリ走る。
 * ⚠️ 判定規則は上の関数と**同じ**（① notification_emails / ② permission='admin' かつ is_active）。
 *    片方だけ直さないこと。③のフォールバックを足すときも両方に効くようにする。
 * ⚠️ 引けなかったときは「宛先なし」に倒す。誰も受け取れない申込を送らせるより害が小さい。
 */
export async function filterCompaniesWithRecipients(
  companyIds: string[],
  source: string,
): Promise<Set<string>> {
  const withRecipient = new Set<string>();
  const ids = Array.from(new Set(companyIds.filter(Boolean)));
  if (ids.length === 0) return withRecipient;

  const admin = createAdminClient();

  const [{ data: companies, error: cErr }, { data: admins, error: aErr }] = await Promise.all([
    admin.from("ow_companies").select("id, notification_emails").in("id", ids),
    admin
      .from("ow_company_admins")
      .select("company_id, ow_users!user_id(email)")
      .in("company_id", ids)
      .eq("permission", "admin")
      .eq("is_active", true)
      .not("user_id", "is", null),
  ]);

  if (cErr) console.error(`[notify-recipients:${source}] ow_companies`, cErr.message);
  if (aErr) console.error(`[notify-recipients:${source}] ow_company_admins`, aErr.message);
  if (cErr || aErr) return withRecipient;

  type AdminRow = { company_id: string; ow_users: { email: string | null } | null };
  const hasAdmin = new Set(
    ((admins ?? []) as unknown as AdminRow[])
      .filter((r) => (r.ow_users?.email ?? "").includes("@"))
      .map((r) => r.company_id),
  );

  for (const c of companies ?? []) {
    const overrides = normalizeEmails(c.notification_emails);
    if (overrides.length > 0 || hasAdmin.has(c.id as string)) withRecipient.add(c.id as string);
  }
  return withRecipient;
}
