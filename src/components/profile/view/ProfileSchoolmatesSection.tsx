import Link from "next/link";
import { PeopleCardRow, JOB_PEOPLE_CSS } from "@/components/jobs/JobPeopleCards";
import { AVATAR_COLOR } from "@/lib/avatarColor";
import type { SchoolmateGroup } from "@/lib/schools/schoolmates";
import { ProfileTimelineSection } from "./ProfileSections";

/**
 * ★プロフィールの「同じ学校の人」（2026-10-21）。学歴の下に、学校ごとに会社ページの社員と同じカードで並べる。
 * ⚠️ ログイン中にだけ出す（呼ぶ側が判定）。中身の判定は lib/schools/schoolmates.ts
 * ⚠️ 見ている人も同じ学校なら「あなたも◯◯の出身です」と添える
 */
export function ProfileSchoolmatesSection({ groups }: { groups: SchoolmateGroup[] }) {
  if (groups.length === 0) return null;
  return (
    /* ⚠️ 枠は職歴・学歴と同じ部品（ProfileTimelineSection）。自前の箱にしない（他の欄と形がずれる） */
    <ProfileTimelineSection id="schoolmates" title="同じ学校の人" latin="SCHOOLMATES">
      <div data-state="profile-schoolmates">
      <style>{JOB_PEOPLE_CSS}</style>
      {groups.map((g) => (
        <div key={g.schoolId} style={{ marginTop: 4, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <Link href={`/schools/${g.schoolId}`} style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", textDecoration: "none" }}>{g.schoolName}</Link>
            {g.total > 0 && <span style={{ fontSize: 12.5, color: "var(--ink-mute)" }}>{g.total}名</span>}
            {g.viewerAlso && (
              <span data-state="schoolmates-viewer-also" style={{ fontSize: 12, fontWeight: 700, color: "var(--royal)", background: "var(--royal-50)", borderRadius: 999, padding: "2px 9px" }}>
                あなたも{g.schoolName}の出身です
              </span>
            )}
          </div>
          {g.people.length > 0 && (
            <PeopleCardRow count={g.people.length}>
              {g.people.map((p) => (
                <a key={p.userId} href={`/u/${p.userId}`} className="jpc-card" title={[p.name, p.sub].filter(Boolean).join(" / ")}>
                  <span className="jpc-avatar" style={{ background: p.avatarUrl ? undefined : AVATAR_COLOR.bg, color: AVATAR_COLOR.text }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : p.initial}
                  </span>
                  <span className="jpc-name">{p.name}</span>
                  <span className="jpc-role">{p.sub}</span>
                </a>
              ))}
            </PeopleCardRow>
          )}
          {g.total > g.people.length && (
            <Link href={`/schools/${g.schoolId}`} style={{ display: "inline-block", marginTop: 8, fontSize: 12.5, fontWeight: 600, color: "var(--royal)", textDecoration: "none" }}>
              {g.schoolName}の出身者をすべて見る →
            </Link>
          )}
        </div>
      ))}
      </div>
    </ProfileTimelineSection>
  );
}
