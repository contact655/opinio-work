import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

type Props = { params: { userId: string } };

type CareerStep = {
  id: string;
  company_id: string | null;
  company_text: string | null;
  company_anonymized: string | null;
  role_title: string | null;
  started_at: string | null;
  ended_at: string | null;
  is_current: boolean;
  description: string | null;
  join_reason: string | null;
  employment_type: string | null;
  salary_man: number | null;
  visibility_company: string;
  visibility_salary: boolean;
  visibility_reason: boolean;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const admin = createAdminClient();
  const { data: cp } = await admin
    .from("ow_career_profiles")
    .select("headline, ow_users(name)")
    .eq("user_id", params.userId)
    .eq("is_published", true)
    .single();
  if (!cp) return { title: "キャリア軌跡 | OPINIO" };
  const user = cp.ow_users as unknown as { name: string | null } | null;
  const name = user?.name ?? "先輩";
  return {
    title: { absolute: `${name}のキャリア軌跡 | OPINIO` },
    description: cp.headline ?? `${name}のリアルなキャリア軌跡を公開しています。`,
  };
}

function Avatar({ name, photoUrl, size = 60 }: { name: string | null; photoUrl: string | null; size?: number }) {
  const initial = (name ?? "?")[0];
  if (photoUrl) {
    return (
      <img src={photoUrl} alt={name ?? ""} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }} />
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

function formatPeriod(startedAt: string | null, endedAt: string | null, isCurrent: boolean): string {
  const fmt = (d: string) => {
    const [y, m] = d.split("-");
    return `${y}年${parseInt(m)}月`;
  };
  const start = startedAt ? fmt(startedAt) : "不明";
  if (isCurrent) return `${start} 〜 現在`;
  const end = endedAt ? fmt(endedAt) : "";
  return `${start} 〜 ${end}`;
}

function calcDuration(startedAt: string | null, endedAt: string | null, isCurrent: boolean): string {
  if (!startedAt) return "";
  const start = new Date(startedAt);
  const end = isCurrent ? new Date() : (endedAt ? new Date(endedAt) : new Date());
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (months < 12) return `${months}ヶ月`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m > 0 ? `${y}年${m}ヶ月` : `${y}年`;
}

function CompanyName({ step, companies }: { step: CareerStep; companies: Record<string, string> }) {
  if (step.visibility_company === "real") {
    const name = step.company_text ?? "";
    if (step.company_id && companies[step.company_id]) {
      return (
        <Link href={`/companies/${step.company_id}`} style={{ color: "var(--royal)", textDecoration: "none", fontWeight: 700, fontSize: 16 }}>
          {companies[step.company_id]}
        </Link>
      );
    }
    return <span style={{ fontWeight: 700, fontSize: 16, color: "var(--ink)" }}>{name}</span>;
  }
  return (
    <span style={{ fontWeight: 700, fontSize: 16, color: "var(--ink-soft)" }}>
      {step.company_anonymized ?? "企業名非公開"}
    </span>
  );
}

export default async function CareerTrajectoryDetailPage({ params }: Props) {
  const admin = createAdminClient();
  const { userId } = params;

  // プロフィール + ユーザー情報
  const { data: cp } = await admin
    .from("ow_career_profiles")
    .select("headline, years_of_experience, updated_at, is_published, ow_users(id, name, profile_photo_url, job_type, visibility)")
    .eq("user_id", userId)
    .single();

  if (!cp || !cp.is_published) notFound();

  const user = cp.ow_users as unknown as {
    id: string; name: string | null; profile_photo_url: string | null;
    job_type: string | null; visibility: string;
  } | null;

  if (!user || user.visibility === "private") notFound();

  // キャリアステップ (adminSupabase で RPC 呼び出し)
  const { data: steps, error: stepsError } = await admin.rpc("get_public_career_steps", { p_user_id: userId });
  if (stepsError) console.error("[career-steps]", stepsError.message);

  const careerSteps: CareerStep[] = (steps ?? []) as CareerStep[];

  // 実名企業の company_id → 表示名を一括取得
  const realCompanyIds = careerSteps
    .filter(s => s.visibility_company === "real" && s.company_id)
    .map(s => s.company_id as string);

  const companies: Record<string, string> = {};
  if (realCompanyIds.length > 0) {
    const { data: compData } = await admin
      .from("ow_companies")
      .select("id, name")
      .in("id", realCompanyIds);
    for (const c of compData ?? []) companies[c.id] = c.name;
  }

  const name = user.name ?? "先輩";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-tint)" }}>
      {/* ── ヘッダー ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "28px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <Link href="/career-trajectories" style={{ fontSize: 13, color: "var(--ink-mute)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 20 }}>
            ← キャリア軌跡一覧に戻る
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Avatar name={name} photoUrl={user.profile_photo_url} size={64} />
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: "var(--ink)", margin: "0 0 4px", fontFamily: "'Noto Serif JP', serif" }}>
                {name}
              </h1>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {user.job_type && (
                  <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{user.job_type}</span>
                )}
                {cp.years_of_experience && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
                    background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)",
                  }}>
                    経験 {cp.years_of_experience}年
                  </span>
                )}
              </div>
            </div>
          </div>

          {cp.headline && (
            <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.7, marginTop: 16, padding: "14px 18px", background: "var(--bg-tint)", borderRadius: 10, borderLeft: "3px solid var(--royal-100)" }}>
              {cp.headline}
            </p>
          )}
        </div>
      </div>

      {/* ── キャリアタイムライン ── */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 60px" }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)", marginBottom: 24 }}>
          キャリア軌跡
        </h2>

        {careerSteps.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--ink-mute)", background: "#fff", borderRadius: 12, border: "1px solid var(--line)" }}>
            <p>経歴情報が公開されていません</p>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            {/* 縦ライン */}
            <div style={{
              position: "absolute", left: 19, top: 0, bottom: 0,
              width: 2, background: "var(--line)", borderRadius: 1,
            }} />

            {careerSteps.map((step, idx) => (
              <div key={step.id} style={{ display: "flex", gap: 20, marginBottom: idx < careerSteps.length - 1 ? 28 : 0, position: "relative" }}>
                {/* ノード */}
                <div style={{
                  width: 40, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center",
                }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: "50%", marginTop: 18,
                    background: step.is_current ? "var(--royal)" : "#fff",
                    border: `2px solid ${step.is_current ? "var(--royal)" : "var(--line)"}`,
                    boxShadow: step.is_current ? "0 0 0 4px rgba(0,35,102,0.1)" : "none",
                    zIndex: 1, position: "relative",
                  }} />
                </div>

                {/* カード */}
                <div style={{
                  flex: 1, background: "#fff", borderRadius: 12,
                  border: `1px solid ${step.is_current ? "var(--royal-100)" : "var(--line)"}`,
                  padding: "16px 18px",
                  boxShadow: step.is_current ? "0 2px 12px rgba(0,35,102,0.06)" : "none",
                }}>
                  {step.is_current && (
                    <span style={{
                      display: "inline-block", fontSize: 10, fontWeight: 800, padding: "2px 8px",
                      borderRadius: 100, background: "var(--royal)", color: "#fff", marginBottom: 10,
                    }}>
                      現職
                    </span>
                  )}

                  <div style={{ marginBottom: 8 }}>
                    <CompanyName step={step} companies={companies} />
                  </div>

                  {step.role_title && (
                    <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 6 }}>
                      {step.role_title}
                    </div>
                  )}

                  <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: step.salary_man || step.join_reason || step.description ? 12 : 0 }}>
                    {formatPeriod(step.started_at, step.ended_at, step.is_current)}
                    {" "}
                    <span style={{ color: "var(--ink-mute)", opacity: 0.7 }}>
                      ({calcDuration(step.started_at, step.ended_at, step.is_current)})
                    </span>
                  </div>

                  {/* 年収 */}
                  {step.salary_man && (
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      fontSize: 13, fontWeight: 700, color: "var(--success)",
                      background: "var(--success-soft)", padding: "3px 10px", borderRadius: 100,
                      marginBottom: 10,
                    }}>
                      年収 {step.salary_man}万円
                    </div>
                  )}

                  {/* 入社理由 */}
                  {step.join_reason && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        入社・転職理由
                      </div>
                      <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7, margin: 0 }}>
                        {step.join_reason}
                      </p>
                    </div>
                  )}

                  {/* 仕事内容 */}
                  {step.description && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        仕事内容
                      </div>
                      <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7, margin: 0 }}>
                        {step.description}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* プロフィールページへのリンク */}
        <div style={{ marginTop: 32, textAlign: "center" }}>
          <Link
            href={`/u/${userId}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "12px 24px", borderRadius: 10, fontSize: 14, fontWeight: 700,
              background: "linear-gradient(135deg, var(--royal), var(--accent))",
              color: "#fff", textDecoration: "none",
              boxShadow: "0 2px 12px rgba(0,35,102,0.20)",
            }}
          >
            {name}のプロフィールを見る →
          </Link>
        </div>
      </div>
    </div>
  );
}
