/**
 * 性別（`ow_users.gender`）。
 *
 * ⚠️★**UI / API / DB の CHECK を3つ揃える**（CLAUDE.md「選択肢が決まっている値」）。
 *    DB 側は `ow_users_gender_check`（migration `20260914180000`）。
 *    **値を1つ足すときは3つとも足すこと。** どれか1つを忘れると
 *    「選べるのに保存できない」か「保存できるのに絞れない」のどちらかになる。
 *
 * ⚠️★**`prefer_not_to_say`（回答しない）を外さないこと**（2026-09-14 / 柴さんの判断）。
 *    逃げ道が無いと、答えたくない人が**嘘を入れるか離脱する**。
 *
 * ── ⚠️★★出していい場所・いけない場所 ──────────────────────────────────────
 * **年齢とまったく同じ扱いにする**（CLAUDE.md「年齢は詳細だけ。一覧に出さず、
 * 年齢で絞り込ませない」2026-08-20）。
 *
 *   ○ 本人の `/mypage`／`/u/[id]` の詳細
 *   ✗ **一覧に出さない**（`/people`・企業ページの社員・`/biz/candidates`・`/biz/meetings`）
 *   ✗ **企業に絞り込ませない**
 *
 * ⚠️★理由は法令。年齢の絞り込みを外したのは**労働施策総合推進法9条**、
 *    性別は**男女雇用機会均等法5条**が同じ位置にある。
 *
 * ⚠️★**OPINIO は「ダイレクトリクルーティング」**。企業と求職者が**直接**やり取りする。
 *    規約本文のとおり、このプロダクトは**職業安定法第4条第6項の「募集情報等提供」**であり、
 *    **職業紹介には該当しない**（`content/legal/terms-of-service-listing.md` 第2条3項）。
 *    ⚠️★**だからこそこの判断が直接効く。** 絞り込むのは**企業（事業主）自身**なので、
 *       性別フィルタを持たせることは**均等法5条違反を直接手助けする**形になる。
 *
 * ⚠️★**「有料職業紹介事業の許可事業者だから一段リスクが高い」とは書かないこと**（2026-09-14 に直した）。
 *    許可（13-ユ-316441）を持っているのは**会社**で、それは別サービス
 *    （エージェントサービス／Opinio Career）の話。**このプロダクトの話と混ぜない。**
 *    ⚠️ 人材紹介利用規約は **2026-09-13 に廃止済み**（`docs/pending/terms-placement-retire.md`）。
 *
 * ⚠️★**守り方は「規約」ではなく「型」**（年齢と同じ）。一覧用の型に `gender` を持たせない。
 *    型に無ければ表示も絞り込みも**書けない**。コメントで「出すな」と書く方式は守られない。
 *
 * ⚠️ SELECT の GRANT は配っていない（`ow_users` の RLS は
 *    「ログインしていれば他人の行も読める」ため）。読むのは**サーバー側で admin
 *    クライアント＋本人の行だけ**。`PUT /api/jobseeker/profile` に `.select()` を足さないこと。
 */
export const GENDER_VALUES = ["male", "female", "other", "prefer_not_to_say"] as const;

export type Gender = (typeof GENDER_VALUES)[number];

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male", label: "男性" },
  { value: "female", label: "女性" },
  { value: "other", label: "その他" },
  { value: "prefer_not_to_say", label: "回答しない" },
];

export function isGender(v: unknown): v is Gender {
  return typeof v === "string" && (GENDER_VALUES as readonly string[]).includes(v);
}
