/* ★サーバー専用（環境変数を読む・正確な日時を扱う）。画面には帯（ActivityBand）だけを渡す */
import "server-only";
import type { ActivityBand } from "@/lib/business/candidates/model";

/**
 * ★候補者を探すの「最近の利用」（2026-10-12 / 柴さんの指示）。表示・絞り込み・並び替えとも、このスイッチのときだけ。
 *   CANDIDATE_ACTIVITY_ENABLED = "true" / "false"。未設定ならローカルの dev は有効、本番・Vercel プレビューは無効。
 * ⚠️★既定で本番は無効の向きを守る（年齢の `isCandidateAgeDisplayEnabled` と同じ形）。規約改定（docs/privacy-policy-revision-20261012.md）が済むまで本番では無効。
 * ⚠️ 記録（`ow_users.last_active_at`）はスイッチと関係なく行う（POST /api/jobseeker/activity）。
 */
export function isCandidateActivityEnabled(): boolean {
  const v = process.env.CANDIDATE_ACTIVITY_ENABLED;
  if (v === "true") return true;
  if (v === "false") return false;
  return process.env.NODE_ENV !== "production";
}

/**
 * 最後に利用した日時 → 4段階の帯。⚠️★**正確な日時はここから先へ渡さない**（企業の画面・ページの埋め込みに載せない）。
 * 記録が無い（NULL）は null（「不明」。推測しない）。
 */
export function activityBand(lastActiveAt: string | null | undefined, now: Date = new Date()): ActivityBand | null {
  if (!lastActiveAt) return null;
  const t = new Date(lastActiveAt).getTime();
  if (!Number.isFinite(t)) return null;
  const days = (now.getTime() - t) / 86_400_000;
  if (days <= 3) return "3d";
  if (days <= 7) return "1w";
  if (days <= 30) return "1m";
  return "older";
}
