import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import MergedTimeline from "@/components/profile/MergedTimeline";
import {
  buildTimelineCareerEntriesFromRaw,
  toTimelineEducationEntries,
  buildFutureData,
  type RawExperienceRow,
  type RawEducation,
} from "@/lib/utils/timeline";
import { getUserAge } from "@/lib/age";
import {
  SocialIcon,
  type SocialPlatform,
  SOCIAL_META,
  SNS_PLATFORMS,
} from "@/components/SocialIcon";

// ─── Types ────────────────────────────────────────────────────────────────────

/** JSONB キー名と一致（"x" = X、ν-8 段階6-1 E で twitter → x 移行済み） */
type SocialLinks = Partial<Record<SocialPlatform, string>>;

type OwUser = {
  id: string;
  name: string;
  avatar_color: string | null;
  cover_color: string | null;
  about_me: string | null;
  birth_date: string | null;
  location: string | null;
  social_links: SocialLinks | null;
  is_mentor: boolean;
  future_aspirations: string | null;
  auth_id: string;
};

type Education = {
  id: string;
  school: string;
  faculty: string | null;
  degree: string | null;
  enrolled_at: string | null;
  graduated_at: string | null;
  is_current: boolean;
  sort_order: number;
};

type Certification = {
  id: string;
  name: string;
  sort_order: number;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from("ow_users")
    .select("name")
    .eq("id", params.id)
    .maybeSingle();
  return { title: data ? `${data.name} — Opinio` : "プロフィール — Opinio" };
}

export default async function UserProfilePage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  // RLS handles visibility: anon sees public only, authenticated sees public+login_only+own.
  // maybeSingle() returns null for private/nonexistent → notFound()
  // auth.getUser() と ow_users fetch を並列実行
  const [
    { data: { user: authUser } },
    { data: user },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("ow_users")
      .select("id, name, avatar_color, cover_color, about_me, birth_date, location, social_links, is_mentor, future_aspirations, auth_id")
      .eq("id", params.id)
      .maybeSingle(),
  ]);

  if (!user) notFound();

  const owUser = user as OwUser;

  const avatarColor = owUser.avatar_color ?? "linear-gradient(135deg, #002366, #3B5FD9)";
  const coverColor = owUser.cover_color ?? "linear-gradient(135deg, #002366, #3B5FD9, #818CF8)";
  const initial = owUser.name.charAt(0);
  const viewerIsOwner = !!authUser && owUser.auth_id === authUser.id;

  // 年齢表示: birth_date をサーバ側で計算（NULL = 非公開）
  const age = getUserAge(owUser.birth_date);
  const ageDisplay = age !== null ? `${age}歳` : null;

  const socialLinks = owUser.social_links ?? {};
  // SNS_PLATFORMS の順序を維持しつつ、値が空文字列でないキーのみ抽出
  const activeSocials = SNS_PLATFORMS.filter(
    (k) => socialLinks[k] && socialLinks[k]!.trim() !== ""
  );

  // Fetch experiences + skill tags + educations + certifications in parallel（RLS select_all=true のため認証不問で読める）
  const [
    { data: expRows }, { data: allRoles }, { data: skillTagsRaw },
    { data: educationsRaw }, { data: certificationsRaw },
  ] = await Promise.all([
    supabase
      .from("ow_experiences")
      .select("id, company_id, company_text, company_anonymized, role_category_id, role_title, started_at, ended_at, is_current, description, why")
      .eq("user_id", owUser.id)
      .order("is_current", { ascending: false })
      .order("started_at", { ascending: false }),
    supabase.from("ow_roles").select("id, name"),
    supabase
      .from("ow_user_skill_tags")
      .select("id, label, sort_order")
      .eq("user_id", owUser.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("ow_user_educations")
      .select("id, school, faculty, degree, enrolled_at, graduated_at, is_current, sort_order")
      .eq("user_id", owUser.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("ow_user_certifications")
      .select("id, name, sort_order")
      .eq("user_id", owUser.id)
      .order("sort_order", { ascending: true }),
  ]);

  const skillTags      = skillTagsRaw      ?? [];
  const educations     = (educationsRaw     ?? []) as Education[];
  const certifications = (certificationsRaw ?? []) as Certification[];

  // ロール表示名を直接参照（ow_roles.name が日本語表示ラベルそのもの、slug 変換不要）
  const roleNameById = new Map<string, string>();
  for (const role of allRoles ?? []) {
    roleNameById.set(role.id as string, role.name as string);
  }

  // Resolve company info (name + logo) for master entries in experiences
  // ロゴは A-1(Phase 2)で MergedTimeline に渡す予定のため取得を維持、現時点では name のみ使用
  const expCompanyIds = (expRows ?? [])
    .filter((r) => r.company_id)
    .map((r) => r.company_id as string);

  type CompanyInfo = { name: string; logoUrl: string | null; logoLetter: string | null; logoGradient: string | null };
  const expCompanyMap = new Map<string, CompanyInfo>();
  if (expCompanyIds.length > 0) {
    const { data: expCompanies } = await supabase
      .from("ow_companies")
      .select("id, name, logo_url, logo_letter, logo_gradient")
      .in("id", expCompanyIds);
    for (const c of expCompanies ?? []) {
      expCompanyMap.set(c.id as string, {
        name: c.name as string,
        logoUrl: (c.logo_url as string | null) ?? null,
        logoLetter: (c.logo_letter as string | null) ?? null,
        logoGradient: (c.logo_gradient as string | null) ?? null,
      });
    }
  }

  // timeline 向け会社名 Map（ロゴは A-1 まで未使用）
  const companyNameById = new Map<string, string>();
  expCompanyMap.forEach((info, id) => companyNameById.set(id, info.name));

  // MergedTimeline 用データ整形
  const timelineCareers = buildTimelineCareerEntriesFromRaw(
    (expRows ?? []) as RawExperienceRow[],
    roleNameById,
    companyNameById,
  );
  const timelineEdus    = toTimelineEducationEntries(educations as RawEducation[]);
  const futureData      = buildFutureData(owUser, viewerIsOwner);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 0 80px" }}>

      {/* Cover + Avatar header */}
      <div style={{
        background: "#fff", border: "1px solid var(--line)",
        borderRadius: 16, overflow: "hidden", marginBottom: 24,
      }}>
        <div style={{ height: 160, background: coverColor }} />

        <div style={{ padding: "0 32px 28px", marginTop: -56, position: "relative" }}>
          <div style={{
            width: 112, height: 112, borderRadius: "50%",
            background: avatarColor,
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 42, fontWeight: 600,
            border: "5px solid #fff",
            boxShadow: "0 4px 16px rgba(15,23,42,0.12)",
            marginBottom: 16, position: "relative",
          }}>
            {initial}
            {owUser.is_mentor && (
              <div style={{
                position: "absolute", bottom: 4, right: 4,
                width: 28, height: 28,
                background: "linear-gradient(135deg, var(--royal), var(--accent))",
                borderRadius: "50%", border: "3px solid #fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff",
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" />
                </svg>
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{
                fontFamily: 'var(--font-noto-serif)',
                fontSize: 26, fontWeight: 700, color: "var(--ink)",
                marginBottom: 6, display: "flex", alignItems: "center", gap: 10,
              }}>
                {owUser.name}
                {owUser.is_mentor && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
                    color: "var(--royal)", background: "var(--royal-50)",
                    border: "1px solid var(--royal-100)",
                    padding: "3px 10px", borderRadius: 100,
                  }}>
                    MENTOR
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {ageDisplay && (
                  <span style={{ fontSize: 13, color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 5 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <circle cx="12" cy="8" r="4" /><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                    </svg>
                    {ageDisplay}
                  </span>
                )}
                {owUser.location && (
                  <span style={{ fontSize: 13, color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 5 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {owUser.location}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* About Me */}
      {owUser.about_me ? (
        <section style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 14, padding: "24px 28px", marginBottom: 20,
        }}>
          <div style={{
            display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16,
            paddingBottom: 14, borderBottom: "1px solid var(--line)",
          }}>
            <span style={{ fontFamily: 'var(--font-noto-serif)', fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>
              About Me
            </span>
          </div>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.9, whiteSpace: "pre-wrap", margin: 0 }}>
            {owUser.about_me}
          </p>
        </section>
      ) : (
        <section style={{
          background: "var(--bg-tint)", border: "1px dashed var(--line)",
          borderRadius: 14, padding: "24px 28px", marginBottom: 20,
          textAlign: "center",
        }}>
          <p style={{ fontSize: 13, color: "var(--ink-mute)", margin: 0 }}>
            自己紹介は未設定です
          </p>
        </section>
      )}

      {/* Skills — 0件時はセクションごと非表示 */}
      {skillTags.length > 0 && (
        <section style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 14, padding: "24px 28px", marginBottom: 20,
        }}>
          <div style={{
            display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16,
            paddingBottom: 14, borderBottom: "1px solid var(--line)",
          }}>
            <span style={{ fontFamily: 'var(--font-noto-serif)', fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>
              スキル
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {skillTags.map((tag) => (
              <span
                key={tag.id as string}
                style={{
                  display: "inline-flex", alignItems: "center",
                  padding: "5px 12px", borderRadius: 100,
                  background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                  fontSize: 13, color: "var(--royal)", fontWeight: 500,
                }}
              >
                {tag.label as string}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* 経歴 — キャリア + 学歴 + 未来を MergedTimeline で統合表示 */}
      {(timelineCareers.length > 0 || timelineEdus.length > 0 || futureData != null) && (
        <section style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 14, padding: "24px 28px", marginBottom: 20,
        }}>
          <div style={{
            display: "flex", alignItems: "baseline", gap: 10, marginBottom: 20,
            paddingBottom: 14, borderBottom: "1px solid var(--line)",
          }}>
            <span style={{ fontFamily: 'var(--font-noto-serif)', fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>
              経歴
            </span>
            <span style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif", fontWeight: 500 }}>
              TIMELINE
            </span>
          </div>
          <MergedTimeline
            careers={timelineCareers}
            educations={timelineEdus}
            future={futureData}
            viewerIsOwner={viewerIsOwner}
          />
        </section>
      )}

      {/* Certifications — 0件時はセクションごと非表示（資格名のみチップ表示） */}
      {certifications.length > 0 && (
        <section style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 14, padding: "24px 28px", marginBottom: 20,
        }}>
          <div style={{
            display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16,
            paddingBottom: 14, borderBottom: "1px solid var(--line)",
          }}>
            <span style={{ fontFamily: 'var(--font-noto-serif)', fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>
              資格・認定
            </span>
            <span style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif", fontWeight: 500 }}>
              CERTIFICATIONS
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {certifications.map((cert) => (
              <span
                key={cert.id}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "5px 12px", borderRadius: 100,
                  background: "var(--warm-soft)", border: "1px solid #FDE68A",
                  fontSize: 13, color: "#92400E", fontWeight: 500,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="6" />
                  <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
                </svg>
                {cert.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Social Links */}
      {activeSocials.length > 0 && (
        <section style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 14, padding: "24px 28px", marginBottom: 20,
        }}>
          <div style={{
            display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16,
            paddingBottom: 14, borderBottom: "1px solid var(--line)",
          }}>
            <span style={{ fontFamily: 'var(--font-noto-serif)', fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>
              リンク
            </span>
          </div>
          {/* アイコンのみ横並び（要望B 準拠） */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {activeSocials.map((platform) => {
              const url = socialLinks[platform]!;
              const label = SOCIAL_META[platform].label;
              return (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                  className="sns-icon-link"
                >
                  <SocialIcon platform={platform} variant="display" />
                </a>
              );
            })}
          </div>
        </section>
      )}

      {/* Footer note */}
      <div style={{ textAlign: "center", padding: "16px 0 0", fontSize: 12, color: "var(--ink-mute)" }}>
        <Link href="/companies" style={{ color: "var(--ink-mute)", textDecoration: "none" }}>
          Opinio
        </Link>
        {" "}のプロフィールページ ·{" "}
        <Link href="/auth" style={{ color: "var(--royal)", textDecoration: "none" }}>
          登録して情報収集を始める
        </Link>
      </div>
    </div>
  );
}
