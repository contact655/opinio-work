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
 */
export const DEFAULT_AFTER_ONBOARDING = "/companies";

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
