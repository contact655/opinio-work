import type { CompanyEmployee, CompanyTool } from "@/lib/supabase/queries";
import type { CompanyDetail } from "@/app/companies/[id]/mockDetailData";

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

/* ── 導入事例 ──────────────────────────────────────────────────────────────
   ⚠️★境界は CLAUDE.md「`customer_cases` の書き方」に実測で書いてある。
      ・**初期表示は3件。4件目から折りたたみが挟まる**（`INITIAL_CASES = 3`）
      ・`usecase` は **100字まで**カード高さが 159px で一定。超えると1行ずつ伸びる
      ・`result` は **60字以内**が目安
      ・`products` は **3つまで**。4つ目からヘッダー行に乗らず独立行になり、
        カードが**約37px 高くなる**
   ⚠️★**`products` キーは必須。** 描画が `c.products.map(...)` なので、
      空配列は安全だが**キーごと省くと `undefined.map` で落ちる。** */
type PreviewCase = { name: string; industry: string; products: string[]; usecase: string; result: string };

function kase(over: Partial<PreviewCase> = {}): PreviewCase {
  return {
    name: "検証製造株式会社",
    industry: "製造",
    products: ["検証CRM", "検証BI"],
    usecase: "全国12拠点の営業情報が拠点ごとに分断されており、案件の進捗を本社が把握できなかった。",
    result: "案件の可視化により受注率が18%改善。報告工数は月40時間削減。",
    ...over,
  };
}

export const CASES_1 = [kase()];

/** ⚠️ 上限ちょうど。折りたたみは出ないはず */
export const CASES_3 = [
  kase(),
  kase({ name: "検証フィナンシャル株式会社", industry: "金融", products: ["検証CRM"] }),
  kase({ name: "検証リテール株式会社", industry: "小売", products: ["検証CRM", "検証BI", "検証MA"] }),
];

/** ⚠️★境界。4件目から「すべての導入事例を見る」が挟まり、フェードで最後が隠れる */
export const CASES_4 = [...CASES_3, kase({ name: "検証ロジスティクス株式会社", industry: "物流" })];

export const CASES_8 = [
  ...CASES_4,
  kase({ name: "検証ヘルスケア株式会社", industry: "医療" }),
  kase({ name: "検証エナジー株式会社", industry: "エネルギー" }),
  kase({ name: "検証エデュケーション株式会社", industry: "教育" }),
  kase({ name: "検証トラベル株式会社", industry: "旅行" }),
];

/** ⚠️ 崩れの確認用。products 4つ / 長い usecase / 空配列 を1枚ずつ */
export const CASES_EDGE = [
  kase({
    name: "検証プロダクツ4つ株式会社",
    products: ["検証CRM", "検証BI", "検証MA", "検証SFA"],
    result: "⚠️ products が4つ。ヘッダー行に乗らず独立行になり、カードが約37px 高くなる",
  }),
  kase({
    name: "検証ロングユースケース株式会社",
    usecase: "全国12拠点の営業情報が拠点ごとに分断され、案件の進捗を本社が把握できなかった。加えて見積の承認が紙とメールで行われており、決裁までに平均5営業日かかっていた。監査対応のたびに過去の承認履歴を人手で集める必要もあり、四半期ごとに延べ80時間を費やしていた。",
    result: "⚠️ usecase が100字超。カードが縦に伸びるだけで崩れないかを見る",
  }),
  kase({
    name: "検証プロダクツなし株式会社",
    result: "⚠️ products が空配列。ピルの行ごと出ないこと（キー自体を省くと落ちる）",
  }),
];

/* ── 組織体制 ──────────────────────────────────────────────────────────────
   ⚠️ 実データは **Salesforce 1社（23チーム / 8部門）だけ**。0件・1件・部門なしを踏めない。
   ⚠️ `division` は任意。**無い場合の束ね方**が確認したい形のひとつ。 */
type PreviewTeam = { name: string; en_name: string; division?: string; mission: string; description: string; roles: string[] };

function team(over: Partial<PreviewTeam> = {}): PreviewTeam {
  return {
    name: "エンタープライズ営業",
    en_name: "Enterprise Sales",
    division: "営業",
    mission: "大企業のDXを、現場の合意から動かす。",
    description: "従業員1,000名以上の企業を担当し、経営層と現場の双方に入り込んで導入を進めるチーム。",
    roles: ["アカウントエグゼクティブ", "セールスエンジニア"],
    ...over,
  };
}

export const TEAMS_1 = [team()];

/** ⚠️ 部門が1つだけ。束ねる意味が出るか */
export const TEAMS_ONE_DIVISION = [
  team(),
  team({ name: "インサイドセールス", en_name: "Inside Sales", roles: ["SDR", "BDR"] }),
  team({ name: "パートナー営業", en_name: "Partner Sales", roles: ["アライアンス"] }),
];

/** ⚠️ 部門が5つ。畳まれ方と「すべて見る」の境界 */
export const TEAMS_5_DIVISIONS = [
  ...TEAMS_ONE_DIVISION,
  team({ division: "エンジニア", name: "プラットフォーム", en_name: "Platform", roles: ["バックエンド", "SRE"] }),
  team({ division: "エンジニア", name: "フロントエンド", en_name: "Frontend", roles: ["フロントエンド"] }),
  team({ division: "マーケティング", name: "デマンドジェネレーション", en_name: "Demand Gen", roles: ["マーケター"] }),
  team({ division: "カスタマーサクセス", name: "オンボーディング", en_name: "Onboarding", roles: ["CSM"] }),
  team({ division: "コーポレート", name: "人事", en_name: "People", roles: ["人事", "採用"] }),
];

/** ⚠️★`division` が無いチーム。**未設定のときにどこへ入るか**（消えないこと） */
export const TEAMS_NO_DIVISION = [
  team({ division: undefined }),
  team({ division: undefined, name: "データ基盤", en_name: "Data Platform", roles: ["データエンジニア"] }),
  team({ division: "営業", name: "フィールドセールス", en_name: "Field Sales", roles: ["AE"] }),
];

/** ⚠️ 極端に長い値と、roles が空・多いケース */
export const TEAMS_EDGE = [
  team({
    name: "エンタープライズコーポレートセールス本部 第一営業部",
    en_name: "Enterprise Corporate Sales Division, First Sales Department",
    mission: "業種を越えた大規模アカウントに対し、複数プロダクトを横断した提案で経営課題の解決まで伴走する。",
    description: "従業員5,000名以上のアカウントを担当。営業・SE・カスタマーサクセスが同じチームとして動き、導入後の定着まで一貫して責任を持つ。四半期ごとに担当アカウントの経営層とレビューを行う。",
    roles: ["アカウントエグゼクティブ", "セールスエンジニア", "カスタマーサクセスマネージャー", "インサイドセールス", "パートナーアライアンス"],
  }),
  team({ name: "ロール未設定チーム", en_name: "No Roles", roles: [] }),
];

/** ⚠️ 23チーム。Salesforce の実データと同じ規模 */
export const TEAMS_23 = Array.from({ length: 23 }, (_, i) =>
  team({
    division: ["営業", "エンジニア", "マーケティング", "カスタマーサクセス", "コーポレート", "プロダクト", "データ", "人事"][i % 8],
    name: `検証チーム${i + 1}`,
    en_name: `Preview Team ${i + 1}`,
    roles: ["ロールA", "ロールB"],
  }),
);

/**
 * `CompanyDetail` を要求する部品（`OrgTeamsSectionClient` など）に渡す最小の値。
 *
 * ⚠️ この型は**必須39項目**あるが、部品が実際に読むのは一部だけ。
 *    全部を「それらしく」埋めると、どれが効いているのか分からなくなる。
 *    **見たい項目だけを `over` で渡し、残りは空にする。**
 *
 * ⚠️ 実在の企業名を使わないこと。`mockDetailData` の LAYERX 等は流用しない。
 */
export function detailWith(over: Partial<CompanyDetail>): CompanyDetail {
  return {
    id: "preview-company",
    mission: "",
    about: "",
    established: null,
    ceo: null,
    hq: null,
    url: "",
    company_features: [],
    freshness: [],
    jobs: [],
    current: [],
    alumni: [],
    interviews: [],
    articles: [],
    related: [],
    mentor_avatars: [],
    mentor_current: 0,
    mentor_alumni: 0,
    numbers: {} as CompanyDetail["numbers"],
    nearestStation: null,
    workTimeSystem: null,
    workstyleDescription: null,
    benefits: null,
    evaluationSystem: null,
    fit_positives: null,
    fit_negatives: null,
    why_join: null,
    numbersUpdatedAt: null,
    orgTeams: null,
    ...over,
  };
}
