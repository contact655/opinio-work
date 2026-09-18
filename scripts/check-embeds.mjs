#!/usr/bin/env node
/**
 * 「PostgREST の埋め込みが曖昧で失敗していないか」の検査
 *
 *   使い方:
 *     node scripts/check-embeds.mjs             # src 全体
 *     node scripts/check-embeds.mjs --self-test # ★検出器が効くかを先に確かめる
 *
 * ── なぜ要るか ───────────────────────────────────────────────────────────────
 *   2つの表のあいだに**経路が複数ある**と、FK を名指ししない埋め込みは
 *   `Could not embed because more than one relationship was found` で
 *   **クエリごと失敗する**。呼び出し側の大半が `?? []` で受けているので、
 *   **エラーも出ないまま「0件」になる。**
 *
 *   ⚠️★経路は FK 1本とは限らない。**中間表（多対多）経由も候補に数えられる。**
 *      2026-09-18 時点で FK を2本以上持つ表は **59**。表が1つ増えるたびに、
 *      これまで通っていた埋め込みが**黙って壊れうる。** 人が気をつける形では無理。
 *
 *   実際に踏んだもの:
 *     2026-09-12 `ow_experiences` → `ow_companies`（`company_id` と `secondment_company_id`）
 *                → ユーザー一覧から3人が消え、候補者一覧の会社名が全員空
 *     2026-09-16 `ow_experiences` → `ow_roles`（中間表 `ow_experience_roles` 経由）
 *     2026-09-18 `ow_company_admins` → `ow_users`（`!inner` を**名指しと誤認**していた）
 *                → `/biz/jobs/new` と `/biz/jobs/[id]/edit` の採用担当者が1年以上0人
 *
 *   ⚠️★**`!inner` は結合の指定であって、FK の名指しではない。** 目で見ると
 *      「ヒントが付いている」ように見えるので、**実際に投げないと見分けられない。**
 *
 * ── ★理屈で判定しない ────────────────────────────────────────────────────────
 *   スキーマから経路を数えて判定する形にしないこと。**PostgREST に実際に投げて
 *   応答で判定する。** 判定規則は PostgREST の実装であって、こちらの推測ではない。
 *   ⚠️ `limit(0)` で行は取らない（読み取りのみ・書き込みはしない）。
 *
 * ── 検出できないもの（過信しないこと）────────────────────────────────────────
 *   ⚠️ **変数を含む select は読めない**（`${COLS}` など）。読めなかったものは
 *      件数と場所を出すので、**目で確かめること**（2026-09-18 時点で11箇所。
 *      いずれも定数を展開して手で確かめ、すべて通っている）。
 *   ⚠️ **列の間違いは対象外**。そちらは `check-columns.mjs`。
 *   ⚠️ **握り潰し（`error` を見ていない）は検出しない。** 失敗が「0件」に化ける
 *      危険はそちらにも残る。
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const out = {};
  for (const f of [".env.local", ".env"]) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, "utf-8").split("\n")) {
      if (!line.includes("=") || line.trim().startsWith("#")) continue;
      const i = line.indexOf("=");
      out[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
    }
  }
  return out;
}

function listFiles(root) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name)) out.push(p);
    }
  })(root);
  return out;
}

/**
 * `.from("X")` と、その `X` に対する `.select(...)` を組にする。
 *
 * ⚠️★**`.from(` から次の `.from(` までで区切ること。** 2026-09-18 に、
 *    「`.from(` の後ろ3000文字から最初の `.select(` を拾う」形にしたせいで、
 *    **別のクエリの select を組にして誤検出**した（`.insert()` する `.from()` に、
 *    後続の別クエリの select がくっついた）。自分の書いたばかりのコードが
 *    「壊れている」と出たので気づけたが、**気づけない組み合わせもありえた。**
 * ⚠️ `.from(` の直後の**最初の動詞**が `select` でなければ、その from に select は無い。
 */
function extractSelects(files) {
  const found = [], unreadable = [];
  for (const f of files) {
    const src = fs.readFileSync(f, "utf-8");
    const froms = [...src.matchAll(/\.from\(\s*["'`]([A-Za-z_][A-Za-z0-9_]*)["'`]\s*\)/g)];
    for (let i = 0; i < froms.length; i++) {
      const m = froms[i];
      const seg = src.slice(m.index, i + 1 < froms.length ? froms[i + 1].index : src.length);
      const verb = seg.match(/\.(select|insert|update|delete|upsert)\(/);
      if (!verb || verb[1] !== "select") continue;
      const sm = seg.match(/\.select\(\s*(`[^`]*`|"[^"]*"|'[^']*')/);
      if (!sm) continue;
      const raw = sm[1], body = raw.slice(1, -1);
      const line = src.slice(0, m.index).split("\n").length;
      if (raw.startsWith("`") && /\$\{/.test(body)) { unreadable.push({ f, line, table: m[1] }); continue; }
      if (!/[A-Za-z_]\s*\(/.test(body)) continue;   // 埋め込みの無い select は対象外
      found.push({ f, line, table: m[1], select: body.replace(/\s+/g, " ").trim() });
    }
  }
  return { found, unreadable };
}

async function run(db, items) {
  const seen = new Map();
  for (const x of items) {
    const key = `${x.table}||${x.select}`;
    if (!seen.has(key)) seen.set(key, { ...x, places: [] });
    seen.get(key).places.push(`${x.f}:${x.line}`);
  }
  const bad = [];
  for (const [, v] of seen) {
    const { error } = await db.from(v.table).select(v.select).limit(0);
    if (error) bad.push({ ...v, message: error.message });
  }
  return { tried: seen.size, bad };
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が読めない（.env.local）");
  process.exit(1);
}
const db = createClient(url, key);

/* ★0件だったときに備えて、検出器が効くことを先に確かめる（CLAUDE.md ルール⑱）。
   ⚠️ 既知の曖昧な組み合わせを**その場で作って**投げる。過去のコミットに依存しない。 */
if (process.argv.includes("--self-test")) {
  const cases = [
    { table: "ow_experiences", select: "id, ow_roles(name)",                  want: "bad",  why: "中間表 ow_experience_roles があるので曖昧" },
    { table: "ow_experiences", select: "id, ow_roles!role_category_id(name)", want: "ok",   why: "FK を名指ししている" },
    { table: "ow_company_admins", select: "ow_users!inner(id)",               want: "bad",  why: "!inner は名指しではない" },
    { table: "ow_experiences", select: "id, ow_users(name)",                  want: "ok",   why: "対照（経路が1本）" },
  ];
  let ng = 0;
  for (const c of cases) {
    const { error } = await db.from(c.table).select(c.select).limit(0);
    const got = error ? "bad" : "ok";
    const pass = got === c.want;
    if (!pass) ng++;
    console.log(`${pass ? "✓" : "✗"} ${c.table}.select("${c.select}") → ${got}（期待 ${c.want}）… ${c.why}`);
  }
  if (ng > 0) { console.error("✗ 検出器が効いていない。本体の「0件」を信じないこと"); process.exit(1); }
  console.log("✓ 検出器は効いている");
  process.exit(0);
}

const root = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "src";
const files = listFiles(root);
const { found, unreadable } = extractSelects(files);
const { tried, bad } = await run(db, found);

console.log(`検査: ${files.length} ファイル / 埋め込みを含む select ${found.length} 箇所（重複を除いて ${tried} 通り）`);

if (unreadable.length > 0) {
  console.log(`\n⚠️ 変数を含んで読めなかった select: ${unreadable.length} 箇所（**目で確かめること**）`);
  for (const u of unreadable) console.log(`   ${u.f}:${u.line}  ${u.table}`);
}

if (bad.length === 0) {
  console.log("\nOK: 失敗する埋め込みは見つからなかった");
  console.log("⚠️ ただし列の間違い（check-columns.mjs）と握り潰しはこの検査では出ない。");
  process.exit(0);
}

console.log(`\n✗ 失敗する埋め込み: ${bad.length} 通り`);
for (const b of bad) {
  console.log(`\n  ${b.table}.select("${b.select.slice(0, 120)}")`);
  for (const p of [...new Set(b.places)]) console.log(`     ${p}`);
  console.log(`     ${b.message.slice(0, 160)}`);
}
process.exit(1);
