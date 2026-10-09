/**
 * ★声かけを受け取る範囲（2026-10-10 / 声かけまわり 段2）。画面と API が同じ定数を見る。
 *
 * 表: `ow_approach_preferences`（範囲）／ `ow_approach_blocked_companies`（受け取らない企業）。
 * 判定: DB 関数 `can_send_company_approach()`（範囲は `company_in_approach_range()`）。
 * ⚠️ 空の項目は「こだわらない」。企業の値が未登録のときは、**その項目で範囲を指定している人には届かない**。
 * ⚠️ 規模の値と都道府県の値は DB の CHECK でも縛っている（3層）。職種・業種は存在する id かを API で見る。
 */
export { COMPANY_SIZE_GROUPS, isCompanySizeGroup } from "@/lib/constants/employeeBand";

/** 受け取らない企業の上限。⚠️ 件数の制約なので UI と API の2層（DB には置かない） */
export const MAX_APPROACH_BLOCKED_COMPANIES = 50;

/** ⚠️ 文言は柴さんの指示どおり。言い換えない */
export const APPROACH_RANGE_EXCLUDED_NOTE = "現職・過去の在籍企業とそのグループ会社には、もともと表示されません";
