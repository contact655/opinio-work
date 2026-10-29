import { test } from "node:test";
import assert from "node:assert/strict";
import { draftWithPatch } from "./syncDraft.ts";

test("下書きにあるキーだけをそろえる", () => {
  assert.deepEqual(
    draftWithPatch({ accepting_casual_meetings: false, tagline: "x" }, { accepting_casual_meetings: true }),
    { accepting_casual_meetings: true, tagline: "x" },
  );
});

test("下書きが無い・キーが無い・値が同じなら書き換えない", () => {
  assert.equal(draftWithPatch(null, { accepting_casual_meetings: true }), undefined);
  assert.equal(draftWithPatch({ tagline: "x" }, { accepting_casual_meetings: true }), undefined);
  assert.equal(draftWithPatch({ accepting_casual_meetings: true }, { accepting_casual_meetings: true }), undefined);
});
