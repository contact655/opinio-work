import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// ─── 役割定義（PeopleListClient の ROLE_OPTIONS と同期） ─────────────────────

const ROLE_MAP: Record<string, {
  label: string;
  labelEn: string;
  description: string;
  icon: string;
  pattern: RegExp;
  salarySlug: string | null;
}> = {
  sales: {
    label: "エンタープライズ営業",
    labelEn: "Sales / Account Executive",
    description: "外資系SaaS・IT企業の営業職経験者。新規開拓・商談・クロージングのリアルな話を聞けます。",
    icon: "📈",
    pattern: /営業|sales|セールス|account executive|account manager|フィールドセールス|インサイドセールス|sdr|bdr/i,
    salarySlug: "enterprise-sales",
  },
  cs: {
    label: "カスタマーサクセス",
    labelEn: "Customer Success",
    description: "顧客の継続・活用支援を担うCS職経験者。日々の業務や必要なスキルセットについて直接聞けます。",
    icon: "🤝",
    pattern: /カスタマーサクセス|customer success|csm/i,
    salarySlug: "customer-success",
  },
  mkt: {
    label: "マーケティング",
    labelEn: "Marketing",
    description: "B2B・SaaSマーケティング経験者。コンテンツ・需要創出・ブランド戦略など多彩なキャリアについて聞けます。",
    icon: "📣",
    pattern: /マーケ|market/i,
    salarySlug: null,
  },
  eng: {
    label: "ソフトウェアエンジニア",
    labelEn: "Software Engineer",
    description: "IT/SaaS企業の開発・インフラエンジニア経験者。技術スタック・開発文化・キャリアパスを直接確認できます。",
    icon: "⚙️",
    pattern: /エンジニア|engineer|開発|dev|tech|ソフトウェア/i,
    salarySlug: "backend-engineer",
  },
  pm: {
    label: "プロダクトマネージャー",
    labelEn: "Product Manager",
    description: "SaaS・IT企業のPM・PdM経験者。プロダクト戦略・ロードマップ・ステークホルダー調整の実態を聞けます。",
    icon: "🗂️",
    pattern: /プロダクトマネージャー|product manager|\bpm\b|pdm/i,
    salarySlug: "product-manager",
  },
  hr: {
    label: "人事・採用",
    labelEn: "HR / Talent Acquisition",
    description: "IT/SaaS企業で採用・HRBPを経験した先輩。組織づくり・採用の内側・キャリアの広がりについて聞けます。",
    icon: "👥",
    pattern: /人事|採用|hr|recruit/i,
    salarySlug: null,
  },
  exec: {
    label: "経営・役員",
    labelEn: "Executive / Leadership",
    description: "CEO・CTO・VP・事業部長など経営層経験者。意思決定・事業戦略・スタートアップの実態について聞けます。",
    icon: "🏆",
    pattern: /CEO|CTO|COO|CFO|VP|役員|代表|社長|事業部長/i,
    salarySlug: null,
  },
};


export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const role = ROLE_MAP[params.slug];
  if (!role) return { title: { absolute: "先輩を知る | OPINIO" } };

  const title = `${role.label}の先輩に話を聞く | OPINIO`;
  const description = `${role.description} IT/SaaS業界特化のキャリアプラットフォームOPINIO。`;

  return {
    title: { absolute: title },
    description,
    keywords: [role.label, role.labelEn, "IT転職", "SaaS", "キャリア相談", "OB訪問"],
    alternates: { canonical: `/people/role/${params.slug}` },
    openGraph: { title, description, type: "website", url: `/people/role/${params.slug}` },
  };
}

// ─── データ取得 ──────────────────────────────────────────────────────────────

type AmbassadorRow = {
  id: string;
  user_id: string;
  company_id: string;
  role_title: string | null;
  talk_themes: string[] | null;
  ow_users: { id: string; name: string | null; avatar_color: string | null; avatar_url: string | null; is_test: boolean | null; visibility: string | null } | null;
  ow_companies: { id: string; name: string | null; brand_name: string | null; slug: string | null; logo_url: string | null; logo_gradient: string | null; logo_letter: string | null; phase: string | null } | null;
};

async function getAmbassadorsByRole(pattern: RegExp, isLoggedIn: boolean): Promise<AmbassadorRow[]> {
  const adminSupabase = createAdminClient();

  const { data, error } = await adminSupabase
    .from("ow_company_members")
    .select(`
      id, user_id, company_id, role_title, talk_themes,
      ow_users!user_id(id, name, avatar_color, avatar_url, is_test, visibility),
      ow_companies!company_id(id, name, brand_name, slug, logo_url, logo_gradient, logo_letter, phase)
    `)
    .eq("display_consent", true)
    .eq("is_public", true)
    .limit(100);

  if (error || !data) return [];

  return (data as unknown as AmbassadorRow[]).filter((row) => {
    if (row.ow_users?.is_test) return false;
    const vis = (row.ow_users as { visibility?: string | null } | null)?.visibility;
    if (vis === "private") return false;
    if (vis === "login_only" && !isLoggedIn) return false;
    const roleTitle = row.role_title ?? "";
    return pattern.test(roleTitle);
  });
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function PeopleRolePage({ params }: { params: { slug: string } }) {
  const role = ROLE_MAP[params.slug];
  if (!role) notFound();

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ambassadors = await getAmbassadorsByRole(role.pattern, !!user);

  const otherRoles = Object.entries(ROLE_MAP).filter(([slug]) => slug !== params.slug);

  return (
    <>
      <style>{`
        .pr-card-link { text-decoration:none; display:block; }
        .pr-card { background:#fff; border:1px solid var(--line); border-radius:16px; padding:20px; transition:box-shadow .15s,border-color .15s; }
        .pr-card-link:hover .pr-card { box-shadow:0 4px 20px rgba(0,35,102,.10); border-color:var(--royal-100); }
        .pr-role-chip { display:flex; align-items:center; gap:8px; padding:10px 14px; border-radius:12px; background:#fff; border:1px solid var(--line); text-decoration:none; font-size:13px; font-weight:600; color:var(--ink); transition:border-color .15s,background .15s; }
        .pr-role-chip:hover { border-color:var(--royal-100); background:var(--royal-50); }
        @media(max-width:600px){ .pr-grid { grid-template-columns:1fr!important; } }
      `}</style>

      {/* ─ ヘッダー ─ */}
      <div style={{ background: "linear-gradient(155deg,#edf0fa 0%,#ece8ff 40%,#f6f0ff 70%,#fff 100%)", padding: "44px 24px 36px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 12 }}>
            <Link href="/people" style={{ color: "var(--ink-soft)", textDecoration: "none", fontWeight: 500 }}>先輩を知る</Link>
            <span style={{ color: "var(--ink-mute)" }}>›</span>
            <span style={{ color: "var(--royal)", fontWeight: 600 }}>{role.label}</span>
          </div>
          <div style={{ fontSize: 36, marginBottom: 12 }}>{role.icon}</div>
          <h1 style={{ fontFamily: "var(--font-noto-serif,'Noto Serif JP',serif)", fontSize: "clamp(22px,3.2vw,34px)", fontWeight: 700, color: "var(--ink)", margin: "0 0 12px", lineHeight: 1.3 }}>
            {role.label}の先輩に話を聞く
          </h1>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "0 0 18px", lineHeight: 1.7, maxWidth: 540 }}>
            {role.description}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ display: "inline-block", padding: "4px 14px", borderRadius: 100, fontSize: 13, fontWeight: 700, background: "#fff", color: "var(--royal)", border: "1px solid var(--royal-100)" }}>
              {ambassadors.length}名の先輩
            </span>
            {role.salarySlug && (
              <Link href={`/salary/${role.salarySlug}`} style={{ display: "inline-block", padding: "4px 14px", borderRadius: 100, fontSize: 12, fontWeight: 600, background: "var(--success-soft)", color: "var(--success)", textDecoration: "none", border: "1px solid #A7F3D0" }}>
                💰 年収相場を見る
              </Link>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "36px 20px 80px" }}>

        {/* ─ アンバサダーグリッド ─ */}
        {ambassadors.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--ink-mute)" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{role.icon}</div>
            <p style={{ fontSize: 15, margin: "0 0 16px" }}>この職種のアンバサダーは近日公開予定です</p>
            <Link href="/people" style={{ fontSize: 13, color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>
              全員の先輩を見る →
            </Link>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "0 0 16px" }}>
              {role.label}の経験者（{ambassadors.length}名）
            </h2>
            <div className="pr-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14, marginBottom: 40 }}>
              {ambassadors.map((a) => {
                const user = a.ow_users;
                const company = a.ow_companies;
                const name = user?.name ?? "名無し";
                const initial = name.slice(0, 1);
                const gradient = user?.avatar_color ?? "linear-gradient(135deg,#002366,#3B5FD9)";
                const companyName = company?.brand_name ?? company?.name ?? "";
                const companySlug = company?.slug ?? company?.id ?? "";
                const themes = a.talk_themes ?? [];

                return (
                  <Link key={a.id} href={`/companies/${companySlug}`} className="pr-card-link">
                    <div className="pr-card">
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                        {/* アバター */}
                        <div style={{ width: 52, height: 52, borderRadius: "50%", background: gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff", fontWeight: 700, flexShrink: 0, overflow: "hidden" }}>
                          {user?.avatar_url
                            ? <img src={user.avatar_url} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : initial
                          }
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                          {a.role_title && (
                            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.role_title}</div>
                          )}
                          {companyName && (
                            <div style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 500 }}>{companyName}</div>
                          )}
                        </div>
                      </div>
                      {/* 話せるテーマ */}
                      {themes.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {themes.slice(0, 3).map((t) => (
                            <span key={t} style={{ display: "inline-block", padding: "2px 9px", borderRadius: 100, fontSize: 10, fontWeight: 600, background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)" }}>
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      <div style={{ marginTop: 14, fontSize: 12, fontWeight: 600, color: "var(--royal)" }}>
                        話を聞く →
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {/* ─ 他の職種 ─ */}
        <div style={{ marginTop: 20, paddingTop: 32, borderTop: "1px solid var(--line)" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: "0 0 14px" }}>他の職種の先輩を見る</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10 }}>
            {otherRoles.map(([slug, info]) => (
              <Link key={slug} href={`/people/role/${slug}`} className="pr-role-chip">
                <span style={{ fontSize: 18 }}>{info.icon}</span>
                <span>{info.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* ─ CTA ─ */}
        <div style={{ marginTop: 40, padding: "28px 24px", borderRadius: 16, background: "linear-gradient(135deg,var(--royal),#3B5FD9)", textAlign: "center" }}>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, margin: "0 0 16px", lineHeight: 1.6 }}>
            転職の参考に、先輩の話をカジュアルに聞いてみませんか。
          </p>
          <Link href="/companies" style={{ display: "inline-block", padding: "10px 28px", borderRadius: 100, background: "#fff", color: "var(--royal)", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
            企業ページから面談を申し込む →
          </Link>
        </div>
      </div>
    </>
  );
}
