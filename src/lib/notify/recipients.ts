import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_EMAIL } from "./templates";

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
 * ★③「運営（ADMIN_EMAIL）へのフォールバック」を 2026-08-23 に実装した（下記）。
 *   以下は当時の設計メモ。**判断の理由なので残す。**
 *
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
 *
 * ── 2026-08-23 に実装した。実測にもとづく判断 ──────────────────────────────
 *   掲載中79社のうち**77社が宛先0件**で、応募・面談・面談対応者の申請が
 *   誰にも届かない状態だった。
 *
 *   ⚠️ この関数は**通知の宛先**だけでなく、**応募CTA・面談CTAの出し分け**にも使われている
 *      （lib/jobs/application.ts / lib/company/casualMeeting.ts）。
 *      ③を足すと「宛先がある」＝常に真になるので、**それらのCTAも開く**。
 *      上のコメントが「面談と応募の両方が同時に開く」と書いているのはこの意味。
 *   ⚠️ 実装時点での実影響は**0社**（実測）:
 *        公開求人を持つ企業 1社 → 宛先あり（新しく開く求人 0件）
 *        accepting_casual_meetings=true 5社 → 全社が宛先あり（新しく開く 0社）
 *      **今後、宛先が無い企業に求人が載った時点で効き始める。** そこが本来の狙い。
 */
/**
 * 宛先と、**運営に回ったかどうか**。
 *
 * ⚠️★**この2つは必ず同じ判定から出す。** 送信側が「宛先が運営かどうか」を
 *    メールアドレスの中身から判定し直さないこと。片方だけ直ると**嘘の印**になる。
 */
export type CompanyNotifyTarget = { to: string[]; viaOps: boolean };

export async function getCompanyNotificationTarget(
  companyId: string,
  /** ログにどの経路から呼ばれたか出すためのラベル。例: "applications" */
  source: string,
): Promise<CompanyNotifyTarget> {
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
  if (overrides.length > 0) return { to: overrides, viaOps: false };

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

  if (fallback.length > 0) return { to: fallback, viaOps: false };

  // ── ③ 企業に宛先が無い → 運営へ ──────────────────────────────────────
  /* ⚠️ 空配列を返さない。返すと応募も面談も「受け取れない」判定になり、
        企業が担当者を登録するまで導線が閉じたままになる。 */
  console.info(
    `[notify-recipients:${source}] falling back to ops for company=${companyId}`
    + " (notification_emails is empty and no active admin)",
  );
  return { to: [ADMIN_EMAIL], viaOps: true };
}

/**
 * 宛先だけが要るとき用の薄いラッパー。
 *
 * ⚠️ **判定は `getCompanyNotificationTarget` の1本だけ。** ここに規則を書かない。
 *    印（viaOps）が要る送信経路は必ず `getCompanyNotificationTarget` を使うこと。
 */
export async function getCompanyNotificationRecipients(
  companyId: string,
  source: string,
): Promise<string[]> {
  return (await getCompanyNotificationTarget(companyId, source)).to;
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
 * ⚠️ 引けなかったとき（クエリ失敗）は「宛先なし」に倒す。誰も受け取れない申込を
 *    送らせるより害が小さい。**③のフォールバックは「引けたが0件」のときだけ効かせる。**
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
    if (overrides.length > 0 || hasAdmin.has(c.id as string)) {
      withRecipient.add(c.id as string);
    } else {
      /* ★③ 運営フォールバック（2026-08-23）。企業に宛先が無くても運営が受け取るので
            「宛先あり」に数える。**単体版（getCompanyNotificationTarget）と同じ結論**にすること。
         ⚠️ ここを揃えないと、一覧では応募CTAが出ないのに詳細では出る（またはその逆）になる。
            この関数は一覧用の別実装なので、③を片方だけに入れると必ずズレる。 */
      withRecipient.add(c.id as string);
    }
  }
  return withRecipient;
}
