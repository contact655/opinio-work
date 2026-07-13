import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { JobseekerHeader } from "@/components/jobseeker/JobseekerHeader";
import { JobseekerFooter } from "@/components/jobseeker/JobseekerFooter";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "スカウト受信箱 | OPINIO" }, robots: { index: false, follow: false } };

export default async function ScoutsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/mypage/scouts");

  const admin = createAdminClient();

  // スカウト一覧 + 企業情報
  const { data: scouts } = await admin
    .from("ow_scouts")
    .select("id, company_id, job_id, message, status, sent_at, ow_companies(id, name, logo_gradient, logo_letter), ow_jobs(id, title)")
    .eq("candidate_id", user.id)
    .order("sent_at", { ascending: false });

  const scoutList = (scouts ?? []).map((s: any) => ({
    id: s.id as string,
    companyId: (s.ow_companies as any)?.id as string ?? s.company_id as string,
    companyName: (s.ow_companies as any)?.name as string ?? "企業",
    companyGradient: (s.ow_companies as any)?.logo_gradient as string | null,
    companyLetter: (s.ow_companies as any)?.logo_letter as string | null,
    jobId: (s.ow_jobs as any)?.id as string | null,
    jobTitle: (s.ow_jobs as any)?.title as string | null,
    message: s.message as string,
    status: s.status as string,
    sentAt: s.sent_at as string,
  }));

  return (
    <>
      <JobseekerHeader />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px 80px" }}>
        <div style={{ marginBottom: 32 }}>
          <Link href="/mypage" style={{ fontSize: 13, color: "var(--ink-mute)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 12 }}>
            ← マイページに戻る
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", margin: "0 0 6px" }}>スカウト受信箱</h1>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0 }}>
            企業から届いたスカウトメッセージです。返信は任意です。無視しても構いません。
          </p>
        </div>

        {scoutList.length === 0 ? (
          <div style={{
            background: "#fff", border: "1px solid var(--line)", borderRadius: 14,
            padding: "48px 32px", textAlign: "center",
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📭</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
              スカウトはまだ届いていません
            </p>
            <p style={{ fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.7 }}>
              プロフィールを充実させると、スカウトが届きやすくなります。
            </p>
            <Link
              href="/profile/edit"
              style={{
                display: "inline-block", marginTop: 20,
                background: "var(--royal)", color: "#fff",
                padding: "10px 24px", borderRadius: 8,
                fontSize: 13, fontWeight: 600, textDecoration: "none",
              }}
            >
              プロフィールを編集する
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {scoutList.map((s) => (
              <div key={s.id} style={{
                background: "#fff", border: "1px solid var(--line)", borderRadius: 14,
                padding: "24px 28px",
                borderLeft: s.status === "sent" ? "3px solid var(--royal)" : "3px solid var(--line)",
              }}>
                {/* Company header */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                    background: s.companyGradient ?? "linear-gradient(135deg, var(--royal), #3B5FD9)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, fontWeight: 700, color: "#fff",
                  }}>
                    {s.companyLetter ?? s.companyName[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{s.companyName}</span>
                      {s.status === "sent" && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
                          background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)",
                        }}>
                          未読
                        </span>
                      )}
                    </div>
                    {s.jobTitle && (
                      <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 2 }}>
                        求人: {s.jobTitle}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>
                    {new Date(s.sentAt).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })}
                  </div>
                </div>

                {/* Message */}
                <div style={{
                  fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8,
                  whiteSpace: "pre-wrap", padding: "14px 16px",
                  background: "var(--bg-tint)", borderRadius: 8,
                  marginBottom: 16,
                }}>
                  {s.message}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Link
                    href={`/companies/${s.companyId}`}
                    style={{
                      fontSize: 12, padding: "7px 16px", borderRadius: 7,
                      border: "1px solid var(--line)", color: "var(--ink-soft)",
                      textDecoration: "none", fontWeight: 500,
                    }}
                  >
                    企業を見る
                  </Link>
                  {s.jobId && (
                    <Link
                      href={`/jobs/${s.jobId}`}
                      style={{
                        fontSize: 12, padding: "7px 16px", borderRadius: 7,
                        border: "1px solid var(--line)", color: "var(--ink-soft)",
                        textDecoration: "none", fontWeight: 500,
                      }}
                    >
                      求人を見る
                    </Link>
                  )}
                  <span style={{ fontSize: 11, color: "var(--ink-mute)", marginLeft: "auto" }}>
                    返信は任意です。無視しても構いません。
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <JobseekerFooter />
    </>
  );
}
