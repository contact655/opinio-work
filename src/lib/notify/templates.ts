import { companyMatchLabelForAdmin } from "@/lib/companies/matchedOn";
import { greetingName } from "@/lib/constants/personName";
/** 運営の宛先。⚠️ 新しい持ち方を作らない。既存の3テンプレートと同じこれを使う。 */
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "contact@opinio.co.jp";

/* ★送信者情報（2026-09-10 に共通フッターへ入れた）。
   ⚠️★**すべて「サイトに既出の表記」をそのまま写している。ここで書き起こさないこと。**
        出どころ: content/legal/privacy-policy.md「1. 事業者情報」／ content/legal/legal-agency.md
        変えるときは、まずそちらを直してからここを合わせる（逆をやると表記が割れる）。
   ⚠️ 受信拒否の連絡先は `ADMIN_EMAIL` を使わない。あちらは環境変数で運営の作業用アドレスに
      差し替えられるので、**公開している窓口と別のものになりうる。**
   ⚠️ 有料職業紹介事業許可番号（13-ユ-316441）は**入れていない**。理由と要否の確認状況は
      docs/scout-email-20260910.md を参照。 */
const SENDER_NAME = "株式会社Opinio";
const SENDER_ADDRESS = "東京都港区赤坂2-21-4 天翔赤坂ANNEXビル4階 404-C号室";
const SENDER_CONTACT_EMAIL = "contact@opinio.co.jp";

/**
 * ★企業に担当者がいないため運営に回ってきた通知に付ける印（2026-08-23）。
 *
 * ⚠️ **印を付けるかどうかは `getCompanyNotificationTarget()` の `viaOps` から出す。**
 *    各テンプレートで「宛先が運営かどうか」を判定し直さないこと。
 *    フォールバックの分岐と印の分岐が別々になると、片方だけ直って**嘘の印**になる。
 *
 * ⚠️ これが無いと、運営は毎回「この通知は自分宛なのか、企業にも届いているのか」を
 *    判断することになる。3種類のメールが同じ受信箱に混ざるので、印が無いと仕分けできない。
 */
export const OPS_SUBJECT_PREFIX = "【担当者未登録】";

/** 運営宛のときだけ本文の先頭に差し込む1行 */
export function opsFallbackNotice(viaOps: boolean): string {
  if (!viaOps) return "";
  return `<p style="margin:0 0 16px;padding:10px 14px;background:#FEF3C7;border:1px solid #FCD34D;border-radius:8px;font-size:13px;color:#92400e">
    この企業には OPINIO の担当者が登録されていないため、運営に届いています。
  </p>`;
}

/** 運営宛のときだけ件名に印を付ける */
export function opsSubject(subject: string, viaOps: boolean): string {
  return viaOps ? `${OPS_SUBJECT_PREFIX}${subject}` : subject;
}

// HTML escape — prevents injection of user-supplied strings into email bodies
/**
 * ★メールの呼びかけ（宛名）。**名前が使えないときは空文字＝行ごと出さない。**
 *
 * ⚠️★**「 さん」「ユーザー さん」を作らないこと。** 判定は
 *    [`greetingName`](@/lib/constants/personName) の1箇所に置いてある
 *    （空・空白だけ・`ユーザー`（`PLACEHOLDER_USER_NAME`）を弾く）。
 *    `ユーザー` は `ow_users.name` のプレースホルダで、**人の名前ではない**
 *    （DB トリガー `handle_new_ow_user` と `lib/auth/linkOwUser.ts` が入れる）。
 *
 * ⚠️★**「ご担当者」などのフォールバックを足さないこと。** 本人が入れていない呼び方を
 *    本人の名前として使うことになる。**出さないほうがよい。**
 *
 * ── 形（`as`）──────────────────────────────────────────────────────────────
 *   `h2`     … 見出しとして単独で置く      → `<h2>◯◯ さん</h2>`
 *   `line`   … 段落として単独で置く        → `<p>◯◯ さん、</p>`
 *   `inline` … 段落の先頭に差し込む        → `◯◯ さん<br><br>`
 *
 * ⚠️★**新しいメールを足すときは必ずここを通すこと。**
 *    `${esc(params.userName)} さん` と素で書くと、名前が無い人に「 さん」が出る。
 *
 * ⚠️★**第三者への言及（「◯◯さんが〜しています」）には使わない。**
 *    あれは宛名ではないので、消すと文が成り立たない。
 *    `joinRequestTemplate` のように、**名前が無いときの別の言い回し**を用意すること。
 */
function greet(raw: string | null | undefined, as: "h2" | "line" | "inline"): string {
  const name = greetingName(raw);
  if (!name) return "";
  if (as === "h2") return `<h2>${esc(name)} さん</h2>`;
  if (as === "line") return `<p>${esc(name)} さん、</p>`;
  return `${esc(name)} さん<br><br>`;
}

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Shared inline styles ───────────────────────────────────────────────────────
const TD_LABEL = "padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;width:120px;vertical-align:top;font-size:13px";
const TD_VALUE = "padding:8px 12px;border:1px solid #e2e8f0;font-size:13px";
const BTN     = "display:inline-block;background:#002366;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px";

/**
 * ★メールで**白文字を載せる緑の塗り**（2026-09-21 に追加）。
 *
 * ⚠️★**globals.css の `--success-strong` と同値。片方だけ変えないこと。**
 *    メールHTMLでは CSS 変数が効かないので hex を直書きするしかなく、二重管理になっている
 *    （globals.css が挙げている「hex で書いてよい例外」がここ）。
 *
 * ⚠️★**`#059669`（= `--success`）に戻さないこと。** あれに白文字は **3.77** で、
 *    13px の文字に必要な 4.5 に届かない（白 on #047857 = **5.48**）。
 *    ⚠️ `--success` のままでよいのは**アイコン・図形**（WCAG 1.4.11 の 3.0）だけ。
 *
 * ⚠️ 色だけを定数にしてある。週次2本で padding と font-weight が違うので、
 *    `BTN` のように1本の style 文字列に畳むと**見た目が変わる。**
 */
export const MAIL_SUCCESS_FILL = "#047857";

/**
 * ★メールで**白文字を載せる黄色の塗り**（2026-09-21 に追加）。
 *
 * ⚠️★**`#F59E0B` を含むグラデーションに戻さないこと。** 明るい側のストップに白文字で
 *    **2.15**、暗い側の `#D97706` でも **3.19** で、どちらも 4.5 に届かない。
 *    いまは明るい側 `#B45309` で **5.02**、暗い側 `#92400E` で **7.09**。
 *
 * ⚠️ 暗い側は globals.css の `--warm-strong` と同値。メールでは CSS 変数が効かない。
 * ⚠️ `lib/constants/meetingCta.ts`（カジュアル面談CTA）とは**別物**。
 *    あちらは 2026-09-06 に「橙を保ち、文字を濃くする」で決着しており、混ぜないこと。
 */
export const MAIL_WARM_GRADIENT = "linear-gradient(135deg,#B45309,#92400E)";

/**
 * ★送信者の表示（名称・住所・受信拒否の連絡先）。**消さないこと**（2026-09-10）。
 *
 * ⚠️★**`htmlWrap()` を通らないメールにも、これを末尾に付けること。**
 *    共通ラッパーを通らない外部宛のメールが4本ある（招待・ウェルカム・週次2本）ので、
 *    そちらは各ファイルでこの関数を呼んでいる。**新しくメールを足すときは
 *    `htmlWrap()` を通すか、通さないならこれを付ける。**
 */
export function senderFooterHtml(): string {
  return `<p style="margin:12px 0 0;padding-top:12px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;line-height:1.7">
      ${esc(SENDER_NAME)}<br>
      ${esc(SENDER_ADDRESS)}<br>
      受信拒否のご連絡: <a href="mailto:${SENDER_CONTACT_EMAIL}" style="color:#94a3b8">${SENDER_CONTACT_EMAIL}</a>
    </p>`;
}

// ── 共通 HTML wrapper ──────────────────────────────────────────────────────────
function htmlWrap(content: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans JP',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
        <tr>
          <td style="background:linear-gradient(135deg,#002366,#3B5FD9);padding:28px 40px">
            <!-- ⚠️ メールに SVG を貼らない（Gmail は落とし、Outlook は描かない）。PNG を絶対URLで。
                 ⚠️ alt を消さないこと。画像をブロックする受信者にはこれが唯一のロゴになる。
                 ⚠️ width / height を属性で書く。Outlook は CSS のサイズを無視する。 -->
            <img src="https://opinio.jp/brand/opinio-logo-horizontal-white@2x.png" alt="OPINIO"
                 width="111" height="29"
                 style="display:inline-block;border:0;outline:none;text-decoration:none;font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.02em;vertical-align:middle">
            <span style="font-size:11px;color:rgba(255,255,255,0.7);margin-left:12px">IT業界のキャリアインフラ</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;color:#0f172a;line-height:1.7;font-size:14px">
            ${content}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px 28px;background:#f8fafc;border-top:1px solid #e2e8f0">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.7">
              このメールは <a href="https://opinio.jp" style="color:#3B5FD9">opinio.jp</a> から自動送信されています。<br>
              心当たりのない場合は、このメールを無視してください。
            </p>
            ${senderFooterHtml()}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── T3: カジュアル面談申込 ────────────────────────────────────────────────────

// T3 admin 宛
export function casualMeetingAdminTemplate(params: {
  companyName: string;
  contactEmail: string;
  intent: string | null;
  interestReason: string | null;
  questions: string | null;
}) {
  const intentLabel: Record<string, string> = {
    info_gathering: "情報収集中",
    good_opportunity: "良い機会があれば",
    within_6: "6ヶ月以内に転職検討",
    within_3: "3ヶ月以内に転職検討",
  };

  return {
    to: ADMIN_EMAIL,
    subject: `【新着カジュアル面談】${params.companyName} への申し込みがありました`,
    html: htmlWrap(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#002366">新着カジュアル面談</h2>
      <p style="margin:0 0 20px;color:#475569"><strong style="color:#0f172a">${params.companyName}</strong> へのカジュアル面談申し込みがありました。</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px">
        <tr><td style="${TD_LABEL}">申込者</td><td style="${TD_VALUE}">${esc(params.contactEmail)}</td></tr>
        ${params.intent ? `<tr><td style="${TD_LABEL}">転職意向</td><td style="${TD_VALUE}">${esc(intentLabel[params.intent] ?? params.intent)}</td></tr>` : "" /* ★申込フォームで聞くのをやめた（2026-10-18）。無ければ行ごと出さない */}
        <tr><td style="${TD_LABEL}">志望理由</td><td style="${TD_VALUE}">${esc(params.interestReason) || "（未記入）"}</td></tr>
        <tr><td style="${TD_LABEL}">質問内容</td><td style="${TD_VALUE}">${esc(params.questions) || "（未記入）"}</td></tr>
      </table>
      <a href="https://opinio.jp/biz/meetings" style="${BTN}">管理画面で確認する →</a>
    `),
  };
}

/**
 * ★企業からの「在籍していない人」報告を運営に知らせる（2026-09-18 / C-7）。
 *
 * ⚠️★**宛先は `ADMIN_EMAIL`。** 上の3本（新規企業・カジュアル面談・応募）と同じ持ち方に
 *    揃える。**新しい宛先の持ち方を作らない。**
 * ⚠️★**週次メールの停止（`WEEKLY_EMAIL_ENABLED` / `vercel.json` の `crons`）とは無関係。**
 *    止まっているのは cron の2本で、`sendEmail` 自体は動いている（上の3本は今も送る）。
 *    停止の理由（マッチ度の根拠なし・配信停止が無い・宛先にバウンス・時限式）は
 *    **運営宛の単発通知には1つも当てはまらない。**
 * ⚠️ 再報告のたびに送る。却下後に状況が変わって再報告されるのは、運営が知りたい場面。
 *    ⚠️ 企業が押し直しても**未対応の行は1つしか作れない**ので、同じ報告で何通も飛ばない。
 */
/**
 * ★検証用アカウントの取り残しを運営に知らせる（2026-09-28）。
 *
 * ⚠️★**0件のときは呼ばないこと。** 「今日も0件でした」を毎日送ると読まれなくなり、
 *    本当に出た日の1通が埋もれる。呼び出し側（日次 cron）が件数で出し分ける。
 * ⚠️★**宛名を付けない。** 運営への通知で、個人宛ではない
 *    （`greetingName()` は人に呼びかけるときだけ）。
 * ⚠️ 倒す操作はここからさせない。**`/admin` を見て、人が migration を書く。**
 */
/**
 * ★「あなたに合う会社」（下段）で、担当者のいない企業に「話を聞いてみたい」（記録上は interested）が押された（2026-10-15）。1件ずつ運営へ。
 * ⚠️ 件名は【興味あり・担当者未登録】＋社名（柴さんの指示）。検証用アカウントなら先頭に【検証】。
 * ⚠️ 組み立てと送信は lib/forYou/notifyOps.ts の1か所から呼ぶ（1日10件を超えたらまとめての通知に切り替える前提）。
 */
export function forYouInterestOpsTemplate(params: {
  companyId: string;
  companyName: string;
  candidateName: string | null;
  rank: number | null;
  reasons: string[];
  /** どこから押したか（for_you / company_page / proposal） */
  source?: string;
  /** 押した人が検証用アカウントか */
  candidateIsTest: boolean;
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://opinio.jp";
  const name = greetingName(params.candidateName);
  const who = name ? `${name}さん` : "利用者の方";
  return {
    to: ADMIN_EMAIL,
    subject: `${params.candidateIsTest ? "【検証】" : ""}【興味あり・担当者未登録】${params.companyName}`,
    html: htmlWrap(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#002366">担当者のいない企業に「興味あり」が届きました</h2>
      <p style="margin:0 0 20px;color:#475569">
        ${esc(who)}が${params.source === "company_page" ? "企業ページ" : "「あなたに合う会社」"}で <strong style="color:#0f172a">${esc(params.companyName)}</strong> に「話を聞いてみたい」を押しました。
        この企業には OPINIO の担当者が登録されていないため、運営に届いています。担当者が登録されたら、押してから90日以内の分は自動でこの企業に届きます。
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px">
        <tr><td style="${TD_LABEL}">企業</td><td style="${TD_VALUE}">${esc(params.companyName)}</td></tr>
        <tr><td style="${TD_LABEL}">押した人</td><td style="${TD_VALUE}">${esc(who)}${params.candidateIsTest ? "（検証用アカウント）" : ""}</td></tr>
        ${params.rank != null ? `<tr><td style="${TD_LABEL}">押した時点の順位</td><td style="${TD_VALUE}">${params.rank}位</td></tr>` : ""}
        ${params.reasons.length > 0 ? `<tr><td style="${TD_LABEL}">表示した理由</td><td style="${TD_VALUE}">${params.reasons.map(esc).join("<br>")}</td></tr>` : ""}
      </table>
      <p style="margin:0 0 20px;color:#475569;font-size:13px">
        ⚠️ 企業へ連絡するときに使えるのは、人数の幅（1〜4人／5〜9人／10人以上）と、業界・職種の大分類の傾向（3人以上の項目だけ）まで。押した人の名前とひとことは企業に渡さないでください（運営画面「話を聞きたい人（担当者の登録待ち）」に一覧があります）。
      </p>
      <a href="${siteUrl}/admin/interests" style="${BTN}">「話を聞きたい人」の一覧を開く →</a>
      <p style="margin:12px 0 0"><a href="${siteUrl}/admin/companies/${params.companyId}" style="color:#002366">運営画面で企業を開く</a></p>
    `),
  };
}

export function testLeftoversAdminTemplate(params: {
  users: string[];
  companies: { name: string; createdBy: string | null }[];
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://opinio.jp";
  const total = params.users.length + params.companies.length;
  const li = (t: string) => `<li style="margin:0 0 4px">${esc(t)}</li>`;
  return {
    to: ADMIN_EMAIL,
    subject: `【要対応】is_test を立て忘れている行が ${total}件あります`,
    html: htmlWrap(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#002366">検証用アカウントの取り残し</h2>
      <p style="margin:0 0 20px;color:#475569">
        実ユーザー・実企業として数えられています。<strong>0件が正常です。</strong>
      </p>
      ${params.users.length > 0 ? `
      <p style="margin:0 0 6px;font-weight:700;color:#0f172a">利用者 ${params.users.length}件</p>
      <ul style="margin:0 0 16px;padding-left:20px;color:#475569">${params.users.map(li).join("")}</ul>` : ""}
      ${params.companies.length > 0 ? `
      <p style="margin:0 0 6px;font-weight:700;color:#0f172a">企業 ${params.companies.length}件</p>
      <ul style="margin:0 0 16px;padding-left:20px;color:#475569">
        ${params.companies.map((c) => li(`${c.name}（作成: ${c.createdBy ?? "不明"}）`)).join("")}
      </ul>` : ""}
      <p style="margin:0 0 20px;color:#475569">
        倒すときは <strong>id / email を明示列挙した migration</strong> で行ってください。
        まとめて倒すと実在の利用者・企業を巻き込みます。
      </p>
      <p style="margin:0"><a href="${siteUrl}/admin" style="color:#002366">運営ダッシュボードを開く</a></p>
    `),
  };
}

export function memberReportAdminTemplate(params: {
  companyName: string;
  /** 対象者の氏名。⚠️ 取れないことがある（経歴が消えた等）ので null を許す */
  personName: string | null;
  /** 「在籍したことがない」などのラベル。⚠️ 生値（never_employed）を入れないこと */
  reasonLabel: string | null;
  /** 企業が書いた補足（任意） */
  note: string | null;
  reportedAt: string;
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://opinio.jp";
  return {
    to: ADMIN_EMAIL,
    subject: `【在籍報告】${params.companyName} から「在籍していない人」の報告がありました`,
    html: htmlWrap(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#002366">在籍していない人の報告</h2>
      <p style="margin:0 0 20px;color:#475569">
        <strong style="color:#0f172a">${esc(params.companyName)}</strong> から、自社ページに出ている人について報告がありました。
        <strong>この報告だけでは何も変わりません。</strong>外すかどうかは運営が判断します。
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px">
        <tr><td style="${TD_LABEL}">企業</td><td style="${TD_VALUE}">${esc(params.companyName)}</td></tr>
        ${/* ⚠️ 値が無ければ行ごと出さない（「不明」で埋めない） */""}
        ${params.personName ? `<tr><td style="${TD_LABEL}">対象者</td><td style="${TD_VALUE}">${esc(params.personName)}</td></tr>` : ""}
        ${params.reasonLabel ? `<tr><td style="${TD_LABEL}">理由</td><td style="${TD_VALUE}">${esc(params.reasonLabel)}</td></tr>` : ""}
        ${params.note ? `<tr><td style="${TD_LABEL}">補足</td><td style="${TD_VALUE}">${esc(params.note)}</td></tr>` : ""}
        <tr><td style="${TD_LABEL}">報告日時</td><td style="${TD_VALUE}">${new Date(params.reportedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</td></tr>
      </table>
      <a href="${siteUrl}/admin/member-reports" style="${BTN}">運営画面で確認する →</a>
    `),
  };
}

/**
 * 企業が `/biz/company` の「掲載を依頼する」を押したときに運営へ届く（2026-09-29）。
 *
 * ⚠️★**このメールは正ではない。** 依頼の記録は `ow_companies.listing_requested_at` で、
 *    `/admin` の要対応タスクと `/admin/companies` にも出る。
 *    **メールを見落としても追える**ので、送信は best-effort でよい
 *    （`/business/contact` は逆に**メールしか無い**ので `sendEmailStrict`。混同しないこと）。
 *
 * ⚠️ 押した人の氏名とメールは**ここにしか残らない。**
 *    `ow_companies` は SELECT が anon にテーブルレベルなので、列としては持っていない
 *    （migration `20260929010000` の理由を参照）。**この2行を消さないこと。**
 */
export function listingRequestAdminTemplate(params: {
  companyId: string;
  companyName: string;
  /** 押した担当者。⚠️ 名前が無い人がいる（`greetingName` が null を返す形）ので null を許す */
  requesterName: string | null;
  requesterEmail: string | null;
  requestedAt: string;
  /** 公開ゲート（業種・主の事業領域）で足りていないもの。空なら「無し」 */
  blockers: string[];
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://opinio.jp";
  return {
    to: ADMIN_EMAIL,
    subject: `【掲載依頼】${params.companyName} から掲載の依頼がありました`,
    html: htmlWrap(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#002366">掲載の依頼</h2>
      <p style="margin:0 0 20px;color:#475569">
        <strong style="color:#0f172a">${esc(params.companyName)}</strong> が
        <strong>掲載を依頼する</strong>を押しました。<strong>掲載はまだ始まっていません。</strong>
        運営が内容を確認して掲載状態を切り替えてください。
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px">
        <tr><td style="${TD_LABEL}">企業</td><td style="${TD_VALUE}">${esc(params.companyName)}</td></tr>
        ${/* ⚠️ 値が無ければ行ごと出さない（「不明」で埋めない） */""}
        ${params.requesterName ? `<tr><td style="${TD_LABEL}">依頼した人</td><td style="${TD_VALUE}">${esc(params.requesterName)}</td></tr>` : ""}
        ${params.requesterEmail ? `<tr><td style="${TD_LABEL}">連絡先</td><td style="${TD_VALUE}">${esc(params.requesterEmail)}</td></tr>` : ""}
        <tr><td style="${TD_LABEL}">依頼日時</td><td style="${TD_VALUE}">${new Date(params.requestedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</td></tr>
        ${/* ★足りないものを先に知らせる。運営が画面を開いてから気づくと一往復増える */""}
        ${params.blockers.length > 0
          ? `<tr><td style="${TD_LABEL}">掲載前に必要</td><td style="${TD_VALUE}">${esc(params.blockers.join(" / "))}</td></tr>`
          : ""}
      </table>
      <a href="${siteUrl}/admin/companies/${params.companyId}" style="${BTN}">運営画面で確認する →</a>
    `),
  };
}

// T3 申込者宛
export function casualMeetingUserTemplate(params: {
  to: string;
  companyName: string;
}) {
  return {
    to: params.to,
    subject: `【opinio.jp】${params.companyName} へのカジュアル面談申し込みを受け付けました`,
    html: htmlWrap(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#002366">申し込みを受け付けました</h2>
      <p style="margin:0 0 16px;color:#475569">
        <strong style="color:#0f172a">${params.companyName}</strong> へのカジュアル面談申し込みありがとうございます。
      </p>
      <div style="background:#eff3fc;border-radius:8px;padding:16px 20px;margin-bottom:24px;border-left:3px solid #002366">
        <p style="margin:0;font-size:13px;color:#334155;line-height:1.7">
          ✅ 編集部が内容を確認し、<strong>3営業日以内</strong>にご連絡いたします。<br>
          しばらくお待ちください。
        </p>
      </div>
      <a href="https://opinio.jp/mypage" style="${BTN}">マイページで状況を確認する →</a>
    `),
  };
}

// ── T4: 面談ステータス変更（申込者宛のみ）────────────────────────────────────

export function meetingStatusTemplate(params: {
  to: string;
  companyName: string;
  status: "company_contacted" | "scheduled" | "declined";
}) {
  const subjects: Record<string, string> = {
    company_contacted: `【opinio.jp】${params.companyName} から返信が届きました`,
    scheduled: `【opinio.jp】${params.companyName} とのカジュアル面談の日程が決まりました`,
    declined: `【opinio.jp】${params.companyName} からカジュアル面談に関するご連絡`,
  };
  const messages: Record<string, string> = {
    company_contacted: `${params.companyName} から返信が届きました。マイページから内容をご確認ください。`,
    scheduled: `${params.companyName} とのカジュアル面談の日程が確定しました。マイページから詳細をご確認ください。`,
    declined: `${params.companyName} からカジュアル面談に関するご連絡があります。マイページから詳細をご確認ください。`,
  };

  const subject = subjects[params.status];
  const message = messages[params.status];

  return {
    to: params.to,
    subject,
    html: htmlWrap(`
      <h2>${subject.replace("【opinio.jp】", "")}</h2>
      <p>${message}</p>
      <p><a href="https://opinio.jp/mypage">マイページで確認する →</a></p>
    `),
  };
}

// ── T1: 求人応募申込 ──────────────────────────────────────────────────────────

// T1 admin 宛
export function applicationAdminTemplate(params: {
  companyName: string;
  jobTitle: string;
  applicantName: string;
  applicantEmail: string;
  message: string | null;
}) {
  return {
    to: ADMIN_EMAIL,
    subject: `【新着応募】${params.companyName} / ${params.jobTitle} に応募がありました`,
    html: htmlWrap(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#002366">新着求人応募</h2>
      <p style="margin:0 0 20px;color:#475569"><strong style="color:#0f172a">${esc(params.companyName)}</strong>「${esc(params.jobTitle)}」への応募がありました。</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px">
        <tr><td style="${TD_LABEL}">応募者</td><td style="${TD_VALUE}">${esc(params.applicantName)}（${esc(params.applicantEmail)}）</td></tr>
        <tr><td style="${TD_LABEL}">志望動機</td><td style="${TD_VALUE}">${esc(params.message) || "（未記入）"}</td></tr>
      </table>
      <a href="https://opinio.jp/biz/applications" style="${BTN}">応募管理で確認する →</a>
    `),
  };
}

// T1 企業宛（ow_companies.notification_emails）
//
// ⚠️ applicationAdminTemplate を流用しないこと。あちらは to が ADMIN_EMAIL 固定で、
//    本文も「{企業名}「{求人}」への応募がありました」と第三者視点で書かれている。
//    企業本人に自社名を三人称で伝える形になるので、宛先ごと分けている。
// ⚠️ 応募者のメールアドレスは載せる。企業が連絡を取るために必要で、
//    /biz/applications でも同じものが見えている。
export function applicationCompanyTemplate(params: {
  to: string;
  jobTitle: string;
  applicantName: string;
  applicantEmail: string;
  message: string | null;
  /** 運営に回った通知か。⚠️ getCompanyNotificationTarget の viaOps をそのまま渡す */
  viaOps?: boolean;
}) {
  return {
    to: params.to,
    subject: opsSubject(`【新着応募】「${params.jobTitle}」に応募がありました`, params.viaOps === true),
    html: htmlWrap(`${opsFallbackNotice(params.viaOps === true)}
      <h2 style="margin:0 0 8px;font-size:20px;color:#002366">応募が届きました</h2>
      <p style="margin:0 0 20px;color:#475569">「${esc(params.jobTitle)}」に新しい応募がありました。</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px">
        <tr><td style="${TD_LABEL}">応募者</td><td style="${TD_VALUE}">${esc(params.applicantName)}（${esc(params.applicantEmail)}）</td></tr>
        <tr><td style="${TD_LABEL}">志望動機</td><td style="${TD_VALUE}">${esc(params.message) || "（未記入）"}</td></tr>
      </table>
      <a href="https://opinio.jp/biz/applications" style="${BTN}">応募管理で確認する →</a>
      <p style="margin:20px 0 0;font-size:12px;color:#94a3b8">
        この通知の宛先は、企業情報の「通知メールアドレス」で変更できます。
      </p>
    `),
  };
}

/**
 * ★企業からのメッセージリクエストに求職者が返信した（2026-10-10。2026-10-11 に「承認」から「返信」へ）。宛先は企業（声かけを送った担当者、
 *   届かなければ `getCompanyNotificationTarget` の決め方）。
 *
 * ⚠️★**会話の内容を書かない。** 名前と会話を開くリンクだけ（柴さんの指示）。
 * ⚠️★**見送られたときは送らない。** 企業から見て「返事待ち」のままにする決まり。
 * ⚠️ 求職者の名前は**第三者への言及**なので `greet()` は使わない。名前が使えないときは別の言い回しにする。
 * ⚠️ 「スカウト」と呼ばない。
 */
export function approachRepliedCompanyTemplate(params: {
  to: string;
  candidateName: string | null | undefined;
  conversationId: string;
  /** 運営に回った通知か。⚠️ getCompanyNotificationTarget の viaOps をそのまま渡す */
  viaOps?: boolean;
}) {
  const name = greetingName(params.candidateName);
  const who = name ? `${name}さん` : "メッセージを送った方";
  /* ★件名・本文は柴さんの指示（2026-10-11）。⚠️★返信の中身は書かない（名前と会話へのリンクだけ） */
  return {
    to: params.to,
    subject: opsSubject(`${who}から返信がありました`, params.viaOps === true),
    html: htmlWrap(`${opsFallbackNotice(params.viaOps === true)}
      <h2 style="margin:0 0 8px;font-size:20px;color:#002366">返信がありました</h2>
      <p style="margin:0 0 20px;color:#475569">${esc(who)}から返信がありました。そのままメッセージでやり取りできます。</p>
      <a href="https://opinio.jp/biz/messages/${encodeURIComponent(params.conversationId)}" style="${BTN}">メッセージを開く →</a>
    `),
  };
}

/**
 * ★運営が求人を停止したことを企業に知らせる（2026-10-12 / 柴さんの指示。即時公開に切り替え、運営は公開後に巡回する）。
 * ⚠️ 理由は全文入れる（企業が直すために要る）。宛先は getCompanyNotificationTarget（応募の通知と同じ決め方）。
 */
/**
 * ★運営が求人を停止した／再開の依頼を見送ったことを企業に知らせる（2026-10-12）。
 *   kind: "stop" … 停止した ／ "decline_reopen" … 再開の依頼を見送り、停止中のまま（理由を更新）
 * ⚠️ 画面の呼び方（停止中・再開を依頼する）と揃える。「運営確認中」「非公開」と書かない
 */
export function jobStoppedCompanyTemplate(params: { to: string; jobTitle: string; reason: string; jobId: string; viaOps?: boolean; kind?: "stop" | "decline_reopen" }) {
  const decline = params.kind === "decline_reopen";
  return {
    to: params.to,
    subject: opsSubject(decline ? `求人「${params.jobTitle}」の再開を見送りました` : `求人「${params.jobTitle}」の掲載を停止しました`, params.viaOps === true),
    html: htmlWrap(`${opsFallbackNotice(params.viaOps === true)}
      <h2 style="margin:0 0 8px;font-size:20px;color:#002366">${decline ? "求人の再開を見送りました" : "求人の掲載を停止しました"}</h2>
      <p style="margin:0 0 12px;color:#475569">${decline
        ? `OPINIO 運営が内容を確認し、次の理由で求人「${esc(params.jobTitle)}」の再開を見送りました。停止中のままです。`
        : `OPINIO 運営が内容を確認し、次の理由で求人「${esc(params.jobTitle)}」の掲載を停止しました。`}</p>
      <p style="margin:0 0 20px;padding:12px 14px;background:#F8FAFC;border-radius:8px;color:#0F172A;white-space:pre-wrap">${esc(params.reason)}</p>
      <p style="margin:0 0 20px;color:#475569">内容を直して、求人管理の「再開を依頼する」を押すと、運営が確認したうえで掲載を再開します。</p>
      <a href="https://opinio.jp/biz/jobs/${encodeURIComponent(params.jobId)}/edit" style="${BTN}">求人を直す →</a>
    `),
  };
}

/**
 * ★企業からメッセージが届いたことを求職者に知らせる（2026-10-11 / 柴さんの指示）。
 *   approach … 企業からの1通目。**送った理由の冒頭だけ**を入れる
 *   reply … 会話で企業から返信があった
 * ⚠️★**本文全体はメールに入れない。** 続きは OPINIO で読む形（理由の冒頭まで）。返信の中身は1文字も入れない。
 * ⚠️ 送るかどうか（設定・30分まとめ・実在の利用者への開始）は lib/notify/companyMessageEmail.ts が決める。ここは文面だけ。
 */
export const COMPANY_MESSAGE_REASON_PREVIEW_CHARS = 60;

export function companyMessageCandidateTemplate(params: {
  to: string;
  userName: string | null | undefined;
  companyName: string;
  kind: "approach" | "reply";
  /** approach のときだけ。⚠️ 全文を渡してよい（ここで冒頭だけに切る） */
  reason?: string | null;
  /** 開く先（https://opinio.jp/… の絶対 URL） */
  url: string;
  /** ★ログインせずにこのお知らせを止めるリンク（lib/notify/unsubscribe.ts。2026-10-20）。無ければ設定へのリンクだけ */
  stopUrl?: string | null;
}) {
  const co = params.companyName;
  const flat = (params.reason ?? "").replace(/\s+/g, " ").trim();
  const preview = flat.length > COMPANY_MESSAGE_REASON_PREVIEW_CHARS ? `${flat.slice(0, COMPANY_MESSAGE_REASON_PREVIEW_CHARS)}…` : flat;
  const subject = `${co}からメッセージが届きました`;
  const lead = params.kind === "approach" ? `${co}から、理由を添えたメッセージが届きました。` : `${co}から、新しいメッセージが届きました。`;
  const button = params.kind === "approach" ? "OPINIOで読む →" : "メッセージを開く →";
  return {
    to: params.to,
    subject,
    html: htmlWrap(`${greet(params.userName, "line")}
      <p style="margin:0 0 16px;color:#475569">${esc(lead)}</p>
      ${params.kind === "approach" && preview ? `<div style="margin:0 0 20px;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;color:#334155">
        <div style="font-size:11px;color:#94a3b8;margin-bottom:4px">送った理由（冒頭）</div>${esc(preview)}</div>` : ""}
      <a href="${esc(params.url)}" style="${BTN}">${button}</a>
      <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;line-height:1.7">
        このあと30分以内に同じ相手から届いたメッセージは、改めてお知らせしません。OPINIO でまとめてご覧ください。<br>
        ${params.stopUrl ? `<a href="${esc(params.stopUrl)}" style="color:#94a3b8">このお知らせを止める</a>（ログインは要りません）／` : ""}<a href="https://opinio.jp/mypage/settings" style="color:#94a3b8">設定</a> の「企業からのメッセージをメールで受け取る」でも止められます。
        企業からのメッセージそのものを止めるには、マイページの「転職の状況」で「転職意欲」を「今は考えていない」にしてください。
      </p>
    `),
  };
}

/**
 * ★個人からメッセージが届いたことを知らせる（2026-10-20 / 柴さんの判断）。
 *   request … 最初の1通（キャリアの相談・メッセージ）。返信するとやり取りが始まる
 *   message … やり取りの中の新しいメッセージ（返信・つながっている人からのメッセージ）
 * ⚠️★**本文は1文字も入れない。** 誰から届いたかと、開くためのリンクだけ（ベルと同じ方針）。
 *    最初の1通の「相談：〈テーマ〉」「メッセージ」の見出しだけは出す（本文ではなく、本人が選んだ種類）。
 * ⚠️ 送り主の名前は第三者への言及なので `greet()` を使わない。
 * ⚠️ 送るかどうか（設定・30分まとめ・検証用と実在）は lib/notify/personMessageEmail.ts が決める。ここは文面だけ。
 */
export function personMessageTemplate(params: {
  to: string;
  userName: string | null | undefined;
  senderName: string;
  kind: "request" | "message";
  /** request のとき「相談：管理職・マネジメント」「メッセージ」など */
  headline?: string | null;
  /** 開く先（https://opinio.jp/… の絶対 URL） */
  url: string;
  /** ★ログインせずにこのお知らせを止めるリンク（lib/notify/unsubscribe.ts）。無ければ設定へのリンクだけ */
  stopUrl?: string | null;
}) {
  const who = params.senderName.trim() || "OPINIO の利用者";
  const subject = params.kind === "request" ? `${who}さんからメッセージが届きました` : `${who}さんから新しいメッセージが届きました`;
  const lead = params.kind === "request"
    ? `${who}さんからメッセージが届きました。返信すると、そのままやり取りを始められます。`
    : `${who}さんから新しいメッセージが届きました。`;
  return {
    to: params.to,
    subject,
    html: htmlWrap(`${greet(params.userName, "line")}
      <p style="margin:0 0 16px;color:#475569">${esc(lead)}</p>
      ${params.kind === "request" && params.headline ? `<p style="margin:0 0 20px"><span style="display:inline-block;padding:3px 10px;border-radius:999px;background:#eef2ff;color:#002366;font-size:12.5px;font-weight:700">${esc(params.headline)}</span></p>` : ""}
      <a href="${esc(params.url)}" style="${BTN}">OPINIOで読む →</a>
      <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;line-height:1.7">
        このあと30分以内に同じ方から届いたメッセージは、改めてお知らせしません。OPINIO でまとめてご覧ください。<br>
        ${params.stopUrl ? `<a href="${esc(params.stopUrl)}" style="color:#94a3b8">このお知らせを止める</a>（ログインは要りません）／` : ""}<a href="https://opinio.jp/mypage/settings" style="color:#94a3b8">設定</a> の「個人からのメッセージをメールで受け取る」でも止められます。
        特定の方からのメッセージを止めたいときは、その方をブロックしてください。
      </p>
    `),
  };
}

/**
 * ★求職者が OPINIO のおすすめを見て「話を聞いてみたい」と答えた（会話はその場でできている）。
 * ⚠️★企業向けでは「紹介」「提案」と書かない（2026-10-11 / 柴さんの指示。人材紹介と紛らわしいため）。
 * ⚠️★ひとことの中身は書かない（名前とリンクだけ。approachRepliedCompanyTemplate と同じ方針）。
 * ⚠️ 求職者の名前は第三者への言及なので `greet()` は使わない。
 */
export function proposalRaisedCompanyTemplate(params: {
  to: string;
  candidateName: string | null | undefined;
  conversationId: string;
  viaOps?: boolean;
}) {
  const name = greetingName(params.candidateName);
  const who = name ? `${name}さん` : "候補者の方";
  return {
    to: params.to,
    subject: opsSubject(`${who}が、貴社の話を聞いてみたいそうです`, params.viaOps === true),
    html: htmlWrap(`${opsFallbackNotice(params.viaOps === true)}
      <h2 style="margin:0 0 8px;font-size:20px;color:#002366">貴社の話を聞いてみたい方がいます</h2>
      <p style="margin:0 0 20px;color:#475569">${esc(who)}が、OPINIO のおすすめで貴社を知り、話を聞いてみたいそうです。そのままメッセージでやり取りできます。</p>
      <a href="https://opinio.jp/biz/messages/${encodeURIComponent(params.conversationId)}" style="${BTN}">メッセージを開く →</a>
    `),
  };
}

/**
 * ★保存した条件の新着のお知らせ（2026-10-10 / 候補者探し 段3）。送るのは条件を作った人だけ。
 * ⚠️★**氏名・経歴を入れない。** 件数とリンクだけ（柴さんの指示）。
 * ⚠️ 新着が0人の日は送らない（呼び出し側で止める。ここは count >= 1 の前提）。
 * ⚠️ 末尾に「お知らせの設定を変える」→ 保存した条件の編集画面。
 */
export function savedSearchAlertTemplate(params: { to: string; searchId: string; searchName: string; count: number }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://opinio.jp";
  const id = encodeURIComponent(params.searchId);
  return {
    to: params.to,
    subject: `保存した条件「${params.searchName}」に新しく${params.count}名が見つかりました`,
    html: htmlWrap(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#002366">新しく${params.count}名が見つかりました</h2>
      <p style="margin:0 0 20px;color:#475569">保存した条件「${esc(params.searchName)}」に合う方が、新しく${params.count}名見つかりました（新しく登録した方と、プロフィールを更新した方）。</p>
      <a href="${siteUrl}/biz/candidates?saved=${id}&new=1" style="${BTN}">新着を見る →</a>
      <p style="margin:28px 0 0;font-size:12px;color:#94A3B8"><a href="${siteUrl}/biz/candidates/saved?edit=${id}" style="color:#64748B">お知らせの設定を変える</a></p>
    `),
  };
}

// T1 応募者宛
export function applicationUserTemplate(params: {
  to: string;
  companyName: string;
  jobTitle: string;
}) {
  return {
    to: params.to,
    subject: `【opinio.jp】${params.companyName}「${params.jobTitle}」への応募を受け付けました`,
    html: htmlWrap(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#002366">応募を受け付けました</h2>
      <p style="margin:0 0 16px;color:#475569">
        <strong style="color:#0f172a">${params.companyName}</strong>「${params.jobTitle}」へのご応募ありがとうございます。
      </p>
      <div style="background:#eff3fc;border-radius:8px;padding:16px 20px;margin-bottom:24px;border-left:3px solid #002366">
        <p style="margin:0;font-size:13px;color:#334155;line-height:1.7">
          ✅ 採用担当者が応募内容を確認次第、ご連絡いたします。<br>
          選考状況はマイページでいつでも確認できます。
        </p>
      </div>
      <a href="https://opinio.jp/mypage/applications" style="${BTN}">選考状況を確認する →</a>
    `),
  };
}

// ── T2: 応募ステータス変更（応募者宛のみ）────────────────────────────────────

export function applicationStatusTemplate(params: {
  to: string;
  name: string;
  companyName: string;
  jobTitle: string;
  status: "reviewing" | "interview" | "accepted" | "rejected";
}) {
  const subjects: Record<string, string> = {
    reviewing: `【opinio.jp】${params.companyName} があなたの応募を確認しています`,
    interview: `【opinio.jp】${params.companyName} が面接を希望しています`,
    accepted:  `【opinio.jp】${params.companyName} から採用の連絡が届きました`,
    rejected:  `【opinio.jp】${params.companyName} からのご連絡`,
  };
  const messages: Record<string, string> = {
    reviewing: `${params.companyName} の採用担当者があなたの応募書類を確認中です。引き続きお待ちください。`,
    interview: `${params.companyName} から面接のご希望がありました。マイページから詳細をご確認ください。`,
    accepted:  `おめでとうございます！${params.companyName} から採用のご連絡がありました。マイページから詳細をご確認ください。`,
    rejected:  `${params.companyName} からご連絡があります。マイページから詳細をご確認ください。`,
  };

  return {
    to: params.to,
    subject: subjects[params.status],
    html: htmlWrap(`
      <h2>${esc(subjects[params.status].replace("【opinio.jp】", ""))}</h2>
      ${greet(params.name, "line")}
      <p>${esc(messages[params.status])}</p>
      <p style="font-size: 13px; color: #888;">応募求人: ${esc(params.companyName)} / ${esc(params.jobTitle)}</p>
      <p><a href="https://opinio.jp/mypage/applications">選考状況を確認する →</a></p>
    `),
  };
}

// ── T6: 企業採用担当者への招待メール ──────────────────────────────────────────

/**
 * ★面接担当になったことを本人に知らせる（2026-10-12）。応募ごとの担当（ow_application_interviewers）を付けたときだけ。
 * ⚠️ 候補者の連絡先・応募の本文は載せない（画面で見てもらう）。載せるのは求人名と画面へのリンクだけ。
 */
export function interviewerAssignedTemplate(params: {
  recipientEmail: string;
  recipientName: string | null;
  companyName: string;
  jobTitle: string | null;
  url: string;
}) {
  return {
    to: params.recipientEmail,
    subject: `【${params.companyName}】面接担当になりました - OPINIO`,
    html: htmlWrap(`
      ${greet(params.recipientName, "line")}
      <p>
        ${esc(params.companyName)} の${params.jobTitle ? `「${esc(params.jobTitle)}」への` : ""}応募で、あなたが面接担当になりました。
      </p>
      <p>選考管理の画面で、候補者のプロフィールと選考の流れを確認し、メモを残せます。</p>
      <p style="margin: 28px 0;">
        <a href="${params.url.startsWith("https://") ? params.url : "#"}"
          style="display: inline-block; background: #002366; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;"
        >選考管理を開く →</a>
      </p>
    `),
  };
}

export function companyInviteTemplate(params: {
  recipientEmail: string;
  inviterName: string;       // 招待した人の名前
  companyName: string;       // 招待先企業名
  companyLogoUrl?: string;   // 任意
  inviteUrl: string;         // 招待リンク（トークン付き）
  roleLabel?: string;        // 任意（例: "採用担当として"）
}) {
  const roleText = params.roleLabel ?? "採用担当として";

  return {
    to: params.recipientEmail,
    subject: `${params.companyName} に${roleText}招待されました - OPINIO`,
    html: htmlWrap(`
      <h2>${esc(params.companyName)} のチームに招待されました</h2>
      <p>${esc(params.recipientEmail)} 様</p>
      <p>
        <strong>${esc(params.inviterName)}</strong> さんから、OPINIO で
        <strong>${esc(params.companyName)}</strong> の${esc(roleText)}招待されました。
      </p>
      <p>下記ボタンから招待を受諾してください。</p>
      <p style="margin: 28px 0;">
        <a
          href="${params.inviteUrl.startsWith("https://") ? params.inviteUrl : "#"}"
          style="
            display: inline-block;
            background: #002366;
            color: #fff;
            padding: 12px 28px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: bold;
            font-size: 14px;
          "
        >招待を受諾する →</a>
      </p>
      <p style="font-size: 12px; color: #888;">
        このリンクは7日間有効です。<br/>
        このメールに心当たりがない場合は、そのまま破棄してください。
      </p>
    `),
  };
}

// ── T7: 新規企業作成の運営通知 ────────────────────────────────────────────────

export function newCompanyAdminTemplate(params: {
  companyName: string;
  companyId: string;
  creatorName: string;
  creatorEmail: string;
  createdAt: string;
  /**
   * 正規化した企業名が一致した既存企業。
   * ⚠️ **作成は止めていない**（同名の別会社が実在するため）。
   *    重複に気づける経路はこの通知だけなので、必ず載せる。
   * ⚠️★`matchedOn` は**どの列で一致したか**（2026-09-05）。照合が
   *    brand_name / name_en / search_aliases まで広がったので、
   *    **なぜ候補に出たのかが分からないと運営が判断できない**
   *    （「ANDPAD」で「株式会社アンドパッド」が出ても、名前は似ていない）。
   */
  duplicates?: { id: string; name: string; isPublished: boolean; source: string | null; matchedOn?: string | null }[];
}) {
  const dups = params.duplicates ?? [];
  const subjectPrefix = dups.length > 0 ? "[OPINIO] [重複の疑い] " : "[OPINIO] ";
  const duplicateNote = dups.length > 0
    ? `<div style="color: #92400E; background: #FEF3C7; padding: 12px 14px; border-radius: 6px; font-size: 13px;">
        <p style="margin: 0 0 8px;">
          ⚠️ 企業名が一致する既存企業が <strong>${dups.length}件</strong> あります。
          <strong>同名の別会社の可能性もあるため、作成は止めていません。</strong>
          統合が必要かどうか確認してください。
        </p>
        <ul style="margin: 0; padding-left: 18px;">
          ${dups.map((d) => `<li style="margin-bottom: 4px;">
            <a href="https://opinio.jp/admin/companies/${d.id}">${esc(d.name)}</a>
            <span style="color:#78350F;">（${d.isPublished ? "公開中" : "非公開"} / source: ${esc(d.source ?? "null")}${d.matchedOn ? ` / 一致したのは<strong>${esc(companyMatchLabelForAdmin(d.matchedOn))}</strong>` : ""}）</span>
          </li>`).join("")}
        </ul>
        <p style="margin: 8px 0 0; font-size: 12px;">
          統合する場合は canonical_company_id を設定してください（参照の付け替えはしません）。
        </p>
       </div>`
    : "";

  return {
    to: ADMIN_EMAIL,
    subject: `${subjectPrefix}新規企業が登録されました: ${params.companyName}`,
    html: htmlWrap(`
      <h2>新しい企業が OPINIO に登録されました</h2>
      ${duplicateNote}
      <table style="border-collapse: collapse; width: 100%; font-size: 13px; margin-top: 16px;">
        <tr>
          <td style="padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: 600; width: 120px;">企業名</td>
          <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${esc(params.companyName)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: 600;">作成者</td>
          <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${esc(params.creatorName)}（${esc(params.creatorEmail)}）</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: 600;">ステータス</td>
          <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">draft（未公開）</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: 600;">登録日時</td>
          <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${new Date(params.createdAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: 600;">企業 ID</td>
          <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-family: monospace; font-size: 11px;">${params.companyId}</td>
        </tr>
      </table>
      <p style="margin-top: 20px;">
        <a href="https://opinio.jp/admin/companies/${params.companyId}">管理画面で確認する →</a>
      </p>
      <p style="font-size: 12px; color: #888; margin-top: 4px;">
        不審な登録の場合は管理画面から kick または非公開化してください。
      </p>
    `),
  };
}

// ── 「面談OK」への招待（本人宛）── ★2026-10-16 に廃止（面談OKの撤去）──────────
/* ⚠️ `ambassadorInviteTemplate` は削除した。文面が要るときは git 履歴から（`3014e638` 時点まで） */

// ── カジュアル面談通知（企業管理者宛） ─────────────────────────────────────────
export function casualMeetingCompanyAdminTemplate(params: {
  to: string;
  companyName: string;
  contactEmail: string;
  intent: string | null;
  interestReason: string | null;
  questions: string | null;
  /** 運営に回った通知か。⚠️ getCompanyNotificationTarget の viaOps をそのまま渡す */
  viaOps?: boolean;
}) {
  const intentLabel: Record<string, string> = {
    info_gathering: "情報収集中",
    good_opportunity: "良い機会があれば",
    within_6: "6ヶ月以内に転職検討",
    within_3: "3ヶ月以内に転職検討",
  };
  return {
    to: params.to,
    subject: opsSubject(`【OPINIO】${esc(params.companyName)}へのカジュアル面談申し込みがありました`, params.viaOps === true),
    html: htmlWrap(`${opsFallbackNotice(params.viaOps === true)}
      <h2 style="margin:0 0 8px;font-size:20px;color:#002366">新着カジュアル面談</h2>
      <p style="margin:0 0 20px;color:#475569"><strong style="color:#0f172a">${esc(params.companyName)}</strong> へのカジュアル面談申し込みがありました。</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px">
        <tr><td style="${TD_LABEL}">申込者</td><td style="${TD_VALUE}">${esc(params.contactEmail)}</td></tr>
        ${params.intent ? `<tr><td style="${TD_LABEL}">転職意向</td><td style="${TD_VALUE}">${esc(intentLabel[params.intent] ?? params.intent)}</td></tr>` : "" /* ★申込フォームで聞くのをやめた（2026-10-18）。無ければ行ごと出さない */}
        <tr><td style="${TD_LABEL}">志望理由</td><td style="${TD_VALUE}">${esc(params.interestReason) || "（未記入）"}</td></tr>
        <tr><td style="${TD_LABEL}">質問内容</td><td style="${TD_VALUE}">${esc(params.questions) || "（未記入）"}</td></tr>
      </table>
      <a href="https://opinio.jp/biz/meetings" style="${BTN}">管理画面で確認する →</a>
    `),
  };
}

// ── 企業参加リクエスト（既存企業のAdminへ通知） ───────────────────────────────
export function joinRequestTemplate(params: {
  to: string;
  adminName: string;
  companyName: string;
  companyId: string;
  requesterName: string;
  requesterEmail: string;
  /** 運営に回った通知か。⚠️ getCompanyNotificationTarget の viaOps をそのまま渡す */
  viaOps?: boolean;
}) {
  return {
    to: params.to,
    /* ★「◯◯への参加」ではなく「◯◯の採用チームへの参加」（2026-10-18 / 柴さんの指示。会社に入りたいのではなく、担当者として加わりたい）
       ⚠️★件名と本文の「◯◯さんが」は**宛名ではなく第三者への言及**なので、
          「行ごと出さない」は当てられない（文が成り立たなくなる）。
          名前が使えないときは**メールアドレスだけで示す**。 */
    subject: opsSubject(
      greetingName(params.requesterName)
        ? `[OPINIO] ${esc(params.requesterName)}さんが「${esc(params.companyName)}」の採用チームへの参加を希望しています`
        : `[OPINIO] 「${esc(params.companyName)}」の採用チームへの参加の希望が届いています`,
      params.viaOps === true,
    ),
    html: htmlWrap(`${opsFallbackNotice(params.viaOps === true)}
      ${greet(params.adminName, "h2")}
      <p>
        ${greetingName(params.requesterName)
          ? `<strong>${esc(params.requesterName)}</strong>（${esc(params.requesterEmail)}）さんが`
          : `<strong>${esc(params.requesterEmail)}</strong> の方が`}
        「${esc(params.companyName)}」の採用チームへの参加を希望しています。
      </p>
      <p>「メンバーと権限」の画面の上に依頼が出ています。権限を選んで「担当者に追加」を押すと、その場で追加されます。心当たりがなければ「見送る」を押してください（相手には知らせません）。</p>
      <a href="https://opinio.jp/biz/members" style="${BTN}">依頼を確認する →</a>
      <p style="margin-top:24px;font-size:12px;color:#94a3b8;">
        心当たりのない場合は、このメールを無視してください。
      </p>
    `),
  };
}

/**
 * ★担当者がまだいない企業への参加依頼を、運営に知らせる（2026-10-17 / 柴さんの判断）。
 *
 * それまでは押した瞬間に管理者になっていた（誰でも、確認なしで、応募者の個人情報まで見られた）。
 * いまは依頼として残り、運営が /admin/company-join-requests で承認したら担当者になる。
 * ⚠️ 承認は在籍の証明ではない。承認画面のメールドメインと企業サイトの一致を材料に判断する。
 */
export function joinRequestOpsTemplate(params: {
  to: string;
  companyName: string;
  requesterName: string;
  requesterEmail: string;
}) {
  const who = greetingName(params.requesterName)
    ? `<strong>${esc(params.requesterName)}</strong>（${esc(params.requesterEmail)}）さん`
    : `<strong>${esc(params.requesterEmail)}</strong> の方`;
  return {
    to: params.to,
    subject: `${OPS_SUBJECT_PREFIX}「${esc(params.companyName)}」の最初の担当者になりたいという依頼が届いています`,
    html: htmlWrap(`
      <p>${who}が、「${esc(params.companyName)}」の最初の担当者として参加を希望しています。</p>
      <p>この企業にはまだ担当者がいないため、運営が承認するまで担当者にはなりません（応募者の情報も見られません）。</p>
      <a href="https://opinio.jp/admin/company-join-requests" style="${BTN}">依頼を確認する →</a>
      <p style="margin-top:24px;font-size:12px;color:#94a3b8;">
        承認の前に、メールのドメインと企業サイトが一致しているかを確認してください。一致していても在籍の証明にはなりません。
      </p>
    `),
  };
}

/**
 * 依頼が承認され、担当者になったことを**本人**に知らせる（2026-09-04）。
 *
 * ⚠️★これが無いと、承認されたことが本人に伝わらない。運営が承認する経路
 *    （`/admin/company-join-requests`）は**企業からの返事ではない**ので、
 *    本人は待ち続けることになる。
 *
 * ⚠️ 取引通知（本人の操作の結果を返すもの）なので opt-out 列は要らない。
 * ⚠️ **誰が承認したかは書かない。** 企業の担当者が承認したのか運営が代理で通したのかは、
 *    本人にとって意味の違う情報で、書くなら正確に書き分ける必要がある。
 *    いまは書き分けられないので**書かない**。
 */
export function joinRequestApprovedTemplate(params: {
  to: string;
  requesterName: string;
  companyName: string;
  /** ★企業が承認したときの権限の名前（2026-10-18）。無ければ従来の文（運営の承認） */
  roleLabel?: string;
}) {
  return {
    to: params.to,
    subject: `[OPINIO] 「${esc(params.companyName)}」の担当者として登録されました`,
    html: htmlWrap(`
      ${greet(params.requesterName, "h2")}
      <p>
        ${params.roleLabel
          ? `「<strong>${esc(params.companyName)}</strong>」の担当者（${esc(params.roleLabel)}）として登録されました。`
          : `「<strong>${esc(params.companyName)}</strong>」の採用担当者として登録されました。
        企業情報の編集や求人の掲載ができます。`}
      </p>
      <a href="https://opinio.jp/biz/dashboard" style="${BTN}">OPINIO Business を開く →</a>
      <p style="margin-top:24px;font-size:12px;color:#94a3b8;">
        心当たりのない場合は、このメールに返信してお知らせください。
      </p>
    `),
  };
}

// ── 企業の審査完了・企業ページの公開（企業宛）── 2026-10-19 ─────────────────────────
/**
 * ★運営が企業を承認したとき（`is_approved` が false → true）。
 *   企業の画面は「審査が完了次第メールでご連絡します」と書いているので、その約束を守る（2026-10-19 まで送っていなかった）。
 * ⚠️ 承認で開くのは候補者を探す・メッセージ。求人の公開は企業ページの公開（掲載）のあと（`publishGate.ts`）なので、そう書く。
 */
export function companyApprovedTemplate(params: { to: string; companyName: string }) {
  return {
    to: params.to,
    subject: `[OPINIO] 「${esc(params.companyName)}」の審査が完了しました`,
    html: htmlWrap(`
      <h2 style="margin:0 0 16px;font-size:18px;">審査が完了しました</h2>
      <p>「<strong>${esc(params.companyName)}</strong>」の OPINIO 運営による審査が完了しました。
        候補者を探して、メッセージを送れるようになりました。</p>
      <p>求人は、企業ページの公開後に公開できます。企業ページの公開は運営が行い、公開したときにあらためてお知らせします。
        まだ「掲載を依頼する」を押していない場合は、企業ページの編集画面から依頼してください。</p>
      <a href="https://opinio.jp/biz/candidates" style="${BTN}">候補者を探す →</a>
      <p style="margin-top:24px;font-size:12px;color:#94a3b8;">
        心当たりのない場合は、このメールに返信してお知らせください。
      </p>
    `),
  };
}

/**
 * ★運営が企業ページを掲載にしたとき（`listing_status` が draft → listed）。求人の公開ができるようになる。
 */
export function companyListedTemplate(params: { to: string; companyName: string; companyPath: string }) {
  return {
    to: params.to,
    subject: `[OPINIO] 「${esc(params.companyName)}」の企業ページを公開しました`,
    html: htmlWrap(`
      <h2 style="margin:0 0 16px;font-size:18px;">企業ページを公開しました</h2>
      <p>「<strong>${esc(params.companyName)}</strong>」の企業ページを公開しました。
        求職者が企業の一覧から見られるようになり、求人も公開できるようになりました。</p>
      <a href="https://opinio.jp${params.companyPath}" style="${BTN}">企業ページを見る →</a>
      <p style="margin-top:12px;"><a href="https://opinio.jp/biz/jobs/new">求人を作る →</a></p>
      <p style="margin-top:24px;font-size:12px;color:#94a3b8;">
        心当たりのない場合は、このメールに返信してお知らせください。
      </p>
    `),
  };
}

// ── 面談対応者の申請・承認・取り消し（企業/運営/本人宛）── ★2026-10-16 にすべて廃止 ──────
/* ⚠️ `ambassadorRequestTemplate`（2026-09-30 に廃止）・`ambassadorApprovedTemplate`・
      `ambassadorDismissedTemplate` は削除した（面談OKの撤去）。文面が要るときは git 履歴から（`3014e638` 時点まで） */

/* ⚠️★`scoutTemplate`（スカウトが届いたお知らせ）は 2026-10-08 にスカウトごと廃止した。
      送信実績は0件。**戻さないこと。** */

// ── 新規ユーザー登録の運営通知 ──────────────────────────────────────────────
/**
 * 求職者が登録を**完了した**ときに運営（`ADMIN_EMAIL`）へ送る（2026-09-30 / 柴さんの依頼）。
 *
 * ⚠️★**「登録した」には2つの時点がある。これは②。**
 *   ① フォーム送信 … `auth.users` と `ow_users` の行ができて確認メールが飛ぶ。
 *      **まだ本人だと分かっていない。** 打ち間違えた人・戻ってこない人が混ざる
 *      （実測 2026-09-30: その日の5人のうち1人が①で止まっていた）。
 *   ② **確認リンクを開いた** … ここで初めて本人。ウェルカムメールが飛ぶ時点。
 *   ⇒ ②で送る。①で送ると、実在しないアドレスの通知が混ざる。
 *
 * ⚠️★**`signup_ref`（登録経路）は載せていない。** あれを書くのは
 *    `OnboardingGuard`（着地後・クライアント）なので、**この時点ではまだ null。**
 *    「—」と出すと「経路なし」と読めてしまう。経路は `/admin/signup-refs` で見る。
 *
 * ⚠️ 名前は**宛名ではない**ので `greet()` を通さない。ここは事実の報告で、
 *    「誰が登録したか」を運営が読む欄。無ければ「（未設定）」と**明示する**
 *    （空欄にすると、取得に失敗したのか未入力なのか区別できない）。
 *    ⚠️ ただし `'ユーザー'`（プレースホルダ）は名前として出さない。`personName.ts` と同じ扱い。
 *
 * ⚠️ 検証用アカウント（`contact+NN@opinio.co.jp`）も**除外していない**。
 *    `is_test` が立つのは後から migration でなので、この時点では見分けが付かない。
 *    運営に1通多く届くだけで実害が無く、むしろ `is_test` の立て忘れに気づける。
 */
export function newUserAdminTemplate(params: {
  owUserId: string;
  email: string;
  /** `ow_users.name`。無い／プレースホルダなら null を渡す */
  name: string | null;
  /** `session.user.app_metadata.provider`（"email" / "google" など） */
  provider: string | null;
  confirmedAt: string;
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://opinio.jp";
  const providerLabel =
    params.provider === "google" ? "Google"
    : params.provider === "email" ? "メールアドレス"
    : params.provider ?? "不明";
  const row = (label: string, value: string, mono = false) => `
        <tr>
          <td style="padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: 600; width: 120px;">${label}</td>
          <td style="padding: 8px 12px; border: 1px solid #e2e8f0;${mono ? "font-family: monospace; font-size: 11px;" : ""}">${value}</td>
        </tr>`;

  return {
    to: ADMIN_EMAIL,
    subject: `[OPINIO] 新規ユーザーが登録しました: ${params.name ?? params.email}`,
    html: htmlWrap(`
      <h2>新しいユーザーが OPINIO に登録しました</h2>
      <table style="border-collapse: collapse; width: 100%; font-size: 13px; margin-top: 16px;">
        ${row("名前", params.name ? esc(params.name) : '<span style="color:#94a3b8;">（未設定）</span>')}
        ${row("メールアドレス", esc(params.email))}
        ${row("認証方法", esc(providerLabel))}
        ${row("登録日時", new Date(params.confirmedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }))}
        ${row("ユーザー ID", params.owUserId, true)}
      </table>
      <p style="margin-top: 20px;">
        <a href="${siteUrl}/admin/users/${params.owUserId}">管理画面で確認する →</a>
      </p>
      <p style="font-size: 12px; color: #888; margin-top: 4px;">
        この時点ではオンボーディング（氏名・お住まい・直近のお勤め先・転職意欲）は未完了です。
        どの声かけから来たかは <a href="${siteUrl}/admin/signup-refs">登録経路</a> で見られます。
      </p>
    `),
  };
}

// ★面談の日時が決まった（2026-10-10 / 段4）。求職者と企業の両方へ。.ics を添付する（呼び出し側）
// ⚠️ 本文に会話の内容を書かない（日時・時間・形式と、会話へのリンクだけ）
export function meetingConfirmedTemplate(params: {
  to: string;
  side: "candidate" | "company";
  /** 相手の名前（企業名 or 求職者名） */
  counterpartName: string | null | undefined;
  whenText: string;
  durationMinutes: number;
  formatLabel: string;
  conversationId: string;
  viaOps?: boolean;
}) {
  const who = params.side === "candidate" ? (params.counterpartName ?? "企業") : (greetingName(params.counterpartName) ? `${greetingName(params.counterpartName)}さん` : "求職者");
  const link = params.side === "candidate"
    ? `https://opinio.jp/mypage/conversations/${encodeURIComponent(params.conversationId)}`
    : `https://opinio.jp/biz/messages/${encodeURIComponent(params.conversationId)}`;
  return {
    to: params.to,
    subject: opsSubject(`面談の日時が決まりました（${who}・${params.whenText}）`, params.viaOps === true),
    html: htmlWrap(`${opsFallbackNotice(params.viaOps === true)}
      <h2 style="margin:0 0 8px;font-size:20px;color:#002366">面談の日時が決まりました</h2>
      <p style="margin:0 0 16px;color:#475569">${esc(who)}との面談です。カレンダーに追加できるファイルを添付しています。</p>
      <div style="background:#eff3fc;border-radius:8px;padding:16px 20px;margin-bottom:24px;border-left:3px solid #002366">
        <p style="margin:0;font-size:14px;color:#0f172a;line-height:1.8">
          日時：${esc(params.whenText)}（日本時間）<br>時間：${params.durationMinutes}分<br>形式：${esc(params.formatLabel)}
        </p>
      </div>
      <a href="${link}" style="${BTN}">会話を開く →</a>
    `),
  };
}

// ★企業が面談（または候補日）を取り消した（2026-10-10 / 段4）。求職者へ
export function meetingCanceledTemplate(params: {
  to: string;
  companyName: string;
  whenText: string | null;
  conversationId: string;
}) {
  return {
    to: params.to,
    subject: `【opinio.jp】${params.companyName}が面談の日程を取り消しました`,
    html: htmlWrap(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#002366">面談の日程が取り消されました</h2>
      <p style="margin:0 0 20px;color:#475569">${esc(params.companyName)}が${params.whenText ? `${esc(params.whenText)}の面談` : "送った候補日"}を取り消しました。くわしくは会話でご確認ください。</p>
      <a href="https://opinio.jp/mypage/conversations/${encodeURIComponent(params.conversationId)}" style="${BTN}">会話を開く →</a>
    `),
  };
}
