import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { interpretQuery, type Condition, type SearchKind } from "@/lib/search/interpretQuery";
import {
  runSearch, skillBandsForCompanies, MIN_AGGREGATE_COUNT,
  type SearchResults, type SkillBand, type PersonFilter,
} from "@/lib/search/runSearch";
import { logSearch, resolveOwUserId } from "@/lib/search/searchLog";
import { chipStyle } from "@/lib/utils/chipVariant";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import { SearchPostCard } from "./SearchPostCard";
import { PersonHitCard } from "./PersonHitCard";
import { searchPostHits } from "@/lib/search/postHits";
import { viewerIsTestByAuthId } from "@/lib/feed/viewerIsTest";
import { loadFeedProps } from "../feed/(list)/loadFeedProps";
import { HomeSideShell } from "../feed/(list)/FeedClient";
import { FollowButton as CompanyFollowButton } from "../companies/[id]/CompanyDetailClient";
import { BookmarkButton } from "@/components/jobseeker/BookmarkButton";
import { getCompanyConnections, type CompanyConnection } from "@/lib/companies/connections";
import { WORK_STYLE_LABELS } from "@/lib/constants/workStyle";

/**
 * 横断検索。企業・求人・人をまとめて引き、**主対象を1つだけ**見出し付きで出す。
 *
 * ── 置き換え前 ──────────────────────────────────────────────────────────────
 * 2026-08-27 まで、ここは `redirect()` するだけのリダイレクタだった
 * （職種語なら `/jobs?q=`、社名なら `/companies?q=`、それ以外は `/companies?q=`）。
 * 「どちらか一方に送る」形だと、企業と人にまたがる問い
 * （「関西で商社出身の人がいるIT企業」）に答えられない。
 *
 * ── ★キャッシュしない理由 ───────────────────────────────────────────────────
 * `force-dynamic`。**検索語ごとに結果が変わるので ISR の余地が無い。**
 * 加えてここは**ログインの有無で出すものが変わる**（人の個票）ので、
 * 静的化すると未ログイン向けのHTMLがログイン済みにも配られる。
 *
 * ⚠️ 語彙（`getRoleAliases` / `getBusinessDomainOptions` / `getRoleTree`）は
 *    それぞれ `unstable_cache`（3600秒 / 3600秒 / 3600秒）に載っているので、
 *    ここが動的でも**マスタの往復は増えない**。
 * ⚠️ `unstable_cache` の中で no-store のクライアントを使わないルールには
 *    抵触しない（このページは `unstable_cache` を1つも持たない）。
 *
 * ── ★noindex ────────────────────────────────────────────────────────────────
 * クエリごとに無限にURLが生えるうえ、中身は `/companies` `/jobs` `/people` の再掲。
 * 入力がそのままURLに出るので、個人名を含むURLがインデックスされうる。
 * ⚠️ **`robots.ts` の Disallow だけでは足りない。** Disallow するとクロールされず
 *    meta が読まれないので、**先に metadata 側で noindex を出す。**
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "検索 | OPINIO" },
  robots: { index: false, follow: false },
};

type Props = { searchParams: { q?: string; drop?: string; kind?: string; tenure?: string; role?: string } };

/** ★画面の種別。条件で引く4つ（SearchKind）に、ことばで引く「投稿」を足したもの（2026-10-21） */
type PageKind = SearchKind | "post";

const KIND_LABEL: Record<PageKind, string> = {
  company: "企業",
  job: "募集",
  /* ★「ユーザー」（2026-10-21 / 柴さんの指示。下のタブバー・ヘッダーのナビと同じ語に揃えた） */
  person: "ユーザー",
  post: "投稿",
  article: "記事",
};

/** タブの並び。⚠️ ヘッダーのナビ（企業・募集・ユーザー・フィード・記事）と同じ順にしてある */
const KIND_ORDER: PageKind[] = ["company", "job", "person", "post", "article"];

/** 「すべて」タブで、主対象**以外**を何件まで出すか。⚠️ 主対象は HIT_LIMIT まで出す */
const PREVIEW_PER_KIND = 3;

// ── チップ ───────────────────────────────────────────────────────────────────

function ResolvedChip({ c, primaryKind }: { c: Condition; primaryKind: SearchKind }) {
  /* 年収は求人にしか列が無い。主対象が求人でないときは「効いていない」ことを
     チップ自身に書く。⚠️ 黙って無視しない（CLAUDE.md「入力させて捨てない」）。 */
  const notApplied = !c.appliesTo.includes(primaryKind);
  const s = chipStyle(c.kind === "salaryMin" ? "money" : "neutral");
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 12px", borderRadius: 100, fontSize: 12.5, fontWeight: 600,
        background: notApplied ? "var(--bg-tint)" : s.bg,
        color: notApplied ? "var(--ink-mute)" : s.color,
        border: `1px solid ${notApplied ? "var(--line)" : s.border}`,
      }}
    >
      {c.label}
      {notApplied && (
        <span style={{ fontWeight: 500, fontSize: 11.5 }}>
          （{KIND_LABEL[c.appliesTo[0]]}にのみ効きます）
        </span>
      )}
    </span>
  );
}

function UnresolvedChip({ word }: { word: string }) {
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center",
        padding: "5px 12px", borderRadius: 100, fontSize: 12.5, fontWeight: 600,
        background: "var(--bg-tint)", color: "var(--ink-mute)",
        border: "1px dashed var(--line)",
      }}
    >
      {word}
    </span>
  );
}

// ── 結果カード ───────────────────────────────────────────────────────────────

/**
 * 会社のカード（2026-10-21 に LinkedIn に寄せた / 柴さんの指示）。
 *   右上にフォロー、下に「あなたのつながり N人がここで働いています」（いるときだけ）。
 * ⚠️ リンクとボタンは並べる（入れ子にしない。押したときに遷移しないように）
 * ⚠️ つながりは企業ページと同じ getCompanyConnections（本人が表示を許した相互フォローの現役社員だけ）
 */
function CompanyCard({ item, connections }: { item: SearchResults["company"]["items"][number]; connections: CompanyConnection[] | null }) {
  const href = `/companies/${item.slug ?? item.id}`;
  return (
    <div data-state="company-card" style={{ padding: 14, borderRadius: 12, border: "1px solid var(--line)", background: "#fff" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <Link href={href} style={{ display: "flex", gap: 12, alignItems: "flex-start", flex: 1, minWidth: 0, textDecoration: "none", color: "inherit" }}>
          <CompanyLogo
            logoUrl={item.logoUrl} name={item.name}
            logoLetter={item.logoLetter} logoGradient={item.logoGradient} size={48}
          />
          <span style={{ minWidth: 0, display: "block" }}>
            <span style={{ display: "block", fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>
              {item.name}
            </span>
            {/* ⚠️ 事業領域が無いときは行ごと出さない（「—」で埋めない） */}
            {item.domain && (
              <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-mute)", marginTop: 2 }}>
                {item.domain}
              </span>
            )}
            {item.tagline && (
              <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-soft)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.tagline}
              </span>
            )}
            {item.jobCount > 0 && (
              <span style={{ display: "block", fontSize: 12, color: "var(--royal)", fontWeight: 600, marginTop: 4 }}>
                募集 {item.jobCount}件
              </span>
            )}
          </span>
        </Link>
        <div style={{ flexShrink: 0 }}>
          <CompanyFollowButton companyId={item.id} />
        </div>
      </div>
      {connections && connections.length > 0 && (
        <div data-state="company-connections" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line-soft)" }}>
          <span style={{ display: "flex" }}>
            {connections.slice(0, 3).map((c, i) => (
              c.avatarUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img key={c.userId} src={c.avatarUrl} alt="" width={22} height={22} style={{ borderRadius: "50%", objectFit: "cover", border: "2px solid #fff", marginLeft: i === 0 ? 0 : -6 }} />
                : <span key={c.userId} aria-hidden="true" style={{ width: 22, height: 22, borderRadius: "50%", background: c.avatarGradient, color: "#fff", fontSize: 11, fontWeight: 700, display: "grid", placeItems: "center", border: "2px solid #fff", marginLeft: i === 0 ? 0 : -6 }}>{c.avatarInitial}</span>
            ))}
          </span>
          <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>
            {/* ⚠️「〜さんのつながりが」と書かない（その人のつながりと読める。2026-10-21 に実画面で気づいた） */}
            あなたのつながりの{connections[0].name}さん{connections.length > 1 ? `ほか${connections.length - 1}人` : ""}がここで働いています
          </span>
        </div>
      )}
    </div>
  );
}

/** 掲載からの日数（「今日」「3日前」「2か月前」） */
function sinceLabel(iso: string | null): string | null {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 0) return null;
  if (days === 0) return "今日";
  if (days < 30) return `${days}日前`;
  if (days < 365) return `${Math.floor(days / 30)}か月前`;
  return `${Math.floor(days / 365)}年前`;
}

/**
 * 募集の行（2026-10-21 に1件1行へ作り直した / 柴さんの指示。LinkedIn と同じ形）。
 *   [ロゴ] 題名 / 会社 / 勤務地・働き方 / 年収 ・ 掲載から N日   [保存]
 * ⚠️ リンクと保存ボタンは並べる（入れ子にしない）
 */
function JobCard({ item }: { item: SearchResults["job"]["items"][number] }) {
  const money = chipStyle("money");
  /* 「東京都（ハイブリッド）」。片方しか無ければその片方だけ */
  const ws = item.workStyle ? WORK_STYLE_LABELS[item.workStyle] ?? null : null;
  const place = item.location && ws ? `${item.location}（${ws}）` : item.location ?? ws;
  const since = sinceLabel(item.publishedAt);
  return (
    <div data-state="job-row" style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 0", borderTop: "1px solid var(--line-soft)" }}>
      <Link href={`/jobs/${item.slug ?? item.id}`} style={{ display: "flex", gap: 12, alignItems: "flex-start", flex: 1, minWidth: 0, textDecoration: "none", color: "inherit" }}>
        <CompanyLogo logoUrl={item.logoUrl} name={item.companyName} logoLetter={item.logoLetter} logoGradient={item.logoGradient} size={44} />
        <span style={{ minWidth: 0, display: "block", flex: 1 }}>
          <span style={{ display: "block", fontWeight: 700, fontSize: 14.5, color: "var(--ink)", lineHeight: 1.45 }}>
            {item.title}
          </span>
          <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-soft)", marginTop: 2 }}>
            {item.companyName}
          </span>
          {place && (
            <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-mute)", marginTop: 2 }}>{place}</span>
          )}
          {(item.salaryMin !== null || since) && (
            <span style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
              {item.salaryMin !== null && (
                /* ⚠️ 緑は金銭的にプラスの条件だけ（chipVariant.ts）。ここは年収なので money */
                <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 100, background: money.bg, color: money.color, border: `1px solid ${money.border}`, fontSize: 12, fontWeight: 600 }}>
                  {item.salaryMin}
                  {item.salaryMax !== null && item.salaryMax !== item.salaryMin ? `〜${item.salaryMax}` : ""}万円
                </span>
              )}
              {since && <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{since}に掲載</span>}
            </span>
          )}
        </span>
      </Link>
      <div style={{ flexShrink: 0 }}>
        <BookmarkButton targetType="job" targetId={item.id} label={item.title} />
      </div>
    </div>
  );
}

/**
 * 記事のカード（2026-10-01）。
 * ⚠️ 社名で当たった企業に紐づく記事。**タイトルの文字列一致では出ない**
 *    （`searchArticleHits` の注記）。「なぜ出たか」は会社名の行が担う。
 */
function ArticleCard({ item }: { item: SearchResults["article"]["items"][number] }) {
  return (
    <Link
      href={`/articles/${item.slug ?? item.id}`}
      style={{
        display: "block", background: "#fff", border: "1px solid var(--line)",
        borderRadius: 12, padding: 14, textDecoration: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        {/* ⚠️ 種別が無ければ行ごと出さない（「—」で埋めない） */}
        {item.typeLabel && (
          <span style={{ ...chipStyle("neutral"), fontSize: 11 }}>{item.typeLabel}</span>
        )}
        {item.companyName && (
          <span style={{ fontSize: 12, color: "var(--ink-mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.companyName}
          </span>
        )}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", lineHeight: 1.5 }}>
        {item.title}
      </div>
    </Link>
  );
}

/** ★結果の1区切り（白い板）。見出しの右に「すべて表示」を置く（2026-10-21） */
function ResultSection({
  title, count, moreHref, children,
}: { title: string; count: number | null; moreHref: string | null; children: React.ReactNode }) {
  return (
    <section
      data-state="search-section"
      className="search-section"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)", margin: 0 }}>{title}</h2>
        {count !== null && (
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", background: "var(--line-soft)", borderRadius: 100, padding: "2px 9px" }}>{count}</span>
        )}
      </div>
      <div style={{ marginTop: 12 }}>{children}</div>
      {/* ★「すべて表示」は区切りの下に横いっぱいで置く（2026-10-21 / 柴さんの指示。LinkedIn と同じ。読み終えたところで押せる） */}
      {moreHref && (
        <Link href={moreHref} data-state="search-more"
          style={{ display: "block", margin: "14px -16px -14px", padding: "12px 16px", borderTop: "1px solid var(--line)", textAlign: "center", fontSize: 13.5, color: "var(--ink-soft)", fontWeight: 700, textDecoration: "none" }}>
          すべて表示 →
        </Link>
      )}
    </section>
  );
}

const GRID: React.CSSProperties = { display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))" };

// ── ページ本体 ───────────────────────────────────────────────────────────────

export default async function SearchPage({ searchParams }: Props) {
  /* ★左右の列（ホームと同じ）の読み込みは、検索と**並べて**走らせる（2026-10-21）。
        検索のあとに待っていたため、ログイン中の表示がホームのぶん（約0.3秒）まるごと遅れていた。
     ⚠️ catch を先に付けておく（下で await するまでに失敗すると、未処理の失敗として記録されるため）。下の await で失敗はそのまま上がる */
  const feedPromise = loadFeedProps();
  feedPromise.catch(() => {});
  const raw = (searchParams.q ?? "").slice(0, 200);
  const interpreted = await interpretQuery(raw);

  /* 「条件を1つ外す」導線から戻ってきたとき。⚠️ 添字はサーバー側で作った配列に
     対するものなので、範囲外なら黙って無視する（不正値で 500 にしない）。 */
  const dropIndex = Number.parseInt(searchParams.drop ?? "", 10);
  const dropped =
    Number.isInteger(dropIndex) && dropIndex >= 0 && dropIndex < interpreted.conditions.length
      ? interpreted.conditions[dropIndex]
      : null;
  const conditions = dropped
    ? interpreted.conditions.filter((_, i) => i !== dropIndex)
    : interpreted.conditions;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  /* ★条件が1つも立たなかったら検索しない。
     ⚠️ **絞り込めていない全件を「検索結果」として出さないこと。**
        条件0件で `runSearch` を呼ぶと掲載79社が丸ごと返り、
        「関西で商社出身の人がいるIT企業」に対して**全社が答えとして並ぶ**
        （2026-08-27 に実際にそうなった）。件数が多いので**正常に見えてしまう**のが厄介。
        絞り込めなかったことは、絞り込めなかったと書く。 */
  const nothingResolved = conditions.length === 0;
  const EMPTY: SearchResults = {
    company: { items: [], total: 0 },
    job: { items: [], total: 0 },
    person: { items: [], total: 0 },
    article: { items: [], total: 0 },
  };
  /* ★人タブの絞り込み（2026-10-21）。人タブを開いているときだけ効かせる（「すべて」では絞らない）。
     ⚠️ 知らない値は無視する（URL を手で書き換えられても壊れない） */
  const personFilter: PersonFilter = {};
  /* ⚠️★未ログインでは絞らない。絞ると3人未満の人数がタブの外に出る（人の件数は MIN_AGGREGATE_COUNT 未満を伏せる規則） */
  if (searchParams.kind === "person" && isLoggedIn) {
    if (searchParams.tenure === "current" || searchParams.tenure === "former") personFilter.tenure = searchParams.tenure;
    if (searchParams.role && /^[a-z0-9_-]{1,64}$/i.test(searchParams.role)) personFilter.role = searchParams.role;
  }
  const results = raw.trim() && !nothingResolved ? await runSearch(conditions, isLoggedIn, personFilter) : EMPTY;
  /* ★投稿は条件ではなく「ことば」で引く。条件が1つも立たなかったときも引く
        （投稿は自由文なので、職種などに読めない語こそ当たりうる）。ログインしているときだけ */
  const posts = raw.trim()
    ? await searchPostHits(raw, {
        isLoggedIn,
        isTest: isLoggedIn ? await viewerIsTestByAuthId(user?.id) : false,
        /* いいね済みかを出すため（ホームと同じ表を見る） */
        owUserId: isLoggedIn ? await resolveOwUserId(user?.id ?? null) : null,
      })
    : { items: [], total: 0 };
  const totalOf = (k: PageKind) => (k === "post" ? posts.total : results[k].total);

  /* ★社名として解決した語が標準スキルにもあるとき、「そのスキルを持つ人」への橋渡しを出す。
     ⚠️ 条件には混ぜない（同じ語で company と skill を両方立てると AND で潰れる）。
     ⚠️ 人数の下限は `MIN_AGGREGATE_COUNT`。人の件数を出す閾値と揃える
        （n=1/2 の「1人います」は本人の特定に繋がる）。 */
  const skillBands: SkillBand[] = nothingResolved
    ? []
    : (await skillBandsForCompanies(conditions)).filter((b) => b.count >= MIN_AGGREGATE_COUNT);

  const primary = interpreted.primaryKind;
  const norm = (x: string) => x.toLowerCase().replace(/[\s　]+/g, "");
  const echoesQuery =
    !dropped && interpreted.unresolved.length === 0 && conditions.length === 1 &&
    conditions[0].appliesTo.includes(primary) && norm(conditions[0].label) === norm(raw);

  /* ★どのタブを見ているか（2026-10-01）。`?kind=` が無ければ「すべて」。
     ⚠️ 知らない値は「すべて」に倒す（URL を手で書き換えられても壊れない）。 */
  const activeKind: PageKind | "all" =
    (KIND_ORDER as string[]).includes(searchParams.kind ?? "")
      ? (searchParams.kind as PageKind)
      : "all";

  /* ★「すべて」では**主対象を先頭に**置く。`interpretQuery` が決めた優先順を捨てない。
     ⚠️ 残りは `KIND_ORDER`（ヘッダーのナビと同じ並び）。**件数順にしないこと** ——
        同じ語で引いても日によって並びが変わる。 */
  const visibleKinds: PageKind[] =
    activeKind === "all" ? [primary, ...KIND_ORDER.filter((k) => k !== primary)] : [activeKind];
  const totalAll = KIND_ORDER.reduce((n, k) => n + totalOf(k), 0);
  /* 条件で引く4種の合計（「条件を1つ外す」の判定に使う。投稿は条件と無関係なので混ぜない） */
  const totalByConditions = (["company", "job", "person", "article"] as const).reduce((n, k) => n + results[k].total, 0);

  /* 0件のときだけ「条件を1つ外すと」を計算する。
     ⚠️ 条件ごとに引き直すので、当たっているときはやらない（無駄な往復を作らない）。 */
  const relaxations: { label: string; index: number; count: number }[] = [];
  if (raw.trim() && !nothingResolved && totalByConditions === 0 && conditions.length >= 2) {
    for (let i = 0; i < interpreted.conditions.length; i++) {
      const rest = interpreted.conditions.filter((_, j) => j !== i);
      if (rest.length === 0) continue;
      const r = await runSearch(rest, isLoggedIn);
      const n = (["company", "job", "person", "article"] as const).reduce((m, k) => m + r[k].total, 0);
      if (n > 0) relaxations.push({ label: interpreted.conditions[i].label, index: i, count: n });
    }
  }

  /* ★検索ログ。**ベストエフォート。** 失敗しても下の描画は止めない。
     ⚠️ `logSearch` は自前で try/catch していて例外を投げない（searchLog.ts 参照）。
     ⚠️ `await` する: fire-and-forget にすると、サーバーレスでは
        応答を返した時点で実行が打ち切られて記録が落ちる。INSERT 1本なので許容する。
     ⚠️ 条件が1つも立たなかったときも記録する。**その回こそ `unresolved` に
        次に足すべき語が入っている**（ログの主目的）。 */
  if (raw.trim()) {
    await logSearch({
      query: raw,
      primaryKind: primary,
      conditions,
      unresolved: interpreted.unresolved,
      resultCount: results[primary].total,
      userId: await resolveOwUserId(user?.id ?? null),
    });
  }


  /* ★左右の列はホームと同じ（2026-10-21 / 柴さんの指示）。中身は loadFeedProps（ホームと同じ読み込み） */
  const feed = await feedPromise;

  /* ★人の行のフォローボタン（2026-10-21）。見ている人がフォローしている人／フォローされている人（「つながり」の表示に使う） */
  const follow: FollowInfo = { me: feed.myUserId, following: new Set(), followers: new Set() };
  const personIds = results.person.items.map((p) => p.userId).filter((id) => id !== feed.myUserId);
  if (feed.myUserId && personIds.length > 0) {
    const admin = createAdminClient();
    const [out, inc] = await Promise.all([
      admin.from("ow_user_follows").select("target_user_id").eq("follower_user_id", feed.myUserId).in("target_user_id", personIds),
      admin.from("ow_user_follows").select("follower_user_id").eq("target_user_id", feed.myUserId).in("follower_user_id", personIds),
    ]);
    if (out.error) console.error("[search] follows:", out.error.message);
    if (inc.error) console.error("[search] followers:", inc.error.message);
    for (const r of out.data ?? []) follow.following.add(r.target_user_id as string);
    for (const r of inc.data ?? []) follow.followers.add(r.follower_user_id as string);
  }

  /* ★会社のカードの「あなたのつながりがここで働いています」（2026-10-21）。ログイン中・出す会社だけ（最大6社） */
  const companyConnections = new Map<string, CompanyConnection[] | null>();
  if (feed.myUserId && results.company.items.length > 0) {
    const ids = results.company.items.slice(0, 6).map((c) => c.id);
    /* ⚠️ 検証用アカウントには検証用の人のつながりだけ（getCompanyConnections の注記） */
    const viewerTest = await viewerIsTestByAuthId(user?.id);
    const lists = await Promise.all(ids.map((id) => getCompanyConnections(id, feed.myUserId as string, viewerTest)));
    ids.forEach((id, i) => companyConnections.set(id, lists[i]));
  }

  return (
    <div style={{ background: "#f0f4f8", minHeight: "70vh" }}>
      <HomeSideShell feed={feed}>
      {/* ⚠️ style タグの中に不等号や山かっこを書かないこと（ハイドレーションが壊れる。ui-debugging ⑲） */}
      <style>{`
        .search-tabs { margin-top: 18px; display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none;
          position: sticky; top: 60px; z-index: 5; background: #f0f4f8; padding: 8px 0; margin-bottom: -8px; }
        .search-tabs::-webkit-scrollbar { display: none; }
        .search-tabs a { flex-shrink: 0; white-space: nowrap; }
        /* ★人タブの絞り込みの行。1行で横にスクロールする */
        .search-filter-row { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
        .search-filter-row::-webkit-scrollbar { display: none; }
        /* ★区切りの箱。⚠️ インラインに戻さないこと（スマホで端まで広げる指定が効かなくなる） */
        .search-section { margin-top: 16px; background: #fff; border: 1px solid var(--line); border-radius: 14px;
          padding: 16px 16px 14px; overflow: hidden; }
        @media (max-width: 767px) {
          .search-section { margin-left: -16px; margin-right: -16px; border-radius: 0; border-left: none; border-right: none; margin-top: 8px; }
          .search-tabs { margin-left: -16px; margin-right: -16px; padding-left: 16px; padding-right: 16px; }
        }
      `}</style>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", margin: 0 }}>
          {raw.trim() ? `「${raw.trim()}」の検索結果` : "検索"}
        </h1>

        {/* ── 解釈した条件 ── */}
        {/* ★入力したことばがそのまま1つの条件になっただけなら、チップを出さない（2026-10-21 / 柴さんの指摘）。
               見出しの「「Salesforce」の検索結果」と同じことを2回言うことになる。
            ⚠️ 読み替えた（「営業職」→「営業」）・複数に分けた・効かない語がある・効く対象が限られる、のどれかなら出す */}
        {(conditions.length > 0 || interpreted.unresolved.length > 0) && !echoesQuery && (
          <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {conditions.map((c, i) => (
              <ResolvedChip key={`c-${i}`} c={c} primaryKind={primary} />
            ))}
            {interpreted.unresolved.map((w) => (
              <UnresolvedChip key={`u-${w}`} word={w} />
            ))}
          </div>
        )}

        {/* ⚠️ 解決できなかった語を黙って落とさない。何が効いていないかを必ず書く */}
        {interpreted.unresolved.length > 0 && (
          <p style={{ marginTop: 8, fontSize: 12.5, color: "var(--ink-mute)", lineHeight: 1.7 }}>
            点線のことばは、いまの OPINIO のデータでは絞り込みに使えません（
            {interpreted.unresolved.join("・")}）。検索結果には反映されていません。
          </p>
        )}

        {dropped && (
          <p style={{ marginTop: 8, fontSize: 12.5, color: "var(--ink-mute)" }}>
            「{dropped.label}」の条件を外して検索しています。
            <Link href={`/search?q=${encodeURIComponent(raw)}`} style={{ color: "var(--royal)", fontWeight: 600, marginLeft: 6 }}>
              条件を戻す
            </Link>
          </p>
        )}

{/* ── ★タブ（2026-10-01 / 柴さんの指示。LinkedIn の横断検索を参考に）──────
               「すべて」＋種別。**押すと URL に `?kind=` が付く**だけで、検索はやり直さない。
            ⚠️★0件の種別もタブは出す。押すと0件だが、**何を横断しているかが分かる**
               （リポジトリの「0件の選択肢を出さない」とは逆向き。ここはタブ＝目次なので）。
            ⚠️ 人の件数は未ログインだと下限未満で伏せる（既存の `MIN_AGGREGATE_COUNT`）。 */}
        {(!nothingResolved || posts.total > 0) && raw.trim() && (
          /* ★1行で横にスクロールし、ヘッダーの下に貼り付く（2026-10-21 / 柴さんの指示。LinkedIn と同じ）。位置と並びは CSS（.search-tabs） */
          <div className="search-tabs" data-state="search-tabs">
            {(["all", ...KIND_ORDER] as const).map((k) => {
              const active = activeKind === k;
              const n = k === "all" ? totalAll : totalOf(k);
              const hideCount = k === "person" && !isLoggedIn && results.person.total < MIN_AGGREGATE_COUNT;
              return (
                <Link
                  key={k}
                  href={`/search?q=${encodeURIComponent(raw)}${k === "all" ? "" : `&kind=${k}`}`}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 14px", borderRadius: 100, fontSize: 13, fontWeight: 600,
                    textDecoration: "none",
                    background: active ? "var(--royal)" : "#fff",
                    color: active ? "#fff" : "var(--ink)",
                    border: `1px solid ${active ? "var(--royal)" : "var(--line)"}`,
                  }}
                >
                  {k === "all" ? "すべて" : KIND_LABEL[k]}
                  {!hideCount && (
                    <span style={{ fontSize: 12, fontWeight: 700, opacity: active ? 0.85 : 0.55 }}>{n}</span>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {/* ── ★結果（2026-10-01 に「主対象1つ＋件数」から作り直した）────────────
               それまでは主対象だけカードを出し、他は「N件 一覧へ」だった。
            ⚠️★**畳む理由がもう無い**（柴さんの判断）。実測（本番 / `?q=Salesforce`）は
               企業1・募集2・人5・記事1 の**合計9件**で、畳んで押させるより短い。
               件数が増えたら `PREVIEW_PER_KIND` と `HIT_LIMIT` で切る。
            ⚠️★**主対象は今までどおり全部出す**（`HIT_LIMIT` まで）。他が3件ずつ増えるだけで、
               **今まで見えていたものは1つも減らない。**
            ⚠️ 人は未ログインだと個票を出さない（`LoginGate`）。既存の規則をそのまま適用する。 */}
        {totalAll === 0 ? (
          <section style={{ marginTop: 22 }}>
            {nothingResolved
              ? <NoConditionState unresolved={interpreted.unresolved} hasQuery={!!raw.trim()} />
              : <EmptyState raw={raw} relaxations={relaxations} hasQuery={!!raw.trim()} />}
          </section>
        ) : (
          <>
            {/* ★条件が読めず投稿だけが当たったとき。企業・募集・人が無い理由を書く（黙って0件にしない） */}
            {nothingResolved && (
              <p data-state="search-posts-only" style={{ marginTop: 14, fontSize: 12.5, color: "var(--ink-mute)", lineHeight: 1.7 }}>
                企業・募集・人は、職種・事業領域・外資系／日系・年収などの条件で探します。
                このことばは条件として読めなかったので、投稿だけを表示しています。
              </p>
            )}
            {visibleKinds.map((k) => {
              if (totalOf(k) === 0) return null;
              const full = activeKind !== "all" || k === primary;
              const moreHref = activeKind === "all" ? `/search?q=${encodeURIComponent(raw)}&kind=${k}` : null;
              if (k === "post") {
                const items = full ? posts.items : posts.items.slice(0, PREVIEW_PER_KIND);
                return (
                  <ResultSection key={k} title={KIND_LABEL[k]} count={posts.total} moreHref={posts.total > items.length ? moreHref : null}>
                    <div style={{ display: "grid", gap: 10, gridTemplateColumns: "minmax(0, 1fr)" }}>
                      {items.map((it) => <SearchPostCard key={it.id} item={it} viewer={{ myUserId: feed.myUserId, myName: feed.myName, myAvatarColor: feed.myAvatarColor, myAvatarUrl: feed.myAvatarUrl }} />)}
                    </div>
                    <Truncated total={posts.total} shown={items.length} />
                  </ResultSection>
                );
              }
              const res = results[k];
              /* ★人は「すべて」でも現役・OB・OG をそれぞれ3人まで出す（片方だけになるのを防ぐ。2026-10-21） */
              const items = full
                ? res.items
                : k === "person"
                  ? [
                      ...results.person.items.filter((p) => p.tenure !== "former").slice(0, PREVIEW_PER_KIND),
                      ...results.person.items.filter((p) => p.tenure === "former").slice(0, PREVIEW_PER_KIND),
                    ]
                  : res.items.slice(0, PREVIEW_PER_KIND);
              const gated = k === "person" && !isLoggedIn;
              const showCount = k !== "person" || isLoggedIn || results.person.total >= MIN_AGGREGATE_COUNT;
              /* ★人タブで絞っているときは、絞ったあとの人数（filteredTotal）を出す */
              const shownTotal = k === "person" ? results.person.filteredTotal ?? res.total : res.total;
              const byCompany = conditions.some((c) => c.kind === "company");
              const tt = results.person.tenureTotals;
              return (
                <ResultSection key={k} title={KIND_LABEL[k]} count={showCount ? shownTotal : null}
                  moreHref={!gated && res.total > items.length ? moreHref : null}>
                  {gated ? (
                    <LoginGate total={results.person.total} />
                  ) : k === "person" ? (
                    <>
                      {activeKind === "person" && (
                        <PersonFilterBar raw={raw} filter={personFilter} byCompany={byCompany}
                          tenureTotals={tt} roleFacets={results.person.roleFacets ?? []} />
                      )}
                      {shownTotal === 0 ? (
                        <p data-state="person-filter-empty" style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-mute)" }}>
                          この条件に当たる人はいません。
                        </p>
                      ) : (
                        <PersonGroups items={items as typeof results.person.items}
                          totals={personFilter.tenure && tt ? { current: personFilter.tenure === "current" ? tt.current : 0, former: personFilter.tenure === "former" ? tt.former : 0 } : tt}
                          byCompany={byCompany} f={follow} />
                      )}
                      {results.person.destinations && (
                        <DestinationsBlock d={results.person.destinations}
                          companyLabel={conditions.find((c) => c.kind === "company")?.label ?? null} />
                      )}
                    </>
                  ) : (
                    k === "job" ? (
                      /* ★募集は1件1行で縦に並べる（2026-10-21） */
                      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)" }}>
                        {(items as typeof results.job.items).map((it) => <JobCard key={it.id} item={it} />)}
                      </div>
                    ) : (
                      <div style={GRID}>
                        {k === "company" && (items as typeof results.company.items).map((it) => <CompanyCard key={it.id} item={it} connections={companyConnections.get(it.id) ?? null} />)}
                        {k === "article" && (items as typeof results.article.items).map((it) => <ArticleCard key={it.id} item={it} />)}
                      </div>
                    )
                  )}
                  {!gated && <Truncated total={shownTotal} shown={items.length} />}
                </ResultSection>
              );
            })}
          </>
        )}

        {/* ── ★スキルの帯。社名として解決した語がスキルにもあるときだけ ── */}
        {skillBands.length > 0 && (
          <section style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 13 }}>
              {skillBands.map((b) => (
                <span key={b.skillId} style={{ color: "var(--ink-mute)" }}>
                  {b.label}を使える人: <strong style={{ color: "var(--ink)" }}>{b.count}</strong> 名
                  {/* ⚠️ 未ログインに個票は出さない。既存ルールをそのまま適用する */}
                  {isLoggedIn ? (
                    <Link
                      href={`/search?q=${encodeURIComponent(`${b.label}のスキルを持つ人`)}`}
                      style={{ color: "var(--royal)", fontWeight: 600, marginLeft: 6 }}
                    >
                      見る
                    </Link>
                  ) : (
                    <Link href="/auth" style={{ color: "var(--royal)", fontWeight: 700, marginLeft: 6 }}>
                      ログインすると表示
                    </Link>
                  )}
                </span>
              ))}
            </div>
          </section>
        )}

{/* ⚠️★「他の対象は件数だけ」だったブロックは 2026-10-01 に削除した。
               いまは上のセクションが全種別を出すので、同じ数字が2回出ることになる。
            ⚠️ 0件の種別への導線（`/companies` などの一覧へ）は**タブが担う**。 */}
      </div>
      </HomeSideShell>
    </div>
  );
}

/**
 * ★「この会社を出た人のいま」（2026-10-21 / 柴さんの指示。OPINIO らしさ＝実際に移った先が見える）。
 *   OB・OG のいまの会社と職種を並べる。人数は3人以上のときだけ（runSearch の Destinations）。
 * ⚠️ ログインしているときだけ（人の欄と同じ）。会社名を出してよい職歴だけを数えている
 */
function DestinationsBlock({ d, companyLabel }: { d: NonNullable<SearchResults["person"]["destinations"]>; companyLabel: string | null }) {
  const chip = chipStyle("neutral");
  const Row = ({ title, list }: { title: string; list: { label: string; count: number | null }[] }) =>
    list.length === 0 ? null : (
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 6 }}>{title}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {list.map((x) => (
            <span key={x.label} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 100, fontSize: 12.5, fontWeight: 600, background: chip.bg, color: chip.color, border: `1px solid ${chip.border}`, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {x.label}
              {x.count !== null && <span style={{ fontWeight: 700, color: "var(--ink-soft)" }}>{x.count}人</span>}
            </span>
          ))}
        </div>
      </div>
    );
  return (
    <div data-state="search-destinations" style={{ marginTop: 16, padding: "14px 14px 12px", borderRadius: 12, background: "var(--bg-tint)", border: "1px solid var(--line)" }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--ink)" }}>
        {companyLabel ? `${companyLabel}を出た人の、いま` : "この会社を出た人の、いま"}
      </div>
      {d.companies.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 6 }}>転職先</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {d.companies.map((x) => {
              const style: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 10px 4px 4px", borderRadius: 100, fontSize: 12.5, fontWeight: 600, background: "#fff", color: "var(--ink)", border: `1px solid ${chip.border}`, maxWidth: "100%", minWidth: 0, textDecoration: "none" };
              const inner = (
                <>
                  <CompanyLogo logoUrl={x.logoUrl} name={x.label} logoLetter={x.logoLetter} logoGradient={x.logoGradient} size={22} />
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.label}</span>
                  {x.count !== null && <span style={{ fontWeight: 700, color: "var(--ink-soft)", flexShrink: 0 }}>{x.count}人</span>}
                </>
              );
              /* ★会社ページが開ける会社だけリンクにする（href は runSearch が filterVisibleCompaniesStrict で決める） */
              return x.href ? (
                <Link key={x.label} href={x.href} data-state="destination-company-link" style={style}>{inner}</Link>
              ) : (
                <span key={x.label} data-state="destination-company" style={style}>{inner}</span>
              );
            })}
          </div>
        </div>
      )}
      <Row title="いまの職種" list={d.roles} />
      <p style={{ margin: "10px 0 0", fontSize: 11.5, color: "var(--ink-mute)" }}>人数は3人以上のときだけ表示しています。</p>
    </div>
  );
}

/** ⚠️★切ったことを黙らない（上限や「すべて」の3件で切ったとき） */
function Truncated({ total, shown }: { total: number; shown: number }) {
  if (total <= shown) return null;
  return (
    <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--ink-mute)" }}>
      {total}件のうち {shown}件を表示しています。
    </p>
  );
}

/**
 * ★人タブの絞り込み（2026-10-21 / 柴さんの指示）。在籍（現役・OB/OG）と職種（大分類）。
 *   押すと絞り、もう一度押すと外す（✕ が付く）。⚠️「すべて」のボタンは置かない（2行の「すべて」が紛らわしかった。柴さんの指摘）
 *   押すと URL の `?tenure=` / `?role=` が変わるだけ（リンク）。サーバーで上限の前に絞る（runSearch の PersonFilter）
 * ⚠️ 人数は「もう一方の絞り込みを当てたあと」で数える。押して0人になる選択肢を出さない
 * ⚠️ 在籍の選択肢は、職歴の条件で引いたとき（現役・OB/OG に分けられるとき）だけ出す
 * ⚠️ 選んでいる職種は、人数が0でも出す（外せなくなるため）
 */
function PersonFilterBar({
  raw, filter, byCompany, tenureTotals, roleFacets,
}: {
  raw: string; filter: PersonFilter; byCompany: boolean;
  tenureTotals: SearchResults["person"]["tenureTotals"];
  roleFacets: { key: string; name: string; count: number }[];
}) {
  const href = (next: PersonFilter) => {
    const p = new URLSearchParams({ q: raw, kind: "person" });
    if (next.tenure) p.set("tenure", next.tenure);
    if (next.role) p.set("role", next.role);
    return `/search?${p.toString()}`;
  };
  const cur = tenureTotals?.current ?? 0;
  const fmr = tenureTotals?.former ?? 0;
  const tenureOpts = [
    { key: "current" as const, label: byCompany ? "現役社員" : "いまの仕事", n: cur },
    { key: "former" as const, label: byCompany ? "OB・OG" : "以前の仕事", n: fmr },
  ].filter((o) => o.n > 0 || filter.tenure === o.key);
  const roles = [
    ...roleFacets,
    ...(filter.role && !roleFacets.some((r) => r.key === filter.role) ? [{ key: filter.role, name: "選択中の職種", count: 0 }] : []),
  ];
  /* ⚠️ 選択肢が1つしかない行は出さない（押しても絞れない）。選んでいる行は外せるように出す */
  const showTenure = tenureOpts.length >= 2 || !!filter.tenure;
  const showRole = roles.length >= 2 || !!filter.role;
  if (!showTenure && !showRole) return null;
  const chip = (active: boolean): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0, whiteSpace: "nowrap",
    padding: "5px 12px", borderRadius: 100, fontSize: 12.5, fontWeight: 600, textDecoration: "none",
    background: active ? "var(--royal)" : "#fff", color: active ? "#fff" : "var(--ink)",
    border: `1px solid ${active ? "var(--royal)" : "var(--line)"}`,
  });
  const num = (n: number, active: boolean) => (
    <span style={{ fontSize: 11.5, fontWeight: 700, opacity: active ? 0.85 : 0.55 }}>{n}</span>
  );
  const rowLabel = (t: string) => (
    <span style={{ flexShrink: 0, alignSelf: "center", fontSize: 12, fontWeight: 700, color: "var(--ink-mute)", width: 30 }}>{t}</span>
  );
  return (
    <div data-state="person-filter" style={{ display: "grid", gap: 8, margin: "12px 0 6px", gridTemplateColumns: "minmax(0, 1fr)" }}>
      {showTenure && (
        <div className="search-filter-row" aria-label="在籍">
          {rowLabel("在籍")}
          {tenureOpts.map((o) => {
            const active = filter.tenure === o.key;
            return (
              <Link key={o.key} href={href({ tenure: active ? undefined : o.key, role: filter.role })} style={chip(active)}
                data-state={`person-filter-tenure-${o.key}${active ? "-active" : ""}`} aria-pressed={active}>
                {o.label}{num(o.n, active)}{active && <span aria-hidden="true">✕</span>}
              </Link>
            );
          })}
        </div>
      )}
      {showRole && (
        <div className="search-filter-row" aria-label="職種">
          {rowLabel("職種")}
          {roles.map((r) => {
            const active = filter.role === r.key;
            return (
              <Link key={r.key} href={href({ tenure: filter.tenure, role: active ? undefined : r.key })} style={chip(active)}
                data-state={`person-filter-role${active ? "-active" : ""}`} aria-pressed={active}>
                {r.name}{num(r.count, active)}{active && <span aria-hidden="true">✕</span>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * ★人を「いま／過去」で分けて出す（2026-10-21 / 柴さんの指示）。
 *   社名で引いたときは「現役社員」「OB・OG」、職種などで引いたときは「いまの仕事」「以前の仕事」。
 * ⚠️ 判定は条件に当たった職歴（`PersonHit.tenure`）。分けられない（tenure が null）ときは分けずに出す
 * ⚠️ 人数は上限で切る前の総数（`tenureTotals`）を出す。表示中の件数を数えない
 */
type FollowInfo = { me: string | null; following: Set<string>; followers: Set<string> };

/** ★人は1人1行で縦に並べる（2026-10-21。LinkedIn と同じ。カードの格子にしない） */
function PersonList({ items, f }: { items: SearchResults["person"]["items"]; f: FollowInfo }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)" }}>
      {items.map((it) => (
        <PersonHitCard key={it.userId} person={it} me={f.me} followed={f.following.has(it.userId)} followsMe={f.followers.has(it.userId)} />
      ))}
    </div>
  );
}

function PersonGroups({
  items, totals, byCompany, f,
}: { items: SearchResults["person"]["items"]; totals: SearchResults["person"]["tenureTotals"]; byCompany: boolean; f: FollowInfo }) {
  const grouped = items.some((p) => p.tenure !== null);
  if (!grouped) {
    return <PersonList items={items} f={f} />;
  }
  const groups = [
    { key: "current" as const, label: byCompany ? "現役社員" : "いまの仕事", n: totals?.current ?? 0 },
    { key: "former" as const, label: byCompany ? "OB・OG" : "以前の仕事", n: totals?.former ?? 0 },
  ];
  return (
    /* ⚠️ minmax(0, 1fr) にすること。既定（auto）だと長い理由の行で列が広がり、スマホではみ出す（実測 375px で 422px） */
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "minmax(0, 1fr)" }}>
      {groups.map((g) => {
        const list = items.filter((p) => p.tenure === g.key);
        if (g.n === 0) return null;
        return (
          <div key={g.key} data-state={`person-group-${g.key}`}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 8 }}>
              {g.label}<span style={{ marginLeft: 6, color: "var(--ink-mute)", fontWeight: 600 }}>{g.n}人</span>
            </div>
            {list.length > 0 ? (
              <PersonList items={list} f={f} />
            ) : (
              <p style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)" }}>「すべて表示」から見られます。</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * ★解決できた条件が1つも無かったとき。
 *
 * ⚠️ **全件を並べない。** 条件が無いまま検索すると掲載79社が丸ごと返るが、
 *    それは「検索結果」ではない。件数が多いぶん**当たっているように見えてしまう**ので、
 *    絞り込めなかったことを明示して次の一手を出す。
 * ⚠️ いま解決できるのは職種・事業領域・外資/日系・年収の4つだけ。
 *    社名・勤務地・業種・従業員数は**まだ条件にできない**（受け皿が無いか、
 *    絞りとして機能しない）。ここの文言はその実態と揃えること。
 */
function NoConditionState({ unresolved, hasQuery }: { unresolved: string[]; hasQuery: boolean }) {
  return (
    <div style={{ padding: "26px 20px", borderRadius: 12, border: "1px solid var(--line)", background: "#fff" }}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
        {hasQuery ? "絞り込める条件が見つかりませんでした" : "調べたいことばを入力してください"}
      </p>
      {hasQuery && (
        <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--ink-mute)", lineHeight: 1.7 }}>
          {unresolved.length > 0 && <>入力された{unresolved.join("・")}は、いまの OPINIO では絞り込みに使えません。<br /></>}
          職種（営業・エンジニアなど）、事業領域（セキュリティ・マーケティングなど）、
          外資系／日系、年収 のいずれかを入れると絞り込めます。
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
        {(
          [
            ["/companies", "企業一覧を見る"],
            ["/jobs", "募集一覧を見る"],
          ] as const
        ).map(([href, label]) => (
          <Link
            key={href}
            href={href}
            style={{
              padding: "6px 13px", borderRadius: 100, border: "1px solid var(--line)",
              background: "#fff", color: "var(--ink-soft)", fontSize: 12.5,
              fontWeight: 600, textDecoration: "none",
            }}
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * ★未ログイン × 人が主対象。**個票は出さない。**
 * 件数も `MIN_AGGREGATE_COUNT` 未満なら出さない（n=1/2 は本人の特定に繋がる）。
 * ⚠️ 結果グリッドがあるはずの位置にログイン導線を置く。空白にしない。
 */
function LoginGate({ total }: { total: number }) {
  const enough = total >= MIN_AGGREGATE_COUNT;
  return (
    <div
      style={{
        padding: "26px 20px", borderRadius: 12, border: "1px solid var(--line)",
        background: "#fff", textAlign: "center",
      }}
    >
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
        {enough
          ? `条件に当てはまる方が ${total} 人います`
          : "この条件に当てはまる方がいるかは、ログインすると確認できます"}
      </p>
      <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--ink-mute)", lineHeight: 1.7 }}>
        登録ユーザーのプロフィールは、OPINIO にログインしている方だけに表示しています。
        {!enough && "人数が少ない条件では、人数もお出ししていません。"}
      </p>
      {/* 別ページへの遷移なので濃紺の塗り（ui-conventions） */}
      <Link
        href="/auth"
        className="btn-fixed-size"
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          marginTop: 14, padding: "10px 26px", borderRadius: 8,
          background: "var(--royal)", color: "#fff", fontWeight: 700, fontSize: 13.5,
          textDecoration: "none",
        }}
      >
        ログイン・新規登録
      </Link>
    </div>
  );
}

/** ⚠️ 0件のときに空白を出さない。次の一手を必ず置く */
function EmptyState({
  raw, relaxations, hasQuery,
}: {
  raw: string;
  relaxations: { label: string; index: number; count: number }[];
  hasQuery: boolean;
}) {
  return (
    <div
      style={{
        padding: "26px 20px", borderRadius: 12, border: "1px solid var(--line)",
        background: "#fff",
      }}
    >
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
        {hasQuery ? "条件に当てはまるものが見つかりませんでした" : "調べたいことばを入力してください"}
      </p>
      {relaxations.length > 0 && (
        <>
          <p style={{ margin: "12px 0 8px", fontSize: 12.5, color: "var(--ink-mute)" }}>
            条件を1つ外すと見つかります。
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {relaxations.map((r) => (
              <Link
                key={r.index}
                href={`/search?q=${encodeURIComponent(raw)}&drop=${r.index}`}
                style={{
                  padding: "6px 13px", borderRadius: 100, border: "1px solid var(--line)",
                  background: "#fff", color: "var(--ink-soft)", fontSize: 12.5,
                  fontWeight: 600, textDecoration: "none",
                }}
              >
                「{r.label}」を外す（{r.count}件）
              </Link>
            ))}
          </div>
        </>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: relaxations.length > 0 ? 14 : 12 }}>
        {(
          [
            ["/companies", "企業一覧を見る"],
            ["/jobs", "募集一覧を見る"],
          ] as const
        ).map(([href, label]) => (
          <Link
            key={href}
            href={href}
            style={{
              padding: "6px 13px", borderRadius: 100, border: "1px solid var(--line)",
              background: "#fff", color: "var(--ink-soft)", fontSize: 12.5,
              fontWeight: 600, textDecoration: "none",
            }}
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
