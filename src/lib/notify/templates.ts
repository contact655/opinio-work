/** 運営の宛先。⚠️ 新しい持ち方を作らない。既存の3テンプレートと同じこれを使う。 */
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "contact@opinio.co.jp";

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
            <span style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.02em">OPINIO</span>
            <span style="font-size:11px;color:rgba(255,255,255,0.7);margin-left:12px">IT/SaaS業界のキャリアインフラ</span>
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
  /** ★指名された社員の氏名（2026-08-30）。**任意。null なら行ごと出さない。**
      ⚠️ 「値が無いことを、ある値に置き換えない」——「（指名なし）」とは書かない。
         指名は任意の機能で、無いことに意味がある。 */
  requestedName?: string | null;
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
        ${params.requestedName ? `<tr><td style="${TD_LABEL}">指名</td><td style="${TD_VALUE}"><strong>${esc(params.requestedName)}</strong> さんに聞きたい</td></tr>` : ""}
        <tr><td style="${TD_LABEL}">転職意向</td><td style="${TD_VALUE}">${params.intent ? esc(intentLabel[params.intent] ?? params.intent) : "未回答"}</td></tr>
        <tr><td style="${TD_LABEL}">志望理由</td><td style="${TD_VALUE}">${esc(params.interestReason) || "（未記入）"}</td></tr>
        <tr><td style="${TD_LABEL}">質問内容</td><td style="${TD_VALUE}">${esc(params.questions) || "（未記入）"}</td></tr>
      </table>
      <a href="https://opinio.jp/biz/meetings" style="${BTN}">管理画面で確認する →</a>
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
      <p>${esc(params.name)} さん、</p>
      <p>${esc(messages[params.status])}</p>
      <p style="font-size: 13px; color: #888;">応募求人: ${esc(params.companyName)} / ${esc(params.jobTitle)}</p>
      <p><a href="https://opinio.jp/mypage/applications">選考状況を確認する →</a></p>
    `),
  };
}

// ── T6: 企業採用担当者への招待メール ──────────────────────────────────────────

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
    subject: `${params.companyName} の採用担当として招待されました - OPINIO`,
    html: htmlWrap(`
      <h2>${esc(params.companyName)} の採用担当チームに招待されました</h2>
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
   */
  duplicates?: { id: string; name: string; isPublished: boolean; source: string | null }[];
}) {
  const dups = params.duplicates ?? [];
  const subjectPrefix = dups.length > 0 ? "[OPINIO] [重複の疑い] " : "[OPINIO] ";
  const duplicateNote = dups.length > 0
    ? `<div style="color: #92400E; background: #FEF3C7; padding: 12px 14px; border-radius: 6px; font-size: 13px;">
        <p style="margin: 0 0 8px;">
          ⚠️ 正規化した企業名が一致する既存企業が <strong>${dups.length}件</strong> あります。
          <strong>同名の別会社の可能性もあるため、作成は止めていません。</strong>
          統合が必要かどうか確認してください。
        </p>
        <ul style="margin: 0; padding-left: 18px;">
          ${dups.map((d) => `<li style="margin-bottom: 4px;">
            <a href="https://opinio.jp/admin/companies/${d.id}">${esc(d.name)}</a>
            <span style="color:#78350F;">（${d.isPublished ? "公開中" : "非公開"} / source: ${esc(d.source ?? "null")}）</span>
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

// ── 「話を聞かれてもよい」への招待（本人宛）───────────────────────────────────
/* ⚠️ 本人が受け取る文面なので、/mypage・/people と同じ語彙にする（2026-08-23 / B-1）。
      「面談対応者」は**企業・運営向けの語**。本人宛には出さない。
   ⚠️ /biz・/admin 側の「面談対応者」「面談受付中」は変えないこと（確定済み）。 */
export function ambassadorInviteTemplate(params: {
  to: string;
  userName: string;
  companyName: string;
  roleTitle: string;
  token: string;
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://opinio.jp";
  const approveUrl = `${siteUrl}/mypage/ambassador-invite/${params.token}`;

  return {
    to: params.to,
    subject: `【OPINIO】${esc(params.companyName)} の話を聞く相手として招待されています`,
    html: htmlWrap(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#002366">話を聞かれてもよいか、確認させてください</h2>
      <p style="margin:0 0 20px;color:#475569">
        ${esc(params.userName)} さん<br><br>
        <strong style="color:#0f172a">${esc(params.companyName)}</strong>の採用担当者より、
        あなたを「この会社の話を聞ける人」として掲載したいという申請がありました。
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px">
        <tr><td style="${TD_LABEL}">企業名</td><td style="${TD_VALUE}">${esc(params.companyName)}</td></tr>
        <tr><td style="${TD_LABEL}">役職</td><td style="${TD_VALUE}">${esc(params.roleTitle)}</td></tr>
      </table>
      <p style="margin:0 0 16px;color:#475569;font-size:14px">
        掲載されると:<br>
        ・OPINIOに「この会社の話を聞ける人」としてプロフィールが表示されます<br>
        ・転職を検討している方から、カジュアル面談の申込みが届きます<br>
        ・あなたの氏名・役職・所属企業が公開されます
      </p>
      <p style="margin:0 0 24px">
        <a href="${approveUrl}" style="${BTN}">承認する（または断る）→</a>
      </p>
      <p style="color:#94a3b8;font-size:12px;margin:0">
        ※ 承認は任意です。承認しない場合、あなたの情報が公開されることはありません。<br>
        ※ 承認後も、いつでも設定を解除できます。<br>
        ※ 管理画面へのアクセス権は付与されません。
      </p>
    `),
  };
}

// ── カジュアル面談通知（企業管理者宛） ─────────────────────────────────────────
export function casualMeetingCompanyAdminTemplate(params: {
  to: string;
  companyName: string;
  contactEmail: string;
  intent: string | null;
  interestReason: string | null;
  questions: string | null;
  /** ★指名された社員の氏名（2026-08-30）。**任意。null なら行ごと出さない。**
      ⚠️ 「値が無いことを、ある値に置き換えない」——「（指名なし）」とは書かない。
         指名は任意の機能で、無いことに意味がある。 */
  requestedName?: string | null;
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
        ${params.requestedName ? `<tr><td style="${TD_LABEL}">指名</td><td style="${TD_VALUE}"><strong>${esc(params.requestedName)}</strong> さんに聞きたい</td></tr>` : ""}
        <tr><td style="${TD_LABEL}">転職意向</td><td style="${TD_VALUE}">${params.intent ? esc(intentLabel[params.intent] ?? params.intent) : "未回答"}</td></tr>
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
    subject: opsSubject(`[OPINIO] ${esc(params.requesterName)}さんが「${esc(params.companyName)}」への参加を希望しています`, params.viaOps === true),
    html: htmlWrap(`${opsFallbackNotice(params.viaOps === true)}
      <h2>${esc(params.adminName)} さん</h2>
      <p>
        <strong>${esc(params.requesterName)}</strong>（${esc(params.requesterEmail)}）さんが
        「${esc(params.companyName)}」への参加を希望しています。
      </p>
      <p>メンバー管理画面からメールアドレスを入力して招待を完了してください。</p>
      <a href="https://opinio.jp/biz/members" style="${BTN}">メンバーを招待する →</a>
      <p style="margin-top:24px;font-size:12px;color:#94a3b8;">
        心当たりのない場合は、このメールを無視してください。
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
}) {
  return {
    to: params.to,
    subject: `[OPINIO] 「${esc(params.companyName)}」の担当者として登録されました`,
    html: htmlWrap(`
      <h2>${esc(params.requesterName)} さん</h2>
      <p>
        「<strong>${esc(params.companyName)}</strong>」の採用担当者として登録されました。
        企業情報の編集や求人の掲載ができます。
      </p>
      <a href="https://opinio.jp/biz/dashboard" style="${BTN}">OPINIO Business を開く →</a>
      <p style="margin-top:24px;font-size:12px;color:#94a3b8;">
        心当たりのない場合は、このメールに返信してお知らせください。
      </p>
    `),
  };
}

// ── 面談対応者の申請（企業/運営宛）─────────────────────────────────────────
/**
 * 本人が「話を聞かれてもよい」と申請したことを企業に知らせる（2026-08-23）。
 *
 * ⚠️ **中身は入れない。** 役職・職歴・自己紹介などは書かない。
 *    「誰が・どの会社に・いつ申請したか」と、確認する場所への導線まで。
 *
 * ⚠️ 取引通知（本人の操作の結果を返すもの）なので **opt-out 列は要らない**。
 *    週次のリマインド（勧誘）とは別物。混同しないこと。
 */
export function ambassadorRequestTemplate(params: {
  to: string;
  companyName: string;
  applicantName: string;
  appliedAt: string;
  /** 運営に回った通知か。⚠️ getCompanyNotificationTarget の viaOps をそのまま渡す */
  viaOps?: boolean;
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://opinio.jp";
  /* 運営に回ったときは運営の画面へ、企業に届くときは企業の画面へ送る */
  const href = params.viaOps === true
    ? `${siteUrl}/admin/ambassador-requests`
    : `${siteUrl}/biz/members`;

  return {
    to: params.to,
    /* ★2026-08-24: 会社の事前承認を廃止したので、**承認を求める文面をやめた**。
          ⚠️ 「承認するまで公開されません」は事実と逆になる。ここを戻さないこと。
          ⚠️ 企業がすることは「外したい場合に外す」だけ。だから件名も本文も
             お願いではなく**お知らせ**にしてある。 */
    subject: opsSubject(
      `【OPINIO】${esc(params.companyName)}の社員の方が「話を聞かれてもよい」を有効にしました`,
      params.viaOps === true,
    ),
    html: htmlWrap(`${opsFallbackNotice(params.viaOps === true)}
      <h2 style="margin:0 0 8px;font-size:20px;color:#002366">「話を聞かれてもよい」が有効になりました</h2>
      <p style="margin:0 0 20px;color:#475569">
        <strong style="color:#0f172a">${esc(params.companyName)}</strong> に在籍していると申告している方が、
        転職を検討している方の相談に応じてもよい、と設定しました。
        <strong style="color:#0f172a">貴社のページに掲載されています。</strong>
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px">
        <tr><td style="${TD_LABEL}">お名前</td><td style="${TD_VALUE}">${esc(params.applicantName)}</td></tr>
        <tr><td style="${TD_LABEL}">設定日</td><td style="${TD_VALUE}">${esc(params.appliedAt)}</td></tr>
      </table>
      <p style="margin:0 0 16px;color:#475569;font-size:14px">
        在籍は<strong style="color:#0f172a">本人の申告</strong>で、OPINIO は在籍確認を行っていません。
        心当たりが無い場合や掲載を止めたい場合は、下のボタンからいつでも貴社のページから外せます。
      </p>
      <p style="margin:0 0 24px">
        <a href="${href}" style="${BTN}">掲載を確認する →</a>
      </p>
    `),
  };
}

// ── 「話を聞かれてもよい」の申請に対する企業の判断（本人宛）───────────────────
/*
 * ⚠️★件名に結果を書かない（2026-08-23 確定）。
 *    件名は受信箱の一覧やスマホのプッシュ通知に出るため、
 *    「見送られました」が**本人以外の目に触れうる場所**に出てしまう。
 *    結果は本文で伝える。承認側も同じ形に揃えている。
 *
 * ⚠️ 本文に役職・職歴・企業の内部事情を書かない。企業がなぜそう判断したかの
 *    記録は存在しない（却下理由を残す器を作っていない）ので、書けるのは結果だけ。
 *
 * ⚠️ 配信停止の列は持たない。**本人の操作（申請）に対する結果通知**なので、
 *    週次メール（`email_weekly_enabled`）とは別の取引通知として扱う。
 */

/** 企業が承認した（初回のみ。再掲載では送らない） */
export function ambassadorApprovedTemplate(params: {
  to: string;
  userName: string;
  companyName: string;
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://opinio.jp";
  return {
    to: params.to,
    /* ★2026-08-24: 会社の事前承認を廃止したので、**「承認されました」と書かない**。
          この通知が飛ぶのは「企業が初めて掲載した」ときだけで、本人は申請していない
          （自分でONにしただけ）。⚠️ 承認の語に戻すと、存在しない審査があったように読める。 */
    subject: `【OPINIO】${esc(params.companyName)} のページに掲載されました`,
    html: htmlWrap(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#002366">話を聞く相手として掲載されました</h2>
      <p style="margin:0 0 20px;color:#475569">
        ${esc(params.userName)} さん<br><br>
        <strong style="color:#0f172a">${esc(params.companyName)}</strong>のページに、
        「話を聞かれてもよい」の登録が掲載されました。
      </p>
      <p style="margin:0 0 16px;color:#475569;font-size:14px">
        これから起きること:<br>
        ・${esc(params.companyName)}のページに、あなたのプロフィールが表示されます<br>
        ・転職を検討している方から、カジュアル面談の申込みが届きます
      </p>
      <p style="margin:0 0 24px">
        <a href="${siteUrl}/mypage" style="${BTN}">マイページを見る →</a>
      </p>
      <p style="color:#94a3b8;font-size:12px;margin:0">
        ※ マイページのトグルで、いつでも掲載を止められます。
      </p>
    `),
  };
}

/** 企業（または運営）が掲載を取り消した。
    ⚠️ 2026-08-24 時点では `pending_company` の行が消えたときだけ送る作りだが、
       その状態には到達しなくなったため実質送られていない（decide.ts の表を参照）。 */
export function ambassadorDismissedTemplate(params: {
  to: string;
  userName: string;
  companyName: string;
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://opinio.jp";
  return {
    to: params.to,
    /* ★2026-08-25: 「見送り（申請の却下）」から「掲載の取り消し」へ書き直した。
          会社の事前承認を廃止したので、**申請という段階が無い**。この通知が飛ぶのは
          「本人が同意して載っていた行が消えたとき」だけ。
       ⚠️★**理由は書けない。** 却下の理由を記録する器が無く、企業の運用も様々。
          書けない以上、**書かない**（推測を本人に伝えない）。代わりに
          **もう一度ONにできる**ことを必ず伝える——これが本人に残された唯一の手。
       ⚠️ 非掲載（`unlistMember`）ではこのメールは飛ばない。往復するため。 */
    subject: `【OPINIO】${esc(params.companyName)} のページの掲載が取り消されました`,
    html: htmlWrap(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#002366">会社のページに出なくなりました</h2>
      <p style="margin:0 0 20px;color:#475569">
        ${esc(params.userName)} さん<br><br>
        <strong style="color:#0f172a">${esc(params.companyName)}</strong>のページでの
        「話を聞かれてもよい」の登録が取り消され、ページに出なくなりました。
      </p>
      <p style="margin:0 0 16px;color:#475569;font-size:14px">
        取り消しは会社または OPINIO の判断によるもので、
        <strong style="color:#0f172a">理由をお伝えすることはできません。</strong><br>
        いま在籍している会社であれば、マイページからもう一度ONにできます。
      </p>
      <p style="margin:0 0 24px">
        <a href="${siteUrl}/mypage" style="${BTN}">マイページを見る →</a>
      </p>
      <p style="color:#94a3b8;font-size:12px;margin:0">
        ※ プロフィール自体は消えていません。公開範囲はマイページから変更できます。
      </p>
    `),
  };
}
