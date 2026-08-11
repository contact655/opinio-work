import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCompanyNotificationRecipients,
  filterCompaniesWithRecipients,
} from "@/lib/notify/recipients";

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
 * ⚠️ 宛先の判定は `filterCompaniesWithRecipients` に委ねている。**ここに規則を書かないこと。**
 *    応募の可否（lib/jobs/application.ts）と同じ規則を見る必要があるため。
 */
export async function filterOpenCasualMeetingCompanies(
  companyIds: string[],
): Promise<Set<string>> {
  const open = new Set<string>();
  const ids = Array.from(new Set(companyIds.filter(Boolean)));
  if (ids.length === 0) return open;

  const admin = createAdminClient();
  const [{ data: companies, error }, withRecipient] = await Promise.all([
    admin.from("ow_companies").select("id, accepting_casual_meetings").in("id", ids),
    filterCompaniesWithRecipients(ids, "casual-meeting"),
  ]);

  /* ⚠️ 握り潰さない。引けなかったときは「開いている」ではなく「閉じている」に倒す。 */
  if (error) {
    console.error("[casual-meeting:batch] ow_companies", error.message);
    return open;
  }

  for (const c of companies ?? []) {
    if (c.accepting_casual_meetings === true && withRecipient.has(c.id as string)) {
      open.add(c.id as string);
    }
  }
  return open;
}
