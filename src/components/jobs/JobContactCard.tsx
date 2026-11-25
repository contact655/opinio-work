import Link from "next/link";
import { DMButton } from "@/components/profile/DMButton";
import type { CompanyRecruiter } from "@/lib/supabase/queries";
import type { PublicJobManager } from "@/lib/nextManager/server";

/**
 * 求人ページのサイドバー「採用担当」（2026-11-26）。上にこの募集の Hiring Manager、下に採用担当者。
 *
 * - Hiring Manager は本人が「採用中」にしている人だけ（getPublicJobManagers）。0人なら出さない
 * - 採用担当者は企業の有効な担当者（getCompanyRecruiters。会社と is_test が一致する人だけ）
 * - 「メッセージを送る」は DMButton が送れるかを確かめ、送れない相手には何も出さない
 * - どちらも0人ならカードごと出さない
 *
 * ⚠️ プレビュー（/biz の求人プレビュー）ではメッセージのボタンを出さない（社内の人が自分たちに送る形になるため）。
 * ⚠️ メッセージは個人どうしのもの。Hiring Manager にはその一行を出す（2026-11-13 の Next Manager の決めごと）。
 */
function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={44} height={44} loading="lazy" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <span aria-hidden style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--line-soft)", color: "var(--ink-mute)", fontWeight: 700, fontSize: 16 }}>
      {name.charAt(0)}
    </span>
  );
}

export function JobContactCard({ managers, recruiters, companyName, preview, title }: {
  managers: PublicJobManager[];
  recruiters: CompanyRecruiter[];
  companyName: string;
  preview: boolean;
  title: React.ReactNode;
}) {
  if (managers.length === 0 && recruiters.length === 0) return null;
  return (
    <div data-state="job-contact">
      {title}
      {managers.length > 0 && (
        <div data-state="job-hiring-managers" style={{ marginBottom: recruiters.length > 0 ? 16 : 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 4 }}>この募集の Hiring Manager</div>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7 }}>
            入社したら一緒に働く、現場のマネージャーです。メッセージは2人だけのもので、会社には共有されません。
          </p>
          {managers.map((m) => (
            <div key={m.userId} style={{ display: "grid", gap: 8, padding: "8px 0" }}>
              <Link href={`/u/${m.userId}`} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, textDecoration: "none", color: "inherit" }}>
                <Avatar url={m.avatarUrl} name={m.name} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, overflowWrap: "anywhere" }}>{m.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#17633F", background: "#E7F5EC", borderRadius: 999, padding: "1px 8px" }}>採用中</span>
                  </span>
                  {m.headline && <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-mute)", overflowWrap: "anywhere" }}>{m.headline}</span>}
                  {m.note && <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-mute)", overflowWrap: "anywhere" }}>チームで募集中: {m.note}</span>}
                </span>
              </Link>
              {!preview && <DMButton targetUserId={m.userId} targetName={m.name} variant="card" label="メッセージを送る" />}
            </div>
          ))}
        </div>
      )}
      {recruiters.length > 0 && (
        <div data-state="job-recruiters">
          {managers.length > 0 && <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 4 }}>採用担当者</div>}
          {recruiters.map((r, i) => (
            <div key={r.id} style={{ display: "grid", gap: 8, padding: "8px 0", borderTop: i === 0 ? undefined : "1px solid var(--line-soft)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <Avatar url={r.avatar_url} name={r.name} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--ink)", overflowWrap: "anywhere" }}>{r.name}</span>
                  <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-mute)", overflowWrap: "anywhere" }}>
                    {[companyName, r.department, r.role_title].filter(Boolean).join(" ・ ")}
                  </span>
                </span>
              </div>
              {!preview && <DMButton targetUserId={r.user_id} targetName={r.name} variant="card" label="メッセージを送る" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
