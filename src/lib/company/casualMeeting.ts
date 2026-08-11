import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyNotificationRecipients } from "@/lib/notify/recipients";

/**
 * カジュアル面談を「申し込める企業か」を判定する。
 *
 * ── なぜフラグ単独で判定しないか（2026-08-11）────────────────────────────────
 * `ow_companies.accepting_casual_meetings` だけを見ていた結果、
 * **公開76社すべてが「面談受付中」と表示され、全社で申込フォームが送信可能**
 * だった。原因は archive/258 の
 *   `UPDATE ow_companies SET accepting_casual_meetings = true WHERE is_published = true`
 * で、その直前の archive/170（「この6社は面談を受け付けていないため false」）を
 * 理由もろとも打ち消していた。
 *
 * フラグはあくまで企業の「意思」。実際に**届く先があるか**は別の事実で、
 * 2026-08-11 時点で宛先を持つ公開企業は **76社中2社**（Opinio / セールスフォース・ジャパン）
 * しかなかった。意思だけで導線を開くと、誰も受け取らない申込を送らせることになる。
 *
 * ⚠️ **判定はここに一本化すること。** 表示（バッジ・CTA）と送信可否が別々の条件を
 *    見ていると必ずずれる。ずれた状態は「押せるのに送れない」か
 *    「送れるのに誰も見ていない」のどちらかになる。
 *
 * ⚠️ データ側（フラグ）も 20260811_casual_meeting_recipients_only で揃えたが、
 *    **コード側のこの判定を消さないこと。** 企業を1社足した瞬間に、
 *    フラグだけ true で宛先が無い状態がまた作れてしまう。
 *
 * ⚠️ 「現役社員に話を聞く」（ow_company_members 経由）は別の導線。ここでは判定しない。
 */
export async function isCasualMeetingOpen(
  companyId: string,
  acceptingFlag: boolean | null | undefined,
): Promise<boolean> {
  // 企業が受付を止めているなら、宛先の有無に関係なく閉じる
  if (acceptingFlag !== true) return false;

  const recipients = await getCompanyNotificationRecipients(companyId, "casual-meeting");
  return recipients.length > 0;
}

/**
 * 複数企業ぶんをまとめて判定する。カード一覧のように N 社を一度に描くとき用。
 *
 * ⚠️ `isCasualMeetingOpen` を N 回呼ばないこと。1社あたり2クエリ走る。
 * ⚠️ 宛先の定義（notification_emails があればそれ、無ければ permission='admin' かつ
 *    is_active の担当者）は `getCompanyNotificationRecipients` と揃えてある。
 *    **片方だけ直さないこと。** 定義を変えるなら両方を同時に変える。
 */
export async function filterOpenCasualMeetingCompanies(
  companyIds: string[],
): Promise<Set<string>> {
  const open = new Set<string>();
  const ids = Array.from(new Set(companyIds.filter(Boolean)));
  if (ids.length === 0) return open;

  const admin = createAdminClient();

  const [{ data: companies, error: cErr }, { data: admins, error: aErr }] = await Promise.all([
    admin
      .from("ow_companies")
      .select("id, accepting_casual_meetings, notification_emails")
      .in("id", ids),
    admin
      .from("ow_company_admins")
      .select("company_id, ow_users!user_id(email)")
      .in("company_id", ids)
      .eq("permission", "admin")
      .eq("is_active", true)
      .not("user_id", "is", null),
  ]);

  /* ⚠️ 握り潰さない。引けなかったときは「開いている」ではなく「閉じている」に倒す。
        誰も受け取れない申込を送らせるより、バッジが出ないほうが害が小さい。 */
  if (cErr) console.error("[casual-meeting:batch] ow_companies", cErr.message);
  if (aErr) console.error("[casual-meeting:batch] ow_company_admins", aErr.message);
  if (cErr || aErr) return open;

  type AdminRow = { company_id: string; ow_users: { email: string | null } | null };
  const hasAdmin = new Set(
    ((admins ?? []) as unknown as AdminRow[])
      .filter((r) => (r.ow_users?.email ?? "").includes("@"))
      .map((r) => r.company_id),
  );

  for (const c of companies ?? []) {
    if (c.accepting_casual_meetings !== true) continue;
    const overrides = (Array.isArray(c.notification_emails) ? c.notification_emails : [])
      .filter((e) => typeof e === "string" && e.includes("@"));
    if (overrides.length > 0 || hasAdmin.has(c.id as string)) open.add(c.id as string);
  }
  return open;
}
