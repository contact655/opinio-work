/**
 * /jobs サイドバーの職種カテゴリを business / tech に振り分けるマップ。
 *
 * ── 2026-08-07 に jobTypes.ts から切り出した ────────────────────────────────
 * 元ファイルには2つの無関係なものが同居していた。
 *   ① JOB_TYPES / JOB_TYPE_CATEGORIES … 希望職種の**自由文字列**の分類（24値）
 *   ② ROLE_NAME_TRACK / getVisibleRoles … **ow_roles** の大分類の振り分け
 * ① は希望職種を ow_profile_desired_roles（ow_roles 参照）へ移したことで
 * 参照が0件になったので削除した。残ったのは ② だけなので、名前も実体に合わせた。
 *
 * ⚠️ ① を消したことで、`SDR` のラベル矛盾も一緒に解消した。
 *    JOB_TYPE_DISPLAY_LABELS は "SDR" を「SDR（新規開拓）」と表示していたが、
 *    職種マスタでは SDR = 反響・インバウンド、新規開拓 = BDR。
 *    **職種マスタ（ow_roles / ow_role_aliases）が正**。
 */

// ─── フェーズ制御フラグ ─────────────────────────────────────────────────────────
// フェーズ1: true（技術職を表示）/ フェーズ2: false（技術職を非表示）
// このフラグを false にするだけで、/jobs サイドバーから tech カテゴリが消える。
export const SHOW_TECH_ROLES = true;

// ─── /jobs サイドバー（DB-backed ow_roles）との対応 ─────────────────────────
//
// ow_roles.name（parent_id IS NULL の9件）と track の対応マップ。
// **ここに書けるのは ow_roles のトップレベル9件の名前だけ。**
// マップに無い名前はサイドバーから消える（getVisibleRoles のフィルタ条件）。
//
// 2026-08-03 修正:
//   旧実装は「インサイドセールス」「フィールドセールス」
//   「ソリューションエンジニア・プリセールス」「デザイナー」「その他」を
//   キーに持っていたが、これらは現在いずれもトップレベルではない（子・孫階層）。
//   一方でトップレベルの「営業」がマップに無かったため、
//   **published 18件中13件を占める営業がサイドバーから丸ごと消えていた。**
//   migration 106 当時の階層のまま更新されず、DB の再編に取り残された結果。
//
//   あわせて、プリセールス系（セールスエンジニア / ソリューションエンジニア /
//   ソリューションズアーキテクト）を tech ではなく営業配下として扱う方針が
//   確定したため、その受け皿である「営業」を business に置いた。
//   ow_roles の階層・ow_job_roles・このマップの3つを同じ判断に揃えるのが目的。
export const ROLE_NAME_TRACK: Record<string, "business" | "tech"> = {
  "経営・CxO":         "business",
  "事業開発":          "business",
  "営業":              "business", // 配下にプリセールス系を含む
  "カスタマーサクセス": "business",
  "マーケティング":     "business",
  "コーポレート":       "business",
  "プロダクト":         "tech",
  "エンジニア":         "tech",
  // 「データ・AI」は従来どおりサイドバー非表示（求人0件のため）。
  // 出す場合はここに "tech" で足すだけでよい。
};

/**
 * parentRoles（ow_roles 親カテゴリ）を business / tech に分類し返す。
 * ROLE_NAME_TRACK に存在しない名前はサイドバーから除外される。
 * SHOW_TECH_ROLES=false のとき tech は空配列になる。
 */
export function getVisibleRoles(roles: { id: string; name: string }[]): {
  business: { id: string; name: string }[];
  tech: { id: string; name: string }[];
} {
  const business = roles.filter((r) => ROLE_NAME_TRACK[r.name] === "business");
  const tech = SHOW_TECH_ROLES
    ? roles.filter((r) => ROLE_NAME_TRACK[r.name] === "tech")
    : [];
  return { business, tech };
}
