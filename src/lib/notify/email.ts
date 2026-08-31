import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@opinio.jp";
const FROM_NAME = "opinio.jp";

type EmailParams = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail(params: EmailParams): Promise<void> {
  // dev / API キーなしの場合は console.log で代替 (mock パターン)
  if (!RESEND_API_KEY) {
    console.log("[notify] sendEmail (mock):", {
      subject: params.subject,
    });
    return;
  }

  const resend = new Resend(RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [params.to],
    subject: params.subject,
    html: params.html,
  });

  if (error) {
    console.error("[notify] sendEmail error:", error);
  }
}

// best-effort wrap (失敗してもメインフローを止めない)
export async function notify(params: EmailParams): Promise<void> {
  try {
    await sendEmail(params);
  } catch (err) {
    console.error("[notify] notify failed silently:", err);
  }
}

/**
 * ★送信の成否を**呼び出し側に返す**版（2026-08-31 追加）。
 *
 * ⚠️ **`sendEmail` / `notify` はどちらも失敗を握り潰す。**
 *    前者は Resend の `error` を console に出して `void` を返し、
 *    後者はさらに例外まで飲む。**「送れた」と「送れなかった」が区別できない。**
 *    通知（応募・面談・スカウト）はメインフローを止めない設計なのでそれでよいが、
 *    **メールが成果物そのものである経路では使えない。**
 *
 * ⚠️★**問い合わせフォームのように、送信の失敗が利用者への嘘になる経路でだけ使うこと。**
 *    握り潰す版を使うと「送信しました」と出したのに誰にも届いていない状態になり、
 *    CLAUDE.md の「入力させたのに保存しない UI を作らない」を破る。
 *
 * ⚠️ `mocked: true` は **RESEND_API_KEY が無い**という意味（dev / ローカル）。
 *    **本番でこれが返ったら設定事故**なので、呼び出し側でログに出すこと。
 *    実際には送っていないので、成功として利用者に見せてよいのは dev だけ。
 */
export type SendResult =
  | { ok: true; mocked: boolean }
  | { ok: false; error: string };

export async function sendEmailStrict(params: EmailParams): Promise<SendResult> {
  if (!RESEND_API_KEY) {
    console.warn("[notify] sendEmailStrict: RESEND_API_KEY が無いため送信していない:", params.subject);
    return { ok: true, mocked: true };
  }

  try {
    const resend = new Resend(RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    });
    if (error) {
      console.error("[notify] sendEmailStrict error:", error);
      return { ok: false, error: error.message || String(error) };
    }
    return { ok: true, mocked: false };
  } catch (err) {
    console.error("[notify] sendEmailStrict threw:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
