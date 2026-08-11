import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getJobBySlugOrId } from "@/lib/supabase/queries";
import ApplicationForm from "./ApplicationForm";
import { APPLICATION_CLOSED_MESSAGE } from "@/lib/jobs/application";

export const metadata: Metadata = {
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
  const result = await getJobBySlugOrId(params.id);
  if (!result) notFound();

  const { job, company } = result;

  /* ⚠️ 応募が届く先が無ければフォームを出さない（2026-08-11）。
        `company.application_open` は getJobById が解決した値で、
        求人詳細の応募CTA・一覧カード・モバイル固定バーと**同じ値**。
        表示と送信が別々の条件を見ると必ずずれる。 */
  if (!company.application_open) {
    return (
      <main style={{ maxWidth: 640, margin: "80px auto", padding: "0 24px" }}>
        <div style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 16, padding: "48px 40px", textAlign: "center",
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "var(--line-soft)", color: "var(--ink-mute)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px", fontSize: 24,
          }}>
            ✕
          </div>
          <h1 style={{
            fontFamily: 'var(--font-noto-serif)', fontSize: 20,
            fontWeight: 600, color: "var(--ink)", marginBottom: 12,
          }}>
            {APPLICATION_CLOSED_MESSAGE}
          </h1>
          {/* ⚠️ 理由も再開見込みも書かない。把握していない。 */}
          <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.9, marginBottom: 28 }}>
            <strong style={{ color: "var(--ink)" }}>{job.role}</strong>（{company.name}）
          </p>
          <Link
            href={`/jobs/${job.id}`}
            style={{
              display: "inline-block", padding: "10px 28px",
              background: "var(--royal)", color: "#fff",
              borderRadius: 8, fontSize: 13, fontWeight: 600,
              textDecoration: "none",
            }}
          >
            ← 募集ページに戻る
          </Link>
        </div>
      </main>
    );
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
            <Link href="/jobs" style={{ color: "var(--ink-mute)" }}>求人</Link>
            <span>/</span>
            <Link href={`/jobs/${job.id}`} style={{ color: "var(--ink-mute)" }}>{job.role}</Link>
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
