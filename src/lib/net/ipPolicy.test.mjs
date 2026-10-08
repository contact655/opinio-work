/**
 * SSRF 対策の判定のテスト（2026-10-09）。
 *     node --test src/lib/net/ipPolicy.test.mjs
 *
 * ⚠️★**ネットワークに出ない。** DNS は偽の解決（`fakeResolver`）で再現する。
 *    内部アドレスへの実際の接続は試さない（判定だけを見る）。
 * ⚠️ 陽性対照（公開アドレスが通ること）を必ず入れる。拒否だけを確かめると、
 *    「全部拒否する壊れた判定」でも通ってしまう。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { blockReason, checkUrlTarget, embeddedV4 } from "./ipPolicy.ts";

/** 偽の DNS。表に無い名前は解決失敗にする（本物の DNS には問い合わせない） */
const DNS = {
  "www.opinio.co.jp": [{ address: "216.198.79.1", family: 4 }],
  "v6.example.test": [{ address: "2606:4700:4700::1111", family: 6 }],
  "127.0.0.1.nip.io": [{ address: "127.0.0.1", family: 4 }],
  "localhost.": [{ address: "127.0.0.1", family: 4 }, { address: "::1", family: 6 }],
  "localhost": [{ address: "127.0.0.1", family: 4 }],
  // 1つだけ内部が混ざる（全部を検査しているかの確認）
  "mixed.example.test": [{ address: "8.8.8.8", family: 4 }, { address: "10.0.0.5", family: 4 }],
};
const fakeResolver = async (h) => {
  if (!(h in DNS)) throw new Error("ENOTFOUND");
  return DNS[h];
};
const check = (u) => checkUrlTarget(u, fakeResolver);

// ── フェーズ0の表の14例（＋陽性対照）。すべて拒否されること ─────────────────────
const MUST_REJECT = [
  ["素の localhost", "http://localhost/"],
  ["127.0.0.1", "http://127.0.0.1/"],
  ["ループバックの別アドレス", "http://127.0.0.2/"],
  ["10進数で書いた 127.0.0.1", "http://2130706433/"],
  ["16進数で書いた 127.0.0.1", "http://0x7f000001/"],
  ["省略形 127.1", "http://127.1/"],
  ["メタデータを10進数で", "http://2852039166/latest/meta-data/"],
  ["メタデータをそのまま", "http://169.254.169.254/latest/meta-data/"],
  ["末尾にドットを付けた localhost", "http://localhost./"],
  ["IPv4 射影 IPv6 の 127.0.0.1", "http://[::ffff:127.0.0.1]/"],
  ["IPv6 のリンクローカル", "http://[fe80::1]/"],
  ["IPv6 のユニークローカル", "http://[fd00::1]/"],
  ["CGNAT 100.64/10", "http://100.64.0.1/"],
  ["0.0.0.0/8 の別アドレス", "http://0.1.2.3/"],
  ["内部 IP に解決されるドメイン", "http://127.0.0.1.nip.io/"],
  ["ユーザー情報で見せかける", "http://opinio.jp@127.0.0.1/"],
  // 追加の形
  ["IPv6 ループバック", "http://[::1]/"],
  ["解決結果の1つだけが内部", "http://mixed.example.test/"],
  ["http/https 以外", "file:///etc/passwd"],
  ["javascript:", "javascript:alert(1)"],
  ["ftp", "ftp://example.com/"],
];

for (const [label, url] of MUST_REJECT) {
  test(`拒否: ${label}（${url}）`, async () => {
    const r = await check(url);
    assert.equal(r.ok, false, `通ってしまった: ${url}`);
  });
}

// ── 陽性対照: 公開サイトは通る ───────────────────────────────────────────────
test("陽性対照: 公開サイト（IPv4）は通る", async () => {
  const r = await check("https://www.opinio.co.jp/");
  assert.equal(r.ok, true);
  assert.deepEqual(r.target.addresses, [{ address: "216.198.79.1", family: 4 }]);
  assert.equal(r.target.hostname, "www.opinio.co.jp");
});
test("陽性対照: 公開サイト（IPv6）は通る", async () => {
  const r = await check("https://v6.example.test/path?q=1");
  assert.equal(r.ok, true);
});
test("陽性対照: 公開 IP の表記は通る", async () => {
  assert.equal((await check("http://8.8.8.8/")).ok, true);
  assert.equal((await check("http://[2606:4700:4700::1111]/")).ok, true);
});
test("DNS で解決できない名前は拒否（理由は dns_failed）", async () => {
  const r = await check("https://no-such-host.example.test/");
  assert.equal(r.ok, false);
  assert.equal(r.reason, "dns_failed");
});

// ── 拒否する範囲（IP 単位）────────────────────────────────────────────────────
const BLOCKED_IPS = [
  "0.0.0.0", "0.1.2.3", "10.0.0.1", "100.64.0.1", "100.127.255.254", "127.0.0.1", "127.255.255.255",
  "169.254.169.254", "172.16.0.1", "172.31.255.255", "192.0.0.1", "192.0.2.1", "192.168.1.1",
  "198.18.0.1", "198.19.255.255", "198.51.100.7", "203.0.113.9", "224.0.0.1", "239.255.255.250",
  "240.0.0.1", "255.255.255.255",
  "::", "::1", "::127.0.0.1", "fc00::1", "fd12:3456::1", "fe80::1", "fe80::1%lo0", "fec0::1",
  "ff02::1", "2001:db8::1", "100::1",
  // 射影・NAT64・6to4 は埋め込まれた IPv4 で判定
  "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:169.254.169.254", "::ffff:10.0.0.1",
  "64:ff9b::127.0.0.1", "64:ff9b::a9fe:a9fe", "64:ff9b::192.168.0.1",
  "2002:7f00:1::", "2002:a9fe:a9fe::1", "2002:c0a8:101::",
];
for (const ip of BLOCKED_IPS) {
  test(`拒否する IP: ${ip}`, () => {
    assert.notEqual(blockReason(ip), null, `通ってしまった: ${ip}`);
  });
}

// ── 陽性対照: 公開アドレスは通る ─────────────────────────────────────────────
const PUBLIC_IPS = [
  "8.8.8.8", "1.1.1.1", "216.198.79.1", "172.32.0.1", "100.128.0.1", "192.169.0.1", "223.255.255.255",
  "2606:4700:4700::1111", "2001:4860:4860::8888",
  "::ffff:8.8.8.8", "64:ff9b::808:808", "2002:808:808::1",
];
for (const ip of PUBLIC_IPS) {
  test(`陽性対照: 公開 IP は通る ${ip}`, () => {
    assert.equal(blockReason(ip), null, `拒否されてしまった: ${ip}`);
  });
}

test("IP の表記でないものは not_an_ip", () => {
  assert.equal(blockReason("localhost"), "not_an_ip");
  assert.equal(blockReason("example.com"), "not_an_ip");
});

test("埋め込まれた IPv4 を取り出せる", () => {
  assert.equal(embeddedV4("::ffff:7f00:1"), "127.0.0.1");
  assert.equal(embeddedV4("64:ff9b::a9fe:a9fe"), "169.254.169.254");
  assert.equal(embeddedV4("2002:c0a8:101::"), "192.168.1.1");
  assert.equal(embeddedV4("2606:4700::1"), null);
});
