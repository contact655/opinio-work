import type { CompanyDetail } from "@/app/companies/[id]/mockDetailData";
import { CAPITAL_TYPE_LABELS } from "@/lib/constants/capitalType";

/**
 * 「拠点・資本関係」セクション。
 *
 * ⚠️★**企業詳細と求人詳細の両方から使う**（2026-08-30 に切り出した）。
 *    切り出す前は `companies/[id]/page.tsx` の中にあり、求人詳細に同じものを足すと
 *    実装が2つに割れるところだった。**片方だけ直る形を作らない。**
 *
 * ⚠️ 見出し（`SecTitle`）は**呼び出し側から渡す**。企業詳細と求人詳細で
 *    それぞれ別の `SecTitle` を持っているため、ここで固定しない。
 */
/**
 * 「拠点・資本関係」— サイドバーに入れると折り返す長い値をここに集める。
 *
 * ── なぜ本文に出すか（2026-08-13 実測）────────────────────────────────────
 * サイドバーの値カラムは **172px** しかなく（カード320px − パディング − ラベル90px）、
 * 本社住所・最寄り駅・資本注記は**3行に折り返していた**（PKSHA で最寄り駅3行・注記3行）。
 * 本文は約900px あるので1行に収まる。
 *
 * ⚠️ **さらに重要なのはモバイル。** サイドバーは `hidden lg:flex` で
 *    **1024px 未満では `display: none`**。つまり 375px / 768px では
 *    本社住所・最寄り駅・拠点・資本注記が**どこにも出ていなかった**。
 *    このセクションは本文なので、モバイルで初めてこれらが見えるようになる。
 *
 * ── 出し分け（同じ項目を2箇所に出さない）──────────────────────────────
 * | カード | 出す条件 | サイドバー側 |
 * |---|---|---|
 * | 本社 | `headquarters_address` あり（10社） | 「所在地」行を**出さない** |
 * | その他の拠点 | `branch_locations` あり（28社） | 「拠点」行は**削除済み** |
 * | 資本関係 | **`capital_notes` あり**（18社） | 「資本区分」バッジは残す |
 *
 * ⚠️ 資本関係カードの条件は `capital_type` ではなく **`capital_notes`**。
 *    `capital_type` は65社にあり、それで出すとセクションが66社に広がるが、
 *    資本区分はサイドバーのバッジで足りている（1行に収まる）。
 *    **本文に出す価値があるのは注記の文だけ。**
 *
 * ⚠️ `headquarters_address` が無い社ではサイドバーが `location` で「所在地」を出す。
 *    充填が進めば自動的に本文カード側へ寄り、全社埋まればサイドバーの所在地行は消える。
 *
 * ⚠️ `nearest_station` は本社カードの中にしか出ない。
 *    「駅はあるが住所が無い」社は 0社（2026-08-13 実測）なので取りこぼしは無い。
 */
export function LocationsCapitalSection({ detail, title }: { detail: CompanyDetail; title: React.ReactNode }) {
  const hasHq = !!detail.headquartersAddress;
  const hasBranches = !!(detail.branchLocations && detail.branchLocations.length > 0);
  const hasCapital = !!detail.capitalNotes;
  if (!hasHq && !hasBranches && !hasCapital) return null;

  const CARD: React.CSSProperties = {
    background: "var(--bg-tint)",
    borderRadius: 12,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
  };
  const LABEL: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 5,
    fontSize: 12, fontWeight: 700, color: "var(--ink-soft)",
    letterSpacing: "0.04em", marginBottom: 2,
  };
  /* ⚠️ 主・副とも `color` を明示する。`<div>` なので globals.css の
        `p { color: #334155 }` には当たらないが、様式を揃えるため書いておく。 */
  const MAIN: React.CSSProperties = {
    fontSize: 14, fontWeight: 600, color: "var(--ink)", lineHeight: 1.7,
    fontFamily: "var(--font-inter), var(--font-noto)",
  };
  const SUB: React.CSSProperties = {
    fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7,
    fontFamily: "var(--font-inter), var(--font-noto)",
  };

  return (
    <section
      id="locations"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: "var(--space-6)",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      <div style={{
        padding: "var(--space-6) 32px var(--space-4)",
        borderBottom: "1px solid var(--line-soft)",
      }}>
        {title}
      </div>

      <div style={{ padding: "var(--space-6)" }}>
        {/* ⚠️ `minmax(240px, 1fr)` の 240px は最小幅。狭い画面では1列に折り返す。
               `1fr` ではなく `minmax(0, 1fr)` 相当にするため minWidth: 0 をカードに置いている
               （`.claude/rules/ui-debugging.md`「横はみ出し」の原因1・2）。 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          {hasHq && (
            <div style={CARD}>
              <div style={LABEL}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                </svg>
                本社
              </div>
              <div style={MAIN}>{detail.headquartersAddress}</div>
              {detail.nearestStation && <div style={SUB}>{detail.nearestStation}</div>}
            </div>
          )}

          {hasBranches && (
            <div style={CARD}>
              <div style={LABEL}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-6h6v6" />
                </svg>
                その他の拠点
              </div>
              <div style={MAIN}>{detail.branchLocations!.join("・")}</div>
            </div>
          )}

          {hasCapital && (
            <div style={CARD}>
              <div style={LABEL}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 3h18v18H3z" /><path d="M9 9h6v6H9z" />
                </svg>
                資本関係
              </div>
              {detail.capitalType && (
                <div style={MAIN}>
                  {CAPITAL_TYPE_LABELS[detail.capitalType] ?? detail.capitalType}
                </div>
              )}
              <div style={SUB}>{detail.capitalNotes}</div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
