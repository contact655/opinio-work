import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/onboarding/companies/search
 *
 * オンボーディング専用の企業検索（認証必須）
 * 未公開企業も含めて検索する（is_published フィルターなし）
 * name + brand_name の OR 検索
 */
/** 埋め込みの `ow_industries` を名前に畳む。⚠️ 配列でもオブジェクトでも来る */
function industryName(v: unknown): string | null {
  const row = Array.isArray(v) ? v[0] : v;
  const name = (row as { name?: unknown } | null)?.name;
  return typeof name === "string" && name.trim() ? name : null;
}

export async function GET(req: NextRequest) {
  // 認証チェック
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const safeQ = q.replace(/%/g, "\\%").replace(/_/g, "\\_");
  const admin = createAdminClient();

  const { data: companies, error } = await admin
    .from("ow_companies")
    /* ⚠️ `name_en` も返す。表示名は `companyDisplayName()` が name_en 優先で作るので、
          返さないと候補だけ正式名称（「株式会社セールスフォース・ジャパン」）になる。 */
    /* ⚠️★`industry`(text) は**廃止列**なので読まない（2026-08-29）。
          2026-08-25 に書き込み経路を閉じており、以降に作られた企業は NULL。
          業種は必ず `industry_id` → `ow_industries.name` から取る
          （実測: 廃止列は 85/86、マスタは **86/86**）。
       ⚠️ `phase` も返さない。生値（listed / unicorn / series_d …）が
          そのまま候補に出ていた。**企業を見分ける役には立たない**ので落とした。 */
    .select("id, name, name_en, brand_name, industry_id, is_published, ow_industries(name)")
    /* ⚠️ 検索は正式名称・ブランド名・英語名の3つに当てる。表示が英語名になる会社を
          英語名で引けないと、見えている名前で検索できないことになる。 */
    .or(`name.ilike.%${safeQ}%,brand_name.ilike.%${safeQ}%,name_en.ilike.%${safeQ}%`)
    .order("is_published", { ascending: false })
    .order("name")
    .limit(8);

  if (error) {
    return NextResponse.json({ error: "検索に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({
    results: (companies ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      name_en: c.name_en ?? null,
      brand_name: c.brand_name ?? null,
      /* ⚠️ 埋め込みは配列で返ることがある。**渡す前に名前へ畳む**
            （畳まずに渡すと受け手は undefined になり、型が optional なので
            tsc も lint も通ったままその項目だけ黙って消える）。 */
      industry: industryName(c.ow_industries),
    })),
  });
}
