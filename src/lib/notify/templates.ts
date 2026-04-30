const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "hshiba@opinio.co.jp";

// ── 共通 HTML wrapper ──────────────────────────────────────────────────────────
function htmlWrap(content: string): string {
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px;">
      ${content}
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;"/>
      <p style="color: #888; font-size: 12px;">
        opinio.work — 採用と転職のためのプラットフォーム<br/>
        <a href="https://opinio.work">https://opinio.work</a>
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
      <p><a href="https://opinio.work/biz/meetings">/biz/meetings で確認する →</a></p>
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
    subject: `【opinio.work】${params.companyName} へのカジュアル面談申し込みを受け付けました`,
    html: htmlWrap(`
      <h2>カジュアル面談申し込みを受け付けました</h2>
      <p><strong>${params.companyName}</strong> へのカジュアル面談申し込みありがとうございます。</p>
      <p>3 営業日以内に Opinio 編集部からご連絡いたします。</p>
      <p>しばらくお待ちください。</p>
      <p><a href="https://opinio.work/mypage">マイページで状況を確認する →</a></p>
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
    company_contacted: `【opinio.work】${params.companyName} から返信が届きました`,
    scheduled: `【opinio.work】${params.companyName} とのカジュアル面談の日程が決まりました`,
    declined: `【opinio.work】${params.companyName} からカジュアル面談に関するご連絡`,
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
      <h2>${subject.replace("【opinio.work】", "")}</h2>
      <p>${message}</p>
      <p><a href="https://opinio.work/mypage">マイページで確認する →</a></p>
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
    subject: `【opinio.work】${params.mentorName} さんへの相談申し込みを受け付けました`,
    html: htmlWrap(`
      <h2>メンター相談申し込みを受け付けました</h2>
      <p><strong>${params.mentorName}</strong> さんへの相談申し込みありがとうございます。</p>
      <p>編集部が内容を確認し、メンターへ転送いたします。</p>
      <p>メンターから直接ご連絡があるまで、しばらくお待ちください。</p>
      <p><a href="https://opinio.work/mypage">マイページで状況を確認する →</a></p>
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
      <p><a href="https://opinio.work/biz/applications">/biz/applications で確認する →</a></p>
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
    subject: `【opinio.work】${params.companyName} の ${params.jobTitle} への応募を受け付けました`,
    html: htmlWrap(`
      <h2>応募を受け付けました</h2>
      <p><strong>${params.companyName}</strong>「${params.jobTitle}」へのご応募ありがとうございます。</p>
      <p>採用担当者があなたの応募を確認次第、ご連絡いたします。</p>
      <p><a href="https://opinio.work/mypage/applications">マイページで選考状況を確認する →</a></p>
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
    reviewing: `【opinio.work】${params.companyName} があなたの応募を確認しています`,
    interview: `【opinio.work】${params.companyName} が面接を希望しています`,
    accepted:  `【opinio.work】${params.companyName} から採用の連絡が届きました`,
    rejected:  `【opinio.work】${params.companyName} からのご連絡`,
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
      <h2>${subjects[params.status].replace("【opinio.work】", "")}</h2>
      <p>${params.name} さん、</p>
      <p>${messages[params.status]}</p>
      <p style="font-size: 13px; color: #888;">応募求人: ${params.companyName} / ${params.jobTitle}</p>
      <p><a href="https://opinio.work/mypage/applications">選考状況を確認する →</a></p>
    `),
  };
}
