import Link from "next/link";

export type TeamMember = {
  id: string;
  name: string;
  initial: string;
  gradient: string;
  role: string;
  permission: "admin" | "editor" | "viewer";
};

const PERM_LABELS: Record<TeamMember["permission"], string> = {
  admin: "管理者",
  editor: "編集者",
  viewer: "閲覧者",
};

const PERM_STYLES: Record<TeamMember["permission"], { bg: string; color: string }> = {
  admin: { bg: "var(--royal-50)", color: "var(--royal)" },
  editor: { bg: "var(--purple-soft)", color: "var(--purple)" },
  viewer: { bg: "var(--line-soft)", color: "var(--ink-mute)" },
};

type Props = {
  members: TeamMember[];
  planType: string | null;
};

export function TeamMembers({ members, planType }: Props) {
  const maxFree = 1;
  const visible = planType ? members : members.slice(0, maxFree);
  const locked = !planType && members.length > maxFree;

  return (
    <section style={{
      background: "#fff",
      border: "1px solid var(--line)",
      borderRadius: 14,
      padding: "22px 26px",
    }}>
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--line)",
      }}>
        <div style={{
          fontFamily: "'Noto Serif JP', serif",
          fontSize: 15, fontWeight: 600, color: "var(--ink)",
          display: "flex", alignItems: "baseline", gap: 8,
        }}>
          チームメンバー
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 9, fontWeight: 700,
            color: "var(--ink-mute)", letterSpacing: "0.15em", textTransform: "uppercase",
          }}>Team</span>
        </div>
        <Link href="/biz/team" style={{ fontSize: 11, color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>
          管理 →
        </Link>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map((m) => {
          const ps = PERM_STYLES[m.permission];
          return (
            <div key={m.id} style={{
              display: "grid",
              gridTemplateColumns: "32px 1fr auto",
              alignItems: "center",
              gap: 10,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: m.gradient,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: "#fff",
                flexShrink: 0,
              }}>
                {m.initial}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{m.name}</div>
                <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{m.role}</div>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700,
                padding: "2px 8px", borderRadius: 100,
                background: ps.bg, color: ps.color,
              }}>
                {PERM_LABELS[m.permission]}
              </span>
            </div>
          );
        })}
      </div>

      {locked && (
        <div style={{
          marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--line)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12,
        }}>
          <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
            他 {members.length - maxFree} 名 — 有料プランで管理
          </span>
          <a href="/biz/upgrade" style={{
            fontSize: 11, fontWeight: 700,
            color: "var(--royal)", textDecoration: "none",
          }}>
            アップグレード →
          </a>
        </div>
      )}
    </section>
  );
}
