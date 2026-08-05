import { getCompanyNotificationRecipients } from "./recipients";

/**
 * 複数企業の通知先をまとめて解決する。
 *
 * ⚠️ 一覧画面で行ごとに getCompanyNotificationRecipients を呼ぶと N+1 になる。
 *    企業IDでユニーク化してから並列に引くこと。企業数は多くても数十なので
 *    Promise.all で十分（2026-08-05 時点で応募先は7社）。
 * ⚠️ 1社でも失敗したら全体を止める、はしない。解決できなかった企業は空配列になり、
 *    画面では「宛先なし」と同じ扱いになる（getCompanyNotificationRecipients が
 *    内部でエラーをログに出したうえで空配列を返す）。
 */
export async function getRecipientsForCompanies(
  companyIds: (string | null | undefined)[],
  source: string,
): Promise<Map<string, string[]>> {
  const unique = Array.from(new Set(companyIds.filter(Boolean) as string[]));
  const pairs = await Promise.all(
    unique.map(async (id) => [id, await getCompanyNotificationRecipients(id, source)] as const),
  );
  return new Map(pairs);
}
