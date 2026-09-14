import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/companies/search — **企業マスタの照会。`/biz` の企業登録専用。**
 *
 * ⚠️★**ディレクトリの軸ではない**（2026-09-14 に変えた）。
 *    答えるのは「**この会社はマスタに既にあるか**」で、「掲載中か」ではない。
 *
 * ── なぜ変えたか ────────────────────────────────────────────────────────────
 * `filterListedCompanies`（掲載中だけ）で引いていたため、**掲載していない企業の
 * 重複を検出できなかった。** 2026-09-14 に61社を `listing_status='draft'` にしたので
 * **88社中66社が候補に出なくなり**、例えばアドビの担当者が登録しに来ても
 * 「すでにあります／あなたは2人目の担当者です」が出ず、**重複行を作る**状態になった。
 * ⚠️ 外した61社は大手外資に偏っており、**登録しに来る確率が高い側**だった。
 *
 * ── ★利用者は1つだけ ────────────────────────────────────────────────────────
 * **`/biz/companies/add/new` の4箇所だけ**（2026-09-14 実測。他はすべてコメント）。
 *   ・ヘッダーのサジェスト … **`/api/search/suggest`**（別ルート。ここではない）
 *   ・職歴の企業ピッカー   … `/api/companies/lookup`
 *   ・スカウトのブロック   … 2026-09-14 に `lookup` へ移した
 * ⚠️ CLAUDE.md には長らく「ヘッダーのサジェストが乗っている」と書かれていたが**誤り**。
 *
 * ⚠️★**新しい利用者を足すときは軸を確かめること。** 求職者に見せる一覧・検索・
 *    サジェストは**ディレクトリの軸**なので、ここではなく `filterListedCompanies` を使う。
 *
 * ── ⚠️ 認証を必須にした（2026-09-14。それまで公開だった）────────────────────
 * 掲載していない企業まで返すようになったので、**未ログインには開けない。**
 * 「掲載していない」という状態そのものが運営の情報（`/api/companies/lookup` と同じ理由）。
 * ⚠️ **`/biz` ロールでは絞れない。** `company` ロールは存在せず、初めて企業を作る人は
 *    `ow_company_admins` の行をまだ持たない。**ログイン必須が上限。**
 *
 * Phase 2 Sprint 1 — 企業作成時の重複チェック用
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

  /* ⚠️★**認証必須**（2026-09-14 に追加。それまで公開だった）。理由は上の JSDoc。
        ⚠️ 短すぎる/空のときの早期 return より**前**に置く。後ろに置くと
           「空クエリなら未ログインでも 200」という穴が残る。 */
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  if (q.length === 0 && domain.length === 0) {
    return NextResponse.json({ results: [] });
  }

  /* ⚠️★**admin クライアントで引く**（2026-09-14）。`ow_companies` の SELECT ポリシーは
        `is_published = true` なので、**未公開の企業はセッションのクライアントからは
        そもそも読めない**（`/api/companies/lookup` と同じ理由）。
        重複検出では未公開の行こそ当てたい —— 例えば大成建設は
        `is_published = false` で入っており、本人が登録しに来たら**それに合流させたい**。
     ⚠️ 絞り込みは `is_test = false` **だけ**。検証用企業は候補に出さない。 */
  let query = createAdminClient()
    .from("ow_companies")
    /* ⚠️ サブテキストは **業種（`ow_industries.name`）**。`industry`(text) は
          廃止予定（新規企業には書かれない）なので読まない。
       ⚠️★**null になりうる**（2026-09-14）。それまでは「掲載中しか返さないので
          公開ゲートが `industry_id` を必須にしている＝必ず値がある」と書いてあったが、
          **掲載で絞るのをやめたのでその前提は消えた。**
          受け手（`/biz/companies/add/new`）は `?? null` で受けており、
          業種の行が出ないだけ。**既定値で埋めないこと。** */
    .select("id, name, brand_name, logo_url, industry_id, employee_count, url, ow_industries(name)")
    .eq("is_test", false)
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
    /* ⚠️ キー名は据え置き（受け手2つ＝職歴エディタとオンボーディングが同じ形で読む）。
          中身は**業種マスタの名前**で、`ow_companies.industry`(text) ではない。 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    industry: ((c as any).ow_industries?.name as string | undefined) ?? null,
    /* ⚠️ 企業作成フォームが業種を引き継ぐのに使う。**保存に使うのはこちら（id）**で、
          上の `industry` は候補カードに出す表示用のラベル。混同しないこと。 */
    industry_id: c.industry_id ?? null,
    employee_count: c.employee_count ?? null,
    url: (c as { url?: string | null }).url ?? null,
    admin_count: adminCountAvailable ? (adminCount.get(c.id) ?? 0) : null,
  }));

  return NextResponse.json({ results });
}
