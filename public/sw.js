/**
 * OPINIO Service Worker
 * Strategy:
 *  - /_next/static/*  → CacheFirst（ビルドハッシュ付き、変わらない）
 *  - images           → CacheFirst + 30日 TTL
 *  - HTML pages       → NetworkFirst（常に最新コンテンツ）
 *  - offline fallback → /offline
 */

const CACHE_VERSION = "v2";
const STATIC_CACHE = `opinio-static-${CACHE_VERSION}`;
const IMAGE_CACHE = `opinio-images-${CACHE_VERSION}`;
const PAGE_CACHE = `opinio-pages-${CACHE_VERSION}`;

const ALL_CACHES = [STATIC_CACHE, IMAGE_CACHE, PAGE_CACHE];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PAGE_CACHE).then((cache) =>
      /* ⚠️ **addAll を使わない。** addAll は1件でも 404 なら**全体を reject** する。
            2026-08-20 まで `/offline` が存在せず（本番で 404 を実測）、
            そのせいで `/` も `/companies` も `/jobs` も**1つもキャッシュされていなかった**。
            `.catch()` があるので install 自体は成功し、**失敗に気づけない形**だった。
         → 1件ずつ add して、落ちたものだけ捨てる。 */
      Promise.all(
        ["/", "/companies", "/jobs", "/offline"].map((path) =>
          cache.add(path).catch((e) => {
            console.warn("[SW] プリキャッシュ失敗:", path, e && e.message);
          })
        )
      )
    )
  );
  // 旧 SW を即座に置き換え
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => !ALL_CACHES.includes(name))
          .map((name) => caches.delete(name))
      )
    )
  );
  // 現在のクライアントをすぐに制御下に置く
  self.clients.claim();
});

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // GET のみ処理
  if (request.method !== "GET") return;

  // http(s) 以外はスキップ
  if (!url.protocol.startsWith("http")) return;

  // Supabase API・Auth はキャッシュしない
  if (url.hostname.includes("supabase.co") || url.hostname.includes("supabase.in")) {
    return;
  }

  // ── ① Next.js static assets（CacheFirst）
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ── ② 画像（CacheFirst + 期限チェック）
  if (
    request.destination === "image" ||
    /\.(png|jpg|jpeg|gif|webp|svg|ico)(\?.*)?$/i.test(url.pathname)
  ) {
    event.respondWith(cacheFirstWithExpiry(request, IMAGE_CACHE, 30 * 24 * 60 * 60 * 1000));
    return;
  }

  // ── ③ HTML ナビゲーション（NetworkFirst）
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    /* ⚠️ **本人にしか見えないページを Cache Storage に残さない**（2026-08-20）。
          `/mypage` などをキャッシュすると、ログアウト後や共有端末でも
          オフライン時に中身を取り出せてしまう。オフラインの見た目より優先する。
          キャッシュしないだけで、オフライン時の案内は従来どおり出す。 */
    event.respondWith(networkFirstWithOfflineFallback(request, !isPrivateUrl(url)));
    return;
  }

  /* ⚠️ **API と RSC ペイロードはキャッシュしない**（2026-08-20）。
        どちらも本人向けの中身を含む。`/api/jobseeker/*` を保存すると
        個人情報が端末に残り、古い応答を返す事故のもとにもなる。 */
  if (url.pathname.startsWith("/api/") || url.searchParams.has("_rsc") || isPrivateUrl(url)) {
    return; // 何もしない＝ブラウザの通常のネットワーク処理に任せる
  }

  // ── ④ その他（NetworkFirst シンプル）
  event.respondWith(networkFirst(request, PAGE_CACHE));
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Network error", { status: 408 });
  }
}

async function cacheFirstWithExpiry(request, cacheName, maxAgeMs) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    const cachedDate = cached.headers.get("sw-cached-at");
    if (cachedDate && Date.now() - Number(cachedDate) < maxAgeMs) {
      return cached;
    }
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      // カスタムヘッダーでキャッシュ時刻を記録
      const headers = new Headers(response.headers);
      headers.set("sw-cached-at", String(Date.now()));
      const augmented = new Response(await response.clone().blob(), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      cache.put(request, augmented);
    }
    return response;
  } catch {
    if (cached) return cached;
    return new Response("", { status: 408 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response("Network error", { status: 408 });
  }
}

/** 本人にしか見えないページか。**キャッシュに残してよいかの判定にだけ使う。**
 *
 * ⚠️ ここに載っていない公開ページ（/ /companies /jobs /articles など）だけを保存する。
 * ⚠️ 認証の判定には使わない。SW はセッションを見ていない。 */
function isPrivateUrl(url) {
  return /^\/(mypage|biz|admin|agent|u|people|onboarding|auth|profile)(\/|$)/.test(url.pathname);
}

async function networkFirstWithOfflineFallback(request, allowCache) {
  try {
    const response = await fetch(request);
    if (response.ok && allowCache) {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // ① まず同 URL のキャッシュ
    const cached = await caches.match(request);
    if (cached) return cached;

    // ② オフラインページ
    const offline = await caches.match("/offline");
    if (offline) return offline;

    // ③ 最終フォールバック
    return new Response(
      `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>オフライン — OPINIO</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#001845;font-family:'Noto Sans JP',sans-serif;color:white;padding:20px;text-align:center;}
  .card{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);
        border-radius:16px;padding:40px;max-width:360px;}
  h1{font-size:20px;margin:16px 0 8px;font-weight:700;}
  p{font-size:14px;color:rgba(255,255,255,0.65);line-height:1.6;margin:0 0 24px;}
  a{display:inline-block;padding:10px 24px;background:#3B5FD9;color:white;
    border-radius:8px;text-decoration:none;font-size:14px;}
</style></head>
<body>
<div class="card">
  <div style="font-size:48px">📡</div>
  <h1>オフラインです</h1>
  <p>インターネット接続を確認してから、もう一度お試しください。</p>
  <a href="/">再読み込み</a>
</div>
</body></html>`,
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}
