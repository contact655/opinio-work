import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@opinio.jp";
const FROM_NAME = "opinio.jp";

type EmailParams = {
  to: string;
  subject: string;
  html: string;
};

/**
 * ★メールの送信設定が入っているか（2026-09-10）。
 *
 * ⚠️★**値は返さない。真偽だけ。** `/api/health` からも呼ぶので、
 *    キーそのものを応答に出す形にしないこと。
 *
 * ⚠️★**起動時に落とす形にしないこと。** メールと無関係なページまで巻き込んで
 *    本番が丸ごと止まる。**送る直前に見て、その操作だけを断る。**
 */
export function hasResendKey(): boolean {
  return Boolean(RESEND_API_KEY);
}

/**
 * ★ローカル（dev）では送らない（2026-09-18）。
 *
 * ── なぜ ────────────────────────────────────────────────────────────────────
 * `.env.local` に `RESEND_API_KEY` が入っているので、**ローカルの dev でも本物が飛ぶ。**
 * 2026-09-18 に検証で運営宛に3通飛ばした。**「毎回キーを外す」は忘れる。**
 *
 * ── ★向きに注意（ここを逆にしない）────────────────────────────────────────
 * **「送信を有効にするフラグ」にしないこと。** `SCOUT_SENDING_ENABLED` と同じ形にすると、
 * **設定漏れで本番のメールが全部止まる**（応募・面談・招待・スカウト返信が13ファイルから
 * 呼んでいる）。しかも止まっても誰も気づけない。
 * → **既定で本番は必ず送る。ローカルだけ明示的に opt-in しないと送らない。**
 *
 * ⚠️★**`next start` は `NODE_ENV=production` なので送る。** dev とは違う。
 *    ローカル本番ビルドの検証では本番同等に飛ぶので、混同しないこと。
 * ⚠️ Vercel のプレビューデプロイも `NODE_ENV=production` なので**送る**（2026-09-18 時点で
 *    そのまま。厳密にするなら `VERCEL_ENV === "production"` を見る形になる）。
 * ⚠️ 呼び出しのたびに読む（モジュール読み込み時に固定しない）。検証で環境を変えて
 *    起動し直したときに、古い値が残らないようにするため。
 */
function skipInDev(subject: string): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.EMAIL_SEND_IN_DEV === "true") return false;
  /* ⚠️ キーが無いときの mock とは**別の文言**にしてある。
        「dev だから止めた」と「キーが無いから送れなかった」は原因が違う。 */
  console.log("[notify] dev のため送信していない（EMAIL_SEND_IN_DEV=true で送る）:", subject);
  return true;
}

export async function sendEmail(params: EmailParams): Promise<void> {
  if (skipInDev(params.subject)) return;

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
  /** ⚠️ `providerId` は Resend の message id。**後から問い合わせるときの唯一の手がかり**なので、
   *  記録する経路では必ず受け取ること（`mocked: true` のときは無い）。 */
  | { ok: true; mocked: boolean; providerId?: string }
  | { ok: false; error: string };

export async function sendEmailStrict(params: EmailParams): Promise<SendResult> {
  /* ⚠️ こちらも同じ扱い。**`mocked: true` を返す**（「送っていない」という意味は同じ）。
        ⚠️ `ok: false` にしないこと。問い合わせフォームが dev で失敗表示になる。 */
  if (skipInDev(params.subject)) return { ok: true, mocked: true };

  if (!RESEND_API_KEY) {
    console.warn("[notify] sendEmailStrict: RESEND_API_KEY が無いため送信していない:", params.subject);
    return { ok: true, mocked: true };
  }

  try {
    const resend = new Resend(RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    });
    if (error) {
      console.error("[notify] sendEmailStrict error:", error);
      return { ok: false, error: error.message || String(error) };
    }
    return { ok: true, mocked: false, providerId: data?.id };
  } catch (err) {
    console.error("[notify] sendEmailStrict threw:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
