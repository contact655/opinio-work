import Link from "next/link";
import type { HomeChecklistItem } from "@/lib/business/homeTypes";

/**
 * ★ホームの「はじめにやること（済んだ数 / 全体）」（2026-10-12。旧スタートガイド・企業ページの充実度・
 *   「候補者に貴社を見つけてもらうには」を1つにした）。項目と判定は dashboard/page.tsx の `buildChecklist`。
 * ⚠️ 済んだ項目はチェック付きで下へ。**全部済んだら枠ごと出さない**（呼び出し側ではなくここで決める）。
 */
export function HomeChecklist({ items }: { items: HomeChecklistItem[] }) {
  const done = items.filter((i) => i.done).length;
  if (items.length === 0 || done === items.length) return null;
  const ordered = [...items.filter((i) => !i.done), ...items.filter((i) => i.done)];
  return (
    <section data-state="home-checklist" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, minWidth: 0, overflow: "hidden" }}>
      <h2 style={{ margin: 0, padding: "16px 20px 10px", fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
        はじめにやること（<span data-state="checklist-done">{done}</span> / {items.length}）
      </h2>
      <ul style={{ listStyle: "none", margin: 0, padding: "0 0 6px" }}>
        {ordered.map((it) => (
          <li key={it.key} data-check={it.key} data-done={it.done ? "1" : "0"}>
            <Link href={it.href} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", textDecoration: "none", minHeight: 44 }}>
              <span aria-hidden="true" style={{
                width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
                border: it.done ? "none" : "1.5px solid var(--line)", background: it.done ? "var(--line-soft)" : "#fff",
              }}>
                {it.done && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: it.done ? 500 : 600, color: it.done ? "var(--ink-mute)" : "var(--ink)" }}>{it.label}</span>
                {!it.done && it.hint && <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-mute)", marginTop: 1 }}>{it.hint}</span>}
              </span>
              {it.done
                ? <span className="sr-only">済み</span>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="2" aria-hidden="true" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6" /></svg>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
