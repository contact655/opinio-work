/**
 * 認証エラーの語彙。`/auth?error=<code>` で受け渡す。
 *
 * ⚠️ ルート側（/auth/confirm, /auth/callback）と表示側（/auth）が同じ定数を見る。
 *    どちらかに文字列を直書きしないこと。片方だけ増やすと
 *    「知らないコードで戻ってきて汎用文言に落ちる」が静かに起きる。
 */

export const AUTH_ERROR_CODES = [
  /** 確認リンクが無効。期限切れ・使用済み・確認済みのいずれか（後述のとおり区別できない） */
  "otp_invalid",
  /** メール未確認のままログインを試みた */
  "email_not_confirmed",
  /** token_hash / type が付いていないリンクで /auth/confirm に来た */
  "missing_token",
  /** OAuth の code 交換に失敗した */
  "exchange_failed",
  /** /auth/callback に code が無い */
  "no_code",
  /** 想定外。ログを見ること */
  "unknown",
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

export function toAuthErrorCode(raw: string | null | undefined): AuthErrorCode | null {
  if (!raw) return null;
  return (AUTH_ERROR_CODES as readonly string[]).includes(raw)
    ? (raw as AuthErrorCode)
    : "unknown";
}

export type AuthErrorDisplay = {
  title: string;
  body: string;
  /** 確認メールの再送ボタンを出すか */
  showResend: boolean;
};

/**
 * ⚠️ `otp_invalid` を「期限切れです」と言い切らないこと。
 *
 *    GoTrue はリンクをクリックした時点で先にメール確認を完了させ、
 *    そのうえでアプリにリダイレクトする。つまり `/auth/callback` の
 *    code 交換が失敗して戻ってきた人の**アカウントは既に確認済み**である
 *    （本番実測 2026-08-13: auth.users.email_confirmed_at と
 *     auth.flow_state.auth_code_issued_at がミリ秒まで一致）。
 *
 *    また確認が済んだトークンは DB から消えるため、verifyOtp からは
 *    「期限切れ」も「使用済み」も「確認済み」も同じ 403 otp_expired で返る。
 *    **区別できないものを断定しない。** 両方の可能性を示してログインへ誘導する。
 */
export const AUTH_ERROR_DISPLAY: Record<AuthErrorCode, AuthErrorDisplay> = {
  otp_invalid: {
    title: "この確認リンクは使用できません",
    body:
      "すでに確認が完了しているか、リンクの有効期限が切れています。" +
      "確認が済んでいる場合はそのままログインできます。ログインできない場合は確認メールを再送してください。",
    showResend: true,
  },
  email_not_confirmed: {
    title: "メールアドレスの確認が完了していません",
    body: "登録時にお送りした確認メールのリンクを開いてください。見当たらない場合は再送できます。",
    showResend: true,
  },
  missing_token: {
    title: "確認リンクが不完全です",
    body:
      "メールソフトによってリンクが途中で切れることがあります。" +
      "メール内のリンクをコピーしてブラウザのアドレス欄に貼り付けるか、確認メールを再送してください。",
    showResend: true,
  },
  exchange_failed: {
    title: "ログイン処理を完了できませんでした",
    body: "お手数ですが、もう一度ログインをお試しください。",
    showResend: false,
  },
  no_code: {
    title: "ログイン処理を完了できませんでした",
    body: "お手数ですが、もう一度ログインをお試しください。",
    showResend: false,
  },
  unknown: {
    title: "認証エラーが発生しました",
    body: "お手数ですが、もう一度お試しください。",
    showResend: false,
  },
};
