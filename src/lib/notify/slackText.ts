/**
 * ★Slack 通知の決めごと（2026-10-12）。**クライアントからも読む**（URL の判定・表示）。
 * ⚠️ `@/` の import を置かないこと（node --test が直接読む）。
 */
export type SlackNotifyKind = "reply" | "meeting" | "application";

export const SLACK_WEBHOOK_PREFIX = "https://hooks.slack.com/";

/** 連続でこの回数失敗したら一時停止する */
export const SLACK_PAUSE_AFTER_FAILURES = 3;

/** 同じ件について、この時間内に続いたものは送らない（メールの通知と同じ30分） */
export const SLACK_WINDOW_MINUTES = 30;

/** https://hooks.slack.com/ で始まり、ホストがちょうど hooks.slack.com のものだけ */
export function isValidSlackWebhookUrl(raw: string): boolean {
  const s = raw.trim();
  if (!s.startsWith(SLACK_WEBHOOK_PREFIX) || /\s/.test(s)) return false;
  try {
    const u = new URL(s);
    return u.protocol === "https:" && u.hostname === "hooks.slack.com" && !u.port && !u.username && !u.password
      && !u.search && !u.hash && /^\/[A-Za-z0-9/_-]+$/.test(u.pathname) && u.pathname.length > 1;
  } catch {
    return false;
  }
}

/** 画面に出すのは末尾だけ（全体は秘密） */
export function maskSlackWebhookUrl(url: string): string {
  return `https://hooks.slack.com/…${url.slice(-6)}`;
}

/** Slack の mrkdwn で意味を持つ文字を逃がす */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * ★送る文。**メッセージ本文・連絡先は入れない**（柴さんの指示）。名前は「含める」がオンのときだけ。
 */
export function buildSlackText(p: { kind: SlackNotifyKind; candidateName: string | null; url: string }): string {
  const name = p.candidateName?.trim() ? esc(p.candidateName.trim()) : null;
  const head = p.kind === "reply"
    ? (name ? `${name}さんから返信がありました` : "新しい返信が1件あります")
    : p.kind === "meeting"
      ? (name ? `${name}さんから面談の申込がありました` : "面談の申込が1件あります")
      : (name ? `${name}さんから応募がありました` : "応募が1件あります");
  return `${head}\n<${p.url}|OPINIO で開く>`;
}
