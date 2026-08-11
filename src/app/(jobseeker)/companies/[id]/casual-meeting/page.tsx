import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCompanyBySlugOrId } from "@/lib/supabase/queries";
import CasualMeetingForm from "./CasualMeetingForm";

export const revalidate = 60;
export const metadata = { title: { absolute: "カジュアル面談申し込み | OPINIO" }, robots: { index: false, follow: false } };

export default async function CasualMeetingPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { job_id?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?next=/companies/${params.id}/casual-meeting`);
  }

  // ⚠️ getCompanyById は UUID しか受けない。親の /companies/[id] は slug でも開けるので、
  //    ここも同じ getCompanyBySlugOrId を使う。
  //    2026-08-05 まで slug の URL は常に notFound() を投げていたが、
  //    このセグメントの loading.tsx が Suspense 境界を作っていたため
  //    HTTP 200 のまま「見つかりません」が出るだけで、誰も気づけなかった。
  const result = await getCompanyBySlugOrId(params.id);
  if (!result) return notFound();

  const { company } = result;

  /* ⚠️ `company.accepting_casual_meetings` は getCompanyById が
        「フラグ true **かつ** 宛先が実在する」に潰した値（lib/company/casualMeeting.ts）。
        ここで生のフラグを見に行かないこと。企業ページの CTA と同じ値を見ることで
        「ボタンが出ているのに申し込めない」「出ていないのに URL 直打ちで送れる」の
        両方を防いでいる。 */
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
            {/* ⚠️ 「準備が整い次第、再開される予定です」と書いてあったが、
                   再開の予定は OPINIO 側で把握していない。約束しない文言にした（2026-08-11）。 */}
            <strong style={{ color: "var(--ink)" }}>{company.name}</strong> は現在、カジュアル面談を受け付けていません。
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

  // ── 在籍企業制約チェック ──────────────────────────────────────────────────────
  // ow_experiences で is_current=true かつ company_id が一致する場合はブロック
  let isCurrentEmployee = false;
  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (owUser) {
    const { data: currentExp } = await supabase
      .from("ow_experiences")
      .select("id")
      .eq("user_id", owUser.id)
      .eq("company_id", company.id)
      .eq("is_current", true)
      .maybeSingle();

    isCurrentEmployee = !!currentExp;
  }

  if (isCurrentEmployee) {
    return (
      <main style={{ maxWidth: 640, margin: "80px auto", padding: "0 24px" }}>
        <div style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 16, padding: "48px 40px", textAlign: "center",
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "var(--warm-soft)", color: "#B45309",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px", fontSize: 24,
          }}>
            🏢
          </div>
          <h1 style={{
            fontFamily: 'var(--font-noto-serif)', fontSize: 20,
            fontWeight: 600, color: "var(--ink)", marginBottom: 12,
          }}>
            現在ご在籍中の企業です
          </h1>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.9, marginBottom: 28 }}>
            <strong style={{ color: "var(--ink)" }}>{company.name}</strong> は、あなたのプロフィールで現在の在籍企業として登録されています。
            <br />在籍中の企業へのカジュアル面談申し込みはできません。
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
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
            <a
              href="/companies"
              style={{
                display: "inline-block", padding: "10px 28px",
                background: "#fff", color: "var(--ink-soft)",
                border: "1px solid var(--line)",
                borderRadius: 8, fontSize: 13, fontWeight: 600,
                textDecoration: "none",
              }}
            >
              他の企業を探す
            </a>
          </div>
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
      jobId={searchParams.job_id ?? null}
    />
  );
}
