/**
 * ★求人編集画面の節（2026-09-21）。`/biz/jobs/[id]/edit?section=` の検証に使う。
 *
 * ⚠️★**`JobEditForm.tsx`（"use client"）に置かないこと。** サーバーの page.tsx から
 *    クライアントモジュールの定数を読むと、ページが丸ごと落ちる
 *    （"Attempted to call includes() from the server but includes is on the client"。
 *    2026-09-21 に実際に踏んだ。`tsc` も lint も通る）。
 * ⚠️ `JobEditForm` の `switch (activeSection)` と揃えること。
 */
export const JOB_EDIT_SECTIONS = ["basic", "salary", "content", "requirements", "process", "assignee", "settings"] as const;
