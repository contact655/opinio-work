import Link from "next/link";

/**
 * ★「候補者に貴社を見つけてもらうには」（2026-10-11 / 柴さんの指示。旧 /biz/proposals の「紹介を増やすには」をホームへ移した）。
 * ⚠️ 企業向けでは「紹介」「提案」と書かない（人材紹介と紛らわしいため）。
 * ⚠️ 数は `getEvidenceMaterials`（lib/evidence/materials.ts）。取得に失敗したら「—」で、0 と出さない。
 */
export type FindabilityMaterials = { path: number; motive: number; talkable: number; jobs: number; roles: number } | null;

export function FindabilityCard({ materials }: { materials: FindabilityMaterials }) {
  const rows = [
    { key: "jobs", label: "公開中の求人", value: materials?.jobs, unit: "件", href: "/biz/jobs/new", action: "求人を登録する" },
    { key: "roles", label: "職種を設定した部門", value: materials?.roles, unit: "件", href: "/biz/organization?tab=roles", action: "部門・職種を登録する" },
    { key: "path", label: "貴社に移ってきた方", value: materials?.path, unit: "人", href: "/biz/employees", action: "企業ページに出ている方を確かめる" },
    { key: "motive", label: "入社の決め手の回答", value: materials?.motive, unit: "件", href: "/biz/employees", action: "社員に回答を呼びかける" },
    { key: "talkable", label: "話を聞ける方", value: materials?.talkable, unit: "人", href: "/biz/employees", action: "社員に登録を呼びかける" },
  ] as const;
  return (
    <section data-state="findability" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "16px 18px" }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>候補者に貴社を見つけてもらうには</h2>
      <p style={{ margin: "0 0 10px", fontSize: 12.5, lineHeight: 1.7, color: "var(--ink-mute)" }}>登録が増えるほど、合う方に貴社がおすすめされやすくなります。</p>
      {rows.map((m, i) => (
        <div key={m.key} data-material={m.key} style={{ padding: "8px 0", borderBottom: i === rows.length - 1 ? "none" : "1px solid var(--line-soft)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13.5 }}>
            <span style={{ color: "var(--ink)", minWidth: 0 }}>{m.label}</span>
            <strong data-material-value style={{ color: m.value === 0 ? "var(--warm-ink)" : "var(--ink)", whiteSpace: "nowrap" }}>
              {typeof m.value === "number" ? `${m.value}${m.unit}` : "—"}
            </strong>
          </div>
          <Link href={m.href} style={{ fontSize: 12, fontWeight: 600, color: "var(--royal)" }}>{m.action} →</Link>
        </div>
      ))}
      <Link href="/biz/help/interested" data-state="materials-help" style={{ display: "inline-block", marginTop: 8, fontSize: 12.5, fontWeight: 600, color: "var(--royal)" }}>しくみを見る</Link>
      {materials === null && (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--ink-mute)" }}>数を取得できませんでした（「—」は 0 という意味ではありません）。</p>
      )}
    </section>
  );
}
