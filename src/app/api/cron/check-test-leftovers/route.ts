import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createNoStoreAdminClient } from "@/lib/supabase/noStore";
import { findTestLeftovers } from "@/lib/admin/testLeftovers";
import { sendEmail } from "@/lib/notify/email";
import { testLeftoversAdminTemplate } from "@/lib/notify/templates";

export const dynamic = "force-dynamic";
/**
 * ★★キャッシュしない（2026-09-28 に追加）。**外さないこと。**
 *
 * ⚠️★`dynamic = "force-dynamic"` **だけでは足りない**（下の「0件に化ける」を読むこと）。
 *    ルート単位の宣言と、クライアント側の `cache: "no-store"` の**二重**にしてある。
 */
export const fetchCache = "force-no-store";

/**
 * 検証用アカウントの「取り残し」を日次で数える（2026-09-28 / 柴さんの指示）。
 *
 * ── なぜ cron にしたか ─────────────────────────────────────────────────────
 * `is_test` を立て忘れた行は、誰にも気づかれずに**実ユーザー・実企業として数えられる**。
 * 2026-09-14 / 09-17 / 09-28 に**4回**起きており、最後の3回は
 * 「注意書きを書いた当日に、書いた本人が」踏んでいる。**文章では防げない。**
 *
 * ⚠️★**`/admin` の要対応タスクと二段構え。** あちらは**開いたときに必ず目に入る**が、
 *    開かない日は気づけない。ここは**開かなくても届く**。
 *    ⚠️ CLAUDE.md の「定期巡回にしない」（面談対応者の確認）とは別。あちらは
 *       **人が毎週見に行く運用**を否定したもので、ここは**機械が数えて、出たときだけ知らせる**。
 *
 * ── ★0件のときは何も送らない ───────────────────────────────────────────────
 * ⚠️★**「今日も0件でした」を毎日送らないこと。** 読まれなくなり、
 *    本当に出た日の1通が埋もれる。**出たときだけ届く**から意味がある。
 *
 * ⚠️★**自動で倒さない。** 実在の利用者・企業を巻き込む
 *    （2026-09-28 に検査式を書き間違えて、株式会社Opinio・セールスフォース・ジャパン・
 *     株式会社エージェントを拾った実績がある）。**数えて知らせるだけ。**
 *
 * ⚠️ 判定は [lib/admin/testLeftovers.ts](src/lib/admin/testLeftovers.ts) の1箇所。
 *    **ここに条件を書き写さないこと** —— `/admin` と食い違うと
 *    「画面は0件なのにメールが来る」（逆も）になる。
 *
 * ⚠️ 取得に失敗したときも送る。**0件に化けさせない**（それが元の問題）。
 *
 * ── ★★キャッシュで「0件」に化ける（2026-09-28 / rebuild-transitions で実際に踏んだ）──
 * supabase-js は内部で `fetch` を使うので、`createClient(url, key)`
 * （＝ `createAdminClient` 相当）の読み取りは **Next / Vercel の fetch キャッシュに
 * 黙って載る**。1回目だけ本当に DB へ行き、以降は**前回の結果が再生される。**
 *
 * ⚠️★**この cron では「0件を再生し続ける」形になり、取り残しが出ても永久に届かない。**
 *    0件のときメールを送らない設計なので、**壊れていることに誰も気づけない**
 *    （CLAUDE.md「壊れているのに正常に見える」）。
 * ⚠️★`dynamic = "force-dynamic"` はこの層を止めない。前例は
 *    [noStore.ts](../../../../lib/supabase/noStore.ts)（2026-08-06）と、
 *    [rebuild-transitions](../rebuild-transitions/route.ts)（**9日間 200 のまま何もしていなかった**）。
 * → **必ず `createNoStoreAdminClient()` を使う。素の `createClient` に戻さないこと。**
 *
 * ── ★本当に DB へ行ったかを応答に出す ─────────────────────────────────────
 * ⚠️★**件数だけでは「走ったか」が分からない。** 0件は正常値なので、
 *    キャッシュ再生と区別が付かない。そこで **問い合わせた時刻（`checkedAt`）と
 *    所要時間（`durationMs`）**を返す。キャッシュ再生なら `durationMs` が 0ms 近くになる。
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
        **ログに何も残らない。** */
  try {
    const db = createNoStoreAdminClient();
    const startedAt = Date.now();
    const checkedAt = new Date().toISOString();

    const leftovers = await findTestLeftovers(db);
    const total = leftovers.users.length + leftovers.companies.length;
    const durationMs = Date.now() - startedAt;

    /* ★0件かつ失敗していなければメールは送らない。
       ⚠️★**ただしログと応答は必ず出す。** 「0件だった」と「そもそも問い合わせていない」を
          見分けられるようにするため（`checkedAt` / `durationMs`）。 */
    if (total === 0 && !leftovers.failed) {
      console.log(`[cron/check-test-leftovers] 0件 / checkedAt=${checkedAt} / ${durationMs}ms`);
      return NextResponse.json({
        ok: true, total: 0, failed: false, notified: false, checkedAt, durationMs,
      });
    }

    if (leftovers.failed) {
      /* ⚠️ 失敗は握り潰さない。ただしメールは送れる情報だけで作る */
      console.error("[cron/check-test-leftovers] 判定に失敗した（0件という意味ではない）");
    }
    console.log(
      `[cron/check-test-leftovers] ${total}件 / checkedAt=${checkedAt} / ${durationMs}ms`,
      leftovers.users, leftovers.companies.map((c) => c.name),
    );

    try {
      await sendEmail(testLeftoversAdminTemplate({
        users: leftovers.users,
        companies: leftovers.companies.map((c) => ({ name: c.name, createdBy: c.createdBy })),
      }));
    } catch (err) {
      /* ⚠️ メールが失敗しても cron は 200 で返さない。黙って止まるのを防ぐ */
      console.error("[cron/check-test-leftovers] 通知に失敗:", err);
      return NextResponse.json({
        ok: false, total, failed: leftovers.failed, notified: false, checkedAt, durationMs,
      }, { status: 500 });
    }

    /* ⚠️ 件数を返す。「エラーが出なかった」を成功にしないため */
    return NextResponse.json({
      ok: true, total, failed: leftovers.failed, notified: true, checkedAt, durationMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/check-test-leftovers] 予期しない失敗:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
