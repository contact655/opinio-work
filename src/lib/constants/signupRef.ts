/**
 * 登録経路の計測（`?ref=`）。**cookie 名・形式・長さをここ1箇所に置く。**
 *
 * ⚠️★**正規表現と最大長を書き写さないこと。** 使い手は3つある
 *    （`middleware.ts` が cookie を立てるとき / `POST /api/jobseeker/signup-ref` が
 *     書くとき / migration の CHECK）。うち**DB の CHECK だけは SQL で別に書く**ので、
 *    実質2重管理になっている。**片方を変えたら必ずもう片方も変える。**
 *    → migration: `20260916T000000_ow_users_signup_ref.sql`
 *
 * ── なぜ語彙を固定しないか ──────────────────────────────────────────────────
 * 声かけのたびに増えるため。`ow_companies.source`（CHECK で5値に固定）とは**性質が違う**。
 * ⚠️★**「選択肢が決まっている値は UI / API / DB の CHECK を3つ揃える」は
 *    ここには当てはまらない。** 縛るのは**値の集合ではなく形式**。
 *    CHECK を列挙に直そうとしないこと（声かけのたびに migration が要ることになる）。
 *
 * ⚠️★**個人を特定できる文字列を入れない**のは**運用で守る**。
 *    形式の制約は氏名やメールのローカル部を弾けない（小文字英数なら通る）。
 *    だから `/admin/signup-refs` に注意書きを出してある。**あの文言を消さないこと。**
 */

/** cookie 名。⚠️ `sb-` で始めないこと（Supabase のセッション判定に拾われる） */
export const SIGNUP_REF_COOKIE = "opinio_ref";

/** cookie の有効期間（秒）。30日 */
export const SIGNUP_REF_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** URL のクエリキー */
export const SIGNUP_REF_QUERY_KEY = "ref";

/** 最大長。⚠️ DB の CHECK（`{0,39}` ＝ 先頭1文字 + 39）と同じ値にすること */
export const SIGNUP_REF_MAX_LENGTH = 40;

/**
 * 形式。**小文字英数で始まり、以降は小文字英数・ハイフン・アンダースコア。1〜40文字。**
 *
 * ⚠️ 大文字を許さないのは、URL に出るので大小の揺れで別の ref に見えるのを防ぐため。
 * ⚠️ 先頭を英数字に限るのは、`-` 始まりが CLI や CSV で事故るため。
 * ⚠️ DB の CHECK と**同じ式**にすること（`^[a-z0-9][a-z0-9_-]{0,39}$`）。
 */
export const SIGNUP_REF_PATTERN = /^[a-z0-9][a-z0-9_-]{0,39}$/;

/**
 * 受け取った値を検証する。**通らなければ `null`。**
 *
 * ⚠️★**「直して通す」ことをしない**（小文字化・切り詰め・記号の除去をしない）。
 *    直すと、`/admin` に出る ref と柴さんが配った URL が食い違う。
 *    **合わないものは記録しない**ほうが、数字として信用できる。
 */
export function parseSignupRef(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.length > SIGNUP_REF_MAX_LENGTH) return null;
  return SIGNUP_REF_PATTERN.test(raw) ? raw : null;
}
