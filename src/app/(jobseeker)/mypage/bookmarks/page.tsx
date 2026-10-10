import { companyLinkStateFor } from "@/lib/companies/linkState";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { jobListingStateFor, TEST_JOB_LISTED_NOTE } from "@/lib/jobs/publicJobs";
import { fetchJobRoleLabels } from "@/lib/jobs/roleLabel";
import BookmarksClient, { type Bookmark } from "./BookmarksClient";
import { formatEmployeeSize } from "@/lib/constants/employeeBand";
import type { Metadata } from "next";

/* ⚠️ **ログイン後のページにもタイトルを付ける。** 付けないとサイト既定の
      「IT業界の転職・求人情報 | OPINIO」になり、**タブを何枚開いても全部同じ名前**で
      見分けがつかない。2026-08-20 の実測で /mypage 配下の3ページが該当した。
   ⚠️ `absolute` にする（ルートの template が `| OPINIO` を足すため）。 */
export const metadata: Metadata = {
  title: { absolute: "保存した企業・募集 | OPINIO" },
  robots: { index: false, follow: false },
};


export const dynamic = "force-dynamic";

export default async function BookmarksPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/mypage/bookmarks");

  const admin = createAdminClient();
  /* ⚠️ ここから下、Supabase の呼び出しは `error` を必ず受けてログに出す（2026-08-29）。
        捨てると **RLS も GRANT も 400 も、すべて「0件」に化ける**。`?? []` で受けている
        側からは区別が付かず、画面には**節ごと消えたようにしか見えない**。
        ⚠️ `try/catch` では捕まらない。supabase-js はエラーを**戻り値**で返す。 */
  const { data: owUserRows, error: owUserRowsErr } = await admin
    .from("ow_users").select("id, is_test").eq("auth_id", user.id).limit(1);
  if (owUserRowsErr) console.error("[mypage/bookmarks] ow_users:", owUserRowsErr.message);
  const owUserId = owUserRows?.[0]?.id;
  const viewerIsTest = owUserRows?.[0]?.is_test === true;
  const companyState = (c: { is_published: boolean | null; is_test: boolean | null }) =>
    companyLinkStateFor({ isTest: c.is_test, isPublished: c.is_published }, { viewerIsTest });

  let companyBookmarks: Bookmark[] = [];
  let jobBookmarks: Bookmark[] = [];

  if (owUserId) {
    const { data: bmarks, error: bmarksErr } = await admin
      .from("ow_bookmarks")
      .select("id, target_id, target_type")
      .eq("user_id", owUserId)
      .in("target_type", ["company", "job"])
      .order("created_at", { ascending: false });
    if (bmarksErr) console.error("[mypage/bookmarks] ow_bookmarks:", bmarksErr.message);

    if (bmarks && bmarks.length > 0) {
      const companyBmarks = bmarks.filter((b) => b.target_type === "company");
      const jobBmarks = bmarks.filter((b) => b.target_type === "job");

      if (companyBmarks.length > 0) {
        const ids = companyBmarks.map((b) => b.target_id as string);
        const { data: companies, error: companiesErr } = await admin
          /* ⚠️ 求職者に見せる分類は**事業領域**。`industry`(text) は廃止予定で
                新規企業では空になる（CLAUDE.md「求職者側の読み手を事業領域へ移した」）。
             ⚠️★`is_published` / `is_test` を**必ず取る**（2026-09-27）。落とすと
                `undefined` になり、下の判定が静かに「生きている」側へ倒れる。 */
          .from("ow_companies")
          .select("id, name, employee_count_band, is_published, is_test, ow_company_business_domains(is_primary, ow_business_domains(name))")
          .in("id", ids);
        if (companiesErr) console.error("[mypage/bookmarks] ow_companies:", companiesErr.message);
        if (companies) {
          const map = new Map(companies.map((c) => [c.id, c]));
          companyBookmarks = companyBmarks.flatMap((b) => {
            const c = map.get(b.target_id as string);
            if (!c) return [];
            /* 主の事業領域だけを出す（カードは1行1タグ）。無ければ項目ごと落とす。 */
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const links = ((c as any).ow_company_business_domains ?? []) as {
              is_primary: boolean; ow_business_domains: { name: string } | null;
            }[];
            const domain = links.find((l) => l.is_primary)?.ow_business_domains?.name ?? null;
            return [{
              id: b.id as string, type: "company" as const,
              title: c.name as string,
              meta: [domain, formatEmployeeSize(c.employee_count_band, null, { compact: true })].filter(Boolean).join(" / "),
              /* ⚠️ `?? "企業"` は事業領域が無いときに出す既定値。`??` でよい
                    （上の `domain` は null か文字列で、空文字にはならない）。 */
              badge_label: domain ?? "企業",
              /* ★開けるかを判定して、開けないものはリンクを外す（2026-09-27 / B案）。
                    ⚠️★**一覧から落とさない。** 本人が保存したものなので、黙って消すと
                       理由の分からないまま記録が減る。
                    ⚠️★**詳細の軸**で見る（`is_published` = 404 ゲート）。
                       ディレクトリ非掲載（`listing_status='draft'`）は**開けるので外さない**
                       —— 「最近見た企業」が `filterVisibleCompaniesStrict` を使うのと同じ線。 */
              /* ★見ている人と会社がどちらも検証用なら、終了とは出さず文字だけ（2026-10-11。`companyLinkStateFor`） */
              href: companyState(c) === "open" ? `/companies/${c.id}` : null,
              /* ⚠️ 理由は断定しない。運営が下ろしたのか企業が下ろしたのかは、ここからは分からない */
              gone_label: companyState(c) === "closed" ? "公開を終了しました" : undefined,
              no_link: companyState(c) === "open_test" ? true : undefined,
            }];
          });
        }
      }

      if (jobBmarks.length > 0) {
        const ids = jobBmarks.map((b) => b.target_id as string);
        const { data: jobs, error: jobsErr } = await admin
          /* ⚠️★`status` / `is_test` を**必ず取る**（2026-09-27）。落とすと `undefined` になり、
                下の判定が静かに「生きている」側へ倒れる（CLAUDE.md「取得していない値が
                既定値に化ける」）。 */
          .from("ow_jobs").select("id, title, job_category, company_id, status, is_test").in("id", ids);
        if (jobsErr) console.error("[mypage/bookmarks] ow_jobs:", jobsErr.message);
        if (jobs) {
          // 職種の表示は会社呼称 ?? 標準職種名。job_category は使わない
          const roleLabels = await fetchJobRoleLabels(jobs.map((j) => j.id as string));
          const companyIds = Array.from(new Set(jobs.map((j) => j.company_id as string)));
          const { data: companies, error: companiesErr } = await admin
            .from("ow_companies").select("id, name, is_test").in("id", companyIds);
          if (companiesErr) console.error("[mypage/bookmarks] ow_companies:", companiesErr.message);
          const cMap = new Map((companies ?? []).map((c) => [c.id as string, c.name as string]));
          const cTest = new Map((companies ?? []).map((c) => [c.id as string, c.is_test === true]));
          const jMap = new Map(jobs.map((j) => [j.id, j]));
          jobBookmarks = jobBmarks.flatMap((b) => {
            const j = jMap.get(b.target_id as string);
            if (!j) return [];
            /* ★判定は `jobListingStateFor` の1か所（2026-10-11）。見ている人と企業がどちらも検証用なら掲載中として扱う */
            const state = jobListingStateFor(j as { status: string; is_test: boolean }, { viewerIsTest, companyIsTest: cTest.get(j.company_id as string) === true });
            return [{
              id: b.id as string, type: "job" as const,
              title: j.title as string,
              meta: [cMap.get(j.company_id as string), roleLabels.get(j.id as string)?.label].filter(Boolean).join(" / "),
              badge_label: roleLabels.get(j.id as string)?.label ?? "募集",
              /* ★公開中の求人だけリンクにする（2026-09-27 / B案）。
                    ⚠️★**表示条件は `status='published'` かつ `is_test=false` の2つだけ**
                       （CLAUDE.md。`ow_jobs` に `is_published` 列は無い）。
                    ⚠️★実際に踏んでいた: 実ユーザーが♡した求人が 2026-08-30 に
                       出典の突き合わせで `private` になり、**本番で 404 を返していた。** */
              href: state === "open" ? `/jobs/${j.id}` : null,
              /* ⚠️ 「募集終了」と断定しない。取り下げ・保留・掲載方法の変更もありうる
                    （CLAUDE.md「採用ページに無い＝募集終了 と断定はできない」と同じ線）。 */
              gone_label: state === "open" ? undefined : state === "open_test" ? TEST_JOB_LISTED_NOTE : "掲載を終了しました",
              no_link: state === "open_test" ? true : undefined,
            }];
          });
        }
      }
    }
  }

  return <BookmarksClient companyBookmarks={companyBookmarks} jobBookmarks={jobBookmarks} />;
}
