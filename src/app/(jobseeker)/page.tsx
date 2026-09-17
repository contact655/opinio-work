import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import LandingPage, {
  type LPCompanyCard,
  type LPJobCard,
  type LPFacet,
  type LPTotals,
} from "./LandingPage";
import { getBusinessDomainFacets } from "@/lib/companies/businessDomainsCached";
import { pickLpCompanies } from "@/lib/lp/pickCompanies";
import { filterListedCompanies } from "@/lib/companies/visibility";
import { fetchBusinessDomainsByCompany } from "@/lib/supabase/queries";
import { primaryBusinessDomain } from "@/types/genre";
import { isScoutSendingEnabled } from "@/lib/business/scoutGate";
import { companyDisplayName } from "@/lib/companies/displayName";

/**
 * ★件数を **metadata と OGP から外した**（2026-09-16）。
 *
 * それまで「掲載企業22社・求人2件。」と実数を出していた。実データから出していたので
 * 嘘ではないが、**検索結果と SNS シェアに最も出るのはこの文言**で、
 * 在庫の薄さを一番強い場所で自分から見せる形になっていた。
 * 同じ理由で画面からも件数を外している（業種タイル / 「N社すべて見る」 / 募集セクション）。
 *
 * ⚠️★**件数を書き戻すなら、画面側の3箇所と一緒に判断すること。** ここだけ戻すと
 *    「検索結果には数字が出るのに、開くとどこにも無い」というちぐはぐな形になる。
 *
 * ⚠️ 数える必要が無くなったので **count クエリ2本を削除した**（LP の描画で使う
 *    `totals` は `HomePage` 側が別に取っている。あちらは募集セクションの
 *    しきい値判定に要る）。
 *
 * ⚠️ サイト共通の layout.tsx 側には数字を置かない（全ページの既定値で気づけないため）。
 */
export async function generateMetadata(): Promise<Metadata> {
  // ⚠️ 2026-08-03: 「スカウトも営業電話もありません」を削除した。事実と異なっていたため。
  //    スカウト機能は実装済みで（ow_scouts / can_send_scout）、受け取る設定にした場合に
  //    だけ届く（初期設定はオフ）。この但し書きは description に収まらないので触れず、
  //    正確な説明は LP の FAQ に置いている。営業電話が無いのは事実なので残す。
  //    ここは LP の generateMetadata で、layout の既定値を上書きする。
  //    検索結果と SNS シェアに最も出るのはこの文言なので、方針変更時は真っ先に直すこと。
  /* ⚠️★FV の見出し・サブコピーと同じ趣旨に揃えてある（2026-09-17 に追随）。
        **片方だけ直さないこと。** 実測の裏取りは
        docs/phase0-top-page-20260916.md にある。
     ⚠️ 「組織体制・働き方まで」と書かないこと（掲載22社中いずれも1社しか無い）。
     ⚠️ 件数を入れないこと（2026-09-16 に外した。画面側の3箇所と一緒に判断する）。 */
  const description =
    "IT企業の事業と、在籍している方・していた方の経歴をまとめています。企業情報と募集は登録なしで読めます。経歴は登録すると読めます。完全無料・営業電話なし。";

  return {
    /* ⚠️ `absolute` にする。素の title だと「… | OPINIO」が足されて OPINIO が2回出る。 */
    title: { absolute: "OPINIO — 会社を、そこで働く人から知る" },
    description,
    openGraph: {
      title: "OPINIO — 会社を、そこで働く人から知る",
      description,
      url: "https://opinio.jp",
      siteName: "OPINIO",
      locale: "ja_JP",
      type: "website",
      /* ⚠️★**`images` をここに書かないと OG 画像が1枚も出ない**（2026-09-06）。
            子が `openGraph` を自分で定義すると、ファイル規約の
            [opengraph-image.tsx](../opengraph-image.tsx) は**マージされない**
            （自分で openGraph を持たない /privacy などには自動で付く）。
            LP は最もシェアされるページなので、明示して既定画像を指す。
         ⚠️ `/og-image.png` のような別ファイルを指さないこと。実在しないファイルを
            指していたのが、既定 OG 画像が長らく出ていなかった原因。 */
      images: ["/opengraph-image"],
    },
    alternates: { canonical: "https://opinio.jp" },
  };
}

// supabase-js 経由の取得は Next が動的だと判断できず、宣言が無いと静的レンダリング
// 結果が固定される（= コードを変えるまで DB 更新が反映されない）。
// 入口ページなので force-dynamic ではなく ISR で追従させる。
export const revalidate = 300;

/** LP に出すプレビュー件数。実体の絞り込みは一覧ページ側が担う */
const PREVIEW_COMPANIES = 12;
const PREVIEW_JOBS = 12;

export default async function HomePage() {
  const db = createAdminClient();

  /* ── ファセット ────────────────────────────────────────────────────
     ⚠️ 業種のファセットは **事業領域（getBusinessDomainFacets）** に移した（2026-08-26）。
        `industry`(text) は廃止予定で新規企業には書かれないため、
        あれで数えると新しい企業が**どのファセットにも入らない**。
     ⚠️ ここにあった `ow_companies` から phase を全件引くクエリは同時に削除した。
        「フェーズから探す」は 2026-08-03 に消えており、**取った行を誰も使っていなかった**
        （LP を1回描くたびに掲載79社ぶんを引いて捨てていた）。 */
  const industryFacetsP = getBusinessDomainFacets();

  // ── 総件数（count only: 行は取得しない）─────────────────────────
  const companyCountP = filterListedCompanies(
    db.from("ow_companies").select("id", { count: "exact", head: true })
  );
  const jobCountP = db
    .from("ow_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "published").eq("is_test", false);

  // ── 出身校ファセット ────────────────────────────────────────────
  // 公開ユーザーの学歴のみ。行数はユーザー数に比例するが、学歴レコードは
  // ユーザーあたり数件なので集計コストは低い。
  const schoolRowsP = db
    .from("ow_user_educations")
    .select("user_id, school_id, ow_schools!school_id(id, name), ow_users!user_id(is_test, is_system, visibility)")
    .not("school_id", "is", null);

  // ── プレビュー（各12件だけ）──────────────────────────────────────
  const jobsP = db
    .from("ow_jobs")
    .select(
      "id, title, job_category, salary_min, salary_max, location, employment_type, remote_work_status, company_id, published_at"
    )
    .eq("status", "published").eq("is_test", false)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(PREVIEW_JOBS);

  const [companyCountRes, jobCountRes, jobsRes, schoolRes, industryFacetList] =
    await Promise.all([companyCountP, jobCountP, jobsP, schoolRowsP, industryFacetsP]);

  // ── ピックアップ企業の選定 ──────────────────────────────────────
  // ⚠️ 基準は src/lib/lp/pickCompanies.ts に切り出してある。
  //    在庫が増えたら「注目順／新着順」に差し替えるのはあちらだけで済む。
  const companyRowsRaw = await pickLpCompanies(db, PREVIEW_COMPANIES);

  for (const [label, res] of Object.entries({
    jobs: jobsRes, schools: schoolRes,
  })) {
    if (res.error) console.error(`[HomePage] ${label} fetch failed:`, res.error.message);
  }

  const totals: LPTotals = {
    companies: companyCountRes.count ?? 0,
    jobs: jobCountRes.count ?? 0,
  };

  /* ── ファセット ──────────────────────────────────────────────────
     ⚠️ 件数はマスタ側（getBusinessDomainFacets）が数える。ここで数え直さない。
        ⚠️ **0件のものは含まれない。** 2026-08-25 まで「ITサービス・受託 0件」が
           出続けていた（押しても必ず0件）。
        ⚠️ URL の key は事業領域の slug。旧 `INDUSTRY_GROUPS` の key と一致させて
           あるので、既存の被リンクはそのまま効く。 */
  const industryFacets: LPFacet[] = industryFacetList.map((d) => ({
    key: d.slug,
    label: d.name,
    count: d.count,
    href: `/companies?industry=${d.slug}`,
  }));

  /* ⚠️ フェーズのラベルは LandingPage 側で `phaseLabel()`（lib/constants/phase.ts）に
        寄せてある（2026-09-16）。**ここでは何も変換しない。** */

  // ── 企業カードの付帯件数 ────────────────────────────────────────
  // プレビュー12社ぶんだけを対象にするので、件数が増えても負荷は一定。
  const companyRows = companyRowsRaw as unknown as {
    id: string; slug: string | null; name: string; brand_name: string | null;
    name_en: string | null; industry: string | null;
    phase: string | null; logo_url: string | null; logo_letter: string | null;
    logo_gradient: string | null; url: string | null;
  }[];
  const previewIds = companyRows.map((c) => c.id);

  /* ⚠️ カードのラベルは**事業領域**。`industry`(text) は廃止予定で新規企業では空になる。 */
  const previewDomains = await fetchBusinessDomainsByCompany(db, previewIds, "LP companies");

  /* ⚠️ `filters` は複数受ける。求人は `status` だけでなく **`is_test` も外す**
        （2026-09-16）。総件数（`jobCountP`）と `pickLpCompanies` は元から
        `is_test=false` を付けており、**ここだけ条件が割れていた。**
        いま該当は0件なので実害は無いが、検証用の求人を公開した日に数字が食い違う。 */
  const tally = async (table: string, col: string, filters: [string, string][] = []) => {
    const map = new Map<string, number>();
    if (previewIds.length === 0) return map;
    let q = db.from(table).select(col).in(col, previewIds);
    for (const [k, v] of filters) q = q.eq(k, v);
    const { data, error } = await q;
    if (error) { console.error(`[HomePage] ${table} tally failed:`, error.message); return map; }
    for (const row of (data ?? []) as unknown as Record<string, string>[]) {
      const id = row[col];
      if (id) map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  };

  // ⚠️ ow_company_members は数えていない。2026-08-05 にカードから「社員」を外したため。
  //    理由は src/lib/lp/pickCompanies.ts のコメントを参照。
  const [articleByCompany, jobByCompany] = await Promise.all([
    tally("ow_articles", "company_id", [["is_published", "true"]]),
    tally("ow_jobs", "company_id", [["status", "published"], ["is_test", "false"]]),
  ]);

  /* ★表示名は `companyDisplayName()` に寄せた（2026-09-16）。
        ⚠️★**`brand_name ?? name` に戻さないこと。** 2つ壊れていた:
          ① **`brand_name` に空文字の行がある**（株式会社Opinio）。`??` は空文字を拾わないので
             **カードの社名が空のまま**出ていた。しかも `updated_at` が最新で**必ず先頭**だった
          ② `/companies` `/search` `/companies/[id]` はすべて
             `companyDisplayName(name, name_en)` を通るのに **LP だけ別ルール**で、
             「HubSpot」「Sansan株式会社」「HPE」「CTC」が同じ一覧に混在していた
        ⚠️ `displayName.ts` の冒頭にも「新しく企業名を表示する箇所を作るときは必ずここを通すこと」
           と書いてある。**LP はそれを通っていない唯一の画面だった。**
        ⚠️ 副作用: 伊藤忠テクノソリューションズが「CTC」→「ITOCHU Techno-Solutions」になる。
           `/companies` と一致する側に揃えた（柴さんの判断）。 */
  const companies: LPCompanyCard[] = companyRows.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: companyDisplayName(c.name, c.name_en).displayName,
    businessDomain: primaryBusinessDomain(previewDomains.get(c.id))?.name ?? null,
    phase: c.phase,
    logoUrl: c.logo_url,
    logoLetter: c.logo_letter,
    logoGradient: c.logo_gradient,
    companyUrl: c.url,
    // 0 でもそのまま出す
    articleCount: articleByCompany.get(c.id) ?? 0,
    jobCount: jobByCompany.get(c.id) ?? 0,
  }));

  // ── 求人カード ──────────────────────────────────────────────────
  const jobRows = (jobsRes.data ?? []) as {
    id: string; title: string; job_category: string | null;
    salary_min: number | null; salary_max: number | null;
    location: string | null; employment_type: string | null;
    remote_work_status: string | null; company_id: string;
  }[];

  const jobCompanyIds = Array.from(new Set(jobRows.map((j) => j.company_id).filter(Boolean)));
  const companyNameById = new Map<string, string>();
  if (jobCompanyIds.length > 0) {
    /* ⚠️ 表示名は企業カードと同じ `companyDisplayName()` を通す（2026-09-16）。
          同じページの中で社名の作り方を2つ持たない。 */
    const { data, error } = await db
      .from("ow_companies")
      .select("id, name, name_en")
      .in("id", jobCompanyIds);
    if (error) console.error("[HomePage] job companies fetch failed:", error.message);
    for (const c of (data ?? []) as { id: string; name: string; name_en: string | null }[]) {
      companyNameById.set(c.id, companyDisplayName(c.name, c.name_en).displayName);
    }
  }

  const jobs: LPJobCard[] = jobRows.map((j) => ({
    id: j.id,
    title: j.title,
    companyName: companyNameById.get(j.company_id) ?? "",
    jobCategory: j.job_category,
    // salary_min/max の単位は円ではなく万円
    salaryMin: j.salary_min,
    salaryMax: j.salary_max,
    location: j.location,
    employmentType: j.employment_type,
    remoteStatus: j.remote_work_status,
  }));

  // ── 出身校ファセット ────────────────────────────────────────────
  // 本人の非公開希望を優先する（private は除外）。テスト・システムユーザーも外す。
  type EduRow = {
    user_id: string;
    ow_schools: { id: string; name: string } | null;
    ow_users: { is_test: boolean | null; is_system: boolean | null; visibility: string | null } | null;
  };
  const bySchool = new Map<string, { name: string; users: Set<string> }>();
  for (const r of (schoolRes.data ?? []) as unknown as EduRow[]) {
    const s = r.ow_schools;
    const u = r.ow_users;
    if (!s || !u) continue;
    if (u.is_test === true || u.is_system === true || u.visibility === "private") continue;
    const entry = bySchool.get(s.id) ?? { name: s.name, users: new Set<string>() };
    entry.users.add(r.user_id);
    bySchool.set(s.id, entry);
  }
  const allSchoolFacets: LPFacet[] = Array.from(bySchool.entries())
    .map(([id, v]) => ({ key: id, label: v.name, count: v.users.size, href: `/schools/${id}` }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ja"))
    .slice(0, 12);

  /**
   * 「人から探す」を出すかどうかの閾値。5校以上かつ実人数10名以上。
   *
   * なぜ隠すか: 1名の学校がいくつも並ぶ状態は、探す手がかりとして機能しない。
   * 「数を隠さない」方針とは矛盾しない ——「表示する値を偽らない」ことと
   * 「セクションを出すかどうか」は別の判断で、ここは後者。出す値は常に実数。
   *
   * なぜ2条件か: 学校数だけでは足りず、1校あたりの密度が要る。チップをクリックした
   * 先が1名では回遊にならないため、平均2名程度（= 5校に対して10名）になるまで待つ。
   *
   * 人数は distinct なユーザー数で数える。1人が高校と大学の2件を登録するため、
   * 学校ごとの件数を単純合計すると同じ人を重複して数えてしまう
   * （2026-08-03 時点: 8校 / 学歴9件 / 実人数5名 → 人数が足りず非表示）。
   *
   * データが増えて閾値を超えれば自動的に表示される。将来ここが表示されていない
   * 場合は、バグではなくこの閾値に達していないだけ。
   */
  const SCHOOL_MIN_SCHOOLS = 5;
  const SCHOOL_MIN_USERS = 10;
  const distinctSchoolUsers = new Set(
    Array.from(bySchool.values()).flatMap((v) => Array.from(v.users))
  ).size;
  const schoolFacets: LPFacet[] =
    allSchoolFacets.length >= SCHOOL_MIN_SCHOOLS && distinctSchoolUsers >= SCHOOL_MIN_USERS
      ? allSchoolFacets
      : [];

  return (
    <LandingPage
      totals={totals}
      industryFacets={industryFacets}
      schoolFacets={schoolFacets}
      companies={companies}
      jobs={jobs}
      /* ⚠️ 判定はここで1回だけ。LP 側で env を読まない（サーバー専用のため） */
      scoutSendingEnabled={isScoutSendingEnabled()}
    />
  );
}
