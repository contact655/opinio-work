import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createNoStoreAdminClient } from "@/lib/supabase/noStore";

export const dynamic = "force-dynamic";
/**
 * ★★キャッシュしない（2026-09-28 に追加）。**外さないこと。**
 *
 * ⚠️★`dynamic = "force-dynamic"` **だけでは足りない。** 下の「9日間動かなかった」を読むこと。
 *    こちらはルート単位の宣言で、クライアント側の `cache: "no-store"` と**二重**にしてある。
 */
export const fetchCache = "force-no-store";

/**
 * `ow_transitions` の洗い替え（2026-09-18）。
 *
 * ── ★この cron はメールを送らない ─────────────────────────────────────────
 * ⚠️★`vercel.json` の `crons` に載っているジョブのひとつ。
 *    あそこが長く空だったのは**週次メールを止めるため**で（2026-08-07）、
 *    この行を足したことで**週次メールが動き出すわけではない。**
 *    `weekly-jobs` / `weekly-match` は
 *      ① `crons` に載っていない
 *      ② ルート側も `WEEKLY_EMAIL_ENABLED !== "true"` で止まっている
 *    の**二重**で止まったまま。**どちらも外さないこと。**
 *
 * ── なぜ洗い替えるのか ─────────────────────────────────────────────────────
 * `ow_transitions` は「会社が変わった隣接ペア」を **SQL から引くため**の導出テーブル。
 * `age_at_move` / `years_of_experience_at_move` / `role_change` / `industry_change` を持つ。
 *
 * ⚠️★**製品の画面はこの表を読んでいない**（2026-09-18 に外した）。
 *    ②⑨ と `/admin/evidence-gaps` は `ow_experiences` から
 *    `lib/evidence/transitions.ts` の同じ関数で組む。
 *    **洗い替えを自動化しても「導出テーブルと正の窓」は消えない**ので、
 *    画面をこちらに戻さないこと。ここが直すのは**SQL で見るときの鮮度**だけ。
 *
 * ⚠️ `rebuild_ow_transitions()` は **service_role でしか実行できない**
 *    （anon / authenticated は 42501）。冪等で、戻り値は入れ直した行数。
 *
 * ── ★★9日間「200 を返しながら何もしていなかった」（2026-09-28 に判明）─────
 * **2026-09-19〜09-28 の定時実行はすべて 200 で、ログにも `10 → 10 行` が出ていたのに、
 * `built_at` は 2026-09-18 18:00:27 のまま動いていなかった。**
 *
 * 原因は **Next / Vercel の fetch（Data）キャッシュ**。supabase-js は内部で `fetch` を
 * 使うので、`createClient(url, key)`（＝ `createAdminClient` 相当）の呼び出しは
 * **黙ってキャッシュに載る**。1回目だけ本当に DB へ行き、以降は
 * **`before` の件数も RPC の戻り値も前回の値が再生される**ため、
 * 「10 → 10」というもっともらしいログが出たまま**DB では何も起きない。**
 *
 * ⚠️★**`export const dynamic = "force-dynamic"` はこの層を止めない。**
 *    [noStore.ts](../../../../lib/supabase/noStore.ts) に 2026-08-06 の前例が書いてある
 *    （そのときも `deleted_at` が null のまま返り続けた）。
 *    **同じ層を、同じ理由で、2度踏んだ。**
 * ⚠️★**キャッシュはデプロイでは消えない**（Vercel の Data キャッシュはプロジェクト単位）。
 *    毎日別のデプロイに当たっていたが、9日間ずっと同じ値を再生していた。
 *
 * → **必ず `createNoStoreAdminClient()` を使う。素の `createClient` に戻さないこと。**
 *
 * ── ★成功したかは `built_at` で判定する ───────────────────────────────────
 * ⚠️★**行数だけでは「走ったか」が分からない**（洗い替えても行数は変わらないことが多い。
 *    実際 9日間ずっと 10 → 10 だった）。**DB が入れた `built_at` を読み直して返す。**
 *    これが「本当に DB へ行った」ことの証拠になる。
 * ⚠️ `durationMs` も出す。キャッシュ再生なら 0ms 近くになるので、次に同じことが
 *    起きたときに応答だけで見分けられる。
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

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    /* ⚠️ `createNoStoreAdminClient()` は投げるので、先に見て分かる文言で返す */
    return new Response("Supabase env not configured", { status: 500 });
  }

  /* ⚠️★**全体を囲む。** supabase-js はエラーを戻り値で返すが、クライアント生成や
        ネットワークの失敗は投げる。囲まないと Vercel の素の 500 になり、
        **ログに何も残らない**（原因を追えなかったのがまさにこれ）。 */
  try {
    const db = createNoStoreAdminClient();
    const startedAt = Date.now();

    const before = await db.from("ow_transitions").select("id", { count: "exact", head: true });
    if (before.error) {
      /* ⚠️★**握り潰さない。** 以前は `before.count ?? "?"` で埋めていたので、
            ここが失敗しても気づけなかった。 */
      console.error("[cron/rebuild-transitions] before の件数取得に失敗:", before.error.message);
      return NextResponse.json({ ok: false, error: before.error.message }, { status: 500 });
    }

    const { data, error } = await db.rpc("rebuild_ow_transitions");
    if (error) {
      /* ⚠️ 握り潰さない。黙って古いままになるのが、そもそもの問題だった */
      console.error("[cron/rebuild-transitions] rebuild_ow_transitions:", error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    /* ★洗い替え後の `built_at` を読み直す。**DB が入れた値**なので、
          これが今回の時刻になっていれば「本当に走った」と言える。
       ⚠️ 全行が同じ値になる（1トランザクションで入れ直すため）ので1行で足りる。 */
    const stamp = await db
      .from("ow_transitions")
      .select("built_at")
      .order("built_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (stamp.error) {
      console.error("[cron/rebuild-transitions] built_at の読み直しに失敗:", stamp.error.message);
      return NextResponse.json({ ok: false, error: stamp.error.message }, { status: 500 });
    }

    const rows = typeof data === "number" ? data : null;
    const builtAt = (stamp.data?.built_at as string | null) ?? null;
    const durationMs = Date.now() - startedAt;

    /* ⚠️ 前後の行数と `built_at` を出す。「エラーが出なかった」を成功にしないため */
    console.log(
      `[cron/rebuild-transitions] ${before.count ?? "?"} → ${rows ?? "?"} 行 / built_at=${builtAt ?? "?"} / ${durationMs}ms`,
    );
    return NextResponse.json({
      ok: true,
      before: before.count ?? null,
      after: rows,
      /* ★これが「本当に DB へ行ったか」の判定材料 */
      builtAt,
      durationMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/rebuild-transitions] 予期しない失敗:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
