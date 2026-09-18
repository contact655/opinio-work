import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";

/**
 * `ow_transitions` の洗い替え（2026-09-18）。
 *
 * ── ★この cron はメールを送らない ─────────────────────────────────────────
 * ⚠️★**`vercel.json` の `crons` に載っている唯一のジョブ。**
 *    あそこが長く空だったのは**週次メールを止めるため**で（2026-08-07）、
 *    この行を足したことで**週次メールが動き出すわけではない。**
 *    `weekly-jobs` / `weekly-match` は
 *      ① `crons` に載っていない（このファイルだけ）
 *      ② ルート側も `WEEKLY_EMAIL_ENABLED !== "true"` で止まっている
 *    の**二重**で止まったまま。**どちらも外さないこと。**
 *
 * ── なぜ洗い替えるのか ─────────────────────────────────────────────────────
 * `ow_transitions` は「会社が変わった隣接ペア」を **SQL から引くため**の導出テーブル。
 * `age_at_move` / `years_of_experience_at_move` / `role_change` / `industry_change` を持つ。
 * 手動でしか洗い替えていなかったため、2026-09-18 時点で**最終 2026-08-26**まで古くなっていた。
 *
 * ⚠️★**製品の画面はこの表を読んでいない**（2026-09-18 に外した）。
 *    ②⑨ と `/admin/evidence-gaps` は `ow_experiences` から
 *    `lib/evidence/transitions.ts` の同じ関数で組む。
 *    **洗い替えを自動化しても「導出テーブルと正の窓」は消えない**ので、
 *    画面をこちらに戻さないこと。ここが直すのは**SQL で見るときの鮮度**だけ。
 *
 * ── 頻度 ───────────────────────────────────────────────────────────────────
 * 日次。職歴は1日に数件しか増えないので、これで足りる。
 * ⚠️ 上げても効果は無い。**画面の鮮度はこの cron に依存していない。**
 *
 * ⚠️ `rebuild_ow_transitions()` は **service_role でしか実行できない**
 *    （anon / authenticated は 42501）。冪等で、戻り値は入れ直した行数。
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return new Response("CRON_SECRET not configured", { status: 500 });
  }
  /* ⚠️ 長さが違うと timingSafeEqual が投げるので、先に長さを見る */
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return new Response("Supabase env not configured", { status: 500 });
  }

  const db = createClient(url, key, { auth: { persistSession: false } });
  const before = await db.from("ow_transitions").select("id", { count: "exact", head: true });

  const { data, error } = await db.rpc("rebuild_ow_transitions");
  if (error) {
    /* ⚠️ 握り潰さない。黙って古いままになるのが、そもそもの問題だった */
    console.error("[cron/rebuild-transitions] rebuild_ow_transitions:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = typeof data === "number" ? data : null;
  console.log(`[cron/rebuild-transitions] ${before.count ?? "?"} → ${rows ?? "?"} 行`);
  /* ⚠️ 前後の行数を返す。「エラーが出なかった」を成功にしないため */
  return NextResponse.json({ ok: true, before: before.count ?? null, after: rows });
}
