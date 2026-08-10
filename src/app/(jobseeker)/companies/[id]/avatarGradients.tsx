/*
 * アバターの背景グラデーション。
 *
 * ⚠️ **"use client" を付けないこと。** サーバーコンポーネント（page.tsx）と
 *    クライアントコンポーネント（CompanyEmployeeSections.tsx）の両方から使う。
 *    クライアントモジュールに置くと、サーバー側から `.length` などを
 *    参照した時点で "Cannot dot into a client module" で落ちる（2026-08-09 に実際に踏んだ）。
 */
export const AV_GRADIENTS = [
  "linear-gradient(135deg, var(--royal), #3B5FD9)",
  "linear-gradient(135deg, #F472B6, #DB2777)",
  "linear-gradient(135deg, #34D399, var(--success))",
  "linear-gradient(135deg, #FBBF24, #D97706)",
  "linear-gradient(135deg, #818CF8, #6366F1)",
  "linear-gradient(135deg, #A78BFA, #7C3AED)",
  "linear-gradient(135deg, #22D3EE, #0891B2)",
];
