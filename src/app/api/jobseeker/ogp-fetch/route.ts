import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import ogs from "open-graph-scraper";
import { safeFetchText } from "@/lib/net/safeFetch";
import { checkRateLimit } from "@/lib/rateLimit";
import { OGP_RATE_LIMIT } from "@/lib/net/ogpRateLimit";

export const dynamic = "force-dynamic";

/** URL の形だけを見る（http / https で、解釈できること）。⚠️ 接続先の検査は safeFetchText が行う */
function isHttpUrl(urlString: string): boolean {
  try {
    const u = new URL(urlString);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * POST /api/jobseeker/ogp-fetch
 *
 * URL を受け取り OGP 情報（og_image_url / og_title）を返す。
 *
 * - 認証必須（未認証の場合は 401）
 * - ★回数制限: 利用者ごとに1分あたり20回（超えたら 429。`OGP_RATE_LIMIT`）
 * - URL の形が不正（解釈できない・http/https 以外）は 400
 * - ★取得は `safeFetchText`（2026-10-09 に差し替え）。DNS で解決した IP を検査し、
 *   検査した IP に接続を固定し、リダイレクトは1段ずつ検査する（SSRF 対策）
 * - ★取得の拒否・失敗はすべて 200 + null（理由は返さない。サーバーのログにだけ残る）
 *   ⚠️ 2026-10-09 まで内部向けのホストは 400 を返していたが、**拒否と失敗で応答を
 *      分けると、内部の様子を探る手がかりになる**ので 200 + null に揃えた
 * - 画像は URL のみ返却、Storage 保存なし
 * - ⚠️ og:image は**利用者のブラウザ**が読みに行く（素の img）。サーバーは取りに行かない
 */
export async function POST(req: NextRequest) {
  // 1. 認証チェック（SSRF 悪用防止: スクレイピング API を未認証公開しない）
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. 回数制限（利用者ごと）
  if (!(await checkRateLimit(req, { ...OGP_RATE_LIMIT, prefix: "ogp-fetch", id: user.id }))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // 3. リクエスト body 取得
  let body: { url?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = body?.url;
  if (typeof url !== "string" || !url.trim()) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }
  if (!isHttpUrl(url)) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const empty = () => NextResponse.json({ og_image_url: null, og_title: null }, { status: 200 });

  // 4. 取得（SSRF 対策込み）→ 解析だけを open-graph-scraper に任せる
  try {
    const fetched = await safeFetchText(url);
    if (!fetched.ok) return empty();

    /* ⚠️ `url` と `html` は同時に渡せない（ogs の仕様）。取得は済んでいるので html だけ */
    const ogsResult = await ogs({ html: fetched.html });
    if (ogsResult.error) return empty();

    const { result } = ogsResult;

    // ogImage は ImageObject[]（各要素に url: string が存在する）
    let ogImageUrl: string | null = null;
    if (Array.isArray(result.ogImage) && result.ogImage.length > 0) {
      ogImageUrl = result.ogImage[0].url ?? null;
    }

    // twitterImage を og:image のフォールバックとして使用
    if (!ogImageUrl && Array.isArray(result.twitterImage) && result.twitterImage.length > 0) {
      ogImageUrl = result.twitterImage[0].url ?? null;
    }

    /* 画像の URL は http / https だけ（javascript: 等を排除）。
       ⚠️ 画像は利用者のブラウザが読むので、ここで内部アドレスの判定は要らない
          （相対パスは従来どおり null になる） */
    if (ogImageUrl && !isHttpUrl(ogImageUrl)) ogImageUrl = null;

    return NextResponse.json(
      {
        og_image_url: ogImageUrl,
        og_title: result.ogTitle ?? result.twitterTitle ?? null,
      },
      { status: 200 },
    );
  } catch (err) {
    // 想定外エラー（パース失敗等）も null で返す。⚠️ URL はログに出さない
    console.error("[ogp-fetch] unexpected:", err instanceof Error ? err.name : "error");
    return empty();
  }
}
