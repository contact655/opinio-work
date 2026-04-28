import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type SocialLinks = {
  twitter?: string;
  linkedin?: string;
  note?: string;
  [key: string]: string | undefined;
};

type OwUser = {
  id: string;
  name: string;
  avatar_color: string | null;
  cover_color: string | null;
  about_me: string | null;
  age_range: string | null;
  location: string | null;
  social_links: SocialLinks | null;
  is_mentor: boolean;
};

// ─── Sub components ───────────────────────────────────────────────────────────

function SocialIcon({ platform }: { platform: string }) {
  if (platform === "twitter") return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
  if (platform === "linkedin") return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43c-1.14 0-2.06-.93-2.06-2.07 0-1.14.92-2.06 2.06-2.06s2.06.92 2.06 2.06c0 1.14-.92 2.07-2.06 2.07zm1.78 13.02H3.56V9h3.56v11.45z" />
    </svg>
  );
  if (platform === "note") return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
  return null;
}

const PLATFORM_LABEL: Record<string, string> = {
  twitter: "X (Twitter)",
  linkedin: "LinkedIn",
  note: "note",
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
    .select("id, name, avatar_color, cover_color, about_me, age_range, location, social_links, is_mentor")
    .eq("id", params.id)
    .maybeSingle();

  if (!user) notFound();

  const owUser = user as OwUser;

  const avatarColor = owUser.avatar_color ?? "linear-gradient(135deg, #002366, #3B5FD9)";
  const coverColor = owUser.cover_color ?? "linear-gradient(135deg, #002366, #3B5FD9, #818CF8)";
  const initial = owUser.name.charAt(0);

  const socialLinks = owUser.social_links ?? {};
  const activeSocials = (["twitter", "linkedin", "note"] as const).filter(
    (k) => socialLinks[k]
  );

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
                fontFamily: '"Noto Serif JP", serif',
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
                {owUser.age_range && (
                  <span style={{ fontSize: 13, color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 5 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <circle cx="12" cy="8" r="4" /><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                    </svg>
                    {owUser.age_range}
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
            <span style={{ fontFamily: '"Noto Serif JP", serif', fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>
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

      {/* Career — TODO: connect ow_experiences when profile/edit career section is wired up */}
      <section style={{
        background: "#fff", border: "1px solid var(--line)",
        borderRadius: 14, padding: "24px 28px", marginBottom: 20,
      }}>
        <div style={{
          display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16,
          paddingBottom: 14, borderBottom: "1px solid var(--line)",
        }}>
          <span style={{ fontFamily: '"Noto Serif JP", serif', fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>
            キャリア
          </span>
          <span style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif", fontWeight: 500 }}>
            CAREER
          </span>
        </div>
        <div style={{ padding: "20px 0", textAlign: "center", color: "var(--ink-mute)", fontSize: 13 }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "var(--bg-tint)", border: "1px solid var(--line)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 12px", color: "var(--ink-mute)",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          </div>
          職歴は非公開または未登録です
        </div>
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
            <span style={{ fontFamily: '"Noto Serif JP", serif', fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>
              リンク
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {activeSocials.map((platform) => {
              const url = socialLinks[platform]!;
              return (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 10,
                    fontSize: 13, color: "var(--royal)", fontWeight: 500,
                    textDecoration: "none",
                    padding: "8px 12px", borderRadius: 8,
                    border: "1px solid var(--line)", background: "var(--bg-tint)",
                    maxWidth: 320,
                  }}
                >
                  <span style={{ color: "var(--ink-soft)", flexShrink: 0 }}>
                    <SocialIcon platform={platform} />
                  </span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {PLATFORM_LABEL[platform]}
                  </span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: "auto", flexShrink: 0, color: "var(--ink-mute)" }}>
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
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
