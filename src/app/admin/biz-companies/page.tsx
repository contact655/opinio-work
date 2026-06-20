import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export const dynamic = "force-dynamic";

type BizCompany = {
  companyId: string;
  companyName: string;
  isPublished: boolean;
  engagementStatus: string;
  adminCount: number;
  activeAdminCount: number;
  lastActivity: string | null;
};

const ENGAGEMENT_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  none:       { label: "未認証",         bg: "#F1F5F9", color: "#6b7280",           border: "#E2E8F0" },
  verified:   { label: "ドメイン認証済", bg: "#EFF3FC", color: "var(--royal)",       border: "#DCE5F7" },
  contracted: { label: "契約済み",       bg: "#ECFDF5", color: "var(--success)",     border: "#A7F3D0" },
};

async function getBizCompanies(): Promise<BizCompany[]> {
  const admin = createAdminClient();

  const [{ data: adminRows }, { data: companies }] = await Promise.all([
    admin
      .from("ow_company_admins")
      .select("company_id, is_active, created_at"),
    admin
      .from("ow_companies")
      .select("id, name, is_published, engagement_status")
      .order("name", { ascending: true }),
  ]);

  const companyMap = new Map<string, { name: string; isPublished: boolean; engagementStatus: string }>(
    (companies ?? []).map((c) => [
      c.id,
      { name: c.name, isPublished: c.is_published ?? false, engagementStatus: c.engagement_status ?? "none" },
    ])
  );

  // BIZ担当者がいる企業だけ集計
  const grouped = new Map<string, { total: number; active: number; lastActivity: string | null }>();
  for (const row of adminRows ?? []) {
    const cid = row.company_id as string;
    if (!grouped.has(cid)) grouped.set(cid, { total: 0, active: 0, lastActivity: null });
    const g = grouped.get(cid)!;
    g.total++;
    if (row.is_active) g.active++;
    const at = row.created_at as string;
    if (!g.lastActivity || at > g.lastActivity) g.lastActivity = at;
  }

  return Array.from(grouped.entries())
    .map(([cid, g]) => {
      const c = companyMap.get(cid);
      return {
        companyId: cid,
        companyName: c?.name ?? "不明",
        isPublished: c?.isPublished ?? false,
        engagementStatus: c?.engagementStatus ?? "none",
        adminCount: g.total,
        activeAdminCount: g.active,
        lastActivity: g.lastActivity,
      };
    })
    .sort((a, b) => a.companyName.localeCompare(b.companyName, "ja"));
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
}

export default async function AdminBizCompaniesPage() {
  const companies = await getBizCompanies();

  const publishedCount = companies.filter((c) => c.isPublished).length;
  const contractedCount = companies.filter((c) => c.engagementStatus === "contracted").length;

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{
            fontFamily: "Inter, sans-serif", fontSize: 9, fontWeight: 800,
            letterSpacing: "0.18em", textTransform: "uppercase",
            background: "#DC2626", color: "#fff", padding: "3px 8px", borderRadius: 4,
          }}>ADMIN</span>
          <h1 style={{
            fontFamily: "var(--font-noto-serif, 'Noto Serif JP', serif)",
            fontSize: 22, fontWeight: 600, color: "#0F172A", margin: 0,
          }}>BIZ 企業</h1>
        </div>
        <p style={{ fontSize: 12, color: "#94A3B8", margin: 0 }}>
          BIZ担当者が登録されている企業の一覧です。企業プロフィール審査は
          <Link href="/admin/companies" style={{ color: "var(--royal)", textDecoration: "none", marginLeft: 4 }}>企業審査</Link>
          から行えます。
        </p>
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "BIZ企業数",      value: companies.length,   color: "var(--royal)",   bg: "#EFF3FC" },
          { label: "公開中",          value: publishedCount,     color: "var(--success)", bg: "#ECFDF5" },
          { label: "契約済み",        value: contractedCount,    color: "#7C3AED",        bg: "#F3E8FF" },
          { label: "未公開",          value: companies.length - publishedCount, color: "#94A3B8", bg: "#F1F5F9" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} style={{
            background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14,
            padding: "20px 22px", position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: "14px 14px 0 0" }} />
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 34, fontWeight: 800, color, lineHeight: 1, marginBottom: 6 }}>
              {value}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{label}</div>
            <div style={{ height: 4, background: bg, borderRadius: 2, marginTop: 10 }} />
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, overflow: "hidden" }}>
        {companies.length === 0 ? (
          <div style={{ textAlign: "center", padding: "56px 0", color: "#94A3B8" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🏢</div>
            <p style={{ fontSize: 14, margin: 0 }}>BIZ担当者が登録されている企業がありません</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                {["企業名", "ステータス", "担当者数", "アクティブ", "登録日", "操作"].map((h) => (
                  <th key={h} style={{
                    textAlign: "left", padding: "10px 16px",
                    fontSize: 10, fontWeight: 700, color: "#94A3B8",
                    letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => {
                const eng = ENGAGEMENT_CONFIG[c.engagementStatus] ?? ENGAGEMENT_CONFIG.none;
                return (
                  <tr key={c.companyId} style={{ borderBottom: "1px solid #F8FAFC" }}>
                    {/* 企業名 */}
                    <td style={{ padding: "12px 16px" }}>
                      <Link href={`/admin/companies/${c.companyId}`} style={{
                        fontWeight: 600, color: "var(--royal)", textDecoration: "none",
                      }}>
                        {c.companyName}
                      </Link>
                    </td>

                    {/* ステータス */}
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 100,
                          background: eng.bg, color: eng.color, border: `1px solid ${eng.border}`,
                        }}>
                          {eng.label}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 100,
                          background: c.isPublished ? "#ECFDF5" : "#F1F5F9",
                          color: c.isPublished ? "var(--success)" : "#94A3B8",
                          border: `1px solid ${c.isPublished ? "#A7F3D0" : "#E2E8F0"}`,
                        }}>
                          {c.isPublished ? "公開中" : "未公開"}
                        </span>
                      </div>
                    </td>

                    {/* 担当者数 */}
                    <td style={{ padding: "12px 16px" }}>
                      <Link href={`/admin/biz-accounts?company=${c.companyId}`} style={{
                        fontFamily: "Inter, sans-serif", fontSize: 16, fontWeight: 700,
                        color: "#0F172A", textDecoration: "none",
                      }}>
                        {c.adminCount}
                      </Link>
                      <span style={{ fontSize: 11, color: "#94A3B8", marginLeft: 4 }}>名</span>
                    </td>

                    {/* アクティブ */}
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600,
                        color: c.activeAdminCount > 0 ? "var(--success)" : "#94A3B8",
                      }}>
                        {c.activeAdminCount}
                      </span>
                      <span style={{ fontSize: 11, color: "#94A3B8", marginLeft: 4 }}>名</span>
                    </td>

                    {/* 登録日 */}
                    <td style={{ padding: "12px 16px", color: "#94A3B8", fontFamily: "Inter, sans-serif", fontSize: 12 }}>
                      {formatDate(c.lastActivity)}
                    </td>

                    {/* 操作 */}
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <Link href={`/admin/companies/${c.companyId}`} style={{
                          fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6,
                          background: "#EFF3FC", color: "var(--royal)",
                          textDecoration: "none", border: "1px solid #DCE5F7",
                          whiteSpace: "nowrap",
                        }}>
                          企業詳細
                        </Link>
                        <Link href={`/admin/biz-accounts`} style={{
                          fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6,
                          background: "#F8FAFC", color: "#475569",
                          textDecoration: "none", border: "1px solid #E2E8F0",
                          whiteSpace: "nowrap",
                        }}>
                          担当者
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
