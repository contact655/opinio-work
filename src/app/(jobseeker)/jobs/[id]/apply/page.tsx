import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getJobBySlugOrId, getJobForPreview, resolveTestJobId } from "@/lib/supabase/queries";
import { viewerIsTestUser } from "@/lib/users/testViewer";
import ApplicationForm from "./ApplicationForm";

export const metadata: Metadata = {
  title: "募集に応募する",
  robots: { index: false, follow: false },
};

export default async function ApplyPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?next=/jobs/${params.id}/apply`);
  }

  /* ⚠️ getJobById は **UUID しか受けない**。ここは slug でも開く（2026-08-11 修正）。
        一覧カードの応募ボタンは `/jobs/{slug}/apply` を指しており、
        **公開求人5件すべてで 404 になっていた**（未ログインだと認証リダイレクトが
        先に出るため、ログインするまで誰も気づけない形だった）。
        2026-08-05 に casual-meeting で踏んだのと同じ罠。 */
  let result = await getJobBySlugOrId(params.id);
  /* ★検証用アカウントだけ、検証用の会社の公開中の求人にも応募できる（2026-10-12）。それ以外は今どおり 404 */
  let jobBase = "/jobs";
  if (!result && (await viewerIsTestUser())) {
    const testId = await resolveTestJobId(params.id);
    result = testId ? await getJobForPreview(testId) : null;
    jobBase = "/t/jobs";
  }
  if (!result) notFound();

  const { job, company } = result;

  /* ⚠️ 応募を受けられない（答えられる担当者がいない）なら、フォームを出さずに会社ページへ戻す（2026-10-27 / 柴さんの決定）。
        `company.application_open` は getJobById が解決した値で、求人詳細・一覧と**同じ値**。
        ⚠️「受け付けていません」「担当者がいません」と出さない（その会社が OPINIO にいないことが分かるため） */
  if (!company.application_open) {
    redirect(`/companies/${encodeURIComponent(company.slug ?? company.id)}`);
  }

  const authName = (user.user_metadata?.name as string | undefined) ?? user.email ?? "";
  const authEmail = user.email ?? "";

  return (
    <>
      {/* Breadcrumb */}
      <nav aria-label="パンくずリスト" style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "10px 0" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }} className="px-5 md:px-10">
          <div style={{ fontSize: 12, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
            <Link href="/" style={{ color: "var(--ink-mute)" }}>OPINIO</Link>
            <span>/</span>
            <Link href="/jobs" style={{ color: "var(--ink-mute)" }}>募集</Link>
            <span>/</span>
            <Link href={`${jobBase}/${job.id}`} style={{ color: "var(--ink-mute)" }}>{job.role}</Link>
            <span>/</span>
            <span aria-current="page" style={{ color: "var(--ink-soft)" }}>応募</span>
          </div>
        </div>
      </nav>

      <div style={{ background: "var(--bg-tint)", minHeight: "calc(100vh - 120px)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 20px 80px" }} className="px-5 md:px-10">
          <h1 style={{
            fontFamily: 'var(--font-noto-serif)',
            fontSize: "clamp(18px,2vw,22px)", fontWeight: 700,
            color: "var(--ink)", marginBottom: 6, lineHeight: 1.4,
          }}>
            {job.role}
          </h1>
          <p style={{ fontSize: 13, color: "var(--ink-mute)", marginBottom: 28 }}>
            {company.name} への応募
          </p>

          <ApplicationForm
            jobId={job.id}
            jobTitle={job.role}
            companyName={company.name}
            companyGradient={company.gradient}
            companyInitial={company.name.charAt(0).toUpperCase()}
            authName={authName}
            authEmail={authEmail}
          />
        </div>
      </div>
    </>
  );
}
