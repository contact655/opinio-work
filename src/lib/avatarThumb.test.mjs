import { test } from "node:test";
import assert from "node:assert/strict";
import { avatarThumbUrl } from "./avatarThumb.ts";

test("Supabase の公開 URL は縮めた版に置き換える", () => {
  assert.equal(
    avatarThumbUrl("https://x.supabase.co/storage/v1/object/public/ow-uploads/a/avatars/u/1.webp?t=123", 32),
    "https://x.supabase.co/storage/v1/render/image/public/ow-uploads/a/avatars/u/1.webp?width=64&height=64&resize=cover&quality=70",
  );
});
test("それ以外はそのまま・空や http は null", () => {
  assert.equal(avatarThumbUrl("https://example.com/a.png", 48), "https://example.com/a.png");
  assert.equal(avatarThumbUrl(null, 32), null);
  assert.equal(avatarThumbUrl("", 32), null);
  assert.equal(avatarThumbUrl("http://example.com/a.png", 32), null);
  assert.equal(avatarThumbUrl("javascript:alert(1)", 32), null);
});
