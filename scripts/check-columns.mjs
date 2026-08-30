#!/usr/bin/env node
/**
 * 「存在しない列で引いていないか」の静的検査
 *
 *   使い方:
 *     node scripts/check-columns.mjs            # src 全体
 *     node scripts/check-columns.mjs <dir/file> # 一部だけ
 *     node scripts/check-columns.mjs --self-test # ★検出器が効くかを先に確かめる
 *
 * ── なぜ要るか ───────────────────────────────────────────────────────────────
 *   列名を1つ間違えると PostgREST は **400** を返すが、呼び出し側の大半が
 *   `?? []` / `?? 0` で受けているため「**0件**」として静かに素通りする。
 *   2026-08-20 に本番ログで **24時間に19件の400**を見つけた（`/mypage` の未読バッジが
 *   `ow_conversations.company_user_id` と `updated_at` で数えており、**どちらの列も無い**。
 *   バッジは常に 0 で、新着メッセージに気づけない状態だった）。
 *
 *   ⚠️★**この手法は CLAUDE.md に手順だけがあり、スクリプトが無かった**（2026-08-30）。
 *      走らせられない検査は無いのと同じなので、`check-og.sh` と同じ形で残す。
 *
 * ── 検出できないもの（過信しないこと）────────────────────────────────────────
 *   ⚠️ **型の間違いは見つからない。** uuid の列に slug を渡す等（22P02）は
 *      本番ログでしか気づけない。実際 2026-08-20 の「最近見た企業が常に空」は
 *      この方法では出なかった。**静的検査とログの両方を見ること。**
 *   ⚠️ 変数越し・テンプレート文字列で組み立てた列名は追えない。
 *   ⚠️ 埋め込み（`ow_users!fk (...)`）の中の列は見ていない。
 *
 * ── ★0件だったときは、検出器が効くことを先に確かめる（CLAUDE.md ルール⑱）──────
 *   `--self-test` が `8b763db4^`（既知のバグがある版）の `mypage/page.tsx` を
 *   `git show` で取り出して当て、**2件とも検出できるか**を見る。
 *   ⚠️ **これが通らないうちは「0件」と言わない。**
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const TYPES = "src/lib/supabase/types.ts";

/** types.ts の `Row: { ... }` からテーブル→列の集合を作る */
function loadSchema() {
  const src = fs.readFileSync(TYPES, "utf-8");
  const tables = new Map();
  // "      ow_xxx: {" … "        Row: {" … "        }"
  const re = /^ {6}(\w+): \{\n {8}Row: \{\n([\s\S]*?)\n {8}\}/gm;
  let m;
  while ((m = re.exec(src))) {
    const cols = new Set();
    for (const line of m[2].split("\n")) {
      const c = /^\s{10}(\w+)\??:/.exec(line);
      if (c) cols.add(c[1]);
    }
    if (cols.size) tables.set(m[1], cols);
  }
  return tables;
}

/** `.from("t")` に続くチェーンから、列名を指定している呼び出しを拾う */
const COL_METHODS = ["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in", "contains", "order"];

/**
 * ★コメントを落としてから走査する。
 *
 * ⚠️ **落とさないと、注意書きの例をコードと誤認する。** 実際に2件とも誤検出だった:
 *      `certifications/[id]/route.ts` … `/* ⚠️ .eq("user_id", …) を必ず付ける *\/`
 *      `lib/supabase/mutate.ts`       … JSDoc の使用例 `supabase.from("ow_job_roles")`
 *    このリポジトリはコメントが厚いので、ここを省くと誤検出だらけになる。
 * ⚠️ `//` は `https://` を巻き込まないよう、直前が `:` のときは残す。
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function scanFile(file, tables, out) {
  const src = stripComments(fs.readFileSync(file, "utf-8"));
  const fromRe = /\.from\(\s*["'`](\w+)["'`]\s*\)/g;
  let m;
  while ((m = fromRe.exec(src))) {
    const table = m[1];
    const cols = tables.get(table);
    if (!cols) continue;                       // 型に無い表（ビュー等）は対象外
    /* ⚠️★次の `.from(` までで切る。**自分自身を数えないよう1文字ずらして探す。**
          ずらさないと `search` が位置0（自分）を返し、切れずに後続の別の表の
          列まで拾う（自己テストで `ow_role_aliases.alias` を
          `ow_profile_desired_roles` のものと誤認した）。 */
    const chain = src.slice(m.index, m.index + 1200);   // 十分な長さの後続
    const rest = chain.slice(1).search(/\.from\(\s*["'`]/);
    const seg = rest >= 0 ? chain.slice(0, rest + 1) : chain;

    for (const meth of COL_METHODS) {
      const r = new RegExp("\\." + meth + "\\(\\s*[\"'`]([\\w.]+)[\"'`]", "g");
      let c;
      while ((c = r.exec(seg))) {
        const head = c[1].split(".")[0];        // "created_at.desc" / "ow_jobs.company_id"
        /* ⚠️★埋め込みリソースへの絞り込みは対象外。
              PostgREST は `.eq("ow_jobs.company_id", x)` のように**別の表**を指せる。
              先頭が表名なら列ではないので飛ばす（列と誤認すると誤検出になる）。 */
        if (tables.has(head)) continue;
        if (!cols.has(head)) out.push({ file, table, col: head, how: "." + meth + "()" });
      }
    }
    // .select("a, b, c") ——⚠️ 埋め込み( `x:tbl(...)` )や * を含む式は飛ばす
    const selRe = /\.select\(\s*["'`]([^"'`]+)["'`]/g;
    let s;
    while ((s = selRe.exec(seg))) {
      const body = s[1];
      /* ⚠️ 埋め込み( `(` )・ワイルドカード( `*` )・FKヒント( `!` ) を含む式は解析しない。
         ⚠️★**テンプレート補間( `${...}` )も飛ばす。** 列リストを定数から差し込んでいる
            箇所（`EXPERIENCE_COMPANY_COLS` など）を、そのまま列名と誤認するため。 */
      if (/[(*!]/.test(body) || body.includes("${")) continue;
      for (const raw of body.split(",")) {
        /* ⚠️★PostgREST は `別名:列名` の順。**コロンの後ろが実在する列。**
              前を見ると別名を列と誤認する（自己テストで `alias` を誤検出した）。 */
        const parts = raw.trim().split(":");
        const col = parts[parts.length - 1].trim();
        if (col && !cols.has(col)) out.push({ file, table, col, how: ".select()" });
      }
    }
    // .or("a.eq.1,b.eq.2")
    const orRe = /\.or\(\s*[`"']([^`"']+)[`"']/g;
    let o;
    while ((o = orRe.exec(seg))) {
      for (const term of o[1].split(",")) {
        /* ⚠️★`.or()` は**丸ごと飛ばさない。** `a.eq.${x},b.eq.${y}` の形が普通で、
              補間が入るのは**値の側**、列名は生で書かれている。
              全体に `${` があるからと捨てると、2026-08-20 の `company_user_id`
              （まさに `.or()` で引いていた）を見逃す。**自己テストが 2/2 → 1/2 に
              落ちて気づいた。**列名の部分だけを見ること。 */
        const col = term.trim().split(".")[0];
        if (col.includes("${")) continue;      // 列名そのものが補間なら追えない
        if (col && /^\w+$/.test(col) && !cols.has(col)) out.push({ file, table, col, how: ".or()" });
      }
    }
  }
}

function walk(p, acc = []) {
  const st = fs.statSync(p);
  if (st.isFile()) { if (/\.tsx?$/.test(p)) acc.push(p); return acc; }
  for (const n of fs.readdirSync(p)) {
    if (n === "node_modules" || n.startsWith(".")) continue;
    walk(path.join(p, n), acc);
  }
  return acc;
}

const tables = loadSchema();
if (tables.size < 50) { console.error(`✗ types.ts から表を ${tables.size} 個しか読めなかった。パーサが壊れている`); process.exit(1); }

if (process.argv.includes("--self-test")) {
  /* ★既知のバグ（8b763db4 で直した2件）を再現検出できるか */
  const tmp = "/tmp/__selftest.tsx";
  const old = execFileSync("git", ["show", "8b763db4^:src/app/(jobseeker)/mypage/page.tsx"], { encoding: "utf-8" });
  fs.writeFileSync(tmp, old);
  const hits = [];
  scanFile(tmp, tables, hits);
  const want = ["company_user_id", "updated_at"];
  const got = want.filter((w) => hits.some((h) => h.table === "ow_conversations" && h.col === w));
  fs.unlinkSync(tmp);
  console.log(`自己テスト（8b763db4^ の既知バグ）: ${got.length}/${want.length} 検出  [${got.join(", ")}]`);
  for (const h of hits) console.log(`   ${h.table}.${h.col}  ${h.how}`);
  if (got.length !== want.length) { console.error("✗ 検出器が効いていない。本体の「0件」を信じないこと"); process.exit(1); }
  console.log("✓ 検出器は効いている");
  process.exit(0);
}

const target = process.argv[2] || "src";
const files = walk(target);
const out = [];
for (const f of files) scanFile(f, tables, out);
console.log(`検査: ${files.length} ファイル / 表 ${tables.size} 種`);
if (!out.length) {
  console.log("OK: 存在しない列での参照は見つからなかった");
  console.log("⚠️ ただし型の間違い（uuid に slug 等）はこの方法では出ない。本番ログも見ること。");
  process.exit(0);
}
for (const h of out) console.log(`  ✗ ${h.file}\n      ${h.table}.${h.col}  ${h.how}`);
console.log(`NG: ${out.length} 件`);
process.exit(1);
