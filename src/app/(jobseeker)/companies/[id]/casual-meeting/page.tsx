import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCompanyBySlugOrId, getTestCompanyBySlugOrId } from "@/lib/supabase/queries";
import { viewerIsTestUser } from "@/lib/users/testViewer";
import CasualMeetingForm from "./CasualMeetingForm";

export const revalidate = 60;
export const metadata = { title: { absolute: "カジュアル面談申し込み | OPINIO" }, robots: { index: false, follow: false } };

export default async function CasualMeetingPage({
  params,
  searchParams,
}: {
  params: { id: string };
  /* ⚠️ `?person=`（人の指名）は 2026-10-16 に撤去した（面談OKの撤去）。古いURLの値は無視される */
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
  let result = await getCompanyBySlugOrId(params.id);
  /* ★検証用アカウントだけ、検証用の会社にも申し込める（2026-10-12）。それ以外は今どおり 404 */
  let companyBase = "/companies";
  if (!result && (await viewerIsTestUser())) {
    result = await getTestCompanyBySlugOrId(params.id);
    companyBase = "/t/companies";
  }
  if (!result) return notFound();

  const { company } = result;

  /* ⚠️ `company.accepting_casual_meetings` は getCompanyById が
        「フラグ true **かつ** 宛先が実在する」に潰した値（lib/company/casualMeeting.ts）。
        ここで生のフラグを見に行かないこと。企業ページの CTA と同じ値を見ることで
        「ボタンが出ているのに申し込めない」「出ていないのに URL 直打ちで送れる」の
        両方を防いでいる。 */
  /* ★受け付けていなければ会社ページへ戻す（2026-10-27 / 柴さんの決定）。「受け付けていません」は出さない
        （担当者がいないことが理由のとき、その会社が OPINIO にいないことが分かるため） */
  if (!company.accepting_casual_meetings) {
    redirect(`${companyBase}/${params.id}`);
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

  /* ── ★在籍中でも申し込めるようにした（2026-08-29 / 柴さんの判断）─────────
        ⚠️★**ここにあった「現在ご在籍中の企業です」のブロックは撤去した。戻さないこと。**

        理由: **プロフィールの更新が漏れているだけの場合がある。**
        既に退職しているのに `is_current = true` のままの人が、申し込めずに止まっていた。
        判定材料が本人の自己申告である以上、それを根拠に**入口を塞ぐのは強すぎる**。

        ⚠️ ただし**黙って通すのではなく、注意書きを出す**（案B）。
           止めないが、更新漏れに気づく機会は残す。
           → `isCurrentEmployee` はここで**捨てずにフォームへ渡す**。

        ⚠️★**API 側には元からブロックが無い**（`POST /api/casual-meetings`）。
           したがって、この画面を外すと**止める仕組みは1つも無くなる**。
           承知のうえでそうしている。**「API が守ってくれる」と思わないこと。**

        ⚠️ CLAUDE.md の「Hisato 思想」6番（在籍企業制約）も同日に書き換えてある。 */

  const companyInitial = company.name.charAt(0);

  return (
    <CasualMeetingForm
      isCurrentEmployee={isCurrentEmployee}
      companyId={company.id}
      companyName={company.name}
      companyInitial={companyInitial}
      companyGradient={company.gradient}
      authEmail={user.email ?? ""}
      jobId={searchParams.job_id ?? null}
    />
  );
}
