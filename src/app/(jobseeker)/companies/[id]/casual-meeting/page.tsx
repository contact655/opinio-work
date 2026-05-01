import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCompanyById } from "@/lib/supabase/queries";
import CasualMeetingForm from "./CasualMeetingForm";

export const metadata = { title: "カジュアル面談申し込み — Opinio" };

export default async function CasualMeetingPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth?next=/companies/${params.id}/casual-meeting`);
  }

  const result = await getCompanyById(params.id);
  if (!result) return notFound();

  const { company } = result;

  if (!company.accepting_casual_meetings) {
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
            現在受付していません
          </h1>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.9, marginBottom: 28 }}>
            <strong style={{ color: "var(--ink)" }}>{company.name}</strong> は現在、カジュアル面談の受付を一時停止しています。
            <br />企業の準備が整い次第、再開される予定です。
          </p>
          <a
            href={`/companies/${params.id}`}
            style={{
              display: "inline-block", padding: "10px 28px",
              background: "var(--royal)", color: "#fff",
              borderRadius: 8, fontSize: 13, fontWeight: 600,
              textDecoration: "none",
            }}
          >
            ← 企業ページに戻る
          </a>
        </div>
      </main>
    );
  }

  const companyInitial = company.name.charAt(0);

  return (
    <CasualMeetingForm
      companyId={company.id}
      companyName={company.name}
      companyInitial={companyInitial}
      companyGradient={company.gradient}
      authEmail={user.email ?? ""}
    />
  );
}
