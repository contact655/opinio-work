import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { SALARY_MIN_REPORTS_TO_DISPLAY, SALARY_REFERENCE_THRESHOLD } from "@/lib/constants/salary";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "給与データ | OPINIO",
  description: "IT/SaaS業界の職種別給与データ。企業が提示する求人レンジと、在籍者の自己申告データを分けて掲載。",
};

interface RoleSalaryGroup {
  roleId: string;
  roleName: string;
  parentName: string | null;
  // Self-reported aggregate (≥5 required)
  reportCount: number;
  reportAvg: number | null;
  reportMin: number | null;
  reportMax: number | null;
  // Job offer ranges from ow_jobs
  jobCount: number;
  jobAvgMin: number | null;
  jobAvgMax: number | null;
}

function fmt(yen: number) {
  return `${Math.round(yen / 10000)}万円`;
}

export default async function SalaryPage() {
  const admin = createAdminClient();

  // ── 在籍者の自己申告データ (statistics_opt_out 除外) ─────────────────────
  const { data: optedOut } = await admin
    .from("ow_users")
    .select("id")
    .eq("statistics_opt_out", true);
  const optedOutIds = (optedOut ?? []).map((u: { id: string }) => u.id);

  // Fetch roles separately (ow_salary_reports has no FK to ow_roles)
  const [reportsRes, jobsRes, rolesRes] = await Promise.all([
    (() => {
      let q = admin
        .from("ow_salary_reports")
        .select("role_id, annual_salary, user_id")
        .eq("is_approved", true);
      if (optedOutIds.length > 0) {
        q = q.not("user_id", "in", `(${optedOutIds.join(",")})`);
      }
      return q;
    })(),
    admin
      .from("ow_jobs")
      .select("job_category, salary_min, salary_max")
      .in("status", ["published", "active"])
      .or("salary_min.gt.0,salary_max.gt.0"),
    admin
      .from("ow_roles")
      .select("id, name, parent_id")
      .limit(500),
  ]);

  const reports = reportsRes.data ?? [];
  const jobs = jobsRes.data ?? [];
  const allRolesData = rolesRes.data ?? [];

  // Build role lookup: id → { name, parentName }
  const roleById: Record<string, { name: string; parentName: string | null }> = {};
  for (const role of allRolesData) {
    const parent = allRolesData.find((r) => r.id === role.parent_id);
    roleById[role.id] = { name: role.name, parentName: parent?.name ?? null };
  }

  // Aggregate reports by role
  const reportMap: Record<string, { salaries: number[]; roleName: string; parentName: string | null }> = {};
  for (const r of reports) {
    const roleId = r.role_id as string | null;
    if (!roleId) continue;
    const roleInfo = roleById[roleId];
    if (!roleInfo) continue;
    if (!reportMap[roleId]) {
      reportMap[roleId] = { salaries: [], roleName: roleInfo.name, parentName: roleInfo.parentName };
    }
    reportMap[roleId].salaries.push(r.annual_salary as number);
  }

  // Aggregate jobs by job_category (approximate role mapping)
  const jobMap: Record<string, number[][]> = {};
  for (const j of jobs ?? []) {
    const cat = (j as any).job_category as string | null;
    if (!cat) continue;
    if (!jobMap[cat]) jobMap[cat] = [];
    const min = (j as any).salary_min as number | null;
    const max = (j as any).salary_max as number | null;
    jobMap[cat].push([min ?? 0, max ?? 0]);
  }

  const groups: RoleSalaryGroup[] = Object.entries(reportMap)
    .filter(([, v]) => v.salaries.length >= SALARY_MIN_REPORTS_TO_DISPLAY)
    .map(([roleId, v]) => {
      const avg = Math.round(v.salaries.reduce((a, b) => a + b, 0) / v.salaries.length);
      const min = Math.min(...v.salaries);
      const max = Math.max(...v.salaries);
      const jPairs = jobMap[v.roleName] ?? [];
      const jMins = jPairs.map((p) => p[0]).filter(Boolean);
      const jMaxs = jPairs.map((p) => p[1]).filter(Boolean);
      return {
        roleId,
        roleName: v.roleName,
        parentName: v.parentName,
        reportCount: v.salaries.length,
        reportAvg: avg,
        reportMin: min,
        reportMax: max,
        jobCount: jPairs.length,
        jobAvgMin: jMins.length > 0 ? Math.round(jMins.reduce((a, b) => a + b, 0) / jMins.length) : null,
        jobAvgMax: jMaxs.length > 0 ? Math.round(jMaxs.reduce((a, b) => a + b, 0) / jMaxs.length) : null,
      };
    })
    .sort((a, b) => (b.reportAvg ?? 0) - (a.reportAvg ?? 0));

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 16px" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 800, color: "var(--ink)", fontFamily: "var(--font-noto-sans)" }}>
          職種別 給与データ
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.7 }}>
          IT/SaaS業界で働くOPINIO会員の自己申告データと、企業が求人票に掲示している提示レンジを分けて掲載しています。<br />
          2つのデータは意味が異なります。企業提示レンジは「これから払う」建前の額。在籍者実額は「実際にもらっている」額です。
        </p>
      </div>

      {/* Notice banner */}
      <div style={{
        background: "var(--royal-50)", border: "1px solid var(--royal-100)",
        borderRadius: 12, padding: "14px 18px", marginBottom: 28,
        fontSize: 13, color: "var(--royal)", lineHeight: 1.7,
      }}>
        <strong>データについて</strong>：在籍者が自己申告した年収データです。
        件数が少ないデータには「参考値」と表示します。個人を特定できる情報は一切含まれません。
      </div>

      {groups.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--ink-mute)" }}>
          <div style={{ fontSize: 18, marginBottom: 8 }}>まだデータが集まっていません</div>
          <div style={{ fontSize: 14, marginBottom: 20 }}>あなたの投稿が最初の一歩になります</div>
          <Link href="/mypage/salary/new" style={{
            display: "inline-block", padding: "10px 24px",
            background: "var(--success)", color: "#fff",
            borderRadius: 10, textDecoration: "none", fontWeight: 600,
          }}>
            給与データを投稿する
          </Link>
        </div>
      ) : (
        <>
          {/* Legend */}
          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-soft)" }}>
              <span style={{ width: 12, height: 12, background: "var(--success-soft)", border: "1px solid #6EE7B7", borderRadius: 3, display: "inline-block" }} />
              在籍者の実額（自己申告）
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-soft)" }}>
              <span style={{ width: 12, height: 12, background: "var(--royal-50)", border: "1px solid var(--royal-100)", borderRadius: 3, display: "inline-block" }} />
              求人の提示レンジ（企業公開）
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {groups.map((g) => (
              <div key={g.roleId} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    {g.parentName && (
                      <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 3 }}>{g.parentName}</div>
                    )}
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>{g.roleName}</div>

                    {/* Self-reported */}
                    <div style={{
                      background: "var(--success-soft)", border: "1px solid #A7F3D0",
                      borderRadius: 10, padding: "10px 14px", marginBottom: 8, display: "inline-block",
                    }}>
                      <div style={{ fontSize: 10, color: "#059669", fontWeight: 600, marginBottom: 4 }}>
                        在籍者の実額（{g.reportCount}件）
                        {g.reportCount < SALARY_REFERENCE_THRESHOLD && (
                          <span style={{ marginLeft: 6, background: "#FEF3C7", color: "#92400E", borderRadius: 4, padding: "1px 5px" }}>参考値</span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
                        <span style={{ fontSize: 20, fontWeight: 800, color: "var(--success)", fontFamily: "Inter, sans-serif" }}>
                          {g.reportAvg ? fmt(g.reportAvg) : "—"}
                        </span>
                        <span style={{ fontSize: 12, color: "#059669" }}>
                          {g.reportMin ? fmt(g.reportMin) : "—"} 〜 {g.reportMax ? fmt(g.reportMax) : "—"}
                        </span>
                      </div>
                    </div>

                    {/* Job offer range */}
                    {g.jobCount > 0 && (
                      <div style={{
                        background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                        borderRadius: 10, padding: "10px 14px", display: "inline-block", marginLeft: 8,
                      }}>
                        <div style={{ fontSize: 10, color: "var(--royal)", fontWeight: 600, marginBottom: 4 }}>求人の提示レンジ（{g.jobCount}件平均）</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--royal)", fontFamily: "Inter, sans-serif" }}>
                          {g.jobAvgMin ? `${g.jobAvgMin}万` : "—"} 〜 {g.jobAvgMax ? `${g.jobAvgMax}万円` : "—"}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 32, textAlign: "center" }}>
            <Link href="/mypage/salary/new" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "12px 28px", background: "var(--success)", color: "#fff",
              borderRadius: 10, textDecoration: "none", fontWeight: 600, fontSize: 14,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              給与データを投稿して、精度を上げる
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
