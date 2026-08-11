import { createAdminClient } from "@/lib/supabase/admin";
import AdminArticlesClient, {
  type Article,
  type OWUser,
  type OWCompany,
} from "./AdminArticlesClient";

/**
 * 記事管理（運営）。
 *
 * ⚠️ **読み取りはここ（サーバー）で createAdminClient を使う。**
 *    2026-08-11 まではクライアント側で引いており、`ow_company_admins` に
 *    運営ポリシー（auth_is_admin）が無いため実測で4件が見えていなかった。
 *    記事↔ユーザーの紐づけ候補（その企業に属する人）が欠けていた。
 *
 * ⚠️ /admin/layout.tsx が cookies() を呼ぶのでこのページは自動的に動的。
 */
export default async function AdminArticlesPage() {
  const supabase = createAdminClient();

  const [
    { data: arts, error: aErr },
    { data: usrs, error: uErr },
    { data: comps, error: cErr },
    { data: exps, error: eErr },
    { data: admins, error: adErr },
  ] = await Promise.all([
    supabase
      .from("ow_articles")
      .select("id, slug, title, subtitle, type, company_name_text, eyecatch_gradient, read_min, is_published, published_at, created_at, user_id, company_id")
      .order("created_at", { ascending: false }),
    supabase.from("ow_users").select("id, name").order("name", { ascending: true }),
    supabase
      .from("ow_companies")
      .select("id, name")
      .eq("is_published", true)
      .order("name", { ascending: true }),
    supabase
      .from("ow_experiences")
      .select("company_id, user_id")
      .not("company_id", "is", null)
      .not("user_id", "is", null),
    supabase
      .from("ow_company_admins")
      .select("company_id, user_id")
      .not("user_id", "is", null),
  ]);

  /* ⚠️ error を握り潰さない。空配列で「0件」を装うと、
        取得失敗と本当に0件の区別がつかなくなる。 */
  const firstError = aErr ?? uErr ?? cErr ?? eErr ?? adErr;
  if (firstError) {
    console.error("[admin/articles]", firstError.message);
    return (
      <div style={{ padding: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", margin: 0 }}>記事管理</h1>
        <div role="alert" style={{
          marginTop: 16, background: "#FEE2E2", border: "1px solid #FCA5A5",
          borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#991B1B",
        }}>
          記事の取得に失敗しました: {firstError.message}
        </div>
      </div>
    );
  }

  /* ⚠️ Map / Set は Server → Client にそのまま渡せない。組の配列にして渡し、
        クライアント側で Map に組み直す。 */
  const pairs: [string, string][] = [];
  for (const row of [...(exps ?? []), ...(admins ?? [])]) {
    const companyId = row.company_id as string | null;
    const userId = row.user_id as string | null;
    if (companyId && userId) pairs.push([companyId, userId]);
  }

  return (
    <AdminArticlesClient
      initialArticles={(arts ?? []) as unknown as Article[]}
      initialUsers={((usrs ?? []) as unknown as OWUser[]).filter((u) => u.name)}
      initialCompanies={(comps ?? []) as unknown as OWCompany[]}
      initialCompanyUserPairs={pairs}
    />
  );
}
