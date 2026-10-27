import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeFeedCursor, encodeFeedCursor, feedCursorOrFilter, nextFeedPage, compareFeedOrder, isAfterCursor } from "./cursor.ts";

/* ★同じ時刻の投稿がページの境目をまたいでも飛ばさない（2026-10-28）。
   DB の並び（時刻 → id の新しい順）と次の条件（isAfterCursor = PostgREST の条件と同じ意味）を、メモリの上で再現して確かめる */

const T1 = "2026-06-04T06:16:01.976232+00:00"; // 「参加しました」が数十件この時刻で入っている
const T0 = "2026-06-01T00:00:00+00:00";
const T2 = "2026-10-27T15:05:19.020522+00:00";
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** rows を DB と同じ順に並べ、limit ごとに読み、hidden を落として集める（画面と API の組み合わせ） */
function readAll(rows, limit, hidden = new Set(), decodeCursor = (c) => decodeFeedCursor(c)) {
  const sorted = [...rows].sort(compareFeedOrder);
  const shown = [];
  let cursor = null;
  for (let guard = 0; guard < 100; guard++) {
    const c = decodeCursor(cursor);
    const page = sorted.filter((r) => (c ? isAfterCursor(r, c) : true)).slice(0, limit);
    shown.push(...page.filter((r) => !hidden.has(r.id)));
    const next = nextFeedPage(page, limit);
    if (!next.hasMore) break;
    cursor = next.nextCursor;
  }
  return shown;
}

test("同じ時刻の投稿がページの境目をまたいでも、全件を1回ずつ読む", () => {
  const rows = [
    { created_at: T2, id: id(999) },
    ...Array.from({ length: 45 }, (_, i) => ({ created_at: T1, id: id(i + 1) })),
    { created_at: T0, id: id(500) },
  ];
  const shown = readAll(rows, 20);
  assert.equal(shown.length, rows.length);
  assert.equal(new Set(shown.map((r) => r.id)).size, rows.length, "重複しない");
});

test("見せない投稿が混ざって件数が上限より少ないページがあっても、最後まで読む", () => {
  const rows = Array.from({ length: 60 }, (_, i) => ({ created_at: T1, id: id(i + 1) }));
  // 先頭のページをまるごと見せない投稿にする（見せる件数0のページ）
  const hidden = new Set(rows.slice().sort(compareFeedOrder).slice(0, 20).map((r) => r.id));
  const shown = readAll(rows, 20, hidden);
  assert.equal(shown.length, 40);
});

test("（参考）時刻だけのカーソルだと、同じ時刻の続きを飛ばしていた", () => {
  const rows = Array.from({ length: 45 }, (_, i) => ({ created_at: T1, id: id(i + 1) }));
  const timeOnly = (c) => { const d = decodeFeedCursor(c); return d ? { createdAt: d.createdAt, id: null } : null; };
  assert.equal(readAll(rows, 20, new Set(), timeOnly).length, 20);
});

test("カーソルの読み書き: 時刻~id・時刻だけ（古い before）・壊れた値", () => {
  const c = encodeFeedCursor({ created_at: T1, id: id(7) });
  assert.deepEqual(decodeFeedCursor(c), { createdAt: T1, id: id(7) });
  assert.deepEqual(decodeFeedCursor(T1), { createdAt: T1, id: null });
  assert.equal(decodeFeedCursor("2026-06-04T06:16:01Z~not-a-uuid"), null);
  assert.equal(decodeFeedCursor("1; drop table"), null);
  assert.equal(decodeFeedCursor(null), null);
});

test("PostgREST の条件: 時刻が前、または同じ時刻で id が前", () => {
  assert.equal(
    feedCursorOrFilter({ createdAt: T1, id: id(7) }),
    `created_at.lt."${T1}",and(created_at.eq."${T1}",id.lt.${id(7)})`,
  );
  assert.equal(feedCursorOrFilter({ createdAt: T1, id: null }), `created_at.lt."${T1}"`);
});

test("続きの有無は読んだ行数で決める", () => {
  assert.equal(nextFeedPage([], 20).hasMore, false);
  assert.equal(nextFeedPage(Array.from({ length: 20 }, (_, i) => ({ created_at: T1, id: id(i) })), 20).hasMore, true);
  assert.equal(nextFeedPage(Array.from({ length: 19 }, (_, i) => ({ created_at: T1, id: id(i) })), 20).hasMore, false);
});
