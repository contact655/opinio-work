/**
 * 日時を相対表示に変換するユーティリティ
 *
 * | 経過時間              | 表示                              |
 * |---------------------|----------------------------------|
 * | 1 分未満             | たった今                           |
 * | 1 時間未満            | N 分前                            |
 * | 今日（同日・1h+）      | 今日 HH:MM                        |
 * | 昨日                 | 昨日 HH:MM                        |
 * | 7 日未満             | N 日前                            |
 * | 7 日以上             | YYYY/MM/DD（withTime: true で HH:MM 付与）|
 *
 * タイムゾーン: ローカル時刻（Asia/Tokyo 環境を想定）
 * 外部依存なし（date-fns 不使用）
 */
export function formatRelativeTime(
  date: Date | string,
  options?: { withTime?: boolean }
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();

  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);

  // 1 分未満
  if (diffSec < 60) return "たった今";

  // 1 時間未満
  if (diffMin < 60) return `${diffMin}分前`;

  // 今日・昨日は startOfDay 境界で判定（経過時間ではなくカレンダー日付）
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
  const startOfD = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const HHmm = d.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // 今日
  if (startOfD.getTime() >= startOfToday.getTime()) {
    return `今日 ${HHmm}`;
  }

  // 昨日
  if (startOfD.getTime() >= startOfYesterday.getTime()) {
    return `昨日 ${HHmm}`;
  }

  // 7 日未満（2〜6 日前）
  const diffDays = Math.floor(
    (startOfToday.getTime() - startOfD.getTime()) / (24 * 60 * 60 * 1000)
  );
  if (diffDays < 7) return `${diffDays}日前`;

  // 7 日以上 → YYYY/MM/DD（withTime: true のとき HH:MM を付与）
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return options?.withTime ? `${y}/${m}/${day} ${HHmm}` : `${y}/${m}/${day}`;
}
