/**
 * メッセージリストの日付セパレータ用ラベルを返すユーティリティ
 *
 * | 日付   | 表示       |
 * |-------|-----------|
 * | 今日   | 今日       |
 * | 昨日   | 昨日       |
 * | それ以前 | YYYY/MM/DD |
 *
 * タイムゾーン: ローカル時刻（Asia/Tokyo 環境を想定）
 * startOfDay 境界で判定（経過時間ではなくカレンダー日付）
 */
export function formatDateSeparator(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
  const startOfD = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (startOfD.getTime() >= startOfToday.getTime()) return "今日";
  if (startOfD.getTime() >= startOfYesterday.getTime()) return "昨日";

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}
