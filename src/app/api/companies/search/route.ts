import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { filterListedCompanies } from "@/lib/companies/visibility";

/**
 * GET /api/companies/search
 *
 * 企業名サジェスト（認証不要・公開エンドポイント）
 * Phase 2 Sprint 1 — 経歴登録時 / 企業作成時の重複チェック用
 *
 * クエリパラメータ:
 *   q     - 検索文字列（2文字以上推奨）
 *   limit - 最大件数（デフォルト 10、最大 50）
 *
 * レスポンス:
 *   { results: [{ id, name, logo_url, industry, industry_id, admin_count, employee_count }] }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = (searchParams.get("q") ?? "").trim();
  const domain = (searchParams.get("domain") ?? "").trim().toLowerCase();
  const limitRaw = parseInt(searchParams.get("limit") ?? "10", 10);
  const limit = Math.min(Math.max(1, isNaN(limitRaw) ? 10 : limitRaw), 50);

  if (q.length === 0 && domain.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const supabase = createClient();

  // is_published = true のみ返す（RLS + 明示フィルター）
  // ⚠️ サジェストはディレクトリの軸。listing_status='draft' は出さない
  let query = filterListedCompanies(
    supabase
      .from("ow_companies")
      .select("id, name, brand_name, logo_url, industry, industry_id, employee_count, url")
  )
    .order("name")
    .limit(limit);

  if (domain.length > 0) {
    // メールドメインで企業URLを検索（例: salesforce.com → %salesforce.com%）
    const safeDomain = domain.replace(/%/g, "\\%").replace(/_/g, "\\_");
    query = query.ilike("url", `%${safeDomain}%`);
  } else {
    // ILIKE wildcard エスケープ（% と _ はPostgreSQLのパターン文字）
    const safeQ = q.replace(/%/g, "\\%").replace(/_/g, "\\_");
    /* ★**社名は「和名・英語名・ブランド名・slug」の4つで引く**（2026-08-20）。
       ⚠️ 和名（`name`）だけで引くと、**英語名で検索した人には見つからない**。
          このサイトの社名は「アドビ株式会社」「シスコシステムズ合同会社」のように
          カタカナで入っており、公開79社のうち **50社は英語名の綴りが `name` に無い**。
          実測: 「Cisco」で検索すると**シスコ本体は出ず、説明文に Cisco を含む競合2社だけ**が出た。
       ⚠️ 検索できる場所は3つある（ヘッダーのサジェスト / `/companies` の一覧 /
          企業ピッカー）。**3つとも同じ列を見ること。** 1つ直すと他が取り残される。 */
    query = query.or(
      `name.ilike.%${safeQ}%,name_en.ilike.%${safeQ}%,` +
      `brand_name.ilike.%${safeQ}%,slug.ilike.%${safeQ}%,` +
      /* 読み仮名（2026-08-21）。カタカナで打たれたときに拾う。画面には出さない */
      `search_aliases.ilike.%${safeQ}%`
    );
  }

  const { data: companies, error } = await query;

  if (error) {
    console.error("[GET /api/companies/search] query failed");
    return NextResponse.json(
      { error: "検索に失敗しました" },
      { status: 500 }
    );
  }

  if (!companies || companies.length === 0) {
    return NextResponse.json({ results: [] });
  }

  /*
    ⚠️ **`admin_count` は admin クライアントで数える。**

    JSDoc には昔から `admin_count` と書いてあったが、**返していなかった**。
    受け手（`/biz/companies/add/new`）は `!conflict.admin_count` で
    「最初の担当者として参加できるか」を判定していたため、
    **undefined → 常に true** になり、担当者が2名いる企業でも
    「この企業はまだ担当者が登録されていません」と表示していた（2026-08-13 修正）。

    ⚠️ **RLS 下では数えられない。** `ow_company_admins` に運営ポリシーは無く、
       他社の行は見えないので `createClient()` で数えると 0 に落ちる
       （CLAUDE.md「/admin 配下ではブラウザ側の Supabase クライアントを使わない」の実測で、
        全10件中6件しか見えなかったのと同じ理由）。

    ⚠️ **数えられなかったときは 0 を返さない（fail closed）。** 0 は
       「担当者がいない＝あなたが最初の担当者になれる」という強い意味を持つ。
       取得に失敗したら `null` を返し、受け手は「不明」として扱う。
  */
  const adminCount = new Map<string, number>();
  let adminCountAvailable = true;
  {
    const adminDb = createAdminClient();
    const { data: adminRows, error: adminErr } = await adminDb
      .from("ow_company_admins")
      .select("company_id")
      .in("company_id", companies.map((c) => c.id))
      .eq("is_active", true);

    if (adminErr) {
      console.error("[GET /api/companies/search] admin_count failed:", adminErr.message);
      adminCountAvailable = false;
    } else {
      for (const row of adminRows ?? []) {
        const id = row.company_id as string;
        adminCount.set(id, (adminCount.get(id) ?? 0) + 1);
      }
    }
  }

  const results = companies.map((c) => ({
    id: c.id,
    name: c.name,
    logo_url: c.logo_url ?? null,
    industry: c.industry ?? null,
    /* ⚠️ 企業作成フォームが業種を引き継ぐのに使う。**保存に使うのはこちら（id）**で、
          上の `industry` は候補カードに出す表示用のラベル。混同しないこと。 */
    industry_id: c.industry_id ?? null,
    employee_count: c.employee_count ?? null,
    url: (c as { url?: string | null }).url ?? null,
    admin_count: adminCountAvailable ? (adminCount.get(c.id) ?? 0) : null,
  }));

  return NextResponse.json({ results });
}
