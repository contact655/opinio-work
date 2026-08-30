import type { CompanyEmployee, CompanyTool } from "@/lib/supabase/queries";

/**
 * プレビュー用の固定データ（2026-08-30）。
 *
 * ⚠️★**DB を読まない。** この配下が DB を触ると、本番データを本番の外へ出す経路になる。
 * ⚠️★**境界値を必ず含めること。** 「それらしい1件」を並べても不具合は出ない。
 *    見つかるのは 0件 / 1件 / 上限ちょうど / 上限+1 / 極端に長い文字列 のところ。
 * ⚠️ 実在の個人名・企業名を使わない。**本番の値をコピーしてこない。**
 */

/* ── 福利厚生 ────────────────────────────────────────────────────────────────
   ⚠️ カテゴリは5つ + その他。`BENEFIT_CATEGORY_LIMIT = 3` なので、
      4カテゴリ目から「すべて見る」が挟まる。**そこが境界。** */
export const BENEFITS_WORKSTYLE_ONLY = ["フルフレックス制度", "リモートワーク可（ハイブリッド）"];

export const BENEFITS_THREE_CATS = [
  "フルフレックス制度",
  "リモートワーク可（ハイブリッド）",
  "確定拠出年金（401k相当）",
  "RSU（譲渡制限付き株式）",
  "書籍・学習費用補助",
];

/** 6カテゴリすべて（その他を含む）。「すべて見る（残り 3）」が出る */
export const BENEFITS_ALL_CATS = [
  ...BENEFITS_THREE_CATS,
  "育児・介護休暇制度",
  "各種社会保険完備",
  "社内コミュニティ活動",
];

/** ⚠️ 色の役割の確認用。緑になってよいのは株式報酬と年金だけ */
export const BENEFITS_MONEY_EDGE = [
  "確定拠出年金", "退職金制度", "ストックオプション", "RSU（譲渡制限付き株式）", "従業員持株会",
  "SO付与", "SOMPO健康保険組合", "SODEXO食事補助",
  "住宅手当（月2万円）", "引越し祝い金10万円", "社員紹介手当",
];

/** ⚠️ 極端に長い1件。折り返しとカード高さの確認 */
export const BENEFITS_LONG = [
  "リモートワーク可（週2日までの出社を基本とし、チームの合意があればフルリモートも選択できる制度）",
  "書籍・学習費用補助（年間20万円まで、技術書・オンライン講座・カンファレンス参加費に利用可）",
  "フルフレックス制度",
];

/** ⚠️ 20件。カテゴリ内が増えたときにグリッドが縦に伸びるだけかを見る */
export const BENEFITS_MANY = [
  ...BENEFITS_ALL_CATS,
  "時差出勤制度", "副業・兼業可", "在宅勤務手当", "健康診断（人間ドック補助）",
  "社食・ランチ補助", "資格取得支援", "勉強会費用補助", "セミナー参加費補助",
  "産休・育休（男性取得実績あり）", "介護休暇", "ボランティア休暇（年7日）", "ウェルネス費用補助",
];

/* ── 社員 / OB・OG ──────────────────────────────────────────────────────────
   ⚠️ `visibility` は "public" | "login_only"。プレビューは表示確認なので public 固定。 */
const GRADIENTS = [
  "linear-gradient(135deg,#002366,#3B5FA8)",
  "linear-gradient(135deg,#0F766E,#14B8A6)",
  "linear-gradient(135deg,#7C2D12,#EA8C3F)",
  "linear-gradient(135deg,#334155,#64748B)",
];

/* ⚠️★**`userId` の先頭文字を散らすこと。**
      求人詳細のアバター色は `userId.charCodeAt(0) % 5` で決まるので、
      全部同じ文字で始めると**37枚すべて同じ色**になり、色の散り方を確認できない。
      2026-08-30 に実際にそうなった（全部 `preview-` 始まりで、37枚とも紫）。
   ⚠️ 実データは UUID なので先頭は 0-9a-f。それに合わせる。 */
const HEX = "0123456789abcdef";

function emp(i: number, over: Partial<CompanyEmployee> = {}): CompanyEmployee {
  const name = `検証 太郎${i}`;
  return {
    userId: `${HEX[i % HEX.length]}-preview-user-${i}`,
    name,
    avatarInitial: "検",
    avatarGradient: GRADIENTS[i % GRADIENTS.length],
    avatarUrl: null,
    roleTitle: "エンタープライズ営業部 / アカウントエグゼクティブ",
    startedAt: "2021-04",
    endedAt: null,
    roleCategoryId: "preview-role",
    roleCategoryIds: ["preview-role"],
    roleCategoryName: "エンタープライズセールス",
    roleParentId: "preview-parent",
    roleParentName: "営業",
    currentRoleTitle: null,
    currentCompanyName: null,
    currentCompanyBrandName: null,
    catchphrase: null,
    visibility: "public",
    ...over,
  };
}

export const EMPLOYEES_1 = [emp(1)];
export const EMPLOYEES_3 = [emp(1), emp(2), emp(3)];
/** ⚠️ 12名。3列グリッドが縦に伸びるだけか、折り返しが崩れないか */
export const EMPLOYEES_12 = Array.from({ length: 12 }, (_, i) => emp(i + 1));

/** ⚠️ 退職者。`endedAt` と「退職後の現在のキャリア」が入る */
export const ALUMNI_3: CompanyEmployee[] = [
  emp(21, {
    endedAt: "2024-03",
    currentRoleTitle: "VP of Sales",
    currentCompanyName: "検証テック株式会社",
    currentCompanyBrandName: "検証テック",
  }),
  emp(22, { endedAt: "2023-09", currentRoleTitle: null, currentCompanyName: null }),
  /* ⚠️ 極端に長い値。1行に収まらないときの見え方 */
  emp(23, {
    name: "検証 とても名前の長い人物",
    endedAt: "2022-12",
    roleTitle: "エンタープライズコーポレートセールス本部 / フィールドセールス（アカウントエグゼクティブ）",
    currentRoleTitle: "Senior Director, Global Enterprise Sales Strategy & Operations",
    currentCompanyName: "検証グローバルソリューションズ株式会社",
    currentCompanyBrandName: "検証グローバルソリューションズ",
  }),
];

export const ALUMNI_12 = Array.from({ length: 12 }, (_, i) =>
  emp(i + 40, { endedAt: "2024-01", currentRoleTitle: "セールスマネージャー", currentCompanyName: `検証${i + 1}株式会社` }),
);

/* ── ツール ────────────────────────────────────────────────────────────────
   ⚠️ カテゴリは DB の10種。表示は5グループに束ねられる。 */
function tool(i: number, name: string, category: string, note: string | null = null): CompanyTool {
  return { id: `preview-tool-${i}`, tool_id: `t${i}`, note, sort_order: i, name, category, master_sort_order: i };
}

export const TOOLS_1 = [tool(1, "Salesforce", "crm")];

export const TOOLS_5_GROUPS = [
  tool(1, "Salesforce", "crm"),
  tool(2, "HubSpot", "marketing"),
  tool(3, "Slack", "communication"),
  tool(4, "Notion", "documentation"),
  tool(5, "GitHub", "development"),
  tool(6, "Snowflake", "data"),
  tool(7, "ChatGPT", "ai"),
  tool(8, "Figma", "design"),
];

/** ⚠️ 30件。グループ内が増えたときの見え方 */
export const TOOLS_MANY = Array.from({ length: 30 }, (_, i) =>
  tool(i + 1, `検証ツール${i + 1}`, ["crm", "marketing", "communication", "development", "data", "ai"][i % 6]),
);
