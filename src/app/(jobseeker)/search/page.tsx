import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { interpretQuery, type Condition, type SearchKind } from "@/lib/search/interpretQuery";
import { runSearch, MIN_AGGREGATE_COUNT, type SearchResults } from "@/lib/search/runSearch";
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

type Props = { searchParams: { q?: string; drop?: string } };

const KIND_LABEL: Record<SearchKind, string> = {
  company: "企業",
  job: "募集",
  person: "人",
};

const KIND_LIST_HREF: Record<SearchKind, string> = {
  company: "/companies",
  job: "/jobs",
  person: "/people",
};

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
  };
  const results = raw.trim() && !nothingResolved ? await runSearch(conditions, isLoggedIn) : EMPTY;

  const primary = interpreted.primaryKind;
  const others = (["company", "job", "person"] as SearchKind[]).filter((k) => k !== primary);
  const totalAll = results.company.total + results.job.total + results.person.total;

  /* 0件のときだけ「条件を1つ外すと」を計算する。
     ⚠️ 条件ごとに引き直すので、当たっているときはやらない（無駄な往復を作らない）。 */
  const relaxations: { label: string; index: number; count: number }[] = [];
  if (raw.trim() && !nothingResolved && totalAll === 0 && conditions.length >= 2) {
    for (let i = 0; i < interpreted.conditions.length; i++) {
      const rest = interpreted.conditions.filter((_, j) => j !== i);
      if (rest.length === 0) continue;
      const r = await runSearch(rest, isLoggedIn);
      const n = r.company.total + r.job.total + r.person.total;
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

  const sectionTitle = { company: "企業", job: "募集", person: "人" }[primary];

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

        {/* ── 主対象 ── */}
        <section style={{ marginTop: 22 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            {sectionTitle}
            {!nothingResolved &&
              (primary !== "person" || isLoggedIn || results.person.total >= MIN_AGGREGATE_COUNT) && (
              <span
                style={{
                  fontSize: 12, fontWeight: 700, color: "var(--ink-soft)",
                  background: "var(--line-soft)", borderRadius: 100, padding: "2px 9px",
                }}
              >
                {results[primary].total}
              </span>
            )}
          </h2>

          <div style={{ marginTop: 12 }}>
            {nothingResolved ? (
              <NoConditionState unresolved={interpreted.unresolved} hasQuery={!!raw.trim()} />
            ) : primary === "person" && !isLoggedIn ? (
              <LoginGate total={results.person.total} />
            ) : results[primary].items.length === 0 ? (
              <EmptyState raw={raw} relaxations={relaxations} hasQuery={!!raw.trim()} />
            ) : (
              <div
                style={{
                  display: "grid", gap: 10,
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                }}
              >
                {primary === "company" &&
                  results.company.items.map((it) => <CompanyCard key={it.id} item={it} />)}
                {primary === "job" &&
                  results.job.items.map((it) => <JobCard key={it.id} item={it} />)}
                {primary === "person" &&
                  results.person.items.map((it) => <PersonHitCard key={it.userId} person={it} />)}
              </div>
            )}
          </div>

          {/* ⚠️ 上限で切ったことを黙らない */}
          {results[primary].items.length > 0 && results[primary].total > results[primary].items.length && (
            <p style={{ marginTop: 10, fontSize: 12.5, color: "var(--ink-mute)" }}>
              {results[primary].total}件のうち {results[primary].items.length}件を表示しています。
            </p>
          )}
        </section>

        {/* ── 他の対象は件数の注記だけ。⚠️ 条件0件のときは出さない（全件の数字になるため） ── */}
        {!nothingResolved && (
        <section style={{ marginTop: 26, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 13 }}>
            {others.map((k) => {
              /* 人は未ログインだと下限未満で件数を伏せる */
              const hidden = k === "person" && !isLoggedIn && results.person.total < MIN_AGGREGATE_COUNT;
              return (
                <span key={k} style={{ color: "var(--ink-mute)" }}>
                  {KIND_LABEL[k]}:{" "}
                  {hidden ? (
                    <Link href="/auth" style={{ color: "var(--royal)", fontWeight: 700 }}>
                      ログインすると表示
                    </Link>
                  ) : (
                    <>
                      <strong style={{ color: "var(--ink)" }}>{results[k].total}</strong> 件
                      {results[k].total > 0 && (
                        <Link
                          href={KIND_LIST_HREF[k]}
                          style={{ color: "var(--royal)", fontWeight: 600, marginLeft: 6 }}
                        >
                          一覧へ
                        </Link>
                      )}
                    </>
                  )}
                </span>
              );
            })}
          </div>
        </section>
        )}
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
