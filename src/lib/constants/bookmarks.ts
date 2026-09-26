/**
 * ブックマークの対象種別（`ow_bookmarks.target_type`）。
 *
 * ⚠️★**ここが唯一の正。** CLAUDE.md「選択肢が決まっている値は UI / API / DB の CHECK を
 *    3つ揃える」に従い、**API のルートに配列を書き写さないこと。**
 *    ⚠️ 2026-09-27 まで `api/bookmarks/route.ts` が同じ配列を**3回インラインで**持っており、
 *       ここ（型）と合わせて**4箇所**に散っていた。増やすと必ず割れる。
 *
 * ⚠️★**3層の3つ目は DB の CHECK**（`ow_bookmarks_target_type_check`）。
 *    値を足す／減らすときは **migration も同じコミットで**書くこと。
 *    片方だけだと「選べるのに保存できない」か「保存できるのに弾かれない」になる。
 *
 * ── `mentor` を外した経緯（2026-09-27）────────────────────────────────────
 * メンター機能は存在しない（`ow_mentors` は DROP 済み。同日に DB から `%mentor%` の
 * 列・表を全部落とし、記事の `type` も `career` に変えた）。
 * 実測: `target_type='mentor'` の行は **0件**。UI が送っていたのも `company` / `job` だけ。
 * ⚠️★**足し直さないこと。**
 *
 * ⚠️ `article` は残してある。**行は0件だが、記事のブックマークは概念として生きている**
 *    （`BookmarkButton` が受け取れる形になっている）。`mentor` とは事情が違う。
 */
export const BOOKMARK_TARGET_TYPES = ["article", "company", "job"] as const;

export type BookmarkTargetType = (typeof BOOKMARK_TARGET_TYPES)[number];

/** 受け取った値が許容値かを判定する。⚠️ ルート側で `includes` を書き写さないこと。 */
export function isBookmarkTargetType(v: unknown): v is BookmarkTargetType {
  return typeof v === "string" && (BOOKMARK_TARGET_TYPES as readonly string[]).includes(v);
}
