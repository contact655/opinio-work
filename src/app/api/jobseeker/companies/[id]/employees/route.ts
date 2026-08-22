import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyEmployeesCached, getPublicAmbassadorsCached, type CompanyEmployee } from "@/lib/supabase/queries";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/jobseeker/companies/[id]/employees
 *
 * 企業詳細ページの「閲覧者によって変わる部分」を返す。
 *   - 社員一覧（現役 / OB・OG）を**閲覧者の権限で絞ったもの**
 *   - 面談対応者（サイドバーの「カジュアル面談OK」ウィジェット用）を同じ条件で絞ったもの
 *   - 伏せた件数（「他N名」の表示用）
 *   - 閲覧者自身がその会社の在籍者かどうか（掲載可否パネル用）
 *
 * ── なぜ切り出したか（2026-08-09）────────────────────────────────────────
 * ページ本体が社員一覧を `isAuthenticated` で出し分けており、そのために
 * `auth.getUser()` が要り、ルートが動的化して `revalidate = 60` が効かなかった。
 * 閲覧者依存をここへ追い出し、ページ本体を閲覧者非依存にしてキャッシュに載せる。
 *
 * ⚠️ **絞り込みは必ずサーバー側で行う。** 全件返してクライアントで絞る実装に
 *    しないこと。非ログインに公開範囲外の社員情報を配ることになる。
 *
 * ⚠️ 絞り込みの条件はページ本体にあったものと**同一**にする。
 *      未ログイン … visibility === "public" のみ
 *      ログイン中 … 全件
 *    片方だけ変えると、画面とAPIで見える範囲がずれる。
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = !!user;

  /* 社員一覧・面談対応者はどちらも企業単位のデータで、**キャッシュ側は閲覧者に依らない**
     （is_test と private だけを落とし、login_only は残して visibility を返してくる）。
     ⚠️ ログイン状態で絞るのは**ここだけ**。キャッシュの中で絞ると、先に来た人の結果が
        後から来た人に配られる。 */
  const [employees, allAmbassadors] = await Promise.all([
    getCompanyEmployeesCached(params.id),
    getPublicAmbassadorsCached(params.id),
  ]);

  /* ⚠️ ここがページ本体にあった条件そのもの。変えないこと。 */
  const filterByVisibility = (emps: CompanyEmployee[]) =>
    isAuthenticated ? emps : emps.filter((e) => e.visibility === "public");

  const visibleCurrent = filterByVisibility(employees.current);
  const visibleAlumni = filterByVisibility(employees.alumni);

  /* ⚠️ 面談対応者にも**同じ条件**を当てる。社員一覧と別の条件にしないこと。 */
  const visibleAmbassadors = isAuthenticated
    ? allAmbassadors
    : allAmbassadors.filter((a) => a.visibility === "public");

  // 閲覧者が在籍者本人か（掲載可否パネルの出し分け用）
  let relation: {
    kind: "anonymous" | "unrelated" | "affiliated";
    listing?: "public" | "login_only" | "hidden";
    experienceCount?: number;
  } = { kind: "anonymous" };

  if (user) {
    relation = { kind: "unrelated" };
    const admin = createAdminClient();
    const { data: viewerRow, error: viewerErr } = await admin
      .from("ow_users")
      .select("id, visibility")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (viewerErr) {
      console.error("[companies/employees] viewer lookup", viewerErr.message);
    } else if (viewerRow) {
      const { data: ownExps, error: ownErr } = await admin
        .from("ow_experiences")
        .select("id, visibility_company")
        .eq("user_id", viewerRow.id as string)
        .eq("company_id", params.id);

      if (ownErr) {
        console.error("[companies/employees] viewer experiences", ownErr.message);
      } else if (ownExps && ownExps.length > 0) {
        const allHidden = ownExps.every((e) => e.visibility_company === "hidden");
        const userVisibility = (viewerRow.visibility as string | null) ?? null;
        /* 掲載レベルは「本人の非公開希望を優先」。どちらか一方でも非公開なら非公開側に倒す。
           ⚠️ ページ本体にあった判定をそのまま移している。 */
        relation = {
          kind: "affiliated",
          listing: allHidden
            ? "hidden"
            : userVisibility === "public"
              ? "public"
              : userVisibility === "login_only"
                ? "login_only"
                : "hidden",
          experienceCount: ownExps.length,
        };
      }
    }
  }

  return NextResponse.json({
    authenticated: isAuthenticated,
    current: visibleCurrent,
    alumni: visibleAlumni,
    hiddenCurrentCount: employees.current.length - visibleCurrent.length,
    hiddenAlumniCount: employees.alumni.length - visibleAlumni.length,
    totalCurrentCount: employees.current.length,
    totalAlumniCount: employees.alumni.length,
    /* ⚠️ `ambassadors` は閲覧者が見てよいものだけ。`totalAmbassadorCount` は
          **閲覧者に依らない総数**で、「ログインすると N名」の N に使う。
          ⚠️ 見出しの N と遮蔽メッセージの N は**この同じ値**から作ること
             （別々に数えて食い違った事故がある）。 */
    ambassadors: visibleAmbassadors,
    totalAmbassadorCount: allAmbassadors.length,
    relation,
  });
}
