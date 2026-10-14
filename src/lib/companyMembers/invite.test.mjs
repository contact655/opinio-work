import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { newInviteRow, acceptInvitePatch } from "./invite.ts";
import { MEMBER_CREATED_VIA } from "../constants/companyMembers.ts";

const base = {
  companyId: "c1",
  userId: "u1",
  roleTitle: "AE",
  invitedByAuthId: "a-admin",
  now: "2026-10-15T00:00:00.000Z",
};

test("企業担当者が招待しても display_consent / is_public は false のまま", () => {
  const row = newInviteRow(base);
  assert.equal(row.display_consent, false);
  assert.equal(row.is_public, false);
  assert.equal(row.user_id, "u1");
  assert.equal(row.company_id, "c1");
  assert.equal("consent_at" in row, false, "招待で consent_at を書かない");
});

test("招待の created_via は MEMBER_CREATED_VIA.INVITE と同じ値", () => {
  assert.equal(newInviteRow(base).created_via, MEMBER_CREATED_VIA.INVITE);
});

test("本人が承諾したときだけ display_consent が true になる", () => {
  const patch = acceptInvitePatch({
    memberUserId: "u1", actorOwUserId: "u1", roleTitle: " CSM ", newToken: "t2", now: base.now,
  });
  assert.ok(patch);
  assert.equal(patch.display_consent, true);
  assert.equal(patch.is_public, true);
  assert.equal(patch.consent_at, base.now);
  assert.equal(patch.role_title, "CSM");
  assert.equal(patch.invite_token, "t2");
});

test("本人以外（企業担当者など）が承諾しようとしても何も返さない", () => {
  assert.equal(acceptInvitePatch({ memberUserId: "u1", actorOwUserId: "u2", roleTitle: null, newToken: "t", now: base.now }), null);
  assert.equal(acceptInvitePatch({ memberUserId: "", actorOwUserId: "", roleTitle: null, newToken: "t", now: base.now }), null);
});

/* ★経路そのものを見張る。招待 API が newInviteRow を通らずに display_consent を書いたら落とす。
     （route.ts は @/ の別名を使うので node --test から直接は読めない。文字列で確かめる） */
test("招待 API は display_consent / is_public を自分で書かない", () => {
  const route = readFileSync(
    fileURLToPath(new URL("../../app/api/biz/ambassador/invite/route.ts", import.meta.url)),
    "utf8",
  );
  const code = route
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.match(code, /newInviteRow\(/, "INSERT は newInviteRow を通す");
  assert.doesNotMatch(code, /display_consent\s*:/, "display_consent を直接書かない");
  assert.doesNotMatch(code, /is_public\s*:/, "is_public を直接書かない");
  assert.doesNotMatch(code, /\.update\(/, "既存の行を書き換えない");
});
