/**
 * ★求人編集画面のステップ（2026-10-11 に6ステップへ並べ直した）。`/biz/jobs/[id]/edit?section=` の検証に使う。
 *
 * ⚠️★**`JobEditForm.tsx`（"use client"）に置かないこと。** サーバーの page.tsx から
 *    クライアントモジュールの定数を読むと、ページが丸ごと落ちる
 *    （"Attempted to call includes() from the server but includes is on the client"。
 *    2026-09-21 に実際に踏んだ。`tsc` も lint も通る）。
 * ⚠️ `JobEditForm` の `switch (activeSection)` と、`lib/jobs/publishRequirements.ts` の
 *    `JobEditStep` と揃えること。
 */
export const JOB_EDIT_SECTIONS = ["job", "conditions", "requirements", "process", "more", "review"] as const;

/**
 * ★旧ステップ名の読み替え。過去のメール・ブックマーク・求人管理のカードの
 *    `?section=settings`（公開申請へ）を新しいステップへ着地させる。⚠️ 消さないこと。
 */
const LEGACY: Record<string, (typeof JOB_EDIT_SECTIONS)[number]> = {
  basic: "job",
  content: "job",
  salary: "conditions",
  assignee: "review",
  settings: "review",
};

export function normalizeJobEditSection(raw: string | undefined | null): (typeof JOB_EDIT_SECTIONS)[number] {
  const s = raw ?? "";
  if ((JOB_EDIT_SECTIONS as readonly string[]).includes(s)) return s as (typeof JOB_EDIT_SECTIONS)[number];
  return LEGACY[s] ?? "job";
}
