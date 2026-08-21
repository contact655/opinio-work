/**
 * 企業向け規約の種別とバージョン。
 *
 * ⚠️ **このファイルにサーバー専用のものを import しないこと。**
 *    同意パネル（`"use client"`）から読むために `lib/business/termsAgreement.ts`
 *    から切り出した。あちらは `createAdminClient`（service_role）を import して
 *    いるので、クライアント部品から読むとサーバー専用コードがバンドルに載る。
 */

/**
 * 企業向け規約の種別。
 *
 * ⚠️ **2026-08-14 に「掲載」と「人材紹介」へ分けた。**
 *    それ以前の同意は `business`（分割前の1本）で記録されている。
 *    `business` は**消さない。** 分割前に同意した企業を未同意に戻さないため、
 *    どちらの判定でも `business` を有効として扱う。
 */
export const TERMS_TYPES = {
  /** 掲載利用規約（/terms/listing）。企業情報の掲載に必要 */
  listing: "listing",
  /** 人材紹介利用規約（/terms/placement）。スカウト・紹介を使うときに必要 */
  placement: "placement",
  /** 分割前の1本（/terms/business）。過去の同意記録のみ */
  legacy: "business",
} as const;

/**
 * 記録する規約のバージョン。
 *
 * ⚠️ **2026-08-21 に掲載利用規約を改定したので更新した**
 *    （掲載サービスの成功報酬を廃止。/terms/listing 第4条2項・第6条3項）。
 *
 * ⚠️ **同意を送る側でハードコードしないこと。** 2026-08-21 まで
 *    `PlacementTermsPanel` と `CompanyEditClient` が別々に `"2026-08-01"` を
 *    直書きしており、**この定数を上げても記録される版は変わらなかった。**
 *    規約を改定したら、ここだけを直せば両方に反映される。
 *
 * ⚠️ **`hasAgreedTerms` はこの値を見ていない。** `terms_type` だけで判定しており、
 *    版が上がっても既存の同意は同意のまま残る。
 *    「改定したら再同意を求める」にはしていない（そうすると版を上げるたびに
 *    全企業の掲載が止まる）。**この値は記録用。**
 *
 * ⚠️ `terms_type` が `listing` / `placement` に分かれているのに
 *    バージョンは1つしか持っていない。**2本の規約が別々に改定されると表せない。**
 *    同意管理の作り直しは別タスク。今回は認識だけ残す。
 *
 * ⚠️ もう1つ別系統がある。`biz/auth/page.tsx` は
 *    `user_metadata.agreed_terms_version` に **`"2026-07"`** を直書きしている。
 *    `ow_terms_agreements` とは別の記録で、こちらは今回触っていない（別タスク）。
 */
export const TERMS_VERSION = "2026-08-21";
