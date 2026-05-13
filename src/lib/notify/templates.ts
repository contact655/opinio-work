const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "hshiba@opinio.co.jp";

// ── 共通 HTML wrapper ──────────────────────────────────────────────────────────
function htmlWrap(content: string): string {
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px;">
      ${content}
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;"/>
      <p style="color: #888; font-size: 12px;">
        opinio.jp — 採用と転職のためのプラットフォーム<br/>
        <a href="https://opinio.jp">https://opinio.jp</a>
      </p>
    </div>
  `;
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
    within_6: "6 ヶ月以内に転職検討",
    within_3: "3 ヶ月以内に転職検討",
  };

  return {
    to: ADMIN_EMAIL,
    subject: `【新着カジュアル面談】${params.companyName} への申し込みがありました`,
    html: htmlWrap(`
      <h2>新着カジュアル面談</h2>
      <p><strong>${params.companyName}</strong> へのカジュアル面談申し込みがありました。</p>
      <p><strong>申込者:</strong> ${params.contactEmail}</p>
      <p><strong>転職意向:</strong> ${params.intent ? (intentLabel[params.intent] ?? params.intent) : "未回答"}</p>
      <p><strong>志望理由:</strong> ${params.interestReason || "（未記入）"}</p>
      <p><strong>質問内容:</strong> ${params.questions || "（未記入）"}</p>
      <p><a href="https://opinio.jp/biz/meetings">/biz/meetings で確認する →</a></p>
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
      <h2>カジュアル面談申し込みを受け付けました</h2>
      <p><strong>${params.companyName}</strong> へのカジュアル面談申し込みありがとうございます。</p>
      <p>3 営業日以内に Opinio 編集部からご連絡いたします。</p>
      <p>しばらくお待ちください。</p>
      <p><a href="https://opinio.jp/mypage">マイページで状況を確認する →</a></p>
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

// ── T5: メンター予約申込 ──────────────────────────────────────────────────────

// T5 admin 宛
export function mentorReservationAdminTemplate(params: {
  mentorName: string;
  contactEmail: string;
  themes: string[];
  currentSituation: string;
  questions: string;
}) {
  return {
    to: ADMIN_EMAIL,
    subject: `【新着メンター相談】${params.mentorName} さんへの申し込みがありました`,
    html: htmlWrap(`
      <h2>新着メンター相談</h2>
      <p><strong>${params.mentorName}</strong> さんへの相談申し込みがありました。</p>
      <p><strong>申込者:</strong> ${params.contactEmail}</p>
      <p><strong>相談テーマ:</strong> ${params.themes.length > 0 ? params.themes.join(", ") : "（未選択）"}</p>
      <p><strong>現在の状況:</strong> ${params.currentSituation}</p>
      <p><strong>聞きたいこと:</strong> ${params.questions}</p>
      <p>内容を確認の上、メンターに転送してください。</p>
    `),
  };
}

// T5 申込者宛
export function mentorReservationUserTemplate(params: {
  to: string;
  mentorName: string;
}) {
  return {
    to: params.to,
    subject: `【opinio.jp】${params.mentorName} さんへの相談申し込みを受け付けました`,
    html: htmlWrap(`
      <h2>メンター相談申し込みを受け付けました</h2>
      <p><strong>${params.mentorName}</strong> さんへの相談申し込みありがとうございます。</p>
      <p>編集部が内容を確認し、メンターへ転送いたします。</p>
      <p>メンターから直接ご連絡があるまで、しばらくお待ちください。</p>
      <p><a href="https://opinio.jp/mypage">マイページで状況を確認する →</a></p>
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
    subject: `【新着応募】${params.companyName} の ${params.jobTitle} に応募がありました`,
    html: htmlWrap(`
      <h2>新着求人応募</h2>
      <p><strong>${params.companyName}</strong>「${params.jobTitle}」への応募がありました。</p>
      <p><strong>応募者:</strong> ${params.applicantName}（${params.applicantEmail}）</p>
      <p><strong>志望動機:</strong> ${params.message || "（未記入）"}</p>
      <p><a href="https://opinio.jp/biz/applications">/biz/applications で確認する →</a></p>
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
    subject: `【opinio.jp】${params.companyName} の ${params.jobTitle} への応募を受け付けました`,
    html: htmlWrap(`
      <h2>応募を受け付けました</h2>
      <p><strong>${params.companyName}</strong>「${params.jobTitle}」へのご応募ありがとうございます。</p>
      <p>採用担当者があなたの応募を確認次第、ご連絡いたします。</p>
      <p><a href="https://opinio.jp/mypage/applications">マイページで選考状況を確認する →</a></p>
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
      <h2>${subjects[params.status].replace("【opinio.jp】", "")}</h2>
      <p>${params.name} さん、</p>
      <p>${messages[params.status]}</p>
      <p style="font-size: 13px; color: #888;">応募求人: ${params.companyName} / ${params.jobTitle}</p>
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
    subject: `${params.companyName} の採用担当として招待されました - Opinio Work`,
    html: htmlWrap(`
      <h2>${params.companyName} の採用担当チームに招待されました</h2>
      <p>${params.recipientEmail} 様</p>
      <p>
        <strong>${params.inviterName}</strong> さんから、Opinio Work で
        <strong>${params.companyName}</strong> の${roleText}招待されました。
      </p>
      <p>下記ボタンから招待を受諾してください。</p>
      <p style="margin: 28px 0;">
        <a
          href="${params.inviteUrl}"
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
  isDuplicate?: boolean;     // force_create=true で同名企業が既存だった場合
}) {
  const subjectPrefix = params.isDuplicate ? "[Opinio Work] [重複承知] " : "[Opinio Work] ";
  const duplicateNote = params.isDuplicate
    ? `<p style="color: #92400E; background: #FEF3C7; padding: 10px 14px; border-radius: 6px; font-size: 13px;">
        ⚠️ 同名企業が既に存在する状態で、ユーザーが意図的に別法人として作成しました。
        表記ゆれの統合が必要かどうか確認してください。
       </p>`
    : "";

  return {
    to: ADMIN_EMAIL,
    subject: `${subjectPrefix}新規企業が登録されました: ${params.companyName}`,
    html: htmlWrap(`
      <h2>新しい企業が Opinio Work に登録されました</h2>
      ${duplicateNote}
      <table style="border-collapse: collapse; width: 100%; font-size: 13px; margin-top: 16px;">
        <tr>
          <td style="padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: 600; width: 120px;">企業名</td>
          <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${params.companyName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: 600;">作成者</td>
          <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${params.creatorName}（${params.creatorEmail}）</td>
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
