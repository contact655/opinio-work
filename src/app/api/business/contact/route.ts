import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { sendEmailStrict } from "@/lib/notify/email";
import { ADMIN_EMAIL } from "@/lib/notify/templates";
import { BUSINESS_CONTACT_LIMITS } from "@/lib/constants/businessContact";

export const dynamic = "force-dynamic";

/*
 * ═══ 企業からの問い合わせ（/business/contact） ═══════════════════════════
 *
 * ⚠️★**保存先はメールだけ。DB には残らない。**
 *    問い合わせを貯めるテーブルは作っていない（運営が受けて返信するだけの導線で、
 *    一覧・ステータス管理の要件がまだ無いため）。
 *    → **したがって送信に失敗したら、その問い合わせはどこにも残らない。**
 *      `sendEmailStrict` で成否を受け、**失敗を 502 で返して画面に出す。**
 *      `notify` / `sendEmail` を使うと失敗が握り潰され、
 *      「送信しました」と出したのに誰にも届いていない状態になる。
 *
 * ⚠️ 認証は無い（企業がまだ登録していない段階で使う導線なので当然）。
 *    そのぶん、以下の3つで守る。**どれも外さないこと。**
 *      ① レート制限（IP あたり1時間5件）
 *      ② ハニーポット（`website` に値が入っていたら 204 を返して**静かに捨てる**）
 *      ③ 文字数の上限（`BUSINESS_CONTACT_LIMITS`。UI と同じ定数を見る）
 *
 * ⚠️ ②で 400 を返さないこと。エラーにするとボットに「弾かれた」と教えることになる。
 *    人間には起こりえない（`display:none` の欄なので）ので、成功と同じ見た目で捨てる。
 *
 * ⚠️★**上限値は `lib/constants/businessContact.ts` の1箇所に置く。**
 *    ここに数字を書くと UI と割れ、「入力できるのに送信で 400」になる
 *    （CLAUDE.md「UI / API / DB の CHECK を揃える」と同じ理由。
 *     DB を使わないので、この経路で揃えるのは UI と API の2層）。
 *
 * ⚠️ 返信先は利用者が入力した `email` を `Reply-To` ではなく**本文に書く**。
 *    Reply-To に外部入力をそのまま入れるとヘッダーインジェクションの面が増えるため、
 *    運営が本文を見て手で返信する運用にしてある。
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** 最低限の形式チェック。厳密な検証はしない（正規表現で弾きすぎると実在の宛先を落とす） */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** 改行を保ったまま HTML にする（本文用） */
const escMultiline = (s: string) => esc(s).replace(/\r?\n/g, "<br />");

type Field = { key: string; label: string; required: boolean; max: number };

const FIELDS: Field[] = [
  { key: "company", label: "会社名",       required: true,  max: BUSINESS_CONTACT_LIMITS.company },
  { key: "name",    label: "お名前",       required: true,  max: BUSINESS_CONTACT_LIMITS.name },
  { key: "email",   label: "メールアドレス", required: true,  max: BUSINESS_CONTACT_LIMITS.email },
  { key: "phone",   label: "電話番号",     required: false, max: BUSINESS_CONTACT_LIMITS.phone },
  { key: "message", label: "ご相談内容",   required: true,  max: BUSINESS_CONTACT_LIMITS.message },
];

export async function POST(req: NextRequest) {
  const allowed = await checkRateLimit(req, { limit: 5, windowSec: 3600, prefix: "biz-contact" });
  if (!allowed) {
    return NextResponse.json(
      { error: "送信が続いています。しばらく時間をおいてからお試しください。" },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストの形式が正しくありません。" }, { status: 400 });
  }

  /* ② ハニーポット。人間には見えない欄なので、埋まっていればボット。
        ⚠️ 成功と同じ 200 を返す（弾いたことを教えない）。 */
  if (typeof body.website === "string" && body.website.trim() !== "") {
    console.warn("[biz-contact] honeypot に入力があったため破棄した");
    return NextResponse.json({ ok: true });
  }

  const values: Record<string, string> = {};
  for (const f of FIELDS) {
    const raw = body[f.key];
    const v = typeof raw === "string" ? raw.trim() : "";
    if (f.required && v === "") {
      return NextResponse.json({ error: `${f.label}を入力してください。` }, { status: 400 });
    }
    if (v.length > f.max) {
      return NextResponse.json({ error: `${f.label}は${f.max}文字以内で入力してください。` }, { status: 400 });
    }
    values[f.key] = v;
  }

  if (!EMAIL_RE.test(values.email)) {
    return NextResponse.json({ error: "メールアドレスの形式が正しくありません。" }, { status: 400 });
  }

  const rows = FIELDS
    .filter((f) => values[f.key] !== "")
    .map((f) => `
      <tr>
        <td style="padding:8px 14px 8px 0;vertical-align:top;color:#475569;white-space:nowrap;">${esc(f.label)}</td>
        <td style="padding:8px 0;vertical-align:top;color:#0f172a;">${
          f.key === "message" ? escMultiline(values[f.key]) : esc(values[f.key])
        }</td>
      </tr>`)
    .join("");

  const html = `
    <div style="font-family:sans-serif;line-height:1.8;color:#0f172a;">
      <p style="margin:0 0 16px;">企業向けページ（/business/contact）から問い合わせが届きました。</p>
      <table style="border-collapse:collapse;font-size:14px;">${rows}</table>
      <p style="margin:20px 0 0;font-size:12px;color:#475569;">
        返信は上記のメールアドレス宛に手動でお願いします（このメールに返信しても届きません）。
      </p>
    </div>`;

  const result = await sendEmailStrict({
    to: ADMIN_EMAIL,
    subject: `【企業問い合わせ】${values.company}（${values.name} 様）`,
    html,
  });

  if (!result.ok) {
    /* ⚠️ ここで 200 を返さないこと。保存先がメールしか無いので、
          失敗を隠すと問い合わせが**どこにも残らないまま**「送信しました」になる。 */
    console.error("[biz-contact] 送信に失敗した:", result.error);
    return NextResponse.json(
      { error: "送信に失敗しました。お手数ですが contact@opinio.co.jp まで直接ご連絡ください。" },
      { status: 502 },
    );
  }

  if (result.mocked) {
    /* RESEND_API_KEY が無い環境。dev では正常だが、本番でこれが出たら設定事故。 */
    console.warn("[biz-contact] RESEND_API_KEY が無いため実際には送信していない");
  }

  return NextResponse.json({ ok: true });
}
