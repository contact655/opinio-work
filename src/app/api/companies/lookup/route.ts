import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { companyDisplayName } from "@/lib/companies/displayName";

/**
 * GET /api/companies/lookup — 職歴の企業ピッカー専用。**未掲載の企業も名前で引ける。**
 *
 * ── なぜ別のエンドポイントにするか ──────────────────────────────────────────
 * ⚠️★**`/api/companies/search`（ディレクトリの軸）を緩めないこと。**
 *    あちらは `filterListedCompanies` で掲載中だけを返す前提で、
 *    ヘッダーのサジェスト・`/biz` の重複チェック・スカウトのブロック設定が乗っている。
 *    緩めると、掲載していない企業がそれら全部に漏れる。
 *
 * ── なぜ要るか ──────────────────────────────────────────────────────────────
 * 職歴の企業ピッカーが掲載中しか引けないと、**マスタにある企業すら選べない。**
 * 実測（2026-09-04）: ゼネコン6社を入れたのに「鹿島」「大林」「高砂」で**0件**だった。
 * 選べないと `company_text`（自由入力）に落ち、**業界に結びつかない**ので
 * `/mypage` の「◯◯の経験が活きる会社」の対象外になる。**非IT出身者ほどこの穴に落ちる。**
 *
 * ── ★返すものを絞る（2026-09-04 / 柴さんの条件）─────────────────────────────
 * 「掲載していない」という状態そのものが運営の情報なので、**名前を引ける以上のことをさせない。**
 *   ・ログイン必須（401）
 *   ・**2文字以上**。空や1文字で一覧が返る形にしない
 *   ・返すのは **id / name / isListed の3つだけ**。ロゴ・説明・URL・業種は返さない
 *   ・件数上限あり（`MAX_RESULTS`）
 *
 * ⚠️ `name` は**表示名に解決してから返す**（`companyDisplayName`）。
 *    `name_en` を生で返すと「返す列を絞る」に反するが、返さないと候補だけ
 *    正式名称（「株式会社セールスフォース・ジャパン」）になって画面と食い違う。
 *    **サーバー側で畳んで1つにする**のが両立する形。
 *
 * ⚠️ admin クライアントで引く。`ow_companies` の SELECT ポリシーは
 *    `is_published = true OR status = 'active'` なので、**未掲載企業は
 *    anon/authenticated からは元々読めない**（2026-09-04 実測）。
 */

/** ⚠️ 上限。増やすときは「名前を引ける以上のことをさせない」に反しないか考えること */
const MAX_RESULTS = 10;
/** ⚠️ 1文字で引かせない。空や1文字で一覧が返る形にしない */
const MIN_QUERY_LENGTH = 2;

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < MIN_QUERY_LENGTH) {
    // ⚠️ 短すぎるときは**空で返す**。エラーにはしない（入力中に赤が出るのは邪魔）
    return NextResponse.json({ results: [] });
  }

  const safeQ = q.replace(/%/g, "\\%").replace(/_/g, "\\_");

  /* ⚠️★**引く列は `/api/companies/search` と揃える**（CLAUDE.md 2026-08-20）。
        「検索できる場所は3つある。3つとも同じ列を見ること。1つ直すと他が取り残される」。
        和名だけで引くと、英語名で検索した人には見つからない。 */
  const { data, error } = await createAdminClient()
    .from("ow_companies")
    .select("id, name, name_en, is_published, listing_status")
    /* ⚠️ 検証用企業は返さない。求職者の画面に出す候補なので */
    .eq("is_test", false)
    .or(
      `name.ilike.%${safeQ}%,name_en.ilike.%${safeQ}%,` +
      `brand_name.ilike.%${safeQ}%,slug.ilike.%${safeQ}%,` +
      `search_aliases.ilike.%${safeQ}%`
    )
    /* 掲載中を先に出す。⚠️ 未掲載が上に来ると「掲載されている会社が無い」ように見える */
    .order("is_published", { ascending: false })
    .order("name")
    .limit(MAX_RESULTS);

  if (error) {
    // ⚠️ 握りつぶさない。空配列で返すと「該当なし」と区別が付かない
    console.error("[GET /api/companies/lookup] query failed:", error.message);
    return NextResponse.json({ error: "検索に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({
    results: (data ?? []).map((c) => ({
      id: c.id as string,
      /* ⚠️ 表示名に畳んでから返す（`name_en` を生で渡さない） */
      name: companyDisplayName(c.name as string, c.name_en as string | null).displayName,
      /* ⚠️ `filterListedCompanies` と同じ意味。掲載中＝ディレクトリに載っている */
      isListed: c.is_published === true && c.listing_status === "listed",
    })),
  });
}
