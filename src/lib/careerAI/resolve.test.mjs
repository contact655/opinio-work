/**
 * ① キャリアAI のマスタ解決のユニットテスト。
 *
 *     node --test src/lib/careerAI/resolve.test.mjs
 *
 * ⚠️ `.mjs` なのは `evidence/engine.test.mjs` と同じ理由（依存を足さずに書くため）。
 *
 * ── ★このテストが守っているもの ────────────────────────────────────────────
 * ① **部分一致をしない**（「東京」で「京都」に当てない）
 * ② **解決できなかった語を黙って落とさない**
 * ③ **推測しない**（年収の単位・範囲の上下・上限超過）
 */

import test from "node:test";
import assert from "node:assert/strict";
import { resolveDesired, isEmptyResolved } from "./resolve.ts";

const MASTERS = {
  roles: [
    { id: "r-ae", name: "アカウントエグゼクティブ", aliases: ["AE", "Account Executive"] },
    { id: "r-cs", name: "カスタマーサクセス", aliases: ["CS"] },
    { id: "r-sdr", name: "インサイドセールス", aliases: ["SDR", "BDR"] },
    { id: "r-pm", name: "プロダクトマネージャー", aliases: ["PdM"] },
    { id: "r-eng", name: "ソフトウェアエンジニア", aliases: [] },
    { id: "r-dsg", name: "デザイナー" },
  ],
  /* ★「東京都」と「京都府」を必ず両方入れる。部分一致の事故を再現するため */
  prefectures: ["東京都", "京都府", "大阪府", "北海道", "神奈川県"],
  /* ⚠️ DESIRED_PHASES（日本語）。PHASE_OPTIONS の slug ではない */
  phases: ["シリーズA", "シリーズB", "シリーズC", "上場"],
  workStyles: [
    { value: "full_remote", label: "フルリモート希望" },
    { value: "hybrid", label: "ハイブリッド（週1〜3出社）" },
    { value: "on_site", label: "出社中心" },
  ],
  salaryMaxMan: 9999,
  maxRoles: 5,
};

// ── ① 部分一致をしない ───────────────────────────────────────────────────────

test("★『東京』は『東京都』に解決し、『京都府』には当たらない", () => {
  const r = resolveDesired({ prefectures: ["東京"] }, MASTERS);
  assert.deepEqual(r.prefectures, ["東京都"]);
  assert.equal(r.unresolved.length, 0);
});

test("★『京都』は『京都府』に解決し、『東京都』には当たらない", () => {
  const r = resolveDesired({ prefectures: ["京都"] }, MASTERS);
  assert.deepEqual(r.prefectures, ["京都府"]);
});

test("★接尾辞の無い『北海道』はそのまま解決する", () => {
  const r = resolveDesired({ prefectures: ["北海道"] }, MASTERS);
  assert.deepEqual(r.prefectures, ["北海道"]);
});

test("★職種の部分一致はしない（『セールス』だけでは当てない）", () => {
  const r = resolveDesired({ roles: ["セールス"] }, MASTERS);
  assert.deepEqual(r.roleIds, []);
  assert.deepEqual(r.unresolved, [{ field: "roles", value: "セールス", reason: "not_found" }]);
});

// ── ② 解決できなかった語を黙って落とさない ───────────────────────────────────

test("マスタに無い職種は unresolved に理由つきで出る", () => {
  const r = resolveDesired({ roles: ["AE", "宇宙飛行士"] }, MASTERS);
  assert.deepEqual(r.roleIds, ["r-ae"]);
  assert.deepEqual(r.unresolved, [{ field: "roles", value: "宇宙飛行士", reason: "not_found" }]);
});

test("マスタに無い都道府県・フェーズ・勤務スタイルも出る", () => {
  const r = resolveDesired(
    { prefectures: ["ハワイ"], phases: ["シリーズZ"], workStyles: ["週4出社"] },
    MASTERS,
  );
  assert.deepEqual(r.unresolved.map((u) => u.field), ["prefectures", "phases", "workStyles"]);
  assert.ok(r.unresolved.every((u) => u.reason === "not_found"));
});

// ── ③ 推測しない ─────────────────────────────────────────────────────────────

test("★年収の単位を推測しない（6000000 は弾いて out_of_range で返す）", () => {
  const r = resolveDesired({ salaryMin: 6000000 }, MASTERS);
  assert.equal(r.salaryMin, null);
  assert.deepEqual(r.unresolved, [{ field: "salaryMin", value: "6000000", reason: "out_of_range" }]);
});

test("★上下が逆でも入れ替えない（両方落として range_inverted）", () => {
  const r = resolveDesired({ salaryMin: 900, salaryMax: 600 }, MASTERS);
  assert.equal(r.salaryMin, null);
  assert.equal(r.salaryMax, null);
  assert.deepEqual(r.unresolved.map((u) => u.reason), ["range_inverted", "range_inverted"]);
});

test("★上限件数を超えたぶんを黙って切らない（over_limit で返す）", () => {
  const r = resolveDesired(
    { roles: ["AE", "CS", "SDR", "PdM", "ソフトウェアエンジニア", "デザイナー"] },
    MASTERS,
  );
  assert.equal(r.roleIds.length, 5);
  assert.deepEqual(r.unresolved, [{ field: "roles", value: "デザイナー", reason: "over_limit" }]);
});

test("★片方だけ言われたら片方だけ入れる（上限を作らない）", () => {
  const r = resolveDesired({ salaryMin: "600万" }, MASTERS);
  assert.equal(r.salaryMin, 600);
  assert.equal(r.salaryMax, null);
  assert.equal(r.unresolved.length, 0);
});

// ── 正規化 ───────────────────────────────────────────────────────────────────

test("別名で引ける（AE / Account Executive）", () => {
  assert.deepEqual(resolveDesired({ roles: ["AE"] }, MASTERS).roleIds, ["r-ae"]);
  assert.deepEqual(resolveDesired({ roles: ["account executive"] }, MASTERS).roleIds, ["r-ae"]);
});

test("全角・空白・中黒の違いを吸収する", () => {
  assert.deepEqual(resolveDesired({ roles: ["ＡＥ"] }, MASTERS).roleIds, ["r-ae"]);
  assert.deepEqual(resolveDesired({ roles: [" アカウント エグゼクティブ "] }, MASTERS).roleIds, ["r-ae"]);
});

test("年収は「600万」「600万円」「1,000」を読む", () => {
  assert.equal(resolveDesired({ salaryMin: "600万" }, MASTERS).salaryMin, 600);
  assert.equal(resolveDesired({ salaryMin: "600万円" }, MASTERS).salaryMin, 600);
  assert.equal(resolveDesired({ salaryMin: "1,000" }, MASTERS).salaryMin, 1000);
  assert.equal(resolveDesired({ salaryMin: 600 }, MASTERS).salaryMin, 600);
});

test("勤務スタイルは値でもラベルでも受ける", () => {
  assert.deepEqual(resolveDesired({ workStyles: ["full_remote"] }, MASTERS).workStyles, ["full_remote"]);
  assert.deepEqual(resolveDesired({ workStyles: ["フルリモート希望"] }, MASTERS).workStyles, ["full_remote"]);
});

test("★フェーズは日本語ラベル。slug（series_a）は解決しない", () => {
  assert.deepEqual(resolveDesired({ phases: ["シリーズA"] }, MASTERS).phases, ["シリーズA"]);
  const r = resolveDesired({ phases: ["series_a"] }, MASTERS);
  assert.deepEqual(r.phases, []);
  assert.equal(r.unresolved[0].reason, "not_found");
});

test("同じものを2回言っても1件に畳む（unresolved には出さない）", () => {
  const r = resolveDesired({ roles: ["AE", "アカウントエグゼクティブ"], prefectures: ["東京", "東京都"] }, MASTERS);
  assert.deepEqual(r.roleIds, ["r-ae"]);
  assert.deepEqual(r.prefectures, ["東京都"]);
  assert.equal(r.unresolved.length, 0);
});

// ── 空 ───────────────────────────────────────────────────────────────────────

test("何も言われていなければ全部空。unresolved も空", () => {
  const r = resolveDesired({}, MASTERS);
  assert.deepEqual(r, {
    roleIds: [], prefectures: [], phases: [], workStyles: [],
    salaryMin: null, salaryMax: null, unresolved: [],
  });
  assert.equal(isEmptyResolved(r), true);
});

test("null / 空文字は「言われていない」として扱う（unresolved にしない）", () => {
  const r = resolveDesired({ salaryMin: null, salaryMax: "" }, MASTERS);
  assert.equal(r.salaryMin, null);
  assert.equal(r.unresolved.length, 0);
});

test("1件でも解決できていれば isEmptyResolved は false", () => {
  assert.equal(isEmptyResolved(resolveDesired({ roles: ["AE"] }, MASTERS)), false);
});

test("★解決が0件でも unresolved があれば、それは『空』とは別（画面で出し分ける）", () => {
  const r = resolveDesired({ roles: ["宇宙飛行士"] }, MASTERS);
  assert.equal(isEmptyResolved(r), true);
  assert.equal(r.unresolved.length, 1);
});
