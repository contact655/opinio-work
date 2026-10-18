import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAutoSkills } from "@/lib/profile/autoSkillsServer";
import { calcTotalExperience } from "@/lib/profile/tenure";
import { RANK_LABELS } from "@/lib/constants/careerOptions";
import { languageProficiencyLabel } from "@/lib/constants/languageProficiency";
import { ANON_COMPANY_LABEL } from "@/lib/experiences/companyName";
import { asOfLabel, buildResumeCompanies, type ResumeExperienceInput } from "@/lib/profile/resume";
import { ResumeDocument, RESUME_CSS, type ResumeDocData } from "@/components/profile/ResumeDocument";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "職務経歴書", robots: { index: false, follow: false } };

/**
 * ★職務経歴書（2026-10-18 / 柴さんの指示）。本人だけが開ける（/mypage 配下なので middleware がログインを求める）。
 *   組み立ては lib/profile/resume.ts。入れないもの（年収・理由・連絡先・住所・生年月日・性別）はそちらの冒頭。
 * ⚠️ 引くのは本人の行だけ（admin で引くが、すべて ow_users.id = 本人 で絞る）。
 * ⚠️ 会社名は登記の名前（ow_companies.name）。職務経歴書は正式な社名で書くのが一般的なため（表示名にしない）。
 */
export default async function ResumePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/mypage/resume");

  const admin = createAdminClient();
  const { data: me, error: meErr } = await admin.from("ow_users")
    .select("id, name, about_me, headline").eq("auth_id", user.id).maybeSingle();
  if (meErr) console.error("[resume] ow_users:", meErr.message);
  if (!me) redirect("/mypage");
  const uid = me.id as string;

  const [exps, roles, achs, awards, certs, langs, skills, edus] = await Promise.all([
    admin.from("ow_experiences")
      .select("id, company_id, company_text, company_anonymized, role_category_id, role_title, department, rank, rank_title, started_at, ended_at, is_current, description, employment_type, secondment_company_id, secondment_company_text")
      .eq("user_id", uid),
    supabase.from("ow_roles").select("id, name, parent_id"),
    supabase.from("ow_user_achievements").select("title, value, unit, description, experience_id, sort_order").eq("user_id", uid).order("sort_order", { ascending: true }),
    supabase.from("ow_user_awards").select("title, issuer, awarded_at, sort_order").eq("user_id", uid).order("sort_order", { ascending: true }),
    supabase.from("ow_user_certifications").select("name, issuer, issued_at, sort_order").eq("user_id", uid).order("sort_order", { ascending: true }),
    supabase.from("ow_user_languages").select("proficiency, sort_order, language:ow_languages(label)").eq("user_id", uid).order("sort_order", { ascending: true }),
    supabase.from("ow_user_skills").select("skill:ow_skills(label)").eq("user_id", uid).order("created_at", { ascending: true }),
    supabase.from("ow_user_educations").select("school, faculty, degree, enrolled_at, graduated_at, is_current, sort_order").eq("user_id", uid).order("sort_order", { ascending: true }),
  ]);
  for (const [label, r] of [["experiences", exps], ["roles", roles], ["achievements", achs], ["awards", awards], ["certifications", certs], ["languages", langs], ["skills", skills], ["educations", edus]] as const) {
    if (r.error) console.error(`[resume] ${label}:`, r.error.message);
  }
  /* ⚠️ 職歴が読めなかったときは書類を出さない（欠けた職務経歴書を「完成品」に見せない） */
  const failed = !!exps.error;

  const expRows = (exps.data ?? []) as Record<string, unknown>[];
  const companyIds = Array.from(new Set(expRows.flatMap((e) => [e.company_id, e.secondment_company_id]).filter((x): x is string => typeof x === "string")));
  const { data: cos, error: coErr } = companyIds.length
    ? await admin.from("ow_companies").select("id, name").in("id", companyIds)
    : { data: [], error: null };
  if (coErr) console.error("[resume] companies:", coErr.message);
  const coName = new Map(((cos ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));

  const roleRows = (roles.data ?? []) as { id: string; name: string; parent_id: string | null }[];
  const roleById = new Map(roleRows.map((r) => [r.id, r]));
  const roleNameById = new Map(roleRows.map((r) => [r.id, { name: r.name, parent_name: r.parent_id ? (roleById.get(r.parent_id)?.name ?? null) : null }]));

  const inputs: ResumeExperienceInput[] = expRows.map((e) => {
    const cid = (e.company_id as string | null) ?? null;
    const ctext = (e.company_text as string | null) ?? null;
    const anon = (e.company_anonymized as string | null) ?? null;
    const name = cid ? (coName.get(cid) ?? null) : ctext ?? (anon ? ANON_COMPANY_LABEL : null);
    const roleId = (e.role_category_id as string | null) ?? null;
    const sid = (e.secondment_company_id as string | null) ?? null;
    return {
      id: e.id as string,
      companyName: name,
      companyKey: cid ?? (ctext ? `text:${ctext.trim()}` : null),
      role: ((e.role_title as string | null) ?? "").trim() || (roleId ? roleById.get(roleId)?.name ?? null : null),
      department: (e.department as string | null) ?? null,
      rank: ((e.rank_title as string | null) ?? "").trim() || (e.rank ? RANK_LABELS[e.rank as string] ?? null : null),
      employmentType: (e.employment_type as string | null) ?? null,
      startedAt: (e.started_at as string | null) ?? null,
      endedAt: (e.ended_at as string | null) ?? null,
      isCurrent: e.is_current === true,
      description: (e.description as string | null) ?? null,
      secondmentCompanyName: sid ? (coName.get(sid) ?? null) : ((e.secondment_company_text as string | null) ?? null),
    };
  });
  const companies = buildResumeCompanies(inputs, ((achs.data ?? []) as Record<string, unknown>[]).map((a) => ({
    experienceId: (a.experience_id as string | null) ?? null, title: (a.title as string) ?? "",
    value: (a.value as string | null) ?? null, unit: (a.unit as string | null) ?? null, description: (a.description as string | null) ?? null,
  })));
  const unlinkedAchievements = ((achs.data ?? []) as Record<string, unknown>[]).filter((a) => !a.experience_id);
  const total = calcTotalExperience(inputs.map((e) => e.startedAt));
  const autoSkills = failed ? [] : await buildAutoSkills(supabase, expRows, roleNameById, "resume");
  const skillLabels = ((skills.data ?? []) as { skill: { label: string } | { label: string }[] | null }[])
    .map((s) => (Array.isArray(s.skill) ? s.skill[0]?.label : s.skill?.label)).filter((x): x is string => !!x);
  const langRows = ((langs.data ?? []) as { proficiency: string | null; language: { label: string } | { label: string }[] | null }[])
    .map((l) => ({ label: Array.isArray(l.language) ? l.language[0]?.label : l.language?.label, level: languageProficiencyLabel(l.proficiency) }))
    .filter((l) => !!l.label);
  const certRows = (certs.data ?? []) as { name: string; issuer: string | null; issued_at: string | null }[];
  const awardRows = (awards.data ?? []) as { title: string; issuer: string | null; awarded_at: string | null }[];
  const eduRows = (edus.data ?? []) as { school: string; faculty: string | null; degree: string | null; enrolled_at: string | null; graduated_at: string | null; is_current: boolean }[];
  const doc: ResumeDocData = {
    asOf: asOfLabel(new Date()),
    name: ((me.name as string | null) ?? "").trim(),
    about: ((me.about_me as string | null) ?? "").trim(),
    totalLabel: total?.label ?? null,
    companies,
    autoSkills: autoSkills.map((s) => ({ label: s.label, band: s.band })),
    skillLabels,
    achievements: unlinkedAchievements.map((a) => {
      const head = [a.title as string, [a.value, a.unit].filter(Boolean).join("")].filter((x) => !!x && String(x).trim()).join("：");
      return a.description ? `${head}（${String(a.description).trim()}）` : head;
    }).filter(Boolean),
    certifications: certRows.map((c) => ({ name: c.name, issuer: c.issuer, issuedAt: c.issued_at })),
    languages: langRows.map((l) => ({ label: l.label as string, level: l.level ?? null })),
    awards: awardRows.map((a) => ({ title: a.title, issuer: a.issuer, awardedAt: a.awarded_at })),
    educations: eduRows.map((e) => ({ school: e.school, faculty: e.faculty, degree: e.degree, enrolledAt: e.enrolled_at, graduatedAt: e.graduated_at, isCurrent: e.is_current })),
  };

  return (
    <div className="rsm-wrap">
      <style>{`
        .rsm-wrap { max-width: 860px; margin: 0 auto; padding: 24px 16px 64px; }
        .rsm-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
        @media print { .rsm-wrap { max-width: none; padding: 0; } }
        ${RESUME_CSS}
      `}</style>

      <div className="rsm-bar" data-print-hide>
        <Link href="/mypage" style={{ fontSize: 13, color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>← マイページ</Link>
        <span style={{ flex: 1 }} />
        {!failed && <PrintButton />}
      </div>
      <p data-print-hide style={{ margin: "0 0 16px", fontSize: 12.5, color: "var(--ink-mute)", lineHeight: 1.7 }}>
        マイページに入れた職歴から作った職務経歴書です。印刷の画面で「PDFに保存」を選ぶと、PDF にできます。
        年収・連絡先・住所・生年月日は入れていません。直したいところはマイページで直すと、ここにも反映されます。
      </p>

      {failed
        ? <p data-state="resume-failed" style={{ fontSize: 13, color: "var(--ink-mute)" }}>職歴を読み込めませんでした。時間をおいて開き直してください。</p>
        : <ResumeDocument d={doc} />}
    </div>
  );
}
