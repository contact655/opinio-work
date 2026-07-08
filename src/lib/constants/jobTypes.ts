// 職種マスタ定数 — オンボーディング / プロフィール編集 / 企業候補者フィルタの共通定義
// 保存値は日本語文字列そのまま（ID変換なし）

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
// ⚠️ JOB_TYPES に存在するが categories.types に含めない値（3つ）:
//   - "エンジニア"       : バックエンド等の上位概念。カテゴリUIでは細分類を提示するため非表示
//   - "インサイドセールス": SDR/BDR に分割したため。既存DB値を守るため JOB_TYPES には残す
//   - "事業開発・BizDev" : "事業開発" に統合。既存DB値を守るため JOB_TYPES には残す
export const JOB_TYPE_CATEGORIES = [
  {
    key: "management",
    label: "経営・事業開発",
    emoji: "🏢",
    types: ["経営・CxO", "事業開発"],
  },
  {
    key: "sales",
    label: "セールス・CS",
    emoji: "📞",
    types: ["フィールドセールス", "SDR", "BDR", "カスタマーサクセス", "カスタマーサポート"],
  },
  {
    key: "marketing",
    label: "マーケ・コーポレート",
    emoji: "📊",
    types: ["マーケティング", "プロダクトマーケティング", "コーポレート", "HR・人事", "財務・経理"],
  },
  {
    key: "product",
    label: "プロダクト・デザイン",
    emoji: "🎨",
    types: ["プロダクトマネージャー", "デザイナー", "データサイエンティスト"],
  },
  {
    key: "engineering",
    label: "ソフトウェアエンジニア",
    emoji: "💻",
    types: ["バックエンド", "フロントエンド", "フルスタック"],
  },
  {
    key: "infra",
    label: "インフラ",
    emoji: "🛠",
    types: ["SRE/インフラ", "iOS/Android"],
  },
  {
    key: "other",
    label: "その他",
    emoji: "🔖",
    types: ["その他"],
  },
] as const;

export type JobTypeCategory = (typeof JOB_TYPE_CATEGORIES)[number]["key"];
