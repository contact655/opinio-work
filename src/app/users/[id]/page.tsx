import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { getCompanyLogoUrl } from "@/lib/utils/companyLogo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: member } = await supabase
    .from("ow_company_members")
    .select("name, role, ow_companies(name)")
    .eq("id", params.id)
    .maybeSingle();
  if (!member) return { title: "メンバーが見つかりません" };
  const companyName = (member.ow_companies as any)?.name ?? "";
  return {
    title: `${member.name} | ${companyName}`,
    description: `${companyName}の${member.role ?? "メンバー"}${member.name}のプロフィール`,
  };
}

type CareerItem = {
  year?: string | number;
  company?: string;
  role?: string;
  detail?: string;
};

function parseCareerHistory(raw: any): CareerItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .filter((x: any) => x && typeof x === "object")
      .map((x: any) => ({
        year: x.year,
        company: x.company,
        role: x.role,
        detail: x.detail,
      }));
  }
  return [];
}

export default async function MemberProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const { data: member } = await supabase
    .from("ow_company_members")
    .select(`
      id, name, role, photo_url, background, job_types,
      article_title, article_content, article_published_at, interviewer,
      career_history,
      ow_companies(id, name, logo_url, url, website_url, brand_color)
    `)
    .eq("id", params.id)
    .maybeSingle();

  if (!member) return notFound();

  const company = member.ow_companies as any;
  const career = parseCareerHistory((member as any).career_history);

  // Fetch other members of same company (for 関連)
  let sameCompanyMembers: any[] = [];
  if (company?.id) {
    const { data } = await supabase
      .from("ow_company_members")
      .select("id, name, role, photo_url")
      .eq("company_id", company.id)
      .neq("id", params.id)
      .limit(3);
    sameCompanyMembers = data || [];
  }

  const companyLogoUrl = company ? getCompanyLogoUrl(company) : null;

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen" style={{ background: "#f8f9fa" }}>
        <div className="max-w-[780px] mx-auto px-4 sm:px-6 lg:px-8" style={{ paddingTop: 32, paddingBottom: 48 }}>
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2" style={{ fontSize: 13, marginBottom: 20 }}>
            <Link href="/companies" style={{ color: "#1a6fd4", textDecoration: "none" }}>企業一覧</Link>
            <span style={{ color: "#d1d5db" }}>›</span>
            {company && (
              <>
                <Link href={`/companies/${company.id}`} style={{ color: "#1a6fd4", textDecoration: "none" }}>{company.name}</Link>
                <span style={{ color: "#d1d5db" }}>›</span>
              </>
            )}
            <span style={{ color: "#6b7280" }}>{member.name}</span>
          </nav>

          {/* Header card: photo + name + company */}
          <section style={{ background: "#fff", borderRadius: 14, padding: 32, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 20 }}>
              <div style={{
                width: 96, height: 96, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
                background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {member.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={member.photo_url} alt={member.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: 0, marginBottom: 4 }}>{member.name}</h1>
                {member.role && (
                  <p style={{ fontSize: 14, color: "#475569", margin: 0, marginBottom: 10 }}>{member.role}</p>
                )}
                {company && (
                  <Link
                    href={`/companies/${company.id}`}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "6px 10px", borderRadius: 8,
                      background: "#f9fafb", border: "0.5px solid #e5e7eb",
                      fontSize: 13, color: "#0f172a", fontWeight: 500,
                      textDecoration: "none",
                    }}
                  >
                    {companyLogoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={companyLogoUrl} alt={company.name} style={{ width: 20, height: 20, borderRadius: 4, objectFit: "contain" }} />
                    ) : (
                      <div style={{ width: 20, height: 20, borderRadius: 4, background: "#f1efe8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 500, color: "#666" }}>
                        {company.name?.[0]}
                      </div>
                    )}
                    {company.name}
                    <span style={{ color: "#9ca3af", fontSize: 11 }}>→</span>
                  </Link>
                )}
              </div>
            </div>

            {/* 職種タグ */}
            {member.job_types && Array.isArray(member.job_types) && member.job_types.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500, letterSpacing: "0.05em", marginBottom: 8 }}>職種</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {member.job_types.map((type: string, i: number) => (
                    <span key={i} style={{
                      fontSize: 12, fontWeight: 500,
                      background: "#f0faf4", color: "#2d7a4f",
                      border: "0.5px solid #b7e4c7",
                      borderRadius: 999, padding: "4px 12px",
                    }}>
                      {type}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 経歴タイムライン（Fix 22） */}
            {career.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500, letterSpacing: "0.05em", marginBottom: 12 }}>経歴</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {career.map((c, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, paddingLeft: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#1D9E75", minWidth: 56, flexShrink: 0, paddingTop: 2 }}>
                        {c.year || "—"}
                      </div>
                      <div style={{ flex: 1 }}>
                        {c.company && (
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{c.company}</div>
                        )}
                        {c.role && (
                          <div style={{ fontSize: 13, color: "#475569", marginTop: 2 }}>{c.role}</div>
                        )}
                        {c.detail && (
                          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, lineHeight: 1.6 }}>{c.detail}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 経歴 (legacy background field) */}
            {!career.length && member.background && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500, letterSpacing: "0.05em", marginBottom: 8 }}>経歴</div>
                <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.8, margin: 0, whiteSpace: "pre-wrap" }}>
                  {member.background}
                </p>
              </div>
            )}

            {/* CTA */}
            <div style={{ marginTop: 28, padding: "14px 18px", background: "#f0faf4", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <span style={{ fontSize: 13, color: "#0F6E56" }}>このメンバーやこの企業について話を聞きたい</span>
              <Link href="/career-consultation" style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: "#1D9E75", padding: "8px 16px", borderRadius: 8, textDecoration: "none", whiteSpace: "nowrap" }}>
                このメンバーに相談する →
              </Link>
            </div>
          </section>

          {/* Fix 22: Interview article content */}
          {(member as any).article_content && (
            <section style={{ background: "#fff", borderRadius: 14, padding: 32, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginTop: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "#0f172a", padding: "3px 10px", borderRadius: 6 }}>Interview</span>
                {(member as any).article_published_at && (
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>
                    取材日: {new Date((member as any).article_published_at).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}
                  </span>
                )}
                {(member as any).interviewer && (
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>
                    · インタビュアー: {(member as any).interviewer}
                  </span>
                )}
              </div>
              {(member as any).article_title && (
                <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: 0, marginBottom: 20, lineHeight: 1.4 }}>
                  {(member as any).article_title}
                </h2>
              )}
              <div style={{ fontSize: 15, color: "#374151", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>
                {(member as any).article_content}
              </div>
            </section>
          )}

          {/* Same-company members (関連セクション) */}
          {sameCompanyMembers.length > 0 && (
            <section style={{ background: "#fff", borderRadius: 14, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginTop: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>
                {company?.name}の他のメンバー
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                {sameCompanyMembers.map((m: any) => (
                  <Link
                    key={m.id}
                    href={`/users/${m.id}`}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: 12, borderRadius: 10,
                      border: "0.5px solid #e5e7eb", background: "#f9fafb",
                      textDecoration: "none",
                    }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                      {m.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.photo_url} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      )}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.name}
                      </div>
                      {m.role && (
                        <div style={{ fontSize: 11, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.role}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
