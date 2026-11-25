import { test } from "node:test";
import assert from "node:assert/strict";
import { relatedPeopleTitle, RELATED_ROLE_LABEL } from "./relatedPeopleTypes.ts";

const p = (roles) => ({ userId: "x", name: "x", avatarUrl: null, title: null, roles, canMessage: false });

test("採用担当だけなら見出しは今までどおり「採用担当」", () => {
  assert.equal(relatedPeopleTitle([p(["recruiter"]), p(["recruiter"])]), "採用担当");
});

test("マネージャーかメンバーがいれば「この募集に関わる人」", () => {
  assert.equal(relatedPeopleTitle([p(["recruiter"]), p(["manager"])]), "この募集に関わる人");
  assert.equal(relatedPeopleTitle([p(["recruiter"]), p(["member"])]), "この募集に関わる人");
  assert.equal(relatedPeopleTitle([p(["recruiter", "manager"])]), "この募集に関わる人");
});

test("見出しと役割に「話せる人」「話を聞ける」を使わない（2026-10-16 の撤去）", () => {
  const words = [relatedPeopleTitle([p(["member"])]), ...Object.values(RELATED_ROLE_LABEL)].join(" ");
  assert.ok(!/話せる|話を聞ける|面談OK/.test(words));
});
