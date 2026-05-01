import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getJobById } from "@/lib/supabase/queries";
import ApplicationForm from "./ApplicationForm";

export default async function ApplyPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?next=/jobs/${params.id}/apply`);
  }

  const result = await getJobById(params.id);
  if (!result) notFound();

  const { job, company } = result;

  const authName = (user.user_metadata?.name as string | undefined) ?? user.email ?? "";
  const authEmail = user.email ?? "";

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "10px 0" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }} className="px-5 md:px-10">
          <div style={{ fontSize: 12, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
            <Link href="/" style={{ color: "var(--ink-mute)" }}>Opinio</Link>
            <span>/</span>
            <Link href="/jobs" style={{ color: "var(--ink-mute)" }}>求人を探す</Link>
            <span>/</span>
            <Link href={`/jobs/${job.id}`} style={{ color: "var(--ink-mute)" }}>{job.role}</Link>
            <span>/</span>
            <span style={{ color: "var(--ink-soft)" }}>応募</span>
          </div>
        </div>
      </div>

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
