#!/usr/bin/env node
/**
 * supabase-js の fetch キャッシュに黙って載る GET ルートを検出する。
 *
 *     node scripts/check-fetch-cache.mjs --self-test  # ★先にこれ。検出器が効くか確かめる
 *     node scripts/check-fetch-cache.mjs              # src/app 全体
 *
 * ── 何を探しているか（2026-09-28 に実測して確定した規則）────────────────────
 * Next 14 は supabase-js の内部 `fetch` をパッチしてキャッシュする。
 * `node_modules/next/dist/server/lib/patch-fetch.js` の判定は
 *   autoNoCache = (authorization/cookie ヘッダ || GET/HEAD 以外) && revalidate === 0
 * で、**`revalidate === 0` になるのは「リクエスト依存の API に触ったとき」**。
 *
 * ⚠️★**`export const dynamic = "force-dynamic"` では 0 にならない。**
 *    実測: `/api/industries` は `force-dynamic` 付きで **6回叩いて DB 読み取り0件**。
 *    同じ形の `/api/cron/rebuild-transitions` は **9日間 200 を返しながら何もしていなかった**。
 *
 * → 危険なのは **「`cookies()` にも `searchParams` にも触らない GET ルート」**。
 *
 * ⚠️★**判定条件に `force-dynamic` の有無を入れないこと。**
 *    2026-09-28 に見つかった5本は**全部付いていた**。入れると全部すり抜ける。
 *
 * 経緯と棚卸しは docs/phase0-fetch-cache-audit-20260928.md
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

/** 非セッションの Supabase クライアント（= cookies() を通らない読み取り） */
const NON_SESSION_CLIENT = /createAdminClient\s*\(|createPublicClient\s*\(|createClient\s*\(\s*url|createClient\s*\(\s*process\.env/;

/** これに触ると Next がリクエストを dynamic 扱いにするので、キャッシュ層に載らない */
const MAKES_DYNAMIC = [
  /from\s+["']@\/lib\/supabase\/server["']/,   // セッションクライアント（内部で cookies()）
  /\bcookies\s*\(/,
  /\bheaders\s*\(/,
  /searchParams/,
  /getTenantContext/,                            // 内部でセッションを引く
  /viewerIsAdmin|adminPageGuard/,                // 同上
];

/** これがあれば明示的に止めてある */
const OPTED_OUT = [
  /createNoStoreAdminClient/,
  /fetchCache\s*=\s*["']force-no-store["']/,
];

/** 本番で 404 になるので対象外 */
const EXEMPT = [/\/dev\/preview\//, /devOnly\s*\(/];

/**
 * ⚠️ コメント・JSDoc を落としてから判定する。
 *    落とさないと**注意書きの中の `createAdminClient` に当たって誤検出する**
 *    （このリポジトリで実際にある形。`git show` の自己テストでも起きた）。
 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** 1ファイルを判定する。危険なら理由を返す／安全なら null */
function judge(path, rawSrc) {
  const src = stripComments(rawSrc);
  if (!/export\s+async\s+function\s+GET\b/.test(src)) return null;
  if (EXEMPT.some((re) => re.test(path) || re.test(src))) return null;
  if (OPTED_OUT.some((re) => re.test(src))) return null;
  if (!NON_SESSION_CLIENT.test(src)) return null;
  const touched = MAKES_DYNAMIC.filter((re) => re.test(src));
  if (touched.length > 0) return null;
  return "非セッションのクライアントで読み、cookies()/searchParams のどちらにも触れていない";
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e === "route.ts") out.push(p);
  }
  return out;
}

/* ── ★自己テスト ─────────────────────────────────────────────────────────────
   修正前の `rebuild-transitions`（素の createClient・cookies にも searchParams にも
   触れない）を検出できることを確かめる。**通らないうちは「0件」を信じない。** */
if (process.argv.includes("--self-test")) {
  const TARGET = "src/app/api/cron/rebuild-transitions/route.ts";
  let before;
  try {
    /* 修正が入る前の版を git から取り出す。★見つからなければ自己テストは失敗扱い */
    before = execFileSync("git", ["show", `origin/main:${TARGET}`], { encoding: "utf8" });
  } catch {
    console.error(`自己テスト: origin/main:${TARGET} を取り出せなかった`);
    process.exit(1);
  }
  const hitBefore = judge(TARGET, before);
  const hitAfter = judge(TARGET, readFileSync(TARGET, "utf8"));
  console.log(`  修正前を検出できるか : ${hitBefore ? "✅ 検出した" : "❌ 検出できない"}`);
  console.log(`  修正後を見逃すか     : ${hitAfter ? "❌ 誤検出した" : "✅ 誤検出なし"}`);
  if (!hitBefore || hitAfter) {
    console.error("自己テスト失敗。判定条件を直すこと。");
    process.exit(1);
  }
  console.log("自己テスト OK");
  process.exit(0);
}

const files = walk("src/app");
const hits = [];
for (const f of files) {
  const reason = judge(f, readFileSync(f, "utf8"));
  if (reason) hits.push({ f, reason });
}

console.log(`検査した route.ts: ${files.length} 件`);
if (hits.length === 0) {
  console.log("該当なし（0件）");
  console.log("⚠️ 先に --self-test を通したか確認すること。");
  process.exit(0);
}
console.log(`\n⚠️ ${hits.length} 件が fetch キャッシュに載りうる:\n`);
for (const { f, reason } of hits) console.log(`  ${f}\n      ${reason}`);
console.log(`
直し方: 読み取りを createNoStoreAdminClient()（src/lib/supabase/noStore.ts）に替える。
        ⚠️ force-dynamic を足しても直らない（それが 2026-09-20 の失敗）。`);
process.exit(1);
