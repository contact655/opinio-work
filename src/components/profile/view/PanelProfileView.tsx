import type { ComponentProps, ReactNode } from "react";
import CompanyLogoImg from "@/components/profile/CompanyLogoImg";
import SchoolLogoImg from "@/components/profile/SchoolLogoImg";
import type { CareerEntry, EducationEntry, EducationSchoolMaster } from "@/components/profile/MergedTimeline";
import type { AutoSkill } from "@/lib/profile/autoSkills";
import { formatDuration, formatYmLabel } from "@/lib/profile/tenure";
import { rankLabel } from "@/lib/constants/careerOptions";
import { languageProficiencyLabel } from "@/lib/constants/languageProficiency";
import { SKILL_CATEGORIES } from "@/lib/constants/skills";
import { PanelProfileScroll, type PanelSection } from "@/components/profile/view/PanelProfileScroll";

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

/** ★1本のスクロールの節（2026-10-12）。「その他」に語学・資格・実績・受賞・メディア・掲載記事・リンク・活動をまとめる */
type GroupKey = "career" | "skills" | "about" | "education" | "other";
const GROUP_LABELS: Record<GroupKey, string> = { career: "職歴", skills: "スキル", about: "自己紹介", education: "学歴", other: "その他" };
const GROUP_ORDER: GroupKey[] = ["career", "skills", "about", "education", "other"];

/** `sectioned` … 候補者を探すの右欄だけ（2026-10-12）。中身・判定は同じで、節の目次（帯）を付けて1本で並べる */
export function PanelProfileView({ data, sectioned = false }: { data: PanelProfileData; sectioned?: boolean }) {
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

  const sections: Array<{ title: string; body: ReactNode; tab: GroupKey }> = [];

  if (careerGroups.length > 0) sections.push({
    title: "職歴", tab: "career",
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
                  /* ★2行目＝職種名（社内での呼び方・職種。例: AE・フィールドセールス）／3行目＝部署・役職。
                        区切りは「・」だけ（「/」は使わない）。値が無い行は出さない */
                  const roleLine = Array.from(new Set([c.role_title, c.role_label].filter(Boolean) as string[])).join("・");
                  const orgLine = [c.department, rank].filter(Boolean).join("・");
                  const lines = [roleLine, orgLine].filter(Boolean);
                  return (
                    <div key={c.id} data-state="panel-career-row" style={{ marginTop: 4 }}>
                      {lines.map((l) => (
                        <div key={l} style={{ fontSize: 14, color: soft, lineHeight: 1.6, overflowWrap: "anywhere" }}>{l}</div>
                      ))}
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
    title: "スキル", tab: "skills",
    body: (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {skillGroups.map((g) => (
          <div key={g.label}>
            {/* ★分類名（職種・業界など）は、分類が2種類以上あるときだけ出す */}
            {skillGroups.length > 1 && <div style={{ fontSize: 12, color: mute, marginBottom: 4 }}>{g.label}</div>}
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
    title: "自己紹介", tab: "about",
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
    title: "学歴", tab: "education",
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

  if (data.achievements.length > 0) sections.push({ title: "実績", tab: "other", body: list(data.achievements.map((a) => ({
    key: a.id, main: <>{a.title}{a.value && <>：{a.value}{a.unit ?? ""}</>}</>, sub: a.description,
  }))) });
  if (data.awards.length > 0) sections.push({ title: "受賞・表彰", tab: "other", body: list(data.awards.map((a) => ({
    key: a.id, main: a.title, sub: [a.issuer, a.awarded_at ? formatYmLabel(a.awarded_at) : null].filter(Boolean).join(" · ") || null,
  }))) });
  if (data.certifications.length > 0) sections.push({ title: "資格", tab: "other", body: list(data.certifications.map((c) => ({
    key: c.id, main: c.name, sub: [c.issuer, c.issued_at ? formatYmLabel(c.issued_at) : null].filter(Boolean).join(" · ") || null,
  }))) });
  if (data.languages.length > 0) sections.push({ title: "語学", tab: "other", body: list(data.languages.map((l) => ({
    key: l.id, main: l.name, sub: languageProficiencyLabel(l.proficiency),
  }))) });
  if (data.mediaAppearances.length > 0) sections.push({ title: "メディア掲載", tab: "other", body: list(data.mediaAppearances.map((m) => ({
    key: m.id,
    main: m.url ? <a href={m.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>{m.title}</a> : m.title,
    sub: [m.media_name, m.appeared_at ? formatYmLabel(m.appeared_at) : null].filter(Boolean).join(" · ") || null,
  }))) });
  if (data.featuredArticles.length > 0) sections.push({ title: "OPINIO掲載記事", tab: "other", body: list(data.featuredArticles.map((a) => ({
    key: a.id, main: <a href={`/articles/${a.slug}`} target="_blank" rel="noopener noreferrer" style={linkStyle}>{a.title}</a>,
  }))) });
  if (links.length > 0) sections.push({ title: "発信・リンク", tab: "other", body: list(links.map((l) => ({
    key: l.key, main: <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" style={linkStyle}>{l.label}</a>,
  }))) });
  if (data.posts.length > 0) sections.push({ title: "アクティビティ", tab: "other", body: list(data.posts.map((p) => ({
    key: p.id,
    main: <span style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "pre-wrap", color: soft }}>{p.content}</span>,
    sub: formatYmLabel(p.created_at.slice(0, 10)),
  }))) });

  if (sectioned) {
    /* ⚠️ 中身の無い節は出さない。「その他」の中は 語学 → 資格 → 実績 → 受賞 → メディア → 掲載記事 → リンク → 活動 の順 */
    const OTHER_ORDER = ["語学", "資格", "実績", "受賞・表彰", "メディア掲載", "OPINIO掲載記事", "発信・リンク", "アクティビティ"];
    const groups: PanelSection[] = GROUP_ORDER.map((key): PanelSection | null => {
      const own = sections.filter((x) => x.tab === key);
      if (own.length === 0) return null;
      if (key !== "other") return { key, label: GROUP_LABELS[key], body: <div>{own.map((x) => <div key={x.title}>{x.body}</div>)}</div> };
      const ordered = [...own].sort((a, b) => OTHER_ORDER.indexOf(a.title) - OTHER_ORDER.indexOf(b.title));
      return {
        key, label: GROUP_LABELS[key],
        body: (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {ordered.map((x) => (
              <div key={x.title}>
                <h4 style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: mute }}>{x.title}</h4>
                {x.body}
              </div>
            ))}
          </div>
        ),
      };
    }).filter((g): g is PanelSection => g !== null);
    return <PanelProfileScroll sections={groups} />;
  }

  if (sections.length === 0) {
    return <p data-state="panel-profile-empty" style={{ margin: "12px 0", fontSize: 13, color: mute }}>プロフィールはまだ書かれていません。</p>;
  }
  return (
    <div data-state="panel-profile">
      {sections.map((s, i) => <Section key={s.title} title={s.title} first={i === 0}>{s.body}</Section>)}
    </div>
  );
}
