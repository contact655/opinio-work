/**
 * `/mypage` のプロフィール本体に、1セクションあたり何行まで出すか（2026-08-17 / フェーズ3）。
 *
 * 超えたぶんは「すべて表示 →」で `/mypage/details/[section]` に送る。
 * 本体は**読むためのページ**、一覧ページは**1件ずつ触るためのページ**という分け方。
 *
 * ⚠️ **画面に直書きしないこと。** しきい値を表示側に書いて取り残した前例がある
 *    （`DISCLOSURE_MAX`）。
 *
 * ⚠️ 職歴と学歴だけ 4、他は 3。年表の行は縦に長い（会社ロゴ＋役割）ので、
 *    3件だと同じ会社の中でも切れてしまう。
 */
export const ROWS_ON_PROFILE = {
  experience: 4,
  education: 4,
  achievements: 3,
  awards: 3,
  /* 資格（2026-08-24）。⚠️ 行が短い（名称＋発行団体＋発行日＋番号）ので受賞と同じ3。 */
  certifications: 3,
  media: 3,
  content: 3,
} as const;

/** `/mypage/details/[section]` が受け付けるセクション */
export type ProfileSectionKey = keyof typeof ROWS_ON_PROFILE;
