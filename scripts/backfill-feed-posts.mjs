/**
 * 公開済みなのにフィード投稿が無いものを突合して作る。
 *
 * ── なぜ要るか ────────────────────────────────────────────────────────────────
 * 公開には2経路あり、片方しか投稿を作らない。
 *   ① /biz/company・/biz/jobs/[id]・/admin/articles の公開操作 → 投稿が作られる
 *   ② migration / SQL で直接 is_published = true / status = 'published' → 作られない
 * 実運用は②。このままだと企業は増えるのにフィードだけ止まる。
 * 2026-08-05 時点で ow_companies.published_at が85社すべて NULL であることが、
 * ①が本番で一度も走っていない証拠。
 *
 * ── 冪等性 ────────────────────────────────────────────────────────────────────
 * 部分UNIQUEインデックス3本（idx_ow_posts_unique_company / _job / _article）が
 * 重複を弾く。23505 は「既にある」として握りつぶすので、何度実行してもよい。
 *
 * ⚠️ 本文と ref_* の埋め方は src/lib/feed/systemPosts.ts と同じ規則にすること。
 *    あちらは TypeScript なのでここからは import できない。**ロジックを写している**。
 *    片方を変えたらもう片方も直す。文面がずれると、同じ出来事の投稿が経路で変わる。
 *
 * ── 使い方 ────────────────────────────────────────────────────────────────────
 *   node scripts/backfill-feed-posts.mjs            # dry-run（既定）。作らない
 *   node scripts/backfill-feed-posts.mjs --apply    # 実際に作る
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");
const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が要る（.env.local）");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

// ── src/lib/feed/systemPosts.ts と同じ規則 ──────────────────────────────────
const displayCompanyName = (co) => co?.brand_name ?? co?.name ?? "";
const companyJoinedContent = (co) =>
  `${displayCompanyName(co)}がOPINIOに掲載されました。${co?.tagline ? ` ${co.tagline}` : ""}`;
const jobPostedContent = (co, job) =>
  `${displayCompanyName(co)}が「${job?.title ?? "—"}」の募集を開始しました。`;
const articlePublishedContent = (a) => `【取材記事】${a?.title ?? ""}`;

/** 投稿の日付は公開日に合わせる。published_at は NULL のことがあるので created_at に落とす */
const stamp = (row) => row.published_at ?? row.created_at;

async function main() {
  console.log(APPLY ? "=== 実行モード（--apply）===" : "=== dry-run（既定）。--apply で実際に作る ===");

  // ── 既存の投稿が指している ID を集める ──────────────────────────────────
  const { data: posts, error: pErr } = await db
    .from("ow_posts")
    .select("post_type, ref_company_id, ref_job_id, ref_article_id");
  if (pErr) throw new Error(`ow_posts の取得に失敗: ${pErr.message}`);

  // ⚠️ ow_posts_visible ではなく ow_posts を見ること。
  //    参照が外れた幽霊投稿はビューに出ないが、行としては存在する。
  //    ビューで数えると「無い」と判定して作りにいき、部分UNIQUEにも引っかからず
  //    （幽霊は ref_* が NULL なのでインデックス対象外）重複を作ってしまう。
  const haveCompany = new Set(posts.filter((p) => p.post_type === "company_joined" && p.ref_company_id).map((p) => p.ref_company_id));
  const haveJob = new Set(posts.filter((p) => p.post_type === "job_posted" && p.ref_job_id).map((p) => p.ref_job_id));
  const haveArticle = new Set(posts.filter((p) => p.post_type === "article_published" && p.ref_article_id).map((p) => p.ref_article_id));

  // ── 検出 ────────────────────────────────────────────────────────────────
  const { data: companies, error: cErr } = await db
    .from("ow_companies")
    .select("id, name, brand_name, tagline, created_at, published_at")
    .eq("is_published", true);
  if (cErr) throw new Error(`ow_companies の取得に失敗: ${cErr.message}`);

  const { data: jobs, error: jErr } = await db
    .from("ow_jobs")
    .select("id, company_id, title, created_at, published_at")
    .eq("status", "published");
  if (jErr) throw new Error(`ow_jobs の取得に失敗: ${jErr.message}`);

  const { data: articles, error: aErr } = await db
    .from("ow_articles")
    .select("id, title, created_at, published_at")
    .eq("is_published", true);
  if (aErr) throw new Error(`ow_articles の取得に失敗: ${aErr.message}`);

  const missingCompanies = companies.filter((c) => !haveCompany.has(c.id));
  const missingJobs = jobs.filter((j) => !haveJob.has(j.id));
  const missingArticles = articles.filter((a) => !haveArticle.has(a.id));

  console.log(`\n公開企業 ${companies.length} 社 → 投稿が無い ${missingCompanies.length} 社`);
  for (const c of missingCompanies) console.log(`   ${displayCompanyName(c)}  (${stamp(c)?.slice(0, 10)})`);
  console.log(`公開求人 ${jobs.length} 件 → 投稿が無い ${missingJobs.length} 件`);
  for (const j of missingJobs) console.log(`   ${j.title}  (${stamp(j)?.slice(0, 10)})`);
  console.log(`公開記事 ${articles.length} 件 → 投稿が無い ${missingArticles.length} 件`);
  for (const a of missingArticles) console.log(`   ${a.title}  (${stamp(a)?.slice(0, 10)})`);

  const total = missingCompanies.length + missingJobs.length + missingArticles.length;
  if (total === 0) {
    console.log("\n取りこぼしなし。作るものはありません。");
    return;
  }
  if (!APPLY) {
    console.log(`\n合計 ${total} 件が対象。実際に作るには --apply を付けて再実行してください。`);
    return;
  }

  // ── 生成 ────────────────────────────────────────────────────────────────
  // 求人の本文には社名が要るので企業をまとめて引く
  const coById = new Map(companies.map((c) => [c.id, c]));
  const needCoIds = missingJobs.map((j) => j.company_id).filter((id) => id && !coById.has(id));
  if (needCoIds.length > 0) {
    const { data: extra } = await db.from("ow_companies").select("id, name, brand_name").in("id", needCoIds);
    for (const c of extra ?? []) coById.set(c.id, c);
  }

  const rows = [
    ...missingCompanies.map((c) => ({
      user_id: SYSTEM_USER_ID, post_type: "company_joined",
      ref_company_id: c.id, content: companyJoinedContent(c), created_at: stamp(c),
    })),
    ...missingJobs.map((j) => ({
      user_id: SYSTEM_USER_ID, post_type: "job_posted",
      ref_job_id: j.id, ref_company_id: j.company_id,
      content: jobPostedContent(coById.get(j.company_id), j), created_at: stamp(j),
    })),
    ...missingArticles.map((a) => ({
      user_id: SYSTEM_USER_ID, post_type: "article_published",
      ref_article_id: a.id, content: articlePublishedContent(a), created_at: stamp(a),
    })),
  ];

  // ⚠️ 1件ずつ入れる。まとめて insert すると1件の 23505 で全部落ちる。
  let created = 0, skipped = 0, failed = 0;
  for (const row of rows) {
    const { error } = await db.from("ow_posts").insert(row);
    if (!error) { created++; continue; }
    if (error.code === "23505") { skipped++; continue; }  // 既にある
    failed++;
    console.error(`   失敗: ${row.content.slice(0, 40)} — ${error.message}`);
  }
  console.log(`\n作成 ${created} 件 / 既存につきスキップ ${skipped} 件 / 失敗 ${failed} 件`);

  // ── 作ったものがフィードに出るか（ref_* を埋めているので出るはず）──────
  if (created > 0) {
    const { count } = await db.from("ow_posts_visible").select("*", { count: "exact", head: true });
    const { count: allCount } = await db.from("ow_posts").select("*", { count: "exact", head: true });
    console.log(`ow_posts ${allCount} 行 / ow_posts_visible ${count} 行`);
    console.log("⚠️ 作成件数ぶん visible が増えていない場合、ref_* の埋め忘れを疑うこと。");
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
