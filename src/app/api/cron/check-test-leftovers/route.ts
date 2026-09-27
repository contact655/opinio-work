import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { findTestLeftovers } from "@/lib/admin/testLeftovers";
import { sendEmail } from "@/lib/notify/email";
import { testLeftoversAdminTemplate } from "@/lib/notify/templates";

export const dynamic = "force-dynamic";

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
  const leftovers = await findTestLeftovers(db);
  const total = leftovers.users.length + leftovers.companies.length;

  /* ★0件かつ失敗していなければ何もしない（メールも送らない） */
  if (total === 0 && !leftovers.failed) {
    console.log("[cron/check-test-leftovers] 0件");
    return NextResponse.json({ ok: true, total: 0, notified: false });
  }

  if (leftovers.failed) {
    /* ⚠️ 失敗は握り潰さない。ただしメールは送れる情報だけで作る */
    console.error("[cron/check-test-leftovers] 判定に失敗した（0件という意味ではない）");
  }
  console.log(`[cron/check-test-leftovers] ${total}件`,
    leftovers.users, leftovers.companies.map((c) => c.name));

  try {
    await sendEmail(testLeftoversAdminTemplate({
      users: leftovers.users,
      companies: leftovers.companies.map((c) => ({ name: c.name, createdBy: c.createdBy })),
    }));
  } catch (err) {
    /* ⚠️ メールが失敗しても cron は 200 で返さない。黙って止まるのを防ぐ */
    console.error("[cron/check-test-leftovers] 通知に失敗:", err);
    return NextResponse.json({ ok: false, total, notified: false }, { status: 500 });
  }

  /* ⚠️ 件数を返す。「エラーが出なかった」を成功にしないため */
  return NextResponse.json({ ok: true, total, failed: leftovers.failed, notified: true });
}
