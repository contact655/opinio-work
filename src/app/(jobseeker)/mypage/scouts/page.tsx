import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { JobseekerHeader } from "@/components/jobseeker/JobseekerHeader";
import { JobseekerFooter } from "@/components/jobseeker/JobseekerFooter";
import ScoutsClient from "./ScoutsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "スカウト受信箱 | OPINIO" }, robots: { index: false, follow: false } };

export default async function ScoutsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/mypage/scouts");

  const admin = createAdminClient();

  const { data: scouts } = await admin
    .from("ow_scouts")
    .select("id, company_id, job_id, message, status, sent_at, conversation_id, ow_companies(id, slug, name, logo_gradient, logo_letter), ow_jobs(id, title)")
    .eq("candidate_id", user.id)
    .order("sent_at", { ascending: false });

  // Mark 'sent' scouts as 'read' (best-effort)
  const unreadIds = (scouts ?? [])
    .filter((s: any) => s.status === "sent")
    .map((s: any) => s.id);
  if (unreadIds.length > 0) {
    await admin.from("ow_scouts").update({ status: "read" }).in("id", unreadIds);
  }

  const scoutList = (scouts ?? []).map((s: any) => ({
    id: s.id as string,
    companyId: (s.ow_companies as any)?.slug ?? (s.ow_companies as any)?.id as string ?? s.company_id as string,
    companyName: (s.ow_companies as any)?.name as string ?? "企業",
    companyGradient: (s.ow_companies as any)?.logo_gradient as string | null,
    companyLetter: (s.ow_companies as any)?.logo_letter as string | null,
    jobId: (s.ow_jobs as any)?.id as string | null,
    jobTitle: (s.ow_jobs as any)?.title as string | null,
    message: s.message as string,
    status: s.status as string,
    sentAt: s.sent_at as string,
    conversationId: s.conversation_id as string | null,
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
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.7 }}>
            企業から届いたスカウトです。「話を聞きたい」と回答すると、企業との会話が始まります。
          </p>
        </div>
        <ScoutsClient scouts={scoutList} />
      </main>
      <JobseekerFooter />
    </>
  );
}
