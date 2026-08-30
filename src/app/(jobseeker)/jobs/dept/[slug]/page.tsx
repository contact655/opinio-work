import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getJobs, getRoleTree } from "@/lib/supabase/queries";
import { getDeptJobs } from "@/lib/jobs/deptJobs";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import { fmtMan } from "@/lib/utils/salary";

// 求人の掲載状態（published / closed）がここに出るため、鮮度は求人詳細に合わせて60秒。
// 1時間だと求人を閉じた後も最大1時間このページから流入し続ける。
export const revalidate = 60;

// ─── カテゴリ定義 ─────────────────────────────────────────────────────────────
//
// 2026-08-03: 職種の分類を ow_roles の9大分類に一本化した。
//
// 旧実装は独自の7スラッグ × job_category のフリーテキスト一致だった。
// 企業が biz の職種セレクトで正しく選んでも、その語彙（営業 / エンジニア / PdM 等）が
// ここの jobCategories（フィールドセールス / バックエンド 等）と噛み合わず、
// 7つの職種ページのうち6つが常に0件になっていた（published 18件中15件が到達不能）。
//
// slug と label は ow_roles（parent_id IS NULL の9件）から引く。ここに持つのは
// SEO 用の説明文だけ。マスタに無い分類をここで増やさないこと——
// 語彙をコード側に作った結果が上記の破綻だった。
const DEPT_SEO: Record<string, { labelEn: string; description: string }> = {
  exec:      { labelEn: "Executive & CxO",        description: "IT/SaaS企業の経営・CxO・幹部候補の求人。" },
  bizdev:    { labelEn: "Business Development",   description: "IT/SaaS企業の事業開発・アライアンス・BizDev求人。" },
  sales:     { labelEn: "Sales",                  description: "IT/SaaS企業のフィールドセールス・インサイドセールス・SDR/BDR・セールスエンジニア・プリセールスの求人。" },
  cs:        { labelEn: "Customer Success",       description: "IT/SaaS企業のカスタマーサクセス・カスタマーサポート・テクニカルサポート求人。" },
  marketing: { labelEn: "Marketing",              description: "IT/SaaS企業のマーケティング・プロダクトマーケティング求人。" },
  product:   { labelEn: "Product & Design",       description: "IT/SaaS企業のプロダクトマネージャー・デザイナーの求人。" },
  "data-ai": { labelEn: "Data & AI",              description: "IT/SaaS企業のデータサイエンティスト・データアナリスト・機械学習エンジニア求人。" },
  engineer:  { labelEn: "Software Engineer",      description: "IT/SaaS企業のバックエンド・フロントエンド・SRE・モバイルエンジニア求人。" },
  corporate: { labelEn: "Corporate",              description: "IT/SaaS企業のHR・人事・財務・経理・法務・コーポレート求人。" },
};

/** ow_roles の9大分類を SEO 文言つきで取得する */
async function getDeptCategories() {
  const tree = await getRoleTree();
  return tree.topLevel
    .filter((r) => r.slug && DEPT_SEO[r.slug])
    .map((r) => ({
      slug: r.slug as string,
      id: r.id,
      label: r.name,
      ...DEPT_SEO[r.slug as string],
    }));
}

export async function generateStaticParams() {
  return Object.keys(DEPT_SEO).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const cat = (await getDeptCategories()).find((c) => c.slug === params.slug);
  if (!cat) return { title: { absolute: "求人 | OPINIO" } };

  const title = `${cat.label}の求人 | OPINIO`;
  const description = `${cat.description} IT/SaaS業界特化の転職プラットフォームOPINIOで探す。`;

  /* ★求人が0件なら noindex（2026-08-30）。
     ⚠️ 実測（2026-08-30）で**9部門のうち8つが0件**なのに `index, follow` だった。
        中身の無いページを検索結果に出しても、来た人に見せるものが無い。
     ⚠️ **sitemap 側と同じ `getDeptJobs()` を使う。** 片方だけ直すと
        「sitemap にはあるのに noindex」という矛盾になる。
     ⚠️ ページ自体は 404 にしない。**求人が入れば自動で index に戻る**し、
        内部リンクから来た人には分類の説明が読める。 */
  const empty = (( await getDeptJobs()).get(params.slug)?.length ?? 0) === 0;

  return {
    title: { absolute: title },
    description,
    keywords: [cat.label, "IT転職", "SaaS求人", "転職", cat.labelEn],
    ...(empty ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical: `/jobs/dept/${params.slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      url: `/jobs/dept/${params.slug}`,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSalary(min: number, max: number): string {
  const fmt = fmtMan;
  if (min && max) return `${fmt(min)}〜${fmt(max)}万円`;
  if (min) return `${fmt(min)}万円〜`;
  if (max) return `〜${fmt(max)}万円`;
  return "応相談";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function JobDeptPage({ params }: { params: { slug: string } }) {
  const categories = await getDeptCategories();
  const cat = categories.find((c) => c.slug === params.slug);
  if (!cat) notFound();

  const { jobs, companies } = await getJobs();

  const companyMap = new Map(companies.map((c) => [c.id, c]));

  // getJobs は roleIds に「具体職種＋その祖先」を入れているので、
  // 大分類の UUID がそのまま含まれているかを見るだけでよい。
  const filteredJobs = jobs.filter((j) => (j.roleIds ?? []).includes(cat.id));

  return (
    <>
    <style>{`
      .dept-job-card-link { text-decoration: none; display: block; }
      .dept-job-card {
        background: #fff; border: 1px solid var(--line); border-radius: 16px;
        padding: 20px 22px; transition: box-shadow 0.15s, border-color 0.15s;
      }
      .dept-job-card-link:hover .dept-job-card {
        box-shadow: 0 4px 20px rgba(0,35,102,0.10); border-color: var(--royal-100);
      }
      .dept-cat-chip {
        display: block; padding: 12px 14px; border-radius: 12px;
        background: #fff; border: 1px solid var(--line);
        text-decoration: none; font-size: 13px; font-weight: 600; color: var(--ink);
        transition: border-color 0.15s, background 0.15s;
      }
      .dept-cat-chip:hover { border-color: var(--royal-100); background: var(--royal-50); }
    `}</style>
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 20px 80px" }}>
      {/* ─ ヘッダー ─ */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Link href="/jobs" style={{ fontSize: 12, color: "var(--ink-soft)", textDecoration: "none", fontWeight: 500 }}>
            求人
          </Link>
          <span style={{ color: "var(--ink-mute)", fontSize: 12, fontWeight: 500 }}>›</span>
          <span style={{ fontSize: 12, color: "var(--royal)", fontWeight: 600 }}>{cat.label}</span>
        </div>
        <h1 style={{
          fontFamily: "var(--font-noto-serif, 'Noto Serif JP', serif)",
          fontSize: "clamp(22px, 3vw, 32px)",
          fontWeight: 700,
          color: "var(--ink)",
          margin: "0 0 10px",
          lineHeight: 1.3,
        }}>
          {cat.label}の求人
        </h1>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "0 0 16px", lineHeight: 1.6 }}>
          {cat.description}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            fontSize: 13, fontWeight: 700,
            background: "var(--royal-50)", color: "var(--royal)",
            padding: "4px 14px", borderRadius: 100,
            border: "1px solid var(--royal-100)",
          }}>
            {filteredJobs.length}件の求人
          </span>
          {/* /jobs の職種フィルタは ow_roles の UUID を受ける（?dept= の文字列一致は廃止） */}
          <Link href={`/jobs?category=${cat.id}`} style={{
            fontSize: 13, color: "var(--royal)", fontWeight: 600, textDecoration: "none",
          }}>
            フィルタで絞り込む →
          </Link>
        </div>
      </div>

      {/* ─ 求人リスト ─ */}
      {filteredJobs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--ink-mute)" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <p style={{ fontSize: 15, margin: 0 }}>現在この職種の求人はありません</p>
          <Link href="/jobs" style={{ display: "inline-block", marginTop: 16, fontSize: 13, color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>
            全求人を見る →
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filteredJobs.map((job) => {
            const company = companyMap.get(job.company_id);
            const hasSalary = (job.salary_min ?? 0) > 0 || (job.salary_max ?? 0) > 0;
            const jobUrl = `/jobs/${job.slug ?? job.id}`;

            return (
              <Link
                key={job.id}
                href={jobUrl}
                className="dept-job-card-link"
              >
                <div className="dept-job-card">
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    {/* ロゴ */}
                    {company && (
                      <CompanyLogo
                        name={company.name}
                        logoUrl={company.logo_url ?? null}
                        logoLetter={company.logo_letter ?? null}
                        logoGradient={company.gradient ?? null}
                        size={44}
                        borderRadius={10}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* 会社名 */}
                      {company && (
                        <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 3, fontWeight: 500 }}>
                          {company.name}
                        </div>
                      )}
                      {/* 求人タイトル */}
                      <div style={{
                        fontSize: 15, fontWeight: 700, color: "var(--ink)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        marginBottom: 6,
                      }}>
                        {job.role}
                      </div>
                      {/* メタ情報 */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                        {/* 具体職種。大分類に集約して出しているので、
                            なぜこのページに載っているかが分かるよう実際の職種名も出す
                            （例: 営業ページに「セールスエンジニア」） */}
                        {job.roleName && job.roleName !== cat.label && (
                          <span style={{
                            fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 100,
                            background: "var(--bg-tint)", color: "var(--ink-soft)",
                            border: "1px solid var(--line)",
                          }}>
                            {job.roleName}
                          </span>
                        )}
                        {hasSalary && (
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--success)", fontFamily: "var(--font-inter), var(--font-noto)" }}>
                            {formatSalary(job.salary_min, job.salary_max)}
                          </span>
                        )}
                        {job.work_style && (
                          <span style={{
                            fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 100,
                            background: "var(--royal-50)", color: "var(--royal)",
                            border: "1px solid var(--royal-100)",
                          }}>
                            {job.work_style}
                          </span>
                        )}
                        {job.location && (
                          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>
                            📍 {job.location}
                          </span>
                        )}
                        {job.is_new && (
                          <span style={{
                            fontSize: 12, fontWeight: 700, padding: "2px 7px", borderRadius: 100,
                            /* ⚠️ 黄色にしない（2026-08-30）。ui-conventions「色の役割」で
                                  **黄色背景は使わない**。NEW は新着を示すだけで、
                                  注意でも面談でも金銭でもない。
                               ⚠️ NEW バッジはこのページにしか無い一点物。他の一覧に足すときは
                                  ここと同じ royal にすること（別の色を持ち込まない）。 */
                            background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)",
                          }}>
                            NEW
                          </span>
                        )}
                      </div>
                      {/* キャッチコピー */}
                      {job.highlight && (
                        <div style={{
                          fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", marginTop: 8, lineHeight: 1.5,
                          overflow: "hidden", display: "-webkit-box",
                          WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                        }}>
                          {job.highlight}
                        </div>
                      )}
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2} style={{ flexShrink: 0, marginTop: 4 }}>
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* ─ 他カテゴリへのリンク ─ */}
      <div style={{ marginTop: 48, paddingTop: 32, borderTop: "1px solid var(--line)" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 16, marginTop: 0 }}>
          他の職種カテゴリ
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
          {categories
            .filter((c) => c.slug !== params.slug)
            .map((c) => (
              <Link
                key={c.slug}
                href={`/jobs/dept/${c.slug}`}
                className="dept-cat-chip"
              >
                {c.label}
              </Link>
            ))}
        </div>
      </div>

      {/* ─ CTA ─ */}
      <div style={{
        marginTop: 40, padding: "28px 24px", borderRadius: 16,
        background: "linear-gradient(135deg, var(--royal), #3B5FD9)",
        textAlign: "center",
      }}>
        <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, margin: "0 0 16px", lineHeight: 1.6 }}>
          気になる求人が見つかったら、企業の先輩に話を聞いてみましょう。
        </p>
        <Link href="/companies" style={{
          display: "inline-block", padding: "10px 28px", borderRadius: 100,
          background: "#fff", color: "var(--royal)",
          fontSize: 13, fontWeight: 700, textDecoration: "none",
        }}>
          企業を探す →
        </Link>
      </div>
    </div>
    </>
  );
}
