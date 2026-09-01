import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyContext } from "@/lib/business/company";
import { JobDetailView } from "@/components/jobs/JobDetailView";

/**
 * 求人のプレビュー（2026-09-02）。
 *
 * ⚠️★**なぜ `/jobs/[id]` に分岐を足さずに別ルートにしたか。**
 *    あちらは ISR（`revalidate = 60`）で**応答がキャッシュ共有される**
 *    （本番実測で `x-vercel-cache: STALE`）。閲覧者ごとの分岐を足すと
 *    **下書きのプレビューが他人に配られる。**
 *    ここは `force-dynamic` なのでキャッシュされない。
 *
 * ⚠️ 見えるのは**その企業の管理者だけ。**
 *    ⚠️★**失敗の理由を出し分けないこと。** 「他社の求人」「存在しないID」「不正なID」で
 *       文言を変えると、**その求人が存在するかどうかが分かってしまう。** 3つとも同じ画面を返す。
 *    ⚠️ `notFound()` は使っていない。親の `app/biz/jobs/loading.tsx` が Suspense 境界を作るため、
 *       **HTTP は 200 のままシェルだけが流れて真っ白になる**（CLAUDE.md「ソフト200」）。
 *       実測でもそうなり、利用者には理由の分からない空白ページに見えた。
 *       ここは `/biz` の内側（認証は middleware が担保）なので、
 *       **status より「何が起きたか伝わること」を優先して、明示的に案内を描いている。**
 *
 * ⚠️ 描画は `JobDetailView` を**公開ページと共用**している。
 *    ここにJSXをコピーしないこと。差が出るとプレビューの意味が無くなる。
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "求人プレビュー | OPINIO Business",
  // ⚠️ 検索エンジンに拾わせない。下書きが含まれる。
  robots: { index: false, follow: false, nocache: true },
};

/** 見せられないときの画面。⚠️ 理由で文言を変えないこと（求人の存在が分かる）。 */
function NotAvailable() {
  return (
    <div style={{ maxWidth: 560, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
      <p style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
        この求人は表示できません
      </p>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.9, marginBottom: 20 }}>
        URL が正しいか、選択中の企業が合っているかをご確認ください。
      </p>
      <Link href="/biz/jobs" style={{ fontSize: 13, fontWeight: 600, color: "var(--royal)" }}>
        求人一覧へ戻る
      </Link>
    </div>
  );
}

export default async function JobPreviewPage({ params }: { params: { id: string } }) {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(params.id)) return <NotAvailable />;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const ctx = await getCompanyContext(supabase, user.id, cookies().get("biz_current_company_id")?.value);
  if (!ctx) return <NotAvailable />;

  /* ⚠️ **求人の持ち主を確かめる。** URL の id をそのまま信じない。
        admin クライアントで引くのは、下書きが RLS で 0 行になるのを避けるため。
        その代わり、直後に company_id を突き合わせている。 */
  const { data: jobRow } = await createAdminClient()
    .from("ow_jobs")
    .select("id, company_id, title, status, is_test")
    .eq("id", params.id)
    .maybeSingle();
  if (!jobRow || jobRow.company_id !== ctx.companyId) return <NotAvailable />;

  const isLive = jobRow.status === "published" && jobRow.is_test === false;

  return (
    <div>
      {/* ⚠️ **この帯を消さないこと。** 公開ページと見分けがつかないと、
             「公開されている」と誤解したまま運用されることになる。 */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "var(--royal)", color: "#fff",
        padding: "10px 20px", display: "flex", alignItems: "center",
        gap: 12, flexWrap: "wrap", fontSize: 13, fontWeight: 600,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
          background: "rgba(255,255,255,0.2)",
        }}>
          プレビュー
        </span>
        <span>
          {isLive
            ? "この求人は公開中です。求職者にもこの内容が見えています。"
            : "この画面はあなたにだけ見えています。求職者・検索エンジンには出ていません。"}
        </span>
        <Link
          href={`/biz/jobs/${params.id}/edit`}
          style={{ marginLeft: "auto", color: "#fff", textDecoration: "underline", whiteSpace: "nowrap" }}
        >
          編集に戻る
        </Link>
      </div>
      <JobDetailView id={params.id} preview />
    </div>
  );
}
