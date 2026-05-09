import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { CareerEntry } from "@/lib/utils/career";
import { CareerTimeline } from "@/components/profile/CareerTimeline";
import { getUserAge } from "@/lib/age";
import {
  SocialIcon,
  type SocialPlatform,
  SOCIAL_META,
  SNS_PLATFORMS,
} from "@/components/SocialIcon";

// DB_NAME_TO_SLUG for role label resolution
const DB_NAME_TO_SLUG: Record<string, string> = {
  "営業": "sales", "PdM / PM": "pm", "カスタマーサクセス": "cs",
  "エンジニア": "engineer", "マーケティング": "marketing", "経営・CxO": "exec", "その他": "other",
  "フィールドセールス": "field_sales", "エンタープライズ営業": "enterprise_sales",
  "インサイドセールス": "inside_sales", "SDR / BDR": "sdr_bdr",
  "プロダクトマネージャー": "product_manager", "プロダクトオーナー": "product_owner", "PMM": "pmm",
  "バックエンド": "backend", "フロントエンド": "frontend", "フルスタック": "fullstack",
  "SRE / インフラ": "sre", "iOS / Android": "ios_android",
  "CEO": "ceo", "COO": "coo", "CPO": "cpo", "CTO": "cto", "CFO": "cfo",
  "デザイナー": "designer", "事業開発": "biz_dev", "HRBP": "hrbp",
  "コーポレート": "corporate", "データサイエンティスト": "data_scientist",
};

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
  const { data: user } = await supabase
    .from("ow_users")
    .select("id, name, avatar_color, cover_color, about_me, birth_date, location, social_links, is_mentor")
    .eq("id", params.id)
    .maybeSingle();

  if (!user) notFound();

  const owUser = user as OwUser;

  const avatarColor = owUser.avatar_color ?? "linear-gradient(135deg, #002366, #3B5FD9)";
  const coverColor = owUser.cover_color ?? "linear-gradient(135deg, #002366, #3B5FD9, #818CF8)";
  const initial = owUser.name.charAt(0);

  // 年齢表示: birth_date をサーバ側で計算（NULL = 非公開）
  const age = getUserAge(owUser.birth_date);
  const ageDisplay = age !== null ? `${age}歳` : null;

  const socialLinks = owUser.social_links ?? {};
  // SNS_PLATFORMS の順序を維持しつつ、値が空文字列でないキーのみ抽出
  const activeSocials = SNS_PLATFORMS.filter(
    (k) => socialLinks[k] && socialLinks[k]!.trim() !== ""
  );

  // Fetch experiences + skill tags in parallel（RLS select_all=true のため認証不問で読める）
  const [{ data: expRows }, { data: allRoles }, { data: skillTagsRaw }] = await Promise.all([
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
  ]);

  const skillTags = skillTagsRaw ?? [];

  const uuidToSlug = new Map<string, string>();
  for (const role of allRoles ?? []) {
    const slug = DB_NAME_TO_SLUG[role.name as string];
    if (slug) uuidToSlug.set(role.id as string, slug);
  }

  // Resolve company info (name + logo) for master entries in experiences
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

  const experiences: CareerEntry[] = (expRows ?? []).map((r) => {
    let companyName: string;
    let companyType: "master" | "custom" | "anon";
    let logoUrl: string | null = null;
    let logoLetter: string | null = null;
    let logoGradient: string | null = null;

    if (r.company_id) {
      companyType = "master";
      const info = expCompanyMap.get(r.company_id as string);
      companyName = info?.name ?? "不明な企業";
      logoUrl = info?.logoUrl ?? null;
      logoLetter = info?.logoLetter ?? null;
      logoGradient = info?.logoGradient ?? null;
    } else if (r.company_text) {
      companyType = "custom";
      companyName = r.company_text as string;
    } else {
      companyType = "anon";
      companyName = (r.company_anonymized as string) ?? "非公開企業";
    }
    const roleUuid = r.role_category_id as string;
    return {
      id: r.id as string,
      companyName,
      companyType,
      logoUrl,
      logoLetter,
      logoGradient,
      roleSlug: uuidToSlug.get(roleUuid) ?? roleUuid,
      roleTitle: r.role_title as string | null,
      startedAt: r.started_at as string,
      endedAt: r.ended_at as string | null,
      isCurrent: r.is_current as boolean,
      description: r.description as string | null,
      why: (r.why as string | null) ?? null,
    };
  });

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

      {/* Career */}
      <section style={{
        background: "#fff", border: "1px solid var(--line)",
        borderRadius: 14, padding: "24px 28px", marginBottom: 20,
      }}>
        <div style={{
          display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16,
          paddingBottom: 14, borderBottom: "1px solid var(--line)",
        }}>
          <span style={{ fontFamily: 'var(--font-noto-serif)', fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>
            キャリア
          </span>
          <span style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif", fontWeight: 500 }}>
            CAREER
          </span>
        </div>
        <CareerTimeline careers={experiences} />
      </section>

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
