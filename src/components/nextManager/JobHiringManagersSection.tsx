import Link from "next/link";
import { DMButton } from "@/components/profile/DMButton";
import type { PublicJobManager } from "@/lib/nextManager/server";

/**
 * ★求人ページの「この募集の Hiring Manager」（Next Manager / 2026-11-13）。
 *   出すのは lib/nextManager/server.ts の getPublicJobManagers が返す人だけ（本人が採用中にしている有効な担当者）。
 *   0人なら何も描かない。
 * ⚠️ メッセージは個人どうしのもの（会社には共有されない）。送る画面にもその一行が出る。
 * ⚠️ プレビュー（/biz の求人プレビュー）ではメッセージのボタンを出さない（社内の人が自分たちに送る形になるため）。
 */
export function JobHiringManagersSection({ managers, preview = false }: {
  managers: PublicJobManager[];
  preview?: boolean;
}) {
  if (managers.length === 0) return null;
  return (
    <section id="job-hiring-managers" data-toc="Hiring Manager" data-state="job-hiring-managers"
      style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "var(--space-6)" }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>この募集の Hiring Manager</h2>
      <p style={{ margin: "6px 0 14px", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8 }}>
        入社したら一緒に働く、現場のマネージャーです。メッセージは2人だけのもので、会社には共有されません。
      </p>
      <div style={{ display: "grid", gap: 12 }}>
        {managers.map((m) => (
          <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flexWrap: "wrap" }}>
            <Link href={`/u/${m.userId}`} style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: "1 1 220px", textDecoration: "none", color: "inherit" }}>
              {m.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.avatarUrl} alt="" width={48} height={48} loading="lazy" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <span aria-hidden style={{ width: 48, height: 48, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, var(--royal), #3B5FD9)", color: "#fff", fontWeight: 700 }}>{m.name[0]}</span>
              )}
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 15, fontWeight: 700, overflowWrap: "anywhere" }}>{m.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#17633F", background: "#E7F5EC", borderRadius: 999, padding: "1px 8px" }}>採用中</span>
                </span>
                {m.headline && <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-soft)", overflowWrap: "anywhere" }}>{m.headline}</span>}
                {m.note && <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-soft)", overflowWrap: "anywhere" }}>チームで募集中: {m.note}</span>}
              </span>
            </Link>
            {!preview && <DMButton targetUserId={m.userId} targetName={m.name} variant="primary" label="メッセージ" />}
          </div>
        ))}
      </div>
    </section>
  );
}
