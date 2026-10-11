import Link from "next/link";
import type { HomeActions } from "@/lib/business/homeTypes";

/**
 * ★ホームの「対応が必要なもの（n）」（2026-10-12）。中身は `lib/business/actionItems.ts` の1か所。
 * ⚠️ 件数は items の数。画面で数え直さない。⚠️ 状態はバッジにしない（灰色の文字）。
 * ⚠️ 0件のときも枠は出す（「確かめた結果、無い」ことを伝える）。取れなかった種類があれば一言添える。
 */
const LIMIT = 10;
const BTN: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 36, padding: "0 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap", background: "#fff", color: "var(--royal)", border: "1px solid var(--line)" };

export function HomeActionList({ actions }: { actions: HomeActions }) {
  const { items, failed, meetings } = actions;
  return (
    <section data-state={items.length > 0 ? "has-actions" : "no-actions"} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, minWidth: 0, overflow: "hidden" }}>
      <h2 style={{ margin: 0, padding: "16px 20px", fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
        対応が必要なもの（<span data-state="action-count">{items.length}</span>）
      </h2>
      {items.length === 0 ? (
        <p data-state="no-actions-text" style={{ margin: 0, padding: "0 20px 18px", fontSize: 13, color: "var(--ink-mute)" }}>今日の対応はありません</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.slice(0, LIMIT).map((t, i) => (
            <li key={`${t.kind}-${i}`} className="biz-home-row" data-action-kind={t.kind}>
              <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", overflowWrap: "anywhere" }}>{t.title}</div>
                {t.sub && <div style={{ fontSize: 12.5, color: "var(--ink-mute)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.sub}>{t.sub}</div>}
              </div>
              <Link href={t.href} className="btn-fixed-size" style={BTN}>{t.action}</Link>
            </li>
          ))}
          {items.length > LIMIT && (
            <li style={{ fontSize: 12.5, color: "var(--ink-mute)", padding: "10px 20px", borderTop: "1px solid var(--line-soft)" }}>
              ほか {items.length - LIMIT} 件は、メッセージ・選考管理の各画面で確認できます
            </li>
          )}
        </ul>
      )}
      {failed.length > 0 && (
        <p data-state="actions-failed" style={{ margin: 0, padding: "10px 20px 14px", fontSize: 12, color: "var(--ink-mute)", borderTop: "1px solid var(--line-soft)" }}>
          {failed.join("・")}を確認できませんでした（件数に入っていません）。
        </p>
      )}
      {/* ★今日・明日の面談（2026-10-12）。件数には入れない。⚠️ 無ければ（取れなかったときも）枠ごと出さない */}
      {meetings && meetings.length > 0 && (
        <div data-state="home-meetings" style={{ borderTop: "1px solid var(--line-soft)", padding: "10px 20px 12px", background: "var(--bg-tint)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 4 }}>今日・明日の面談</div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {meetings.map((m) => (
              <li key={m.id}>
                <Link href={m.href} data-state="home-meeting" style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", padding: "4px 0", fontSize: 13, color: "var(--ink)", textDecoration: "none" }}>
                  <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{m.dayLabel} {m.time}</span>
                  <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{m.name}さん</span>
                  <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{m.detail}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <style>{`
        .biz-home-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 12px 20px; border-top: 1px solid var(--line-soft); }
        @media (max-width: 767px) { .biz-home-row { padding: 12px 16px; gap: 10px; } }
      `}</style>
    </section>
  );
}
