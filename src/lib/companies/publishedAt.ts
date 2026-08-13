/**
 * `ow_companies.published_at` の決め方を1箇所に集約する。
 *
 * ── 規則 ────────────────────────────────────────────────────────────────────
 *   `published_at` は「**最初に公開した日時**」。
 *   ・初回公開のときだけ `now` を書く
 *   ・すでに値があれば**触らない**（公開中に再保存しても上書きしない）
 *   ・非公開に戻しても**消さない**
 *
 * ⚠️ 消さないのは、公開した瞬間に作られるフィード投稿（company_joined）が残るため。
 *    記録を消すと、投稿と「いつ公開したか」を突き合わせられなくなる。
 *
 * ── なぜ関数にしたか（2026-08-12）────────────────────────────────────────────
 * `is_published` を true にできる経路が**3つ**あり、規則がばらけていた。
 *
 *   admin/companies/actions.ts `updateIsPublished` … 初回のみ書く（これが正）
 *   api/biz/company `PATCH`                        … `isPublished ? now : null`。
 *                                                    再保存で上書きし、非公開化で消していた
 *   api/admin/companies/[id] `PATCH`               … **まったく書いていなかった**
 *
 * ⚠️ **新しく `is_published` を true にする経路を足すときは、必ずここを通すこと。**
 *    3箇所に同じ条件を書き写すと、片方だけ直し忘れる（本日それを何度も直している）。
 *
 * ⚠️ 既存80社の `published_at` は NULL のまま。**バックフィルしない。**
 *    `created_at` で埋めると推測値の投入になる。「記録が無い」事実を残す。
 */

/**
 * 更新オブジェクトに混ぜる差分を返す。
 *
 * **パッチ形（`{}` を返しうる）にしているのが肝。** 「触らない」を表現するには、
 * 値を返す形（`string | null`）では足りない。null を返すと「消す」になってしまう。
 *
 * ```ts
 * const { data: cur } = await admin
 *   .from("ow_companies").select("published_at").eq("id", id).maybeSingle();
 * await admin.from("ow_companies").update({
 *   is_published: next,
 *   ...publishedAtPatch(cur?.published_at, next, now),
 *   updated_at: now,
 * }).eq("id", id);
 * ```
 *
 * @param currentPublishedAt DB に入っている現在値（未取得なら undefined を渡さないこと）
 * @param nextIsPublished    これから設定する `is_published`
 * @param nowIso             書き込む日時（呼び出し側の `updated_at` と揃える）
 */
export function publishedAtPatch(
  currentPublishedAt: string | null | undefined,
  nextIsPublished: boolean,
  nowIso: string,
): { published_at?: string } {
  // 非公開にするとき: 触らない（消さない）
  if (!nextIsPublished) return {};
  // 既に記録がある: 触らない（上書きしない）
  if (currentPublishedAt) return {};
  // 初回公開: ここでだけ書く
  return { published_at: nowIso };
}
