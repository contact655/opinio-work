import { cache } from "react";

/**
 * ★検証用アカウント専用の表示（/t/companies・/t/jobs）を描いている最中か（2026-10-12）。リクエストごとの印。
 *   ページの先頭で `enterTestViewMode()` を呼ぶと、その描画の中のリンク（求人・企業ページ）が /t/… を指す。
 * ⚠️ 通常の公開ページ（ISR）では呼ばない。呼ばなければ今までどおり /jobs/…・/companies/… を指す。
 */
const flag = cache(() => ({ on: false }));
export function enterTestViewMode(): void { flag().on = true; }
export function inTestViewMode(): boolean { return flag().on; }
export function jobPath(slugOrId: string): string { return `${inTestViewMode() ? "/t" : ""}/jobs/${slugOrId}`; }
export function companyPath(slugOrId: string): string { return `${inTestViewMode() ? "/t" : ""}/companies/${slugOrId}`; }

/** 検証用の会社のページ上部に出す一行（検証用アカウントにだけ見える） */
export const TEST_COMPANY_NOTICE = "検証用の会社です（一般の利用者には表示されません）";

/** ヘッダーの検索候補で、検証用の会社・求人の2行目に出す語 */
export const TEST_SUGGEST_NOTE = "検証用（一般の利用者には表示されません）";
