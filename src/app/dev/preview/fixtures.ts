import type { CompanyEmployee, CompanyTool } from "@/lib/supabase/queries";
import type { CompanyDetail } from "@/app/companies/[id]/mockDetailData";
import type { Benefit } from "@/lib/companies/benefits";
import type { CompanyForCarousel } from "@/types/genre";
import type { Job } from "@/app/jobs/mockJobData";
import type { Company } from "@/app/companies/mockCompanies";
import type { CareerEntry, EducationEntry } from "@/components/profile/MergedTimeline";

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
/** 名前だけ（詳細なし）。**押せないカード**になるのが正しい */
const n = (name: string): Benefit => ({ name });

export const BENEFITS_WORKSTYLE_ONLY: Benefit[] = ["フルフレックス制度", "リモートワーク可（ハイブリッド）"].map(n);

export const BENEFITS_THREE_CATS: Benefit[] = [
  "フルフレックス制度",
  "リモートワーク可（ハイブリッド）",
  "確定拠出年金（401k相当）",
  "RSU（譲渡制限付き株式）",
  "書籍・学習費用補助",
].map(n);

/** 6カテゴリすべて（その他を含む）。「すべて見る（残り 3）」が出る */
export const BENEFITS_ALL_CATS: Benefit[] = [
  ...BENEFITS_THREE_CATS,
  ...["育児・介護休暇制度", "各種社会保険完備", "社内コミュニティ活動"].map(n),
];

/** ⚠️ 色の役割の確認用。緑になってよいのは株式報酬と年金だけ */
export const BENEFITS_MONEY_EDGE: Benefit[] = [
  "確定拠出年金", "退職金制度", "ストックオプション", "RSU（譲渡制限付き株式）", "従業員持株会",
  "SO付与", "SOMPO健康保険組合", "SODEXO食事補助",
  "住宅手当（月2万円）", "引越し祝い金10万円", "社員紹介手当",
].map(n);

/** ⚠️ 極端に長い1件。折り返しとカード高さの確認 */
export const BENEFITS_LONG: Benefit[] = [
  "リモートワーク可（週2日までの出社を基本とし、チームの合意があればフルリモートも選択できる制度）",
  "書籍・学習費用補助（年間20万円まで、技術書・オンライン講座・カンファレンス参加費に利用可）",
  "フルフレックス制度",
].map(n);

/** ⚠️ 20件。カテゴリ内が増えたときにグリッドが縦に伸びるだけかを見る */
export const BENEFITS_MANY: Benefit[] = [
  ...BENEFITS_ALL_CATS,
  ...["時差出勤制度", "副業・兼業可", "在宅勤務手当", "健康診断（人間ドック補助）",
      "社食・ランチ補助", "資格取得支援", "勉強会費用補助", "セミナー参加費補助",
      "産休・育休（男性取得実績あり）", "介護休暇", "ボランティア休暇（年7日）", "ウェルネス費用補助"].map(n),
];

/* ── ★詳細つき（2026-08-31 追加）────────────────────────────────────────────
   ⚠️ `detail` があるカードだけが**押せる**。無いカードは押せないのが正しい。
   ⚠️ ホバーとタップの両方で開く。**ホバーだけにしないこと**
      （スマホに届かない。`BenefitCard` のコメント参照）。
   ⚠️ 詳細の長さは実際に企業が書きそうな幅を入れる。カードと同じ幅で折り返すので、
      **長い詳細が縦にどれだけ伸びるか**をここで見る。 */
export const BENEFITS_WITH_DETAIL: Benefit[] = [
  { name: "書籍・学習費用補助", detail: "年間65万円（学習機関の指定あり）" },
  { name: "確定拠出年金（401k相当）", detail: "会社拠出は給与の5%。本人拠出との合算も可。" },
  { name: "フルフレックス制度" },                       // ← 詳細なし。押せない
  { name: "リモートワーク可（ハイブリッド）", detail: "週2〜3日の出社を基本としつつ、チームの合意があれば週1日まで減らせます。四半期に一度、全社出社日があります。" },
  { name: "各種社会保険完備" },                          // ← 詳細なし
];

/** ⚠️ 全件に詳細がある場合。「?」が並びすぎて煩くないか */
export const BENEFITS_ALL_DETAIL: Benefit[] = BENEFITS_THREE_CATS.map((b, i) => ({
  ...b, detail: `検証用の詳細${i + 1}。実際の運用条件をここに書きます。`,
}));

/* ── 社員 / OB・OG ──────────────────────────────────────────────────────────
   ⚠️ `visibility` は "public" | "login_only"。プレビューは表示確認なので public 固定。 */
/**
 * `ow_roles` の**実在する親カテゴリ UUID**（2026-08-31 に本番から取得）。
 *
 * ⚠️★**`lib/jobCategoryColors.ts` のキーを使わないこと。** あの表の7キーは
 *    「2026-05 時点の実値」とコメントされているが、**実データと1つも一致しない。**
 *    表のキーを使うと**本番では絶対に出ない色**をプレビューが見せることになる
 *    （2026-08-31 に実際にやった）。**プレビューは本番と同じ結果を出さないと意味が無い。**
 *
 * ⚠️ したがって現状、`resolveAvatarColor` は**全員フォールバック色**を返す。
 *    このプレビューでアバターが1色なのは**バグではなく本番どおり**。
 */
const PARENT_ROLE_IDS = [
  "c8140123-e29a-43b3-9dbf-1a3d21a68966", // エンジニア
  "168cd1ab-d096-46cc-ad7e-5baf7f10a0b1", // プロダクト
  "38429140-f784-44c0-8eec-407495044272", // マーケティング
  "6938712f-0b29-4682-ac6e-ad112734a3f1", // 営業
  "ad47e554-e328-4aec-abd1-dab9953ddf9d", // カスタマーサクセス
  "166bebdf-0c26-40df-9713-5f3b958cc96f", // 経営・CxO
];

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
    /* ⚠️★アバターの色は `resolveAvatarColor(roleParentId, roleCategoryId)` が
          **職種で**決める（2026-08-31 に企業ページと揃えた）。
          ⚠️ 全員を同じ職種にすると**色が1つしか出ず、散り方を確認できない。**
             実在の親カテゴリ UUID（`lib/jobCategoryColors.ts` の表のキー）を
             順番に当てて、7色すべてが出るようにする。 */
    roleCategoryId: null,
    roleCategoryIds: [],
    roleCategoryName: "エンタープライズセールス",
    roleParentId: PARENT_ROLE_IDS[i % PARENT_ROLE_IDS.length],
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

/* ── 主要製品 ──────────────────────────────────────────────────────────────
   ⚠️ 値は **`製品名（説明）`** の形で統一されている（全角括弧）。既存17社すべてこの形。
      ⚠️★**括弧を外さないこと。** 外すと説明文がそのまま製品名として1行に出る。
   ⚠️ 初期表示は **5件**（`PRODUCTS_LIMIT`）。6件目から「すべて見る」が挟まる。
   ⚠️ 900px 以上の列数は `Math.min(全件, 5)` の固定幅 183px。
      **2製品だと 374px しか埋まらず、右側が大きく空く**（CLAUDE.md / 2026-08-12 実測）。 */
export const PRODUCTS_1 = ["検証CRM（顧客管理クラウド）"];

/** ⚠️★境界。カードが2枚しか無く、右側が空くのが仕様どおりか見る */
export const PRODUCTS_2 = ["検証CRM（顧客管理クラウド）", "検証BI（データ可視化ツール）"];

/** ⚠️ 上限ちょうど。900px で1行に収まる */
export const PRODUCTS_5 = [
  "検証CRM（顧客管理クラウド）",
  "検証BI（データ可視化ツール）",
  "検証MA（マーケティングオートメーション）",
  "検証CS（カスタマーサクセス基盤）",
  "検証Chat（社内コミュニケーション）",
];

/** ⚠️★境界。6件目から「すべて見る（残り N）」が挟まる */
export const PRODUCTS_8 = [
  ...PRODUCTS_5,
  "検証Analytics（BIダッシュボード）",
  "検証Flow（業務自動化）",
  "検証Docs（文書管理）",
];

/** ⚠️ 括弧なし・極端に長い名前・説明が長いもの。1行に収まらないときの見え方 */
export const PRODUCTS_EDGE = [
  "括弧なし製品",
  "検証エンタープライズインテグレーションプラットフォーム（複数の基幹システムをAPIで接続し、データ連携を自動化する統合基盤）",
  "検証AI（生成AIによる要約・分類・提案を業務システムに組み込むためのアシスタント機能群）",
];

/** ⚠️ 主な顧客。`customer_cases` があると**表示されない**フォールバック構造 */
export const CUSTOMERS_7 = [
  "検証自動車株式会社", "検証銀行", "検証コミュニケーションズ",
  "検証リテール", "検証エナジー", "検証ロジスティクス", "検証メディア",
];

/* ── 企業カード（一覧） ───────────────────────────────────────────────────
   ⚠️ 実データは掲載79社あるが、**欠けのパターンが偏っている**。
      tagline は 78/79 社にあり、**空は1社だけ**。logo_url が NULL も2社だけ。
      「全部欠けている企業」「ロゴが横長の企業」を並べて見るのが目的。

   ⚠️★CLAUDE.md に記録された既知の論点:
      ・**375px は1列**なので行内に他のカードが無く、**tagline が空の1社だけ 19px 低い**
        （124px vs 143px）。1440px/1199px/768px では全カード 161px で一致
      ・ロゴの本当の問題は判読性より**不揃い**——白背景の正方形と色付きの横長バナーの混在
      ・`employee_count` が空だと以前は「**0名**」と出ていた（2ad7eb31 で解消）。
        **空のときに項目ごと消えるか**をここで確かめる */
function company(over: Partial<CompanyForCarousel> = {}): CompanyForCarousel {
  return {
    id: "preview-co-1",
    slug: "preview-co-1",
    name: "検証ソリューションズ株式会社",
    name_en: "Preview Solutions",
    tagline: "現場の合意から、企業のDXを動かす。",
    industry: null,
    funding_stage: null,
    employee_count: "約200名",
    description: "検証用の企業説明です。",
    accepting_casual_meetings: true,
    jobs_public: true,
    remote_work_status: "hybrid",
    location: "東京都",
    branch_locations: ["大阪", "名古屋"],
    logo_letter: "検",
    logo_gradient: "linear-gradient(135deg,#002366,#3B5FA8)",
    logo_url: null,
    updated_at: "2026-08-01T00:00:00Z",
    job_count: 3,
    current_member_count: 0,
    obog_count: 0,
    live_current_count: 4,
    live_obog_count: 2,
    article_count: 1,
    business_domains: [],
    founded_year: 2015,
    company_features: ["リモート可", "副業OK"],
    top_job_titles: ["エンタープライズ営業", "セールスエンジニア"],
    ...over,
  };
}

/** ⚠️★欠けのパターン。**空の項目が「0名」や「—」に化けないか**を1枚ずつ見る */
export const COMPANY_CARDS_MISSING: CompanyForCarousel[] = [
  company({ id: "c-full", name: "検証フル株式会社" }),
  company({ id: "c-no-tagline", name: "検証タグラインなし株式会社", tagline: null }),
  company({ id: "c-no-emp", name: "検証従業員数なし株式会社", employee_count: null }),
  company({ id: "c-no-loc", name: "検証所在地なし株式会社", location: null, branch_locations: null }),
  company({ id: "c-no-jobs", name: "検証求人0件株式会社", job_count: 0, top_job_titles: null }),
  /* ⚠️ 社名に「0名」を入れないこと。「0名」で grep したときに自分の名前が当たり、
        誤検知になる（2026-08-31 に実際にやった）。 */
  company({ id: "c-no-members", name: "検証メンバー未登録株式会社", live_current_count: 0, live_obog_count: 0 }),
  company({
    id: "c-empty", name: "検証すべて空株式会社",
    tagline: null, employee_count: null, location: null, branch_locations: null,
    job_count: 0, live_current_count: 0, live_obog_count: 0, article_count: 0,
    company_features: null, top_job_titles: null, founded_year: null, description: null,
  }),
];

/** ⚠️ 長い社名・長いタグライン・タグが多い。折り返しと省略の確認 */
export const COMPANY_CARDS_LONG: CompanyForCarousel[] = [
  company({
    id: "c-long-name",
    name: "検証エンタープライズソリューションホールディングス株式会社",
    name_en: "Preview Enterprise Solution Holdings Corporation",
    tagline: "業種を越えた大規模アカウントに対し、複数プロダクトを横断した提案で経営課題の解決まで伴走するチームをつくる。",
    company_features: ["リモート可", "副業OK", "フレックス", "書籍補助", "産育休実績あり", "ストックオプション"],
    top_job_titles: ["エンタープライズコーポレートセールス本部 アカウントエグゼクティブ", "ソリューションエンジニア"],
    branch_locations: ["大阪", "名古屋", "福岡", "札幌", "仙台", "京都", "徳島", "新潟"],
  }),
  company({ id: "c-short", name: "A社", name_en: null, tagline: "短い。", company_features: null }),
];

/** ⚠️ 件数が多いときの一覧。12件（1ページぶん） */
export const COMPANY_CARDS_12: CompanyForCarousel[] = Array.from({ length: 12 }, (_, i) =>
  company({
    id: `c-${i}`, slug: `c-${i}`,
    name: `検証${i + 1}株式会社`,
    tagline: i % 3 === 0 ? null : `検証${i + 1}のキャッチコピー。`,
    employee_count: ["約50名", "約200名", "1000名以上", null][i % 4],
    job_count: i % 4,
  }),
);

/* ── 求人カード（一覧） ───────────────────────────────────────────────────
   ⚠️ 公開求人は **2件だけ**（2026-08-30 実測）。しかも両方 Salesforce で
      年収もキャッチコピーも入っている。**欠けた形を実データで踏めない。**
   ⚠️ `JobListItem` が読むのは9項目だけ（id / slug / company_id / role /
      highlight / location / work_style / salary_min / salary_max）。
      それ以外は型を満たすためのダミーでよい。
   ⚠️★`employment_type` は **null を「正社員」に倒さない**（2026-08-07 の判断）。 */
function job(over: Partial<Job> = {}): Job {
  return {
    id: "preview-job-1",
    slug: "preview-job-1",
    company_id: "preview-co-1",
    role: "エンタープライズ営業（アカウントエグゼクティブ）",
    dept: "営業",
    employment_type: "正社員",
    location: "東京都",
    work_style: "ハイブリッド",
    salary_min: 900,
    salary_max: 1800,
    experience: "3年以上",
    tags: ["営業", "SaaS"],
    highlight: "現場の合意から、大企業のDXを動かす。",
    updated_days_ago: 3,
    is_new: false,
    urgency: "open",
    dept_members: 0,
    member_avatars: [],
    overview: "",
    main_tasks: [],
    required_skills: [],
    preferred_skills: [],
    benefits: [],
    selection_flow: [],
    selection_note: "",
    position_members: [],
    related_article_title: "",
    related_article_excerpt: "",
    ...over,
  };
}

/** ⚠️★欠けのパターン。**年収なしで「年収0万円〜」等に化けないこと** */
export const JOB_CARDS_MISSING: Job[] = [
  job({ id: "j-full", role: "検証フル求人" }),
  job({ id: "j-no-salary", role: "検証 年収なし", salary_min: 0, salary_max: 0 }),
  job({ id: "j-min-only", role: "検証 下限だけ", salary_min: 800, salary_max: 0 }),
  job({ id: "j-max-only", role: "検証 上限だけ", salary_min: 0, salary_max: 1200 }),
  job({ id: "j-no-highlight", role: "検証 キャッチコピーなし", highlight: "" }),
  job({ id: "j-no-location", role: "検証 勤務地なし", location: "", work_style: "" }),
  job({
    id: "j-empty", role: "検証 すべて空",
    highlight: "", location: "", work_style: "", salary_min: 0, salary_max: 0,
  }),
];

/** ⚠️ 長い職種名・長いキャッチコピー。折り返しと省略 */
export const JOB_CARDS_LONG: Job[] = [
  job({
    id: "j-long",
    role: "エンタープライズコーポレートセールス本部 第一営業部 アカウントエグゼクティブ（金融・通信担当）",
    highlight: "業種を越えた大規模アカウントに対し、複数プロダクトを横断した提案で経営課題の解決まで伴走する。導入後の定着まで一貫して責任を持つ。",
    location: "東京都 / 大阪府 / 愛知県 / 福岡県",
    salary_min: 12000, salary_max: 25000,
  }),
  job({ id: "j-short", role: "AE", highlight: "短い。", location: "東京" }),
];

/** ⚠️ 会社が見つからないとき（companyMap に無い） */
export const JOB_CARD_NO_COMPANY: Job[] = [
  job({ id: "j-orphan", role: "検証 会社情報なし", company_id: "does-not-exist" }),
];

/** `JobListItem` に渡す会社。⚠️ 実ページと同じく Map で渡す */
export const PREVIEW_COMPANY_MAP: Map<string, Company> = new Map([
  ["preview-co-1", {
    id: "preview-co-1",
    slug: "preview-co-1",
    name: "検証ソリューションズ株式会社",
    name_en: "Preview Solutions",
    logo_letter: "検",
    logo_gradient: "linear-gradient(135deg,#002366,#3B5FA8)",
    logo_url: null,
    phase: null,
  } as unknown as Company],
]);

/* ── 職歴タイムライン ───────────────────────────────────────────────────────
   ⚠️ 実データは **職歴のある実ユーザー4人 / 経歴24件**（2026-08-30 実測）。
      同社グループ・出戻り・並行職・長期ブランクを**まとめて持つ人がいない。**

   ⚠️★実装が記録している分岐（`MergedTimeline.tsx` のコメント）:
      ・`career`（単独）と **`career-same-company`（同社で連続する2件以上）** の**2経路**
      ・**出戻り**（連続しない同社）は自然に別グループになる（意図どおり）
      ・⚠️ **`career-group`（同一開始月の並行職を1枚にまとめる箱）は廃止済み。**
         箱に戻さないこと。並行は**言葉で示す**（`lib/profile/parallel.ts`）
      ・年マーカーは**新しい順**（2026-08-26 に「古い順に並んでいた」不具合を修正）

   ⚠️ `department` / `prefecture` は **SELECT に含めていない画面では undefined**。
      その画面で出ないのが正しいので、**両方のパターン**を入れてある。 */
function career(over: Partial<CareerEntry> = {}): CareerEntry {
  return {
    id: "pv-c1",
    company_id: "preview-co-1",
    company_name: "検証ソリューションズ株式会社",
    logo_url: null,
    logo_letter: "検",
    logo_gradient: "linear-gradient(135deg,#002366,#3B5FA8)",
    role_label: "エンタープライズセールス",
    role_parent_name: "営業",
    role_title: "アカウントエグゼクティブ",
    department: null,
    rank: null,
    prefecture: null,
    remote_work_status: null,
    started_at: "2021-04-01",
    ended_at: "2024-03-31",
    is_current: false,
    description: null,
    join_reason: null,
    employment_type: "正社員",
    ...over,
  };
}

/** ⚠️ 1件だけ。グループ化も年マーカーの複数行も起きない最小形 */
export const CAREERS_1: CareerEntry[] = [career({ id: "c1", is_current: true, ended_at: null })];

/** ⚠️★同社で連続する2件 → `career-same-company` にまとまるはず */
export const CAREERS_SAME_COMPANY: CareerEntry[] = [
  career({ id: "sc2", role_title: "シニアアカウントエグゼクティブ", rank: "manager",
           started_at: "2023-04-01", ended_at: null, is_current: true }),
  career({ id: "sc1", role_title: "アカウントエグゼクティブ",
           started_at: "2021-04-01", ended_at: "2023-03-31" }),
];

/** ⚠️★出戻り。同じ会社だが**連続しない**ので、別グループになるのが正しい */
export const CAREERS_BOOMERANG: CareerEntry[] = [
  career({ id: "b3", company_name: "検証ソリューションズ株式会社", role_title: "営業部長",
           rank: "director", started_at: "2024-04-01", ended_at: null, is_current: true }),
  career({ id: "b2", company_id: "other-co", company_name: "検証テック株式会社",
           role_label: "フィールドセールス", role_title: "AE",
           started_at: "2022-04-01", ended_at: "2024-03-31" }),
  career({ id: "b1", role_title: "アカウントエグゼクティブ",
           started_at: "2019-04-01", ended_at: "2022-03-31" }),
];

/** ⚠️★並行職（開始月が同じ2件）。**箱にまとめず、言葉で示す**のが現在の仕様 */
export const CAREERS_PARALLEL: CareerEntry[] = [
  career({ id: "p1", started_at: "2022-04-01", ended_at: null, is_current: true }),
  career({ id: "p2", company_id: "side-co", company_name: "検証スタジオ合同会社",
           role_label: "プロダクトマネージャー", role_parent_name: "プロダクト",
           role_title: "PdM（副業）", employment_type: "業務委託",
           started_at: "2022-04-01", ended_at: null, is_current: true }),
];

/** ⚠️★長期ブランク（3年空き）。年マーカーが飛ぶときの見え方 */
export const CAREERS_GAP: CareerEntry[] = [
  career({ id: "g2", company_id: "other-co", company_name: "検証テック株式会社",
           started_at: "2023-04-01", ended_at: null, is_current: true }),
  career({ id: "g1", started_at: "2016-04-01", ended_at: "2020-03-31" }),
];

/** ⚠️ 自由入力の会社（`company_id` が null）。**ロゴが無く、リンクも張られない** */
export const CAREERS_CUSTOM: CareerEntry[] = [
  career({ id: "cu1", company_id: null, company_name: "検証フリー株式会社",
           logo_letter: null, logo_gradient: null, is_current: true, ended_at: null }),
  career({ id: "cu2", company_id: null, company_name: "非公開",
           logo_letter: null, logo_gradient: null,
           started_at: "2018-04-01", ended_at: "2021-03-31" }),
];

/** ⚠️ 項目が埋まっているとき（部署・勤務地・勤務形態・入社理由・説明） */
export const CAREERS_RICH: CareerEntry[] = [
  career({
    id: "r1", is_current: true, ended_at: null,
    department: "エンタープライズコーポレートセールス本部・Solution Sales 1G",
    prefecture: "東京都", remote_work_status: "hybrid", rank: "manager",
    join_reason: "現場に入り込んで意思決定まで伴走する営業の型を、事業会社側で作りたかった。",
    description: "従業員1,000名以上のアカウントを担当。経営層と現場の双方に入り込み、導入から定着まで一貫して responsibility を持つ。四半期ごとに担当アカウントの経営層とレビューを実施。",
  }),
];

/** ⚠️ 8件。折りたたみ（`collapseAfter`）の境界 */
export const CAREERS_8: CareerEntry[] = Array.from({ length: 8 }, (_, i) =>
  career({
    id: `m${i}`,
    company_id: `co-${i}`,
    company_name: `検証${i + 1}株式会社`,
    started_at: `${2010 + i * 2}-04-01`,
    ended_at: i === 7 ? null : `${2012 + i * 2}-03-31`,
    is_current: i === 7,
  }),
);

/** 学歴。⚠️ `enrolled_at` が無い学歴は 2026-08 に「公開プロフィールから消えていた」前例がある */
export const EDUCATIONS_2: EducationEntry[] = [
  { id: "e1", school: "検証大学", school_id: null, school_master: null,
    faculty: "経済学部", degree: "bachelor",
    enrolled_at: "2012-04-01", graduated_at: "2016-03-31", is_current: false },
  { id: "e2", school: "検証高等学校", school_id: null, school_master: null,
    faculty: null, degree: "high_school",
    enrolled_at: "2009-04-01", graduated_at: "2012-03-31", is_current: false },
];
