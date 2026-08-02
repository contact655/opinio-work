import type { LPMember } from "./LandingPage";

/**
 * LP 表示専用メンバー。本人のアカウント（ow_users）は存在しない。
 *
 * ow_users に登録しない理由:
 *   ow_users は「アカウント」のテーブルで email が NOT NULL + UNIQUE。
 *   運営が本人の実アドレスで行を作ると、本人が後からサインアップしたときに
 *   trigger handle_new_ow_user() の ON CONFLICT DO NOTHING で INSERT が握り潰され、
 *   auth_id が紐づかないまま認証だけ通る（= ow_users 行なしでログイン状態）。
 *   引き継ぎ経路は現状 POST /api/biz/companies にしか無く、求職者導線には無い。
 *   また掲載同意は「表示してよい」であって「アカウントを作ってよい」ではない。
 *
 * ⚠️ この2名は FV の「いま話を聞ける現役社員」枠には出さない。
 *    あの枠は can_casual_meeting = true の人だけ（掲載 ≠ 面談可）。
 *    掲載のみの人をどこに出すかは検討中。決まるまでこのデータは未使用。
 */
export const LP_GUEST_MEMBERS: LPMember[] = [
  {
    id: "guest-kanazawa",
    name: "金澤 啓太郎",
    avatarColor: null,
    photoUrl: "/images/people/kanazawa.png",
    roleTitle: null, // 役職は未確認
    companyName: "株式会社KOSKA",
    careerFlow: null,
    quote: "製造業向けSaaSの法人営業",
  },
  {
    id: "guest-yamazaki",
    name: "山崎 華奈",
    avatarColor: null,
    photoUrl: "/images/people/yamazaki.png",
    roleTitle: null, // 役職は未確認
    companyName: "Sansan株式会社",
    careerFlow: null,
    quote: "営業DXの大企業向けの法人営業",
  },
];
