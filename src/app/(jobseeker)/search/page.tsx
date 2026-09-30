import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { interpretQuery, type Condition, type SearchKind } from "@/lib/search/interpretQuery";
import {
  runSearch, skillBandsForCompanies, MIN_AGGREGATE_COUNT,
  type SearchResults, type SkillBand,
} from "@/lib/search/runSearch";
import { logSearch, resolveOwUserId } from "@/lib/search/searchLog";
import { chipStyle } from "@/lib/utils/chipVariant";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import { PersonHitCard } from "./PersonHitCard";

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

type Props = { searchParams: { q?: string; drop?: string; kind?: string } };

const KIND_LABEL: Record<SearchKind, string> = {
  company: "企業",
  job: "募集",
  person: "人",
  article: "記事",
};

/** タブの並び。⚠️ ヘッダーのナビ（企業・募集・ユーザー・フィード・記事）と同じ順にしてある */
const KIND_ORDER: SearchKind[] = ["company", "job", "person", "article"];

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

function CompanyCard({ item }: { item: SearchResults["company"]["items"][number] }) {
  return (
    <Link
      href={`/companies/${item.slug ?? item.id}`}
      style={{
        display: "flex", gap: 12, alignItems: "flex-start", padding: 14,
        borderRadius: 12, border: "1px solid var(--line)", background: "#fff",
        textDecoration: "none", color: "inherit",
      }}
    >
      <CompanyLogo
        logoUrl={item.logoUrl} name={item.name}
        logoLetter={item.logoLetter} logoGradient={item.logoGradient} size={44}
      />
      <span style={{ minWidth: 0, display: "block" }}>
        <span style={{ display: "block", fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>
          {item.name}
        </span>
        {/* ⚠️ 事業領域が無いときは行ごと出さない（「—」で埋めない） */}
        {item.domain && (
          <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-mute)", marginTop: 2 }}>
            {item.domain}
          </span>
        )}
        {item.tagline && (
          <span
            style={{
              display: "block", fontSize: 12.5, color: "var(--ink-soft)", marginTop: 4,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
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
  );
}

function JobCard({ item }: { item: SearchResults["job"]["items"][number] }) {
  const money = chipStyle("money");
  return (
    <Link
      href={`/jobs/${item.slug ?? item.id}`}
      style={{
        display: "block", padding: 14, borderRadius: 12,
        border: "1px solid var(--line)", background: "#fff",
        textDecoration: "none", color: "inherit",
      }}
    >
      <span style={{ display: "block", fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>
        {item.title}
      </span>
      <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-mute)", marginTop: 3 }}>
        {item.companyName}
      </span>
      {item.salaryMin !== null && (
        /* ⚠️ 緑は金銭的にプラスの条件だけ（chipVariant.ts）。ここは年収なので money */
        <span
          style={{
            display: "inline-block", marginTop: 7, padding: "3px 9px", borderRadius: 100,
            background: money.bg, color: money.color, border: `1px solid ${money.border}`,
            fontSize: 12, fontWeight: 600,
          }}
        >
          {item.salaryMin}
          {item.salaryMax !== null && item.salaryMax !== item.salaryMin ? `〜${item.salaryMax}` : ""}万円
        </span>
      )}
    </Link>
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

// ── ページ本体 ───────────────────────────────────────────────────────────────

export default async function SearchPage({ searchParams }: Props) {
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
  const results = raw.trim() && !nothingResolved ? await runSearch(conditions, isLoggedIn) : EMPTY;

  /* ★社名として解決した語が標準スキルにもあるとき、「そのスキルを持つ人」への橋渡しを出す。
     ⚠️ 条件には混ぜない（同じ語で company と skill を両方立てると AND で潰れる）。
     ⚠️ 人数の下限は `MIN_AGGREGATE_COUNT`。人の件数を出す閾値と揃える
        （n=1/2 の「1人います」は本人の特定に繋がる）。 */
  const skillBands: SkillBand[] = nothingResolved
    ? []
    : (await skillBandsForCompanies(conditions)).filter((b) => b.count >= MIN_AGGREGATE_COUNT);

  const primary = interpreted.primaryKind;

  /* ★どのタブを見ているか（2026-10-01）。`?kind=` が無ければ「すべて」。
     ⚠️ 知らない値は「すべて」に倒す（URL を手で書き換えられても壊れない）。 */
  const activeKind: SearchKind | "all" =
    (KIND_ORDER as string[]).includes(searchParams.kind ?? "")
      ? (searchParams.kind as SearchKind)
      : "all";

  /* ★「すべて」では**主対象を先頭に**置く。`interpretQuery` が決めた優先順を捨てない。
     ⚠️ 残りは `KIND_ORDER`（ヘッダーのナビと同じ並び）。**件数順にしないこと** ——
        同じ語で引いても日によって並びが変わる。 */
  const visibleKinds: SearchKind[] =
    activeKind === "all" ? [primary, ...KIND_ORDER.filter((k) => k !== primary)] : [activeKind];
  const totalAll = KIND_ORDER.reduce((n, k) => n + results[k].total, 0);

  /* 0件のときだけ「条件を1つ外すと」を計算する。
     ⚠️ 条件ごとに引き直すので、当たっているときはやらない（無駄な往復を作らない）。 */
  const relaxations: { label: string; index: number; count: number }[] = [];
  if (raw.trim() && !nothingResolved && totalAll === 0 && conditions.length >= 2) {
    for (let i = 0; i < interpreted.conditions.length; i++) {
      const rest = interpreted.conditions.filter((_, j) => j !== i);
      if (rest.length === 0) continue;
      const r = await runSearch(rest, isLoggedIn);
      const n = KIND_ORDER.reduce((m, k) => m + r[k].total, 0);
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


  return (
    <div style={{ background: "#f0f4f8", minHeight: "70vh" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px 48px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", margin: 0 }}>
          {raw.trim() ? `「${raw.trim()}」の検索結果` : "検索"}
        </h1>

        {/* ── 解釈した条件 ── */}
        {(conditions.length > 0 || interpreted.unresolved.length > 0) && (
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
        {!nothingResolved && raw.trim() && (
          <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(["all", ...KIND_ORDER] as const).map((k) => {
              const active = activeKind === k;
              const n = k === "all" ? totalAll : results[k].total;
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
        {nothingResolved ? (
          <section style={{ marginTop: 22 }}>
            <NoConditionState unresolved={interpreted.unresolved} hasQuery={!!raw.trim()} />
          </section>
        ) : totalAll === 0 ? (
          <section style={{ marginTop: 22 }}>
            <EmptyState raw={raw} relaxations={relaxations} hasQuery={!!raw.trim()} />
          </section>
        ) : (
          visibleKinds.map((k) => {
            const full = activeKind !== "all" || k === primary;
            const items = full ? results[k].items : results[k].items.slice(0, PREVIEW_PER_KIND);
            const gated = k === "person" && !isLoggedIn;
            if (results[k].total === 0) return null;
            return (
              <section key={k} style={{ marginTop: 22 }}>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  {KIND_LABEL[k]}
                  {(k !== "person" || isLoggedIn || results.person.total >= MIN_AGGREGATE_COUNT) && (
                    <span style={{
                      fontSize: 12, fontWeight: 700, color: "var(--ink-soft)",
                      background: "var(--line-soft)", borderRadius: 100, padding: "2px 9px",
                    }}>{results[k].total}</span>
                  )}
                </h2>
                <div style={{ marginTop: 12 }}>
                  {gated ? (
                    <LoginGate total={results.person.total} />
                  ) : (
                    <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                      {k === "company" && (items as typeof results.company.items).map((it) => <CompanyCard key={it.id} item={it} />)}
                      {k === "job" && (items as typeof results.job.items).map((it) => <JobCard key={it.id} item={it} />)}
                      {k === "person" && (items as typeof results.person.items).map((it) => <PersonHitCard key={it.userId} person={it} />)}
                      {k === "article" && (items as typeof results.article.items).map((it) => <ArticleCard key={it.id} item={it} />)}
                    </div>
                  )}
                </div>
                {/* ⚠️★切ったことを黙らない。押す先はこの種別のタブ（検索条件を保ったまま） */}
                {!gated && results[k].total > items.length && (
                  <p style={{ marginTop: 10, fontSize: 12.5, color: "var(--ink-mute)" }}>
                    {results[k].total}件のうち {items.length}件を表示しています。
                    {activeKind === "all" && (
                      <Link href={`/search?q=${encodeURIComponent(raw)}&kind=${k}`}
                        style={{ color: "var(--royal)", fontWeight: 600, marginLeft: 6 }}>
                        すべて表示 →
                      </Link>
                    )}
                  </p>
                )}
              </section>
            );
          })
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
