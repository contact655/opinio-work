// 職種マスタ定数 — オンボーディング / プロフィール編集 / 企業候補者フィルタの共通定義
// 保存値は日本語文字列そのまま（ID変換なし）

// ─── フェーズ制御フラグ ─────────────────────────────────────────────────────────
// フェーズ1: true（技術職を表示）/ フェーズ2: false（技術職を非表示）
// このフラグを false にするだけで、全画面から tech カテゴリが消える。
export const SHOW_TECH_ROLES = true;

export const JOB_TYPES = [
  // ── ビジネス ───────────────────────────────────────────
  "経営・CxO",
  "事業開発",
  "フィールドセールス",
  "SDR",
  "BDR",
  "インサイドセールス",   // legacy: SDR/BDR 追加前の登録値。既存DBデータを保護するため残す
  "カスタマーサクセス",
  "カスタマーサポート",
  "マーケティング",
  "プロダクトマーケティング",
  "コーポレート",
  // ── プロダクト・デザイン ─────────────────────────────────
  "プロダクトマネージャー",
  "デザイナー",
  "データサイエンティスト",
  // ── エンジニアリング ──────────────────────────────────────
  "エンジニア",           // legacy: カテゴリUIでは非表示。上位概念として残す
  "バックエンド",
  "フロントエンド",
  "フルスタック",
  "SRE/インフラ",
  "iOS/Android",
  // ── legacy / その他 ──────────────────────────────────────
  "事業開発・BizDev",     // legacy: "事業開発" に統合。既存DBデータ保護のため残す
  "HR・人事",
  "財務・経理",
  "その他",
] as const;

export type JobType = (typeof JOB_TYPES)[number];

// 表示ラベルのオーバーライド（DB保存値 → 画面表示用ラベル）
// JOB_TYPES は文字列配列のまま維持し、ラベルはここで吸収する。
// ProfileEditClient / CandidatesClient は JOB_TYPES を文字列配列として参照するため影響なし。
export const JOB_TYPE_DISPLAY_LABELS: Partial<Record<string, string>> = {
  "SDR": "SDR（新規開拓）",
  "BDR": "BDR（戦略的開拓）",
};

// オンボーディング P1 — 2段階UI用カテゴリ定義
// カテゴリ選択 → サブ職種選択の順でユーザーに提示する
//
// track: "business" = ビジネスサイド（Opinio Work の主役）
//        "tech"     = 技術職（フェーズ1では表示、フェーズ2で非表示予定）
//
// ⚠️ JOB_TYPES に存在するが categories.types に含めない値（3つ）:
//   - "エンジニア"       : バックエンド等の上位概念。カテゴリUIでは細分類を提示するため非表示
//   - "インサイドセールス": SDR/BDR に分割したため。既存DB値を守るため JOB_TYPES には残す
//   - "事業開発・BizDev" : "事業開発" に統合。既存DB値を守るため JOB_TYPES には残す
export const JOB_TYPE_CATEGORIES = [
  // ── ビジネスサイド（track: "business"）────────────────────────
  {
    key: "management",
    label: "経営・事業開発",
    emoji: "🏢",
    track: "business" as const,
    types: ["経営・CxO", "事業開発"] as const,
  },
  {
    key: "sales",
    label: "セールス・CS",
    emoji: "📞",
    track: "business" as const,
    types: ["フィールドセールス", "SDR", "BDR", "カスタマーサクセス", "カスタマーサポート"] as const,
  },
  {
    key: "marketing",
    label: "マーケ・コーポレート",
    emoji: "📊",
    track: "business" as const,
    types: ["マーケティング", "プロダクトマーケティング", "コーポレート", "HR・人事", "財務・経理"] as const,
  },
  {
    key: "other",
    label: "その他",
    emoji: "🔖",
    track: "business" as const,
    types: ["その他"] as const,
  },
  // ── 技術職（track: "tech"）フェーズ2で非表示予定 ───────────────
  {
    key: "product",
    label: "プロダクト・デザイン",
    emoji: "🎨",
    track: "tech" as const,
    types: ["プロダクトマネージャー", "デザイナー", "データサイエンティスト"] as const,
  },
  {
    key: "engineering",
    label: "ソフトウェアエンジニア",
    emoji: "💻",
    track: "tech" as const,
    types: ["バックエンド", "フロントエンド", "フルスタック"] as const,
  },
  {
    key: "infra",
    label: "インフラ",
    emoji: "🛠",
    track: "tech" as const,
    types: ["SRE/インフラ", "iOS/Android"] as const,
  },
];

export type JobTypeCategory = (typeof JOB_TYPE_CATEGORIES)[number]["key"];

// ─── フェーズ制御ヘルパー ──────────────────────────────────────────────────────

/** SHOW_TECH_ROLES に基づいてユーザーに見せるカテゴリ一覧を返す */
export function getVisibleCategories() {
  return SHOW_TECH_ROLES
    ? JOB_TYPE_CATEGORIES
    : JOB_TYPE_CATEGORIES.filter((c) => c.track === "business");
}

/** SHOW_TECH_ROLES に基づいてユーザーに見せる職種フラット配列を返す */
export function getVisibleJobTypes(): string[] {
  return getVisibleCategories().flatMap((c) => [...c.types]);
}

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
