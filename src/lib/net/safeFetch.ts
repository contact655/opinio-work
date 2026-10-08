/* ★サーバー専用。クライアントから（間接的にでも）読むとビルドが落ちる */
import "server-only";
import http from "node:http";
import https from "node:https";
import zlib from "node:zlib";
import type { LookupFunction } from "node:net";
import { checkUrlTarget, type CheckedTarget } from "@/lib/net/ipPolicy";

/**
 * ★外部 URL の HTML を安全に取りに行く（2026-10-09 / SSRF 対策）。**サーバーが外部 URL を
 *   取りに行くときは必ずこれを通すこと。** `fetch(url)` を直接書かない。
 *
 * 使い手: `/api/jobseeker/ogp-fetch`・`/api/jobseeker/content-links/ogp`。
 *         依頼② 1b（企業資料の URL の取り込み）も、これを使う前提。
 *
 * ── 何を守っているか ───────────────────────────────────────────────────────
 *   ① http / https 以外・`user:pass@` 付きの URL は拒否
 *   ② ホスト名を DNS で解決した**全部**の IP を検査し、1つでも内部なら拒否（`ipPolicy.ts`）
 *   ③ ★**検査した IP に接続を固定する**（`lookup` を差し替えて、検査済みの IP を返す）。
 *      取得のときに DNS を引き直されて別の IP に変わる、という抜け道を塞ぐ
 *   ④ リダイレクトは自動で追わない。`Location` を**1段ずつ同じ検査に通す**（最大3回）
 *   ⑤ 全体の時間の上限（8秒）・取得サイズの上限（512KB。展開後で数える）
 *   ⑥ Content-Type が HTML であること
 *
 * ⚠️ 拒否・失敗の理由は**呼び出し側から利用者へ返さない**（内部の様子を探る手がかりになる）。
 *    ログにはホスト名と理由だけを出す。**URL 全体やクエリは出さない。**
 * ⚠️ 2026-10-09 まで OGP 取得2本はホスト名の文字列だけで判定しており、
 *    `127.0.0.1.nip.io`（内部 IP に解決されるドメイン）・`localhost.`・`[fd00::1]`・
 *    `169.254.169.254`（片方の API）などが素通りしていた。
 */

export const SAFE_FETCH_TIMEOUT_MS = 8000;
export const SAFE_FETCH_MAX_BYTES = 512 * 1024;
export const SAFE_FETCH_MAX_REDIRECTS = 3;

const USER_AGENT = "Mozilla/5.0 (compatible; OPINIOBot/1.0; +https://opinio.jp)";
const HTML_TYPES = ["text/html", "application/xhtml+xml"];

export type SafeFetchFailReason =
  | "invalid_url" | "bad_scheme" | "credentials_in_url" | "dns_failed" | "no_address" | "blocked_address"
  | "too_many_redirects" | "bad_redirect" | "http_status" | "not_html" | "timeout" | "network_error";

export type SafeFetchResult =
  | { ok: true; html: string; finalUrl: string; truncated: boolean }
  | { ok: false; reason: SafeFetchFailReason };

/** ログ。⚠️ ホスト名と理由だけ（URL 全体・パス・クエリは出さない） */
function logReject(hostname: string | undefined, reason: SafeFetchFailReason) {
  console.warn(`[safeFetch] rejected host=${hostname ?? "-"} reason=${reason}`);
}

/** ★検査済みの IP だけを返す lookup。接続はこの IP に固定される */
function pinnedLookup(target: CheckedTarget): LookupFunction {
  const first = target.addresses[0];
  return ((_hostname: string, options: { all?: boolean } | number, callback: (...args: unknown[]) => void) => {
    const all = typeof options === "object" && options?.all;
    if (all) callback(null, target.addresses.map((a) => ({ address: a.address, family: a.family })));
    else callback(null, first.address, first.family);
  }) as unknown as LookupFunction;
}

type Once =
  | { kind: "redirect"; location: string }
  | { kind: "response"; status: number; contentType: string; body: Buffer; truncated: boolean }
  | { kind: "error"; reason: SafeFetchFailReason };

function requestOnce(target: CheckedTarget, timeoutMs: number, maxBytes: number): Promise<Once> {
  return new Promise((resolve) => {
    const { url, hostname } = target;
    const mod = url.protocol === "https:" ? https : http;
    let settled = false;
    const done = (v: Once) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v); } };

    const req = mod.request({
      protocol: url.protocol,
      host: hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      /* ⚠️ IP の表記のときは Node が lookup を呼ばない（検査は ipPolicy で済んでいる） */
      lookup: pinnedLookup(target),
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Encoding": "gzip, deflate, br",
      },
    }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        const loc = res.headers.location;
        res.resume();
        if (typeof loc === "string" && loc) done({ kind: "redirect", location: loc });
        else done({ kind: "error", reason: "bad_redirect" });
        return;
      }
      const contentType = String(res.headers["content-type"] ?? "").toLowerCase();
      const enc = String(res.headers["content-encoding"] ?? "").toLowerCase();
      let stream: NodeJS.ReadableStream = res;
      if (enc === "gzip" || enc === "x-gzip") stream = res.pipe(zlib.createGunzip());
      else if (enc === "deflate") stream = res.pipe(zlib.createInflate());
      else if (enc === "br") stream = res.pipe(zlib.createBrotliDecompress());

      const chunks: Buffer[] = [];
      let total = 0;
      let truncated = false;
      /* ★上限は**展開後**で数える（圧縮で小さく見せた巨大な本文を読み切らない） */
      stream.on("data", (c: Buffer) => {
        if (truncated) return;
        const room = maxBytes - total;
        if (c.length > room) {
          chunks.push(c.subarray(0, room)); total += room; truncated = true;
          req.destroy();
          done({ kind: "response", status, contentType, body: Buffer.concat(chunks), truncated: true });
          return;
        }
        chunks.push(c); total += c.length;
      });
      stream.on("end", () => done({ kind: "response", status, contentType, body: Buffer.concat(chunks), truncated }));
      stream.on("error", () => done({ kind: "error", reason: "network_error" }));
    });

    const timer = setTimeout(() => { req.destroy(); done({ kind: "error", reason: "timeout" }); }, Math.max(1, timeoutMs));
    req.on("error", () => done({ kind: "error", reason: "network_error" }));
    req.end();
  });
}

/** 文字コードを決めて文字列にする。ヘッダ → `<meta charset>` → UTF-8 の順 */
function decodeHtml(body: Buffer, contentType: string): string {
  let charset = contentType.match(/charset=["']?([\w-]+)/i)?.[1] ?? null;
  if (!charset) {
    const head = body.subarray(0, 4096).toString("latin1");
    charset = head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ?? null;
  }
  try {
    return new TextDecoder((charset ?? "utf-8").toLowerCase(), { fatal: false }).decode(body);
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(body);
  }
}

export async function safeFetchText(
  rawUrl: string,
  opts: { timeoutMs?: number; maxBytes?: number; maxRedirects?: number } = {},
): Promise<SafeFetchResult> {
  const timeoutMs = opts.timeoutMs ?? SAFE_FETCH_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? SAFE_FETCH_MAX_BYTES;
  const maxRedirects = opts.maxRedirects ?? SAFE_FETCH_MAX_REDIRECTS;
  /* ★時間の上限は**全体**（リダイレクトをまたいで）で数える */
  const deadline = Date.now() + timeoutMs;

  let current = rawUrl;
  for (let hop = 0; ; hop++) {
    const checked = await checkUrlTarget(current);
    if (!checked.ok) { logReject(checked.hostname, checked.reason); return { ok: false, reason: checked.reason }; }
    const host = checked.target.hostname;

    const remaining = deadline - Date.now();
    if (remaining <= 0) { logReject(host, "timeout"); return { ok: false, reason: "timeout" }; }

    const r = await requestOnce(checked.target, remaining, maxBytes);
    if (r.kind === "error") { logReject(host, r.reason); return { ok: false, reason: r.reason }; }
    if (r.kind === "redirect") {
      if (hop >= maxRedirects) { logReject(host, "too_many_redirects"); return { ok: false, reason: "too_many_redirects" }; }
      let next: string;
      try { next = new URL(r.location, checked.target.url).href; } catch { logReject(host, "bad_redirect"); return { ok: false, reason: "bad_redirect" }; }
      current = next;            // ★次の周回で同じ検査（DNS・IP）を通す
      continue;
    }
    if (r.status < 200 || r.status >= 300) { logReject(host, "http_status"); return { ok: false, reason: "http_status" }; }
    if (!HTML_TYPES.some((t) => r.contentType.includes(t))) { logReject(host, "not_html"); return { ok: false, reason: "not_html" }; }
    return { ok: true, html: decodeHtml(r.body, r.contentType), finalUrl: checked.target.url.href, truncated: r.truncated };
  }
}
