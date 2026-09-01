import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePublishedCompanyHref } from "@/lib/supabase/queries";
import { getRecipientsForCompanies } from "@/lib/notify/recipientsBatch";
import { APPLICATION_STATUS_TABS } from "@/lib/business/applications";
import Link from "next/link";

/**
 * 応募管理（閲覧のみ）。
 *
 * ⚠️ 運営から応募を操作できるようにしないこと。
 *    OPINIO はダイレクトリクルーティングで、企業と求職者が直接やりとりする。
 *    運営は仲介しない。ステータス変更・返信・対話への参加は置かない。
 *    ここは「誰がどんな企業に応募したか」を運営が把握するためだけの画面。
 *
 * ⚠️「企業側の宛先」の列は消さないこと。宛先ゼロの企業への応募は
 *    運営と応募者にしかメールが飛んでおらず、**企業には何も届いていない**。
 *    運営がそれを把握できる場所がここしかない。
 *
 * 雛形は /admin/meetings。page.tsx 1ファイル完結・Server Action なし。
 */

export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  pending:   { label: "新着",     bg: "#FEF3C7", color: "var(--warm-ink)",       border: "#FDE68A" },
  reviewing: { label: "確認中",   bg: "#EFF3FC", color: "var(--royal)",  border: "#DCE5F7" },
  interview: { label: "面接中",   bg: "#F3E8FF", color: "#7C3AED",       border: "#E9D5FF" },
  accepted:  { label: "採用",     bg: "#ECFDF5", color: "var(--success-ink)", border: "#A7F3D0" },
  rejected:  { label: "不採用",   bg: "#FEE2E2", color: "var(--error-ink)",       border: "#FECACA" },
  hired:     { label: "採用確定", bg: "var(--success)", color: "#fff",   border: "var(--success)" },
};

type Application = {
  id: string;
  createdAt: string;
  userId: string | null;
  name: string;
  email: string;
  jobId: string | null;
  jobSlug: string | null;
  jobTitle: string | null;
  companyId: string | null;
  companyName: string | null;
  status: string;
};

async function getApplications(): Promise<Application[]> {
  const admin = createAdminClient();

  // ⚠️ 埋め込みには ! を明示すること。ow_users への外部キーが複数ある表では、
  //    関係名だけだと "more than one relationship was found" でクエリごと落ちる
  //    （2026-08-05 に join-request とスカウト返信が無言で落ちていた原因）。
  const { data, error } = await admin
    .from("ow_job_applications")
    .select(`
      id, status, created_at, user_id, name, email, job_id,
      job:ow_jobs!job_id(id, slug, title, company_id,
        company:ow_companies!company_id(id, name))
    `)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    console.error("[admin/applications]", error.message);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => {
    const job = row.job as
      | { id: string; slug: string | null; title: string | null; company_id: string | null;
          company: { id: string; name: string | null } | null }
      | null;
    return {
      id: row.id as string,
      createdAt: row.created_at as string,
      userId: row.user_id as string | null,
      name: (row.name as string) ?? "—",
      email: (row.email as string) ?? "—",
      jobId: job?.id ?? null,
      jobSlug: job?.slug ?? null,
      jobTitle: job?.title ?? null,
      companyId: job?.company_id ?? null,
      companyName: job?.company?.name ?? null,
      status: (row.status as string) ?? "pending",
    };
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
}

const TH: React.CSSProperties = {
  textAlign: "left", padding: "10px 14px", fontSize: 11,
  color: "var(--ink-mute)", fontWeight: 700, letterSpacing: "0.05em", whiteSpace: "nowrap",
};
const TD: React.CSSProperties = { padding: "12px 14px", fontSize: 13, verticalAlign: "top" };

export default async function AdminApplicationsPage() {
  const applications = await getApplications();

  // 企業側の宛先。⚠️ 行ごとに引かない（N+1）。企業IDでユニーク化して並列に取る
  const recipients = await getRecipientsForCompanies(
    applications.map((a) => a.companyId),
    "admin/applications",
  );

  // 企業ページのリンク。⚠️ 非掲載企業には飛ばさない（本番で404）
  const hrefEntries = await Promise.all(
    Array.from(new Set(applications.map((a) => a.companyId).filter(Boolean) as string[]))
      .map(async (id) => [id, await resolvePublishedCompanyHref(id)] as const),
  );
  const companyHrefs = new Map(hrefEntries);

  const undelivered = applications.filter(
    (a) => !a.companyId || (recipients.get(a.companyId) ?? []).length === 0,
  ).length;

  const counts = APPLICATION_STATUS_TABS
    .filter((t) => t.status !== "all")
    .map((t) => ({ ...t, count: applications.filter((a) => a.status === t.status).length }));

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)" }}>応募管理</h1>
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", padding: "3px 7px",
            borderRadius: 4, background: "#DC2626", color: "#fff",
          }}>ADMIN</span>
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>
          誰がどの企業に応募したかを確認します。<strong>閲覧のみ</strong>です。
          企業と求職者は直接やりとりするため、運営からの操作（ステータス変更・返信）は行いません。
        </p>
      </div>

      {/* サマリ */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ padding: "10px 18px", borderRadius: 10, background: "var(--bg-tint)", border: "1px solid var(--line)" }}>
          <div style={{ fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 20, fontWeight: 800, color: "var(--ink)" }}>{applications.length}</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-mute)", marginTop: 2 }}>応募</div>
        </div>
        {counts.map((c) => (
          <div key={c.status} style={{ padding: "10px 18px", borderRadius: 10, background: "#fff", border: "1px solid var(--line)" }}>
            <div style={{ fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 20, fontWeight: 800, color: c.color }}>{c.count}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-mute)", marginTop: 2 }}>{c.labelJa}</div>
          </div>
        ))}
        {undelivered > 0 && (
          <div style={{ padding: "10px 18px", borderRadius: 10, background: "var(--error-soft)", border: "1px solid #FCA5A5" }}>
            <div style={{ fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 20, fontWeight: 800, color: "#DC2626" }}>{undelivered}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#991B1B", marginTop: 2 }}>企業に届いていない</div>
          </div>
        )}
      </div>

      <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7 }}>
        <strong style={{ color: "var(--ink)" }}>企業側の宛先:</strong>{" "}
        企業情報の「企業への通知先」、未設定なら管理者権限の担当者に届きます。
        どちらも無い企業への応募は、<strong>運営と応募者にしかメールが飛んでいません</strong>。
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid var(--line)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr style={{ background: "var(--bg-tint)", borderBottom: "1px solid var(--line)" }}>
                {["応募日", "応募者", "求人", "企業", "ステータス", "企業側の宛先"].map((h) => (
                  <th key={h} scope="col" style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "56px 0", color: "var(--ink-mute)", fontSize: 14 }}>
                    <div style={{ marginBottom: 8, fontSize: 28 }}>📥</div>
                    応募はまだありません
                  </td>
                </tr>
              ) : applications.map((a) => {
                const to = a.companyId ? (recipients.get(a.companyId) ?? []) : [];
                const href = a.companyId ? companyHrefs.get(a.companyId) : null;
                const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.pending;
                return (
                  <tr key={a.id} style={{ borderBottom: "1px solid var(--line-soft)" }}>
                    <td style={{ ...TD, whiteSpace: "nowrap", color: "var(--ink-mute)", fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 12 }}>
                      {formatDate(a.createdAt)}
                    </td>

                    {/* 応募者 — 公開プロフィールへ */}
                    <td style={TD}>
                      {a.userId ? (
                        <Link href={`/u/${a.userId}`} target="_blank" rel="noopener noreferrer"
                          style={{ color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>
                          {a.name}
                        </Link>
                      ) : (
                        <span style={{ fontWeight: 600 }}>{a.name}</span>
                      )}
                      <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>{a.email}</div>
                    </td>

                    <td style={TD}>
                      {a.jobId ? (
                        <Link href={`/jobs/${a.jobSlug ?? a.jobId}`} target="_blank" rel="noopener noreferrer"
                          style={{ color: "var(--royal)", textDecoration: "none" }}>
                          {a.jobTitle ?? "—"}
                        </Link>
                      ) : (
                        <span style={{ color: "var(--ink-mute)" }}>—</span>
                      )}
                    </td>

                    {/* 企業 — ⚠️ 非掲載企業はリンクにしない（resolvePublishedCompanyHref が null を返す） */}
                    <td style={TD}>
                      {href ? (
                        <Link href={href} target="_blank" rel="noopener noreferrer"
                          style={{ color: "var(--royal)", textDecoration: "none" }}>
                          {a.companyName ?? "—"}
                        </Link>
                      ) : (
                        <span style={{ color: "var(--ink-soft)" }}>
                          {a.companyName ?? "—"}
                          {a.companyName && <span style={{ fontSize: 11, color: "var(--ink-mute)", marginLeft: 6 }}>（非掲載）</span>}
                        </span>
                      )}
                    </td>

                    <td style={TD}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100,
                        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, whiteSpace: "nowrap",
                      }}>
                        {cfg.label}
                      </span>
                    </td>

                    {/* 企業側の宛先 — ゼロは目立たせる */}
                    <td style={TD}>
                      {to.length === 0 ? (
                        <span title="この応募は企業に届いていません"
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100,
                            background: "var(--error-soft)", color: "#991B1B", border: "1px solid #FCA5A5",
                            whiteSpace: "nowrap",
                          }}>
                          ⚠ 宛先なし
                        </span>
                      ) : (
                        <span title={to.join(", ")}
                          style={{
                            fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100,
                            background: "#ECFDF5", color: "var(--success-ink)", border: "1px solid #A7F3D0",
                            whiteSpace: "nowrap",
                          }}>
                          {to.length}件
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
