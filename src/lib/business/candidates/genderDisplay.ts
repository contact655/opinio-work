/* ★サーバー専用（環境変数を読む）。画面には表示用の文字（男性・女性・その他）だけを渡す */
import "server-only";
import { GENDER_OPTIONS } from "@/lib/constants/gender";

/**
 * ★候補者を探すの一覧と右欄に「性別」を出すか（2026-10-12 / 柴さんの指示）。
 *   CANDIDATE_GENDER_DISPLAY_ENABLED = "true" / "false"。
 *   未設定 → NODE_ENV が production 以外（ローカルの dev）なら有効、production（本番・Vercel のプレビュー）なら無効。
 *
 * ⚠️★★**表示だけ。絞り込み・並び替え・保存した条件には絶対に使わない**（男女雇用機会均等法5条）。
 *    企業（事業主）が自分で絞る形になるので、フィルタを持たせることは差別的な取扱いを直接手助けする（`lib/constants/gender.ts`）。
 *    ⚠️ だから `Candidate` に載せるのは**表示用の文字（genderLabel）だけ**で、値（male など）は渡さない。
 * ⚠️★「既定で本番は無効」の向きを守ること（年齢の `isCandidateAgeDisplayEnabled` と同じ形）。
 * ⚠️ 本人が登録した人だけ。未登録・「回答しない」は何も出さない（推測しない）。
 */
export function isCandidateGenderDisplayEnabled(): boolean {
  const v = process.env.CANDIDATE_GENDER_DISPLAY_ENABLED;
  if (v === "true") return true;
  if (v === "false") return false;
  return process.env.NODE_ENV !== "production";
}

/** 表示用の文字。⚠️「回答しない」・未登録・知らない値は null（何も出さない） */
export function candidateGenderLabel(gender: string | null | undefined): string | null {
  if (!gender || gender === "prefer_not_to_say") return null;
  return GENDER_OPTIONS.find((o) => o.value === gender)?.label ?? null;
}
