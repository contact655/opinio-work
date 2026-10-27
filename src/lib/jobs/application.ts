import { filterCompaniesWithRespondingStaff, hasRespondingStaff } from "@/lib/companies/respondingStaff";
import {
  getCompanyNotificationRecipients,
  filterCompaniesWithRecipients,
} from "@/lib/notify/recipients";

/**
 * 求人に「応募できる企業か」を判定する。
 *
 * ── なぜ必要か（2026-08-11）──────────────────────────────────────────────────
 * 応募の可否は求人の `status` だけで決めていた。だが status が published でも
 * **応募が届く先があるとは限らない**。実際、公開求人を持っていた7社のうち
 * 6社は `getCompanyNotificationRecipients()` が0件で、応募しても誰にも届かなかった。
 *
 * 面談（lib/company/casualMeeting.ts）で同じ形の穴を先に見つけており、
 * そちらは「フラグ true かつ宛先あり」に直した。応募には企業の意思を表すフラグが
 * 無いので、**宛先の有無だけ**で判定する。
 *
 * ⚠️ **表示と送信が同じ値を見ること。** 求人詳細の応募CTA・モバイル固定バー・
 *    一覧カード・応募ページ・POST /api/applications が、すべてこの判定を通る。
 *    A（面談）では画面を4箇所直したあとに API を直し忘れかけた。
 *    画面から消しても直叩きで送れる経路が残る。
 *
 * ⚠️ 宛先の規則は `getCompanyNotificationRecipients` が持つ。**ここに書かないこと。**
 *    将来「③運営（ADMIN_EMAIL）へのフォールバック」を足すときは
 *    lib/notify/recipients.ts の1箇所だけを直せば、面談と応募の両方が同時に開く。
 *
 * ⚠️ 求人の status はここでは見ない。掲載の可否と応募の可否は別の関心事で、
 *    status は呼び出し側（getJobById など）が既に絞っている。
 */
export async function isJobApplicationOpen(companyId: string): Promise<boolean> {
  if (!companyId) return false;
  /* ★★2026-10-27（柴さんの決定）: 担当者がいない企業への応募は受けない。名前・応募内容が企業に届くのは、
        本人が送った時点で担当者がいる場合だけ（「担当者が登録したら届く」はやめた。2026-10-17 の「受ける」を戻した）。
        判定は「答えられる担当者」（respondingStaff.ts。会社と is_test が一致する有効な担当者）。
     ⚠️ 受けないことも、その理由も画面に出さない（応募ページは会社ページへ戻す・API は一般的なエラー）。 */
  const [recipients, staff] = await Promise.all([
    getCompanyNotificationRecipients(companyId, "applications"),
    hasRespondingStaff(companyId),
  ]);
  return recipients.length > 0 && staff;
}

/**
 * 複数企業ぶんをまとめて判定する。`/jobs` の一覧のように N 件を一度に描くとき用。
 *
 * ⚠️ `isJobApplicationOpen` を N 回呼ばないこと。1社あたり2クエリ走る。
 */
export async function filterCompaniesAcceptingApplications(
  companyIds: string[],
): Promise<Set<string>> {
  /* ★2026-10-27: 答えられる担当者がいることも要る（isJobApplicationOpen と同じ規則） */
  const [withRecipients, withStaff] = await Promise.all([
    filterCompaniesWithRecipients(companyIds, "applications"),
    filterCompaniesWithRespondingStaff(companyIds),
  ]);
  return new Set(Array.from(withRecipients).filter((id) => withStaff?.has(id) === true));
}

/** 応募を受け付けていないときに画面へ出す文言。**理由や再開見込みは書かない**（把握していない） */
/* ★2026-10-27: 閉じる理由は「答えられる担当者がいない」だけ。⚠️ それが分かる書き方をしない（「まだ OPINIO で〜」とも書かない）。
      いまは API のエラーにだけ使う（画面は会社ページへ戻す） */
export const APPLICATION_CLOSED_MESSAGE = "この募集には応募できません。";
