/**
 * ★サーバーが外部 URL を取りに行くときの「接続してよい IP か」の判定（2026-10-09 / SSRF 対策）。
 *
 * ⚠️★**このファイルは `node:net` 以外を import しないこと。** `npm test`
 *    （`node --test 'src/lib/**\/*.test.mjs'`）が `.ts` を直接読むため、`@/…` を1つでも
 *    import するとテストが起動しなくなる（`evidence/engine.ts` と同じ約束）。
 *
 * ⚠️ 判定は**解決した IP アドレス**に対して行う。ホスト名の文字列では判定しない
 *    （それが 2026-10-09 まで OGP 取得2本の穴だった。`127.0.0.1.nip.io` のように
 *    内部 IP に解決されるドメインや、`localhost.` などが素通りしていた）。
 * ⚠️ 取得本体は `safeFetch.ts`。こちらは「この URL の接続先に繋いでよいか」だけを答える。
 * ⚠️ URL の検査（`checkUrlTarget`）も**このファイルに同居させている。** 別ファイルにすると
 *    `.ts` 同士の import に拡張子が要り（Node のテスト）、それは tsconfig が許さない。
 */
import { BlockList, isIP, isIPv4, isIPv6 } from "node:net";
import { lookup } from "node:dns/promises";

export type BlockReason =
  | "not_an_ip"
  | "private_v4"
  | "private_v6";

/* ── 拒否する範囲 ────────────────────────────────────────────────────────────
   ⚠️ 足すときはテスト（ipPolicy.test.mjs）にも1件足すこと。 */
const V4_RANGES: [string, number][] = [
  ["0.0.0.0", 8],        // 「このネットワーク」
  ["10.0.0.0", 8],       // プライベート
  ["100.64.0.0", 10],    // CGNAT
  ["127.0.0.0", 8],      // ループバック（127.0.0.1 以外も）
  ["169.254.0.0", 16],   // リンクローカル（クラウドのメタデータ 169.254.169.254 を含む）
  ["172.16.0.0", 12],    // プライベート
  ["192.0.0.0", 24],     // IETF プロトコル割り当て
  ["192.0.2.0", 24],     // 文書用 TEST-NET-1
  ["192.88.99.0", 24],   // 6to4 リレー（廃止）
  ["192.168.0.0", 16],   // プライベート
  ["198.18.0.0", 15],    // ベンチマーク用
  ["198.51.100.0", 24],  // 文書用 TEST-NET-2
  ["203.0.113.0", 24],   // 文書用 TEST-NET-3
  ["224.0.0.0", 4],      // マルチキャスト
  ["240.0.0.0", 4],      // 予約（255.255.255.255 を含む）
];

const V6_RANGES: [string, number][] = [
  ["::", 96],            // 未指定・ループバック（::1）・IPv4 互換（廃止）
  ["100::", 64],         // 破棄用
  ["2001:db8::", 32],    // 文書用
  ["fc00::", 7],         // ユニークローカル
  ["fe80::", 10],        // リンクローカル
  ["fec0::", 10],        // サイトローカル（廃止）
  ["ff00::", 8],         // マルチキャスト
];

const v4List = new BlockList();
for (const [a, p] of V4_RANGES) v4List.addSubnet(a, p, "ipv4");
const v6List = new BlockList();
for (const [a, p] of V6_RANGES) v6List.addSubnet(a, p, "ipv6");

/** IPv6 を 8 個の 16bit 値に展開する。⚠️ 末尾に IPv4 表記を含む形（::ffff:1.2.3.4）も扱う */
function expandV6(ip: string): number[] | null {
  let s = ip.toLowerCase();
  const pct = s.indexOf("%");                 // ゾーン ID（fe80::1%eth0）は落とす
  if (pct >= 0) s = s.slice(0, pct);
  let tail: number[] = [];
  const lastColon = s.lastIndexOf(":");
  const maybeV4 = s.slice(lastColon + 1);
  if (maybeV4.includes(".")) {
    if (!isIPv4(maybeV4)) return null;
    const o = maybeV4.split(".").map(Number);
    tail = [(o[0] << 8) | o[1], (o[2] << 8) | o[3]];
    s = s.slice(0, lastColon + 1) + "0:0";    // 位置合わせ用。下で tail に置き換える
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 ? (halves[1] ? halves[1].split(":") : []) : [];
  const fill = halves.length === 2 ? 8 - head.length - rest.length : 0;
  const parts = [...head, ...Array(Math.max(fill, 0)).fill("0"), ...rest];
  if (parts.length !== 8) return null;
  const words = parts.map((h) => parseInt(h || "0", 16));
  if (words.some((w) => Number.isNaN(w) || w < 0 || w > 0xffff)) return null;
  if (tail.length) { words[6] = tail[0]; words[7] = tail[1]; }
  return words;
}

const v4FromWords = (hi: number, lo: number) =>
  `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;

/**
 * IPv6 に埋め込まれた IPv4 を取り出す。**埋め込みの形なら必ず IPv4 として判定し直す。**
 *   ::ffff:a.b.c.d    … IPv4 射影
 *   64:ff9b::a.b.c.d  … NAT64（64:ff9b::/96。末尾 32bit）
 *   2002:AABB:CCDD::  … 6to4（2002::/16。16〜48bit 目）
 */
export function embeddedV4(ip: string): string | null {
  const w = expandV6(ip);
  if (!w) return null;
  // ::ffff:0:0/96
  if (w[0] === 0 && w[1] === 0 && w[2] === 0 && w[3] === 0 && w[4] === 0 && w[5] === 0xffff) {
    return v4FromWords(w[6], w[7]);
  }
  // 64:ff9b::/96
  if (w[0] === 0x64 && w[1] === 0xff9b && w[2] === 0 && w[3] === 0 && w[4] === 0 && w[5] === 0) {
    return v4FromWords(w[6], w[7]);
  }
  // 2002::/16
  if (w[0] === 0x2002) return v4FromWords(w[1], w[2]);
  return null;
}

/**
 * ★この IP に接続してはいけないなら理由を返す。接続してよいなら null。
 * ⚠️ IP の表記でないもの（ホスト名）は `not_an_ip` で拒否する（解決してから渡すこと）。
 */
export function blockReason(ip: string): BlockReason | null {
  const kind = isIP(ip.split("%")[0]);
  if (kind === 4) return v4List.check(ip, "ipv4") ? "private_v4" : null;
  if (kind === 6 || isIPv6(ip)) {
    const v4 = embeddedV4(ip);
    if (v4) return v4List.check(v4, "ipv4") ? "private_v4" : null;
    const clean = ip.split("%")[0];
    return v6List.check(clean, "ipv6") ? "private_v6" : null;
  }
  return "not_an_ip";
}

export function isBlockedAddress(ip: string): boolean {
  return blockReason(ip) !== null;
}

// ── URL の接続先の検査 ─────────────────────────────────────────────────────────
/*
 * ★URL の形 → 接続先の IP（名前なら DNS で解決した**全部**）→ 1つでも内部なら拒否。
 * ⚠️ DNS の解決は引数で差し替えられる（`resolver`）。テストは偽の解決で
 *    「内部 IP に解決されるドメイン」を再現する。**本物の内部アドレスには繋がない。**
 */
export type TargetRejectReason =
  | "invalid_url"
  | "bad_scheme"
  | "credentials_in_url"
  | "dns_failed"
  | "no_address"
  | "blocked_address";

export type ResolvedAddress = { address: string; family: 4 | 6 };
export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;

export type CheckedTarget = {
  url: URL;
  /** 接続に使うホスト名（IPv6 の表記は角括弧を外したもの） */
  hostname: string;
  /** 検査済みのアドレス。**接続はこの中のものだけを使う**（引き直さない） */
  addresses: ResolvedAddress[];
};

export const defaultResolver: Resolver = async (hostname) => {
  const all = await lookup(hostname, { all: true, verbatim: true });
  return all.map((a) => ({ address: a.address, family: a.family === 6 ? 6 : 4 }));
};

export async function checkUrlTarget(
  raw: string,
  resolver: Resolver = defaultResolver,
): Promise<{ ok: true; target: CheckedTarget } | { ok: false; reason: TargetRejectReason; hostname?: string }> {
  let url: URL;
  try { url = new URL(raw); } catch { return { ok: false, reason: "invalid_url" }; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, reason: "bad_scheme" };
  /* ⚠️ user:pass@host は拒否する。見かけのホストと実際の接続先を取り違えさせる形のため */
  if (url.username || url.password) return { ok: false, reason: "credentials_in_url", hostname: url.hostname };

  const hostname = url.hostname.replace(/^\[|\]$/g, "");

  /* ★IP の表記なら DNS を通さずそのまま判定する。
       ⚠️ Node は接続先が IP の表記だと lookup を呼ばないので、ここで止めないと素通りする */
  const literal = isIP(hostname);
  if (literal) {
    if (blockReason(hostname)) return { ok: false, reason: "blocked_address", hostname };
    return { ok: true, target: { url, hostname, addresses: [{ address: hostname, family: literal === 6 ? 6 : 4 }] } };
  }

  let addresses: ResolvedAddress[];
  try { addresses = await resolver(hostname); } catch { return { ok: false, reason: "dns_failed", hostname }; }
  if (addresses.length === 0) return { ok: false, reason: "no_address", hostname };
  /* ★解決した**全部**を検査する。1つでも内部なら拒否（どれに繋がるかを相手に選ばせない） */
  if (addresses.some((a) => blockReason(a.address))) return { ok: false, reason: "blocked_address", hostname };
  return { ok: true, target: { url, hostname, addresses } };
}
