import { acceptRate, REFERENCE_ONLY_BELOW, ROW_RATE_MIN, type AnalyticsCell, type AnalyticsRow, type ApproachAnalytics } from "@/lib/approaches/analytics";
import { APPROACH_EXPIRE_DAYS } from "@/lib/constants/companyApproaches";

/**
 * ★/biz/analytics の「声かけ」タブ（2026-10-10 / 段6）。集計は lib/approaches/analytics.ts。
 * ⚠️ 承認率の分母は「結果の出た件数」（承認＋送って30日を過ぎた承認待ち）。10件未満は「参考値」、行ごとに5件未満は率を「—」。
 */
export function ApproachTab({ data, periodLabel }: { data: ApproachAnalytics | null; periodLabel: string }) {
  if (!data) {
    return <p style={{ fontSize: 13, color: "var(--error)" }}>声かけの数字を取得できませんでした（0件という意味ではありません）。</p>;
  }
  const t = data.total;
  const rate = acceptRate(t);
  const reference = t.resolved < REFERENCE_ONLY_BELOW;
  return (
    <div data-state="approach-analytics">
      <div className="an-kpis" style={{ marginBottom: 16 }}>
        <Card label="送った数" value={String(t.sent)} sub={periodLabel} />
        <Card label="承認された数" value={String(t.accepted)} sub={periodLabel} />
        <Card label="承認率" value={rate === null ? "—" : `${rate}%`} sub={`結果の出た ${t.resolved} 件のうち`} badge={rate !== null && reference ? "参考値" : null} />
        <Card label="面談につながった数" value={String(t.meetings)} sub="承認された声かけのうち" />
      </div>
      <p style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7, margin: "0 0 16px" }}>
        承認率は「結果の出た件数」（承認された件数と、送ってから{APPROACH_EXPIRE_DAYS}日を過ぎた承認待ち）を分母にしています。
        見送りと返事なしは区別しません。結果の出た件数が{REFERENCE_ONLY_BELOW}件未満のときは参考値、表の行ごとに{ROW_RATE_MIN}件未満のときは率を出していません。
        検証用アカウントの分は含みません。
      </p>
      <Table title="送った人ごと" rows={data.bySender} />
      <Table title="関連する求人を添えたか" rows={data.byJob} note="2026-10-10 から記録しています。それより前の声かけは「記録なし」です。" />
      <Table title="理由の字数" rows={data.byReasonLength} />
      <Table title="本文のテンプレート" rows={data.byTemplate} note="テンプレートの機能はまだありません。2026-10-10 以降の声かけは「テンプレートなし」、それより前は「記録なし」です。" />
    </div>
  );
}

function Card({ label, value, sub, badge }: { label: string; value: string; sub?: string; badge?: string | null }) {
  return (
    <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 600 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
        <span style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-inter), var(--font-noto)" }}>{value}</span>
        {badge && <span data-state="reference-only" style={{ fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 100, background: "var(--line-soft)", color: "var(--ink-soft)" }}>{badge}</span>}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: "var(--ink-mute)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function rateCell(c: AnalyticsCell): string {
  const r = acceptRate(c);
  return c.resolved < ROW_RATE_MIN || r === null ? "—" : `${r}%`;
}

function Table({ title, rows, note }: { title: string; rows: AnalyticsRow[]; note?: string }) {
  const th: React.CSSProperties = { textAlign: "right", padding: "8px 10px", fontWeight: 600, color: "var(--ink-soft)", fontSize: 12, whiteSpace: "nowrap" };
  const td: React.CSSProperties = { textAlign: "right", padding: "8px 10px", fontSize: 13, fontFamily: "var(--font-inter), var(--font-noto)" };
  return (
    <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "14px 16px", marginBottom: 16, overflowX: "auto" }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>{title}</div>
      {note && <div style={{ fontSize: 11.5, color: "var(--ink-mute)", marginBottom: 6 }}>{note}</div>}
      {rows.length === 0 || rows.every((r) => r.sent === 0) ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>この期間に送った声かけはありません</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }} aria-label={title}>
          <thead><tr style={{ borderBottom: "1px solid var(--line)" }}>
            <th style={{ ...th, textAlign: "left" }}></th><th style={th}>送った</th><th style={th}>結果が出た</th><th style={th}>承認</th><th style={th}>承認率</th><th style={th}>面談</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} data-row={r.key} style={{ borderBottom: "1px solid var(--line-soft)" }}>
                <td style={{ ...td, textAlign: "left", fontFamily: "inherit" }}>{r.label}</td>
                <td style={td}>{r.sent}</td><td style={td}>{r.resolved}</td><td style={td}>{r.accepted}</td>
                <td style={td} data-rate>{rateCell(r)}</td><td style={td}>{r.meetings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
