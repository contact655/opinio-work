import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export const dynamic = "force-dynamic";

type School = {
  id: string;
  name: string;
  nameKana: string | null;
  logoLetter: string | null;
  logoGradient: string | null;
  country: string;
  type: string;
  createdAt: string;
};

async function getSchools(): Promise<School[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("ow_schools")
    .select("id, name, name_kana, logo_letter, logo_gradient, country, type, created_at")
    .order("name", { ascending: true });

  if (error) {
    console.error("[admin/schools]", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    nameKana: row.name_kana ?? null,
    logoLetter: row.logo_letter ?? null,
    logoGradient: row.logo_gradient ?? null,
    country: row.country,
    type: row.type,
    createdAt: row.created_at,
  }));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
}

export default async function AdminSchoolsPage() {
  const schools = await getSchools();

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{
              fontFamily: "Inter, sans-serif", fontSize: 9, fontWeight: 800,
              letterSpacing: "0.18em", textTransform: "uppercase",
              background: "#DC2626", color: "#fff", padding: "3px 8px", borderRadius: 4,
            }}>ADMIN</span>
            <h1 style={{
              fontFamily: "var(--font-noto-serif, 'Noto Serif JP', serif)",
              fontSize: 22, fontWeight: 600, color: "#0F172A", margin: 0,
            }}>学校マスタ</h1>
          </div>
          <p style={{ fontSize: 12, color: "#94A3B8", margin: 0 }}>
            {schools.length}件 登録済み ／ 新規追加は
            <Link href="/admin/school-requests" style={{ color: "var(--royal)", textDecoration: "none", marginLeft: 4 }}>
              学校追加リクエスト
            </Link>
            から承認してください
          </p>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, overflow: "hidden" }}>
        {schools.length === 0 ? (
          <div style={{ textAlign: "center", padding: "56px 0", color: "#94A3B8" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🏫</div>
            <p style={{ fontSize: 14, margin: 0 }}>学校マスタが登録されていません</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                {["ロゴ", "学校名", "よみがな", "種別", "登録日"].map((h) => (
                  <th key={h} style={{
                    textAlign: "left", padding: "10px 16px",
                    fontSize: 10, fontWeight: 700, color: "#94A3B8",
                    letterSpacing: "0.06em", textTransform: "uppercase",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schools.map((s) => (
                <tr key={s.id} style={{ borderBottom: "1px solid #F8FAFC" }}>
                  {/* ロゴ */}
                  <td style={{ padding: "10px 16px" }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                      background: s.logoGradient || "linear-gradient(135deg, #4A4A7A, #6A5A8A)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700, color: "#fff",
                    }}>
                      {s.logoLetter || s.name.charAt(0)}
                    </div>
                  </td>

                  {/* 学校名 */}
                  <td style={{ padding: "10px 16px" }}>
                    <div style={{ fontWeight: 600, color: "#0F172A" }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: "Inter, sans-serif", marginTop: 2 }}>
                      {s.id.slice(0, 8)}…
                    </div>
                  </td>

                  {/* よみがな */}
                  <td style={{ padding: "10px 16px", color: "#475569" }}>
                    {s.nameKana || "—"}
                  </td>

                  {/* 種別 */}
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 100,
                      background: "#EFF3FC", color: "var(--royal)", border: "1px solid #DCE5F7",
                    }}>
                      {s.type}
                    </span>
                  </td>

                  {/* 登録日 */}
                  <td style={{ padding: "10px 16px", color: "#94A3B8", fontFamily: "Inter, sans-serif", fontSize: 12 }}>
                    {formatDate(s.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
