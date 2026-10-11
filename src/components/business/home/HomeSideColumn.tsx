import Link from "next/link";
import type { HomeSide } from "@/lib/business/homeTypes";

/**
 * ★ホームの右の細い列（2026-10-12）。今月のメッセージ／求人の数／企業ページの状態。
 * ⚠️ 状態はバッジにしない（文字だけ）。⚠️ 取れなかった数は「—」（0 と出さない）。
 */
const CARD: React.CSSProperties = { background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "14px 16px" };
const H: React.CSSProperties = { margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "var(--ink)" };
const LINK: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "var(--royal)", textDecoration: "none" };

function Bar({ pct }: { pct: number }) {
  return (
    <div aria-hidden="true" style={{ height: 6, borderRadius: 3, background: "var(--line-soft)", margin: "4px 0 10px", overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", background: "var(--royal)" }} />
    </div>
  );
}

export function HomeSideColumn({ side }: { side: HomeSide }) {
  const j = side.jobs;
  const jobRows = [
    { label: "公開中", n: j?.published, href: "/biz/jobs?status=published" },
    { label: "下書き", n: j?.draft, href: "/biz/jobs?status=draft" },
    { label: "停止中", n: j?.stopped, href: "/biz/jobs?status=stopped" },
  ];
  return (
    <aside style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      {side.quota !== undefined && (
        <section data-state="home-quota" style={CARD}>
          <h2 style={H}>今月のメッセージ</h2>
          {side.quota ? (
            <div style={{ fontSize: 13, color: "var(--ink)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>送った数</span><strong data-state="home-sent">{side.quota.sentText}</strong></div>
              <div style={{ fontSize: 11.5, color: "var(--ink-mute)", marginTop: 2 }}>{side.quota.sentSub}</div>
              <Bar pct={side.quota.sentPct} />
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>返事待ち</span><strong data-state="home-open">{side.quota.openText}</strong></div>
              <div style={{ fontSize: 11.5, color: "var(--ink-mute)", marginTop: 2 }}>{side.quota.openSub}</div>
              <Bar pct={side.quota.openPct} />
              <Link href="/biz/analytics?tab=messages" style={LINK}>振り返りを見る →</Link>
            </div>
          ) : <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-mute)" }}>件数を確認できませんでした</p>}
        </section>
      )}
      <section data-state="home-jobs" style={CARD}>
        <h2 style={H}>求人</h2>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {jobRows.map((r) => (
            <Link key={r.label} href={r.href} data-job-tab={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 32, fontSize: 13, color: "var(--ink)", textDecoration: "none" }}>
              <span>{r.label}</span>
              <strong style={{ color: r.n ? "var(--ink)" : "var(--ink-mute)" }}>{typeof r.n === "number" ? `${r.n}件` : "—"}</strong>
            </Link>
          ))}
        </div>
      </section>
      <section data-state="home-company" style={CARD}>
        <h2 style={H}>企業ページ</h2>
        <Link href="/biz/company" style={{ display: "block", fontSize: 13, color: "var(--ink)", textDecoration: "none" }}>
          <span data-state="home-company-status">{side.companyStatus}</span>
          <span style={{ ...LINK, display: "block", marginTop: 4 }}>企業ページを開く →</span>
        </Link>
      </section>
    </aside>
  );
}
