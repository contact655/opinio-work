import { createAdminClient } from "@/lib/supabase/admin";
import { SCHOOL_TYPES, schoolTypeLabel } from "@/lib/constants/schools";

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

/**
 * ★学校を探して出す（2026-10-22）。⚠️ 全件を並べない。
 *   それまでは全件を名前順で引いていたが、学校は約5万4千校あり、PostgREST が1,000行で黙って切るので
 *   **名前順の最初の1,000校だけが出て「1000件 登録済み」と表示していた**。件数は下の countByType が数える。
 */
const LIST_LIMIT = 200;

async function getSchools(q: string, type: string): Promise<School[]> {
  const admin = createAdminClient();
  let query = admin
    .from("ow_schools")
    .select("id, name, name_kana, logo_letter, logo_gradient, country, type, created_at");
  /* ⚠️ % _ , ( ) は LIKE / or の区切りなので落とす */
  const safe = q.replace(/[%_,()]/g, " ").trim();
  if (safe) query = query.or(`name.ilike.%${safe}%,name_kana.ilike.%${safe}%`);
  if (type) query = query.eq("type", type);
  /* 何も指定していないときは、最近追加した学校から */
  const { data, error } = await (safe || type
    ? query.order("name", { ascending: true })
    : query.order("created_at", { ascending: false })).limit(LIST_LIMIT);

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

/** 種別ごとの件数（head + count。行は読まない） */
async function countByType(): Promise<{ type: string; label: string; n: number | null }[]> {
  const admin = createAdminClient();
  return Promise.all(SCHOOL_TYPES.map(async (t) => {
    const { count, error } = await admin.from("ow_schools").select("id", { count: "exact", head: true }).eq("type", t.value);
    if (error) console.error("[admin/schools] count", t.value, error.message);
    return { type: t.value, label: t.label, n: error ? null : count ?? 0 };
  }));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
}

export default async function AdminSchoolsPage({ searchParams }: { searchParams: { q?: string; type?: string } }) {
  const q = (searchParams.q ?? "").slice(0, 50);
  const type = SCHOOL_TYPES.some((t) => t.value === searchParams.type) ? (searchParams.type as string) : "";
  const [schools, counts] = await Promise.all([getSchools(q, type), countByType()]);
  const total = counts.every((c) => c.n !== null) ? counts.reduce((a, c) => a + (c.n ?? 0), 0) : null;

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{
              fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 9, fontWeight: 800,
              letterSpacing: "0.18em", textTransform: "uppercase",
              background: "#DC2626", color: "#fff", padding: "3px 8px", borderRadius: 4,
            }}>ADMIN</span>
            <h1 style={{
              fontFamily: "var(--font-noto-serif, 'Noto Serif JP', serif)",
              fontSize: 22, fontWeight: 600, color: "#0F172A", margin: 0,
            }}>学校マスタ</h1>
          </div>
          <p style={{ fontSize: 12, color: "#94A3B8", margin: 0 }}>
            {/* ⚠️ 「新規追加は〈学校追加リクエスト〉から承認してください」を消した（2026-09-01）。
                   リクエスト機能ごと畳んだため。実測でリクエスト由来の学校は**0件**だった。
                   学校は migration で足す（マスタ37件はすべてその経路）。 */}
            {total !== null ? `${total.toLocaleString()}件 登録済み` : "件数を取得できませんでした"}
          </p>
        </div>
      </div>

      {/* ★種別ごとの件数と検索（2026-10-22）。押すとその種別に絞る */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {counts.map((c) => (
          <a key={c.type} href={`/admin/schools?type=${c.type}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            style={{ padding: "5px 11px", borderRadius: 100, fontSize: 12, fontWeight: 600, textDecoration: "none",
              border: `1px solid ${type === c.type ? "var(--royal)" : "#E2E8F0"}`, background: type === c.type ? "#EFF3FC" : "#fff", color: "#0F172A" }}>
            {c.label} <span style={{ color: "#64748B" }}>{c.n === null ? "—" : c.n.toLocaleString()}</span>
          </a>
        ))}
      </div>
      <form method="get" action="/admin/schools" style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {type && <input type="hidden" name="type" value={type} />}
        <input name="q" defaultValue={q} placeholder="学校名・よみで探す" style={{ flex: 1, padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 14 }} />
        <button type="submit" style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: "var(--royal)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>探す</button>
        {(q || type) && <a href="/admin/schools" style={{ alignSelf: "center", fontSize: 12.5, color: "#64748B" }}>条件を外す</a>}
      </form>
      <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 14px" }}>
        {q || type ? `当てはまる学校を名前順に${LIST_LIMIT}件まで表示しています。` : `最近追加した学校を${LIST_LIMIT}件表示しています。学校名で探してください。`}
      </p>

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, overflow: "hidden" }}>
        {schools.length === 0 ? (
          <div style={{ textAlign: "center", padding: "56px 0", color: "#94A3B8" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🏫</div>
            <p style={{ fontSize: 14, margin: 0 }}>{q || type ? "当てはまる学校はありません" : "学校マスタが登録されていません"}</p>
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
                    <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: "var(--font-inter), var(--font-noto)", marginTop: 2 }}>
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
                      {schoolTypeLabel(s.type)}
                    </span>
                  </td>

                  {/* 登録日 */}
                  <td style={{ padding: "10px 16px", color: "#94A3B8", fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 12 }}>
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
