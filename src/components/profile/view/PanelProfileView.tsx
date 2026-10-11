import type { ComponentProps, ReactNode } from "react";
import CompanyLogoImg from "@/components/profile/CompanyLogoImg";
import SchoolLogoImg from "@/components/profile/SchoolLogoImg";
import type { CareerEntry, EducationEntry, EducationSchoolMaster } from "@/components/profile/MergedTimeline";
import type { AutoSkill } from "@/lib/profile/autoSkills";
import { formatDuration, formatYmLabel } from "@/lib/profile/tenure";
import { rankLabel } from "@/lib/constants/careerOptions";
import { languageProficiencyLabel } from "@/lib/constants/languageProficiency";
import { SKILL_CATEGORIES } from "@/lib/constants/skills";

/**
 * ★右欄（候補者を探す・メッセージのドロワー）用の、詰まったプロフィール表示（2026-10-11 / 柴さんの指示）。
 *
 * ⚠️★**見た目だけの部品。** データの取得と見せてよい範囲の判定は `UserProfileContent` が行い、
 *    出来上がった値をここへ渡すだけ。ここで取り直さない・条件を足さない。/u/[id] の見た目には関係しない。
 *
 * - 帯・大きな顔アイコン・名前と会社ロゴの段は出さない（名前は欄の上の固定部分だけ）
 * - 並び：職歴 → スキル → 自己紹介 → 学歴 → 残りの項目 → アクティビティ（人事が最初の画面で職歴を読めるように）
 * - カードにしない。日本語の小見出し＋区切り線だけ。英語の小見出しは出さない
 * - ⚠️ 状態をバッジにしない（「在籍中」は期間の「〜現在」で表す）
 * - ⚠️ 中身が空の項目は出さない（「まだ投稿していません」などの空表示を出さない）
 */

type Education = EducationEntry & { school_master?: EducationSchoolMaster | null };
type SchoolMaster = ComponentProps<typeof SchoolLogoImg>["schoolMaster"];

export type PanelProfileData = {
  aboutMe: string | null;
  careers: CareerEntry[];
  educations: EducationEntry[];
  /** 入学年月の無い学歴（/u/[id] では年表の下に出しているもの） */
  unplacedEducations: Array<{ id: string; school: string; faculty?: string | null; degree?: string | null; school_master?: SchoolMaster | null }>;
  skills: Array<{ id: string; skill: { label: string; category: string } | null }>;
  autoSkills: AutoSkill[];
  achievements: Array<{ id: string; title: string; value: string | null; unit: string | null; description: string | null }>;
  awards: Array<{ id: string; title: string; issuer: string | null; awarded_at: string | null }>;
  certifications: Array<{ id: string; name: string; issuer: string | null; issued_at: string | null }>;
  languages: Array<{ id: string; name: string; proficiency: string | null }>;
  mediaAppearances: Array<{ id: string; title: string; media_name: string | null; url: string | null; appeared_at: string | null }>;
  featuredArticles: Array<{ id: string; slug: string; title: string; published_at: string | null }>;
  contentLinks: Array<{ id: string; url: string; title: string | null }>;
  socialLinks: Record<string, string | undefined>;
  posts: Array<{ id: string; content: string; created_at: string }>;
};

const ink = "var(--ink)";
const soft = "var(--ink-soft)";
const mute = "var(--ink-mute)";

function Section({ title, children, first }: { title: string; children: ReactNode; first?: boolean }) {
  return (
    <section style={{ padding: "14px 0", borderTop: first ? "none" : "1px solid var(--line)" }}>
      <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: ink }}>{title}</h3>
      {children}
    </section>
  );
}

function period(start: string | null, end: string | null, isCurrent: boolean): string {
  if (!start) return "";
  const range = `${formatYmLabel(start)}〜${isCurrent ? "現在" : formatYmLabel(end)}`;
  const dur = formatDuration(start, isCurrent ? null : end);
  return dur ? `${range}（${dur}）` : range;
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

/** 同じ会社が続く職歴は会社名を1回だけ出す（/u/[id] の年表と同じ束ね方。代替表示の社名は束ねない） */
function groupCareers(careers: CareerEntry[]): CareerEntry[][] {
  const groups: CareerEntry[][] = [];
  for (const c of careers) {
    const last = groups[groups.length - 1];
    const key = c.company_id ?? (c.is_placeholder_company ? null : c.company_name);
    const lastKey = last ? (last[0].company_id ?? (last[0].is_placeholder_company ? null : last[0].company_name)) : undefined;
    if (last && key && key === lastKey) last.push(c);
    else groups.push([c]);
  }
  return groups;
}

export function PanelProfileView({ data }: { data: PanelProfileData }) {
  const careerGroups = groupCareers(data.careers);
  const skillGroups = [
    ...[
      { label: "職種", rows: data.autoSkills.filter((a) => a.kind === "role").map((a) => ({ key: `r:${a.label}`, label: a.label, sub: a.band })) },
      { label: "業界", rows: data.autoSkills.filter((a) => a.kind === "domain").map((a) => ({ key: `d:${a.label}`, label: a.label, sub: a.band })) },
    ],
    ...SKILL_CATEGORIES.map((c) => ({
      label: c.label,
      rows: data.skills.filter((s) => s.skill?.category === c.value).map((s) => ({ key: s.id, label: s.skill!.label, sub: null as string | null })),
    })),
  ].filter((g) => g.rows.length > 0);
  const socials = Object.values(data.socialLinks).filter((u): u is string => typeof u === "string" && !!u);
  const links = [
    ...data.contentLinks.map((l) => ({ key: l.id, url: l.url, label: l.title || hostOf(l.url) })),
    ...socials.map((u) => ({ key: u, url: u, label: hostOf(u) })),
  ];

  const sections: Array<{ title: string; body: ReactNode }> = [];

  if (careerGroups.length > 0) sections.push({
    title: "職歴",
    body: (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {careerGroups.map((g) => {
          const head = g[0];
          return (
            <div key={head.id} style={{ display: "flex", gap: 10, minWidth: 0 }}>
              <div style={{ flexShrink: 0, paddingTop: 1 }}>
                <CompanyLogoImg logoUrl={head.logo_url ?? null} logoLetter={head.logo_letter ?? null} logoGradient={head.logo_gradient ?? null} name={head.company_name} size={24} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: ink, overflowWrap: "anywhere" }}>{head.company_name}</div>
                {g.map((c) => {
                  /* ⚠️ 役職の区分（rank）と社内での呼び方（rank_title）は対で出す。片方だけにしない（/u/[id] と同じ形） */
                  const rl = rankLabel(c.rank);
                  const rank = rl ? (c.rank_title ? `${rl}（${c.rank_title}）` : rl) : (c.rank_title || null);
                  const role = [c.role_parent_name, c.role_label].filter(Boolean).join("・");
                  const lines = [c.department, [c.role_title, rank].filter(Boolean).join("・") || null, role || null].filter(Boolean) as string[];
                  return (
                    <div key={c.id} data-state="panel-career-row" style={{ marginTop: 4 }}>
                      {lines.length > 0 && (
                        <div style={{ fontSize: 14, color: soft, lineHeight: 1.6, overflowWrap: "anywhere" }}>{lines.join(" / ")}</div>
                      )}
                      <div style={{ fontSize: 13, color: mute }}>{period(c.started_at, c.ended_at, c.is_current)}</div>
                      {c.secondment_company_name && (
                        <div style={{ fontSize: 13, color: mute }}>{c.secondment_company_name}へ出向</div>
                      )}
                      {c.description && (
                        <p style={{ margin: "4px 0 0", fontSize: 13, color: soft, lineHeight: 1.7, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{c.description}</p>
                      )}
                      {c.join_reason && (
                        <p style={{ margin: "4px 0 0", fontSize: 13, color: soft, lineHeight: 1.7, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>選んだ理由：{c.join_reason}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    ),
  });

  if (skillGroups.length > 0) sections.push({
    title: "スキル",
    body: (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {skillGroups.map((g) => (
          <div key={g.label}>
            <div style={{ fontSize: 12, color: mute, marginBottom: 4 }}>{g.label}</div>
            <div style={{ fontSize: 14, color: soft, lineHeight: 1.7, overflowWrap: "anywhere" }}>
              {g.rows.map((r, i) => (
                <span key={r.key}>
                  {i > 0 && "、"}{r.label}{r.sub && <span style={{ fontSize: 12.5, color: mute }}>（{r.sub}）</span>}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    ),
  });

  if (data.aboutMe?.trim()) sections.push({
    title: "自己紹介",
    body: <p style={{ margin: 0, fontSize: 14, color: soft, lineHeight: 1.8, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{data.aboutMe}</p>,
  });

  const eduRows: Array<{ id: string; school: string; sub: string; when: string; master: SchoolMaster | null }> = [
    ...(data.educations as Education[]).map((e) => ({
      id: e.id, school: e.school, sub: [e.faculty, e.degree].filter(Boolean).join(" · "),
      when: period(e.enrolled_at, e.graduated_at, e.is_current).replace(/（.*）$/, ""), master: e.school_master ?? null,
    })),
    ...data.unplacedEducations.map((e) => ({
      id: e.id, school: e.school, sub: [e.faculty, e.degree].filter(Boolean).join(" · "), when: "入学年月 未入力", master: e.school_master ?? null,
    })),
  ];
  if (eduRows.length > 0) sections.push({
    title: "学歴",
    body: (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {eduRows.map((e) => (
          <div key={e.id} style={{ display: "flex", gap: 10, minWidth: 0 }}>
            <div style={{ flexShrink: 0, paddingTop: 1 }}><SchoolLogoImg schoolMaster={e.master} size={24} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: ink, overflowWrap: "anywhere" }}>{e.school}</div>
              {e.sub && <div style={{ fontSize: 14, color: soft }}>{e.sub}</div>}
              {e.when && <div style={{ fontSize: 13, color: mute }}>{e.when}</div>}
            </div>
          </div>
        ))}
      </div>
    ),
  });

  const list = (rows: Array<{ key: string; main: ReactNode; sub?: string | null }>) => (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((r) => (
        <li key={r.key} style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, color: ink, overflowWrap: "anywhere" }}>{r.main}</div>
          {r.sub && <div style={{ fontSize: 13, color: mute, overflowWrap: "anywhere" }}>{r.sub}</div>}
        </li>
      ))}
    </ul>
  );
  const linkStyle = { color: "var(--royal)", textDecoration: "none" } as const;

  if (data.achievements.length > 0) sections.push({ title: "実績", body: list(data.achievements.map((a) => ({
    key: a.id, main: <>{a.title}{a.value && <>：{a.value}{a.unit ?? ""}</>}</>, sub: a.description,
  }))) });
  if (data.awards.length > 0) sections.push({ title: "受賞・表彰", body: list(data.awards.map((a) => ({
    key: a.id, main: a.title, sub: [a.issuer, a.awarded_at ? formatYmLabel(a.awarded_at) : null].filter(Boolean).join(" · ") || null,
  }))) });
  if (data.certifications.length > 0) sections.push({ title: "資格", body: list(data.certifications.map((c) => ({
    key: c.id, main: c.name, sub: [c.issuer, c.issued_at ? formatYmLabel(c.issued_at) : null].filter(Boolean).join(" · ") || null,
  }))) });
  if (data.languages.length > 0) sections.push({ title: "語学", body: list(data.languages.map((l) => ({
    key: l.id, main: l.name, sub: languageProficiencyLabel(l.proficiency),
  }))) });
  if (data.mediaAppearances.length > 0) sections.push({ title: "メディア掲載", body: list(data.mediaAppearances.map((m) => ({
    key: m.id,
    main: m.url ? <a href={m.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>{m.title}</a> : m.title,
    sub: [m.media_name, m.appeared_at ? formatYmLabel(m.appeared_at) : null].filter(Boolean).join(" · ") || null,
  }))) });
  if (data.featuredArticles.length > 0) sections.push({ title: "OPINIO掲載記事", body: list(data.featuredArticles.map((a) => ({
    key: a.id, main: <a href={`/articles/${a.slug}`} target="_blank" rel="noopener noreferrer" style={linkStyle}>{a.title}</a>,
  }))) });
  if (links.length > 0) sections.push({ title: "発信・リンク", body: list(links.map((l) => ({
    key: l.key, main: <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" style={linkStyle}>{l.label}</a>,
  }))) });
  if (data.posts.length > 0) sections.push({ title: "アクティビティ", body: list(data.posts.map((p) => ({
    key: p.id,
    main: <span style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "pre-wrap", color: soft }}>{p.content}</span>,
    sub: formatYmLabel(p.created_at.slice(0, 10)),
  }))) });

  if (sections.length === 0) {
    return <p data-state="panel-profile-empty" style={{ margin: "12px 0", fontSize: 13, color: mute }}>プロフィールはまだ書かれていません。</p>;
  }
  return (
    <div data-state="panel-profile">
      {sections.map((s, i) => <Section key={s.title} title={s.title} first={i === 0}>{s.body}</Section>)}
    </div>
  );
}
