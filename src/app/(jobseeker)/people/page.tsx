export const dynamic = "force-dynamic";

import { unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { PeopleListClient, type AmbassadorCard } from "./PeopleListClient";

export const metadata: Metadata = {
  title: "話せる人 | OPINIO",
  description: "OPINIO に登録している企業の社員・OB/OGの中から、採用に関わっている方に直接話を聞けます。",
  openGraph: {
    title: "話せる人 | OPINIO",
    description: "企業の現役社員に、仕事のリアルを直接聞いてみませんか。",
    type: "website",
  },
};

type DbAmbassador = {
  id: string;
  user_id: string;
  company_id: string;
  role_title: string | null;
  department: string | null;
  user: { id: string; name: string | null; avatar_color: string | null; visibility: string | null } | null;
  company: {
    id: string;
    name: string | null;
    brand_name: string | null;
    logo_url: string | null;
    logo_gradient: string | null;
    logo_letter: string | null;
  } | null;
};

const FALLBACK_GRADIENT = "linear-gradient(135deg, #002366, #3B5FD9)";

async function getAmbassadors(): Promise<AmbassadorCard[]> {
  noStore();
  const adminSupabase = createAdminClient();

  const { data, error } = await adminSupabase
    .from("ow_company_admins")
    .select(`
      id,
      user_id,
      company_id,
      role_title,
      department,
      user:ow_users!user_id(id, name, avatar_color, visibility),
      company:ow_companies!company_id(id, name, brand_name, logo_url, logo_gradient, logo_letter)
    `)
    .eq("is_ambassador", true)
    .eq("is_active", true)
    .not("user_id", "is", null)
    .order("company_id", { ascending: true });

  if (error) {
    console.error("[people] fetch error:", error.message);
    return [];
  }

  const rows = (data ?? []) as unknown as DbAmbassador[];

  return rows
    .filter((r) => r.user?.visibility === "public" && r.user?.name)
    .map((r) => {
      const gradient =
        r.user?.avatar_color?.startsWith("linear-gradient")
          ? r.user.avatar_color
          : FALLBACK_GRADIENT;

      return {
        adminId: r.id,
        userId: r.user_id,
        name: r.user?.name ?? "—",
        initial: r.user?.name?.charAt(0) ?? "?",
        gradient,
        roleTitle: r.role_title,
        department: r.department,
        companyId: r.company?.id ?? r.company_id,
        companyName: r.company?.brand_name ?? r.company?.name ?? "—",
        companyLogoUrl: r.company?.logo_url ?? null,
        companyLogoGradient: r.company?.logo_gradient ?? null,
        companyLogoLetter: r.company?.logo_letter ?? null,
      };
    });
}

export default async function PeoplePage() {
  const ambassadors = await getAmbassadors();

  // 企業ごとにグループ化してフィルター用のリストを作成
  const companies = Array.from(
    new Map(
      ambassadors.map((a) => [a.companyId, { id: a.companyId, name: a.companyName }])
    ).values()
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      {/* ページヘッダー */}
      <div style={{
        background: "linear-gradient(135deg, #001233 0%, #002366 60%, #0f3280 100%)",
        padding: "48px 24px 40px",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "#F59E0B",
              textTransform: "uppercase",
            }}>
              People
            </span>
          </div>
          <h1 style={{
            fontSize: "clamp(24px, 3vw, 36px)",
            fontWeight: 800,
            color: "#fff",
            fontFamily: "Noto Serif JP, serif",
            margin: "0 0 12px",
            lineHeight: 1.3,
          }}>
            話せる人
          </h1>
          <p style={{
            fontSize: 15,
            color: "rgba(255,255,255,0.7)",
            lineHeight: 1.8,
            maxWidth: 520,
            margin: "0 0 20px",
          }}>
            OPINIO 掲載企業の現役社員で、採用に関わっている方々です。<br />
            転職を考えていなくても、話を聞いてみることから始められます。
          </p>
          {ambassadors.length > 0 && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 14px",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 100,
                fontSize: 12,
                fontWeight: 700,
                color: "rgba(255,255,255,0.85)",
              }}>
                <span style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#F97316",
                  display: "inline-block",
                }} />
                {ambassadors.length}名が話せます
              </span>
              {companies.length > 1 && (
                <span style={{
                  padding: "5px 14px",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 100,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.55)",
                }}>
                  {companies.length}社
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* コンテンツ */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 24px 80px" }}>
        <PeopleListClient ambassadors={ambassadors} companies={companies} />
      </div>
    </div>
  );
}
