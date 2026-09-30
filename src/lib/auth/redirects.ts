/**
 * 認証まわりのリダイレクト先の組み立て。
 *
 * ⚠️ このファイルはクライアントからも import される。
 *    サーバー専用のもの（createAdminClient など）を持ち込まないこと。
 *    サーバー側の後処理は postAuth.ts にある。
 */

/**
 * オープンリダイレクト防止。
 * 同一オリジンの相対パスだけを通す。`//evil.com` は host 相対の絶対URLなので弾く。
 */
/**
 * オンボーディングの一連（`/onboarding` → `/onboarding/stance` → 行き先）で、
 * `next` が無い／不正だったときの既定の行き先。
 *
 * ⚠️★**この定数を1箇所に保つこと。** 以前は `/onboarding/stance/page.tsx` に
 *    `"/companies"` のリテラルが直書きされているだけで、`/onboarding` 側は
 *    `next` を読んでもいなかった（2026-09-09 のフェーズ0 の 0-4）。
 *    2箇所に書くと、片方だけ変えたときに**同じ導線の中で行き先が割れる。**
 * ⚠️ `/auth` と `postAuth` は**それぞれ自前の既定**を持っている。あちらは
 *    「認証後どこへ行くか」で関心が違うので、ここに寄せていない。
 *
 * ── ★2026-10-01 に `/mypage` → `/feed`（ホーム）にした（柴さんの指示）────────
 * ⚠️★**何を手放したかを残す。** `/mypage` だったのは、2026-09-15 に
 *    オンボーディング4画面目（勤務地・勤務形態・これまでの職歴・学歴）を削除した
 *    ときに「**続きを入れる場所に着地させないと誰もたどり着かない**」と決めたため。
 *    ⇒ **いまは登録直後の人が職歴の入力画面に導かれない。** ヘッダーの
 *       「マイページ」から1クリックで行けることを前提にしている。
 *    ⚠️ 職歴を入れる人が減ったら、まずここを疑うこと。
 *
 * ⚠️★`DEFAULT_AFTER_LOGIN` と**いまは同じ値だが、統合しないこと。**
 *    「登録を終えた直後」と「ログインし直したとき」は別の判断で、
 *    片方を変えたときにもう片方を黙って巻き込むのが一番まずい。
 */
export const DEFAULT_AFTER_ONBOARDING = "/feed";

/**
 * ★`next` が「本人の意図」ではなく**呼び出し側が既定で付けただけ**の値（2026-09-15）。
 *
 * ⚠️★`/companies` は3箇所が**意図の有無に関わらず付ける**:
 *    `/auth` の登録（`nextUrl || "/companies"`）／ メールテンプレートの
 *    `next=%2Fcompanies`（**リポジトリの外**・Supabase ダッシュボード）／ `/auth/confirm`。
 *    そのため `DEFAULT_AFTER_ONBOARDING` を変えても**素通りしてしまう**。
 */
const GENERIC_NEXT = "/companies";

/**
 * ★オンボーディングを終えた人の行き先（2026-09-15）。
 *
 * ⚠️★**中断された人は元の場所へ戻す。** `OnboardingGuard` や `postAuth` が付ける `next` は
 *    「その人が開こうとしていたURL」なので、勝手に変えない。
 * ⚠️ ただし `next` が `GENERIC_NEXT` のときは**意図とみなさず**既定へ寄せる。
 *    2026-09-15 に4画面目（職歴・学歴・勤務地）を削除したので、
 *    続きを入れる場所（`/mypage`）に着地させないと**誰もたどり着かない**。
 * ⚠️ 代償: `/companies` を見ていて中断された人も `/mypage` に着く。
 *    **意図を1つ取りこぼす**が、ヘッダーから1クリックで戻れるほうを採った。
 */
export function afterOnboarding(raw: string | null | undefined): string {
  const v = safeNext(raw, DEFAULT_AFTER_ONBOARDING);
  return v === GENERIC_NEXT ? DEFAULT_AFTER_ONBOARDING : v;
}

/**
 * ★ログイン直後の既定の行き先（2026-10-01 / 柴さんの指示で `/companies` から変更）。
 *
 * ⚠️★**`DEFAULT_AFTER_ONBOARDING`（`/mypage`）とは別。** あちらは
 *    「オンボーディングを終えた人が続きを入れる場所」で、2026-09-15 に
 *    4画面目を削除したときに決めた**別の理由**がある。**片方を変えるときに
 *    もう片方を巻き込まないこと。**
 */
export const DEFAULT_AFTER_LOGIN = "/feed";

/**
 * ★ログイン直後の行き先（2026-10-01）。
 *
 * ⚠️ `next` が「本人の意図」なら尊重する。ただし `GENERIC_NEXT`（`/companies`）は
 *    **呼び出し側が既定で付けただけ**なので意図とみなさない（`afterOnboarding` と同じ扱い）。
 * ⚠️★これが要るのは、メールテンプレートの `next=%2Fcompanies` が
 *    **リポジトリの外（Supabase ダッシュボード）**にあって直せないため。
 *    ここで畳まないと、メール経由の人だけ `/companies` に着く。
 */
export function afterLogin(raw: string | null | undefined): string {
  const v = safeNext(raw, DEFAULT_AFTER_LOGIN);
  return v === GENERIC_NEXT || v === "/" ? DEFAULT_AFTER_LOGIN : v;
}

export function safeNext(raw: string | null | undefined, fallback: string): string {
  const v = raw ?? "";
  if (!v.startsWith("/")) return fallback;
  if (v.startsWith("//")) return fallback;
  // `/\evil.com` をブラウザが `//evil.com` として解釈する実装があるため合わせて弾く。
  if (v.startsWith("/\\")) return fallback;
  return v;
}

/**
 * メール内リンクの着地点。
 *
 * ⚠️ `/auth/callback`（code 交換）ではなく `/auth/confirm`（token_hash 検証）を指す。
 *    @supabase/ssr は flowType: "pkce" をハードコードしており上書きできないため、
 *    `code` は登録したブラウザに保存された code_verifier とペアでないと交換できない。
 *    スマホのGmailアプリ内ブラウザなど「別ブラウザで開く」と必ず失敗する。
 *    token_hash + verifyOtp はサーバー側だけで完結するのでこの制約が無い。
 *
 * ⚠️ この値は Supabase のメールテンプレートで `{{ .RedirectTo }}` として展開され、
 *    テンプレート側が末尾に `&token_hash=...&type=...` を**そのまま連結**する。
 *    したがって **戻り値は必ず `?` を含んでいなければならない**。
 *    含まないと `...confirm&token_hash=...` になり、token_hash がクエリとして
 *    解釈されず、確認が全件失敗する。
 *
 *    保証はこのヘルパー側で持つ（テンプレートに `?` の有無を判断させない）:
 *      - `next` は**必須引数**。省略すると TypeScript が弾く
 *      - `next` が "/" でも "" でも `?next=` は必ず出力される
 *      - したがって条件分岐は不要で、`?` の欠落は起こりえない
 *
 *    ⚠️ 戻り値の組み立てを「next が空なら付けない」形に最適化しないこと。
 *       クエリが消えた瞬間にメール確認が全滅する。
 */
export function confirmRedirectTo(origin: string, next: string): string {
  return `${origin}/auth/confirm?next=${encodeURIComponent(next)}`;
}
