import Link from "next/link";
import type { PathsRowView, PathsStartView, PathsView } from "@/lib/paths/server";
import { prevCareerHref, prevCareerText } from "@/lib/people/prevCareer";

/**
 * ★「その経歴から次に進んだ人」の集計（2026-11-03。旧 /paths の PathsResult の集計部分）。
 *   /people（前の経歴で絞ったとき・一覧の上）と /home（あなたと同じ経歴の人の行き先）が同じ部品を使う。
 *
 * ⚠️ 各行は5人以上（MIN_AGGREGATE_COUNT。lib/paths/server.ts が切る）。ここで人数を足したり作ったりしない。
 * ⚠️ variant="home" は、出せる行が1つも無いとき null を返す（ホームに空の箱を出さない）。
 */
function Rows({ title, rows }: { title: string; rows: PathsRowView[] }) {
  if (rows.length === 0) return null;
  return (
    <div data-state="paths-dim" style={{ minWidth: 0 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-mute)", margin: "0 0 8px" }}>{title}</h3>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
        {rows.map((r) => (
          <li key={r.label} data-state="paths-row" style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14, minWidth: 0 }}>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.label}>
              {r.href ? <Link href={r.href} style={{ color: "var(--royal)", textDecoration: "none" }}>{r.label}</Link> : r.label}
            </span>
            <span style={{ flexShrink: 0, color: "var(--ink-soft)", fontWeight: 600 }}>{r.count}人</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PrevCareerSummary({ view, variant = "people" }: {
  view: Pick<PathsView, "start" | "summary" | "wider">;
  variant?: "people" | "home";
}) {
  const start: PathsStartView | null = view.start;
  if (!start) return null;
  const s = view.summary;
  const hasRows = !!s && s.company.length + s.role.length + s.industry.length > 0;
  if (variant === "home" && !hasRows) return null;

  return (
    <section data-state={variant === "home" ? "home-paths" : "paths-summary"}
      className={variant === "home" ? "home-box" : undefined}
      style={variant === "home" ? undefined : { marginBottom: 20, padding: 20, border: "1px solid var(--line)", borderRadius: 12, background: "#fff", minWidth: 0 }}>
      <h2 style={{ fontSize: variant === "home" ? 17 : 16, fontWeight: 800, margin: "0 0 4px", color: "var(--ink)", lineHeight: 1.5 }}>
        {variant === "home" ? "あなたと同じ経歴の人の行き先" : `「${prevCareerText(start)}」から次に進んだ人`}
      </h2>
      {variant === "home" && (
        <p style={{ margin: "0 0 4px", fontSize: 12.5, color: "var(--ink-mute)", lineHeight: 1.7 }}>
          直近の職歴が「{prevCareerText(start)}」の人が、次にどこへ進んだか。
        </p>
      )}
      {s && s.moverCount !== null && (
        <p data-state="paths-basis" style={{ margin: "0 0 14px", fontSize: 13, color: "var(--ink-mute)" }}>{s.moverCount}人の動きから（5人以上の項目だけ）</p>
      )}
      {hasRows && s ? (
        <div className="prev-career-dims">
          <Rows title="次の会社" rows={s.company} />
          <Rows title="次の職種" rows={s.role} />
          <Rows title="次の業界" rows={s.industry} />
        </div>
      ) : (
        <div data-state="paths-few">
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--ink-soft)" }}>
            まだ集計に出せるほどの動きがありません（5人以上の動きがあるものだけを出しています）。
          </p>
          {view.wider.length > 0 && (
            <p data-state="paths-wider" style={{ margin: "12px 0 0", fontSize: 14 }}>
              広げて見る：{" "}
              {view.wider.map((w, i) => (
                <span key={prevCareerHref(w)}>
                  {i > 0 && "／"}
                  <Link href={prevCareerHref(w)} scroll={false} style={{ color: "var(--royal)" }}>{prevCareerText(w)}</Link>
                </span>
              ))}
            </p>
          )}
        </div>
      )}
      {variant === "home" && (
        <p style={{ margin: "14px 0 0", fontSize: 13 }}>
          <Link href={prevCareerHref(start)} data-state="home-paths-more" style={{ color: "var(--royal)", fontWeight: 600 }}>この経歴から進んだ人を見る →</Link>
        </p>
      )}
      <style>{`
        .prev-career-dims { display: grid; gap: 20px; grid-template-columns: minmax(0, 1fr); }
        @media (min-width: 768px) { .prev-career-dims { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
      `}</style>
    </section>
  );
}
