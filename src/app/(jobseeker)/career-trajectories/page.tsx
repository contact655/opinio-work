import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: { absolute: "キャリア軌跡 | OPINIO" },
  description: "IT/SaaS業界で働くプロフェッショナルのリアルなキャリア軌跡。転職の背景・年収変化・選択の理由を公開。",
  alternates: { canonical: "/career-trajectories" },
};

type CareerProfileRow = {
  user_id: string;
  headline: string | null;
  years_of_experience: number | null;
  updated_at: string;
  ow_users: {
    id: string;
    name: string | null;
    profile_photo_url: string | null;
    job_type: string | null;
  } | null;
};

function YearsLabel({ years }: { years: number | null }) {
  if (!years) return null;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
      background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)",
    }}>
      経験 {years}年
    </span>
  );
}

function Avatar({ name, photoUrl, size = 48 }: { name: string | null; photoUrl: string | null; size?: number }) {
  const initial = (name ?? "?")[0];
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name ?? ""}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "linear-gradient(135deg, var(--royal), var(--accent))",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 800, fontSize: size * 0.38,
    }}>
      {initial}
    </div>
  );
}

export default async function CareerTrajectoriesPage() {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("ow_career_profiles")
    .select("user_id, headline, years_of_experience, updated_at, ow_users!inner(id, name, profile_photo_url, job_type)")
    .eq("is_published", true)
    .eq("ow_users.visibility", "public")
    .order("updated_at", { ascending: false });

  if (error) console.error("[career-trajectories]", error.message);

  const profiles = (data ?? []) as unknown as CareerProfileRow[];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-tint)" }}>
      {/* ── ヘッダーバナー ── */}
      <div style={{
        background: "linear-gradient(135deg, #1a0533 0%, #2d1057 40%, #4c1d95 100%)",
        padding: "48px 24px 40px", textAlign: "center",
      }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(196,181,253,0.9)", letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>
          Career Trajectories
        </p>
        <h1 style={{ fontSize: "clamp(22px,4vw,36px)", fontWeight: 900, color: "#fff", fontFamily: "'Noto Serif JP', serif", lineHeight: 1.3, margin: "0 0 14px" }}>
          リアルなキャリア軌跡
        </h1>
        <p style={{ fontSize: 15, color: "rgba(221,214,254,0.85)", maxWidth: 520, margin: "0 auto", lineHeight: 1.7 }}>
          転職の背景・年収の変化・選択の理由。<br />
          IT/SaaS業界で働くプロフェッショナルが、自らのキャリアを公開しています。
        </p>
      </div>

      {/* ── プロフィール一覧 ── */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 20px 60px" }}>
        {profiles.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 24px", color: "var(--ink-mute)" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📂</div>
            <p style={{ fontSize: 15 }}>現在公開中のキャリア軌跡はありません</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, color: "var(--ink-mute)", marginBottom: 24 }}>
              {profiles.length}件のキャリア軌跡を公開中
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {profiles.map((p) => {
                const user = p.ow_users;
                const name = user?.name ?? "匿名";
                const href = `/career-trajectories/${p.user_id}`;
                return (
                  <Link
                    key={p.user_id}
                    href={href}
                    style={{ textDecoration: "none" }}
                  >
                    <div style={{
                      background: "#fff", borderRadius: 14, padding: "20px",
                      border: "1px solid var(--line)", transition: "box-shadow 0.2s, transform 0.15s",
                      cursor: "pointer",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 24px rgba(0,35,102,0.1)";
                      (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.boxShadow = "none";
                      (e.currentTarget as HTMLElement).style.transform = "none";
                    }}>
                      {/* ヘッダー: アバター + 名前 */}
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                        <Avatar name={name} photoUrl={user?.profile_photo_url ?? null} size={44} />
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{name}</div>
                          {user?.job_type && (
                            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>{user.job_type}</div>
                          )}
                        </div>
                      </div>

                      {/* 経験年数 */}
                      {p.years_of_experience && (
                        <div style={{ marginBottom: 10 }}>
                          <YearsLabel years={p.years_of_experience} />
                        </div>
                      )}

                      {/* ヘッドライン */}
                      {p.headline ? (
                        <p style={{
                          fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6,
                          margin: 0, display: "-webkit-box", WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical", overflow: "hidden",
                        }}>
                          {p.headline}
                        </p>
                      ) : (
                        <p style={{ fontSize: 13, color: "var(--ink-mute)", margin: 0 }}>
                          キャリアの詳細を見る →
                        </p>
                      )}

                      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line-soft)", display: "flex", justifyContent: "flex-end" }}>
                        <span style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600 }}>
                          軌跡を見る →
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
