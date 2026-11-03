import { test } from "node:test";
import assert from "node:assert/strict";
import { followCardView, showFollowOnCard, FOLLOW_LABEL, FOLLOWING_LABEL } from "./followButton.ts";

test("フォロー前は枠線の「フォローする」、押すと POST", () => {
  const v = followCardView(false);
  assert.equal(v.label, FOLLOW_LABEL);
  assert.equal(v.label, "フォローする");
  assert.equal(v.tone, "outline");
  assert.equal(v.method, "POST");
});

test("フォロー後はグレーの「フォロー中」、押すと確認なしで DELETE", () => {
  const v = followCardView(true);
  assert.equal(v.label, FOLLOWING_LABEL);
  assert.equal(v.label, "フォロー中");
  assert.equal(v.tone, "muted");
  assert.equal(v.method, "DELETE");
});

test("相手が自分をフォローしていても文言は2つだけ（つながり申請に見せない）", () => {
  assert.equal(followCardView(true, true).label, "フォロー中");
  assert.equal(followCardView(false, true).label, "フォローする");
  assert.match(followCardView(true, true).title, /お互いに/);
});

test("自分自身と未ログインにはボタンを出さない", () => {
  assert.equal(showFollowOnCard("me", "me"), false);
  assert.equal(showFollowOnCard(null, "other"), false);
  assert.equal(showFollowOnCard("me", "other"), true);
});
