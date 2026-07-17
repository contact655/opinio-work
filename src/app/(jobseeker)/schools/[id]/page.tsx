import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GraduationCap, Users } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

export const revalidate = 300;

// ─── 型定義 ──────────────────────────────────────────────────────────────────

type SchoolRow = {
  id: string;
  name: string;
  name_kana: string | null;
  logo_url: string | null;
  logo_gradient: string | null;
  logo_letter: string | null;
  country: string | null;
  type: string | null;
};

type Graduate = {
  userId: string;
  name: string;
  avatarInitial: string;
  avatarGradient: string;
  avatarUrl: string | null;
  catchphrase: string | null;
  faculty: string | null;
  degree: string | null;
  graduatedAt: string | null;
};

// ─── データ取得 ───────────────────────────────────────────────────────────────

async function getSchool(id: string): Promise<SchoolRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ow_schools")
    .select("id, name, name_kana, logo_url, logo_gradient, logo_letter, country, type")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return data as SchoolRow;
}

async function getGraduates(schoolId: string): Promise<Graduate[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("ow_user_educations")
    .select(`
      faculty,
      degree,
      graduated_at,
      ow_users!inner(
        id,
        name,
        avatar_color,
        avatar_url,
        visibility,
        email,
        catchphrase
      )
    `)
    .eq("school_id", schoolId)
    .order("graduated_at", { ascending: false });

  if (error) {
    console.error("[schools] fetch graduates error:", error.message);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as unknown as Array<Record<string, any>>;

  // seed・非公開ユーザーを除外
  const filtered = rows.filter((r) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = r.ow_users as Record<string, any> | null;
    if (!u) return false;
    if (u.visibility === "private") return false;
    if ((u.email as string | null)?.endsWith("@seed.internal")) return false;
    return true;
  });

  // 同一ユーザーの重複を除去（同校に複数educationがある場合）
  const seen = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return filtered.reduce<Graduate[]>((acc, r) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = r.ow_users as Record<string, any>;
    const uid = u.id as string;
    if (seen.has(uid)) return acc;
    seen.add(uid);
    const name = (u.name as string) ?? "—";
    const hex = (u.avatar_color as string | null) ?? null;
    acc.push({
      userId: uid,
      name,
      avatarInitial: name.charAt(0),
      avatarGradient: hex
        ? `linear-gradient(135deg, ${hex}99, ${hex})`
        : "linear-gradient(135deg, #7C3AED, #a855f7)",
      avatarUrl: (u.avatar_url as string | null) ?? null,
      catchphrase: (u.catchphrase as string | null) ?? null,
      faculty: (r.faculty as string | null) ?? null,
      degree: (r.degree as string | null) ?? null,
      graduatedAt: (r.graduated_at as string | null) ?? null,
    });
    return acc;
  }, []);
}

// ─── メタデータ ───────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const school = await getSchool(id);
  if (!school) return { title: "学校 | OPINIO" };
  return {
    title: { absolute: `${school.name} 出身者 | OPINIO` },
    description: `${school.name}出身のIT/SaaS業界の現役社員・OB/OGのキャリアを見る。`,
    robots: { index: false, follow: false },
  };
}

// ─── 学校種別ラベル ───────────────────────────────────────────────────────────

function schoolTypeLabel(type: string | null): string {
  switch (type) {
    case "university":      return "大学";
    case "graduate_school": return "大学院";
    case "college":         return "短期大学・高専";
    case "highschool":      return "高等学校";
    case "vocational":      return "専門学校";
    default:                return "学校";
  }
}

// ─── 卒業年フォーマット ───────────────────────────────────────────────────────

function formatGradYear(graduatedAt: string | null): string | null {
  if (!graduatedAt) return null;
  const year = graduatedAt.slice(0, 4);
  return `${year}年卒`;
}

// ─── ページ ───────────────────────────────────────────────────────────────────

export default async function SchoolPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [school, graduates] = await Promise.all([
    getSchool(id),
    getGraduates(id),
  ]);

  if (!school) notFound();

  const typeLabel = schoolTypeLabel(school.type);

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg-tint)" }}>
      {/* ── ヘッダーバンド ──────────────────────────────────────────────── */}
      <div
        style={{
          background: school.logo_gradient ?? "linear-gradient(135deg, #7C3AED, #a855f7)",
          padding: "48px 24px 40px",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          {/* パンくず */}
          <nav style={{ marginBottom: 20 }}>
            <Link
              href="/people"
              style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, textDecoration: "none" }}
            >
              ← 先輩一覧に戻る
            </Link>
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* ロゴ */}
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 16,
                background: "rgba(255,255,255,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                backdropFilter: "blur(4px)",
                border: "1.5px solid rgba(255,255,255,0.3)",
              }}
            >
              {school.logo_letter ? (
                <span style={{ fontSize: 32, fontWeight: 800, color: "#fff" }}>
                  {school.logo_letter}
                </span>
              ) : (
                <GraduationCap size={36} color="#fff" strokeWidth={1.5} />
              )}
            </div>

            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.7)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                {typeLabel}
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1.25 }}>
                {school.name}
              </h1>
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Users size={14} color="rgba(255,255,255,0.7)" />
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                  {graduates.length > 0
                    ? `OPINIO登録中の出身者 ${graduates.length}名`
                    : "現在出身者の登録はありません"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 出身者一覧 ──────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 64px" }}>
        {graduates.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 24px",
              color: "var(--ink-soft)",
              fontSize: 15,
            }}
          >
            <GraduationCap size={40} color="var(--ink-mute)" style={{ marginBottom: 12 }} />
            <p>この学校の出身者はまだ登録されていません。</p>
          </div>
        ) : (
          <>
            <h2
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--ink-soft)",
                letterSpacing: "0.05em",
                marginBottom: 16,
              }}
            >
              出身者 ({graduates.length}名)
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 16,
              }}
            >
              {graduates.map((g) => (
                <GraduateCard key={g.userId} graduate={g} />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

// ─── 出身者カード ─────────────────────────────────────────────────────────────

function GraduateCard({ graduate: g }: { graduate: Graduate }) {
  const gradYear = formatGradYear(g.graduatedAt);
  const subText = [g.faculty, g.degree, gradYear].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/u/${g.userId}`}
      style={{ textDecoration: "none" }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid var(--line)",
          padding: "16px 18px",
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          transition: "box-shadow 0.15s, border-color 0.15s",
        }}
        className="graduate-card"
      >
        {/* Avatar */}
        {g.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={g.avatarUrl}
            alt=""
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: g.avatarGradient,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: 18,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            {g.avatarInitial}
          </div>
        )}

        {/* テキスト */}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--ink)",
              marginBottom: 2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {g.name}
          </div>
          {subText && (
            <div
              style={{
                fontSize: 12,
                color: "var(--ink-soft)",
                marginBottom: g.catchphrase ? 6 : 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {subText}
            </div>
          )}
          {g.catchphrase && (
            <div
              style={{
                fontSize: 12,
                color: "var(--ink-soft)",
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                lineHeight: 1.5,
              }}
            >
              {g.catchphrase}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
