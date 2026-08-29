import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDirectoryPeople, type DirectoryPerson } from "@/lib/people/directory";
import { getRoleTree } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

// ─── 役割定義（PeopleListClient の ROLE_OPTIONS と同期） ─────────────────────

const ROLE_MAP: Record<string, {
  label: string;
  labelEn: string;
  description: string;
  icon: string;
  /**
   * ow_roles のトップレベル slug。URL の slug とは別。
   * URL 側（sales/cs/mkt/eng/pm/hr/exec）は既存リンクを壊さないため変えない。
   * ⚠️ 2026-08-04 まで role_title の正規表現だった。ow_roles に寄せて
   *    カード表示・/people のフィルタと軸を揃えている。
   */
  roleSlug: string;
  salarySlug: string | null;
}> = {
  sales: {
    label: "エンタープライズ営業",
    labelEn: "Sales / Account Executive",
    description: "外資系SaaS・IT企業の営業職経験者。新規開拓・商談・クロージングのリアルな話を聞けます。",
    icon: "📈",
    roleSlug: "sales",
    salarySlug: "enterprise-sales",
  },
  cs: {
    label: "カスタマーサクセス",
    labelEn: "Customer Success",
    description: "顧客の継続・活用支援を担うCS職経験者。日々の業務や必要なスキルセットについて直接聞けます。",
    icon: "🤝",
    roleSlug: "cs",
    salarySlug: "customer-success",
  },
  mkt: {
    label: "マーケティング",
    labelEn: "Marketing",
    description: "B2B・SaaSマーケティング経験者。コンテンツ・需要創出・ブランド戦略など多彩なキャリアについて聞けます。",
    icon: "📣",
    roleSlug: "marketing",
    salarySlug: null,
  },
  eng: {
    label: "ソフトウェアエンジニア",
    labelEn: "Software Engineer",
    description: "IT/SaaS企業の開発・インフラエンジニア経験者。技術スタック・開発文化・キャリアパスを直接確認できます。",
    icon: "⚙️",
    roleSlug: "engineer",
    salarySlug: "backend-engineer",
  },
  pm: {
    label: "プロダクトマネージャー",
    labelEn: "Product Manager",
    description: "SaaS・IT企業のPM・PdM経験者。プロダクト戦略・ロードマップ・ステークホルダー調整の実態を聞けます。",
    icon: "🗂️",
    roleSlug: "product",
    salarySlug: "product-manager",
  },
  hr: {
    label: "人事・採用",
    labelEn: "HR / Talent Acquisition",
    description: "IT/SaaS企業で採用・HRBPを経験した方。組織づくり・採用の内側・キャリアの広がりについて聞けます。",
    icon: "👥",
    roleSlug: "corporate",
    salarySlug: null,
  },
  exec: {
    label: "経営・役員",
    labelEn: "Executive / Leadership",
    description: "CEO・CTO・VP・事業部長など経営層経験者。意思決定・事業戦略・スタートアップの実態について聞けます。",
    icon: "🏆",
    roleSlug: "exec",
    salarySlug: null,
  },
};


export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const role = ROLE_MAP[params.slug];
  if (!role) return { title: { absolute: "登録ユーザーを探す | OPINIO" } };

  const title = `${role.label}の経験者を探す | OPINIO`;
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

/**
 * 表示条件は /people と共有する（src/lib/people/directory.ts）。
 *
 * ⚠️ 2026-08-04 まではここが独自に ow_company_members を引いていたため、
 *    親を「登録ユーザー一覧」に変えると同じ人が親には出て子には出ない状態になった。
 *    条件を足したくなったら directory.ts 側に書くこと。
 */
async function getPeopleByRole(slug: string, isLoggedIn: boolean): Promise<DirectoryPerson[]> {
  const [all, tree] = await Promise.all([getDirectoryPeople(isLoggedIn), getRoleTree()]);
  // ⚠️ 2026-08-04 まで role_title の正規表現マッチだった。
  //    自由記述との照合で精度が出ず、カードに出す職種（ow_roles 由来）と軸も
  //    食い違っていたため、ow_roles の9大分類 ID で判定する。
  const top = tree.topBySlug.get(slug);
  if (!top) return [];
  return all.filter((p) => p.topRoleId === top.id).slice(0, 100);
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function PeopleRolePage({ params }: { params: { slug: string } }) {
  const role = ROLE_MAP[params.slug];
  if (!role) notFound();

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const people = await getPeopleByRole(role.roleSlug, !!user);

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
            <Link href="/people" style={{ color: "var(--ink-soft)", textDecoration: "none", fontWeight: 500 }}>登録ユーザー</Link>
            <span style={{ color: "var(--ink-mute)" }}>›</span>
            <span style={{ color: "var(--royal)", fontWeight: 600 }}>{role.label}</span>
          </div>
          <div style={{ fontSize: 36, marginBottom: 12 }}>{role.icon}</div>
          <h1 style={{ fontFamily: "var(--font-noto-serif,'Noto Serif JP',serif)", fontSize: "clamp(22px,3.2vw,34px)", fontWeight: 700, color: "var(--ink)", margin: "0 0 12px", lineHeight: 1.3 }}>
            {role.label}の経験者を探す
          </h1>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "0 0 18px", lineHeight: 1.7, maxWidth: 540 }}>
            {role.description}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ display: "inline-block", padding: "4px 14px", borderRadius: 100, fontSize: 13, fontWeight: 700, background: "#fff", color: "var(--royal)", border: "1px solid var(--royal-100)" }}>
              {people.length}名が登録
            </span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "36px 20px 80px" }}>

        {/* ─ 一覧 ─ */}
        {people.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--ink-mute)" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{role.icon}</div>
            <p style={{ fontSize: 15, margin: "0 0 16px" }}>この職種の登録者はまだいません</p>
            <Link href="/people" style={{ fontSize: 13, color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>
              登録ユーザーをすべて見る →
            </Link>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: "0 0 16px" }}>
              {role.label}の経験者（{people.length}名）
            </h2>
            <div className="pr-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14, marginBottom: 40 }}>
              {people.map((p) => {
                const aff = p.affiliation;
                return (
                  // 遷移先は本人のプロフィール。以前は企業ページに飛ばしていたが、
                  // 所属が無い人がいるので本人に統一する。
                  <Link key={p.userId} href={`/u/${p.userId}`} className="pr-card-link">
                    <div className="pr-card">
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                        <div style={{ width: 52, height: 52, borderRadius: "50%", background: p.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff", fontWeight: 700, flexShrink: 0, overflow: "hidden" }}>
                          {p.avatarUrl
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={p.avatarUrl} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : p.initial
                          }
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                          {/* /people のカードと同じく ow_roles の職種名を出す。
                              自由記述の role_title は粒度がばらばらなので一覧では使わない */}
                          {p.roleName && (
                            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.roleName}</div>
                          )}
                          {aff.kind !== "none" && (
                            <div style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 500 }}>
                              {/* 現職が無い人は「元 ○○」、職歴が無い人は学校名。
                                  /people のカードと同じ形にする */}
                              {aff.kind === "past" && <span style={{ marginRight: 4 }}>元</span>}
                              {aff.kind === "education" ? aff.schoolName : aff.companyName}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* 経験年数。職種は上の行に出すのでここには入れない */}
                      {p.experienceMonths != null && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 100, fontSize: 12, fontWeight: 600, background: "var(--bg-tint)", color: "var(--ink-soft)", border: "1px solid var(--line)" }}>
                            経験 {Math.max(1, Math.floor(p.experienceMonths / 12))}年
                          </span>
                        </div>
                      )}
                      <div style={{ marginTop: 14, fontSize: 12, fontWeight: 600, color: "var(--royal)" }}>
                        プロフィールを見る →
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
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: "0 0 14px" }}>他の職種を見る</h2>
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
            気になる企業から、どんな人が働いているかを見てみませんか。
          </p>
          <Link href="/companies" style={{ display: "inline-block", padding: "10px 28px", borderRadius: 100, background: "#fff", color: "var(--royal)", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
            企業を探す →
          </Link>
        </div>
      </div>
    </>
  );
}
