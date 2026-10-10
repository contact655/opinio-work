"use client";

import { useState, useTransition } from "react";
import { setCompanyWithdrawn } from "../actions";
import { CANDIDATE_NOTES_PURGE_DAYS } from "@/lib/constants/candidateNotes";

/**
 * ★企業の退会の操作（2026-10-10 / 段5）。記録した日から30日後に、その企業の社内メモと社内の状態が消える。
 * ⚠️ 担当者が全員無効になっても自動では消えない（この操作が起点）。
 */
export function CompanyWithdrawPanel({ companyId, withdrawnAt }: { companyId: string; withdrawnAt: string | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const purgeOn = withdrawnAt ? new Date(new Date(withdrawnAt).getTime() + CANDIDATE_NOTES_PURGE_DAYS * 86400000) : null;
  const fmt = (d: Date) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "long" }).format(d);
  return (
    <div data-state={withdrawnAt ? "withdrawn" : "active"} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "0 0 12px", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--line)", background: "#fff", fontSize: 13 }}>
      <span style={{ fontWeight: 700 }}>企業の退会</span>
      <span style={{ color: "var(--ink-soft)", flex: 1, minWidth: 0 }}>
        {withdrawnAt && purgeOn
          ? `${fmt(new Date(withdrawnAt))}に退会の操作をしました。${fmt(purgeOn)}以降に、この企業の社内メモと社内の状態を消します。`
          : `退会の操作をすると、その日から${CANDIDATE_NOTES_PURGE_DAYS}日後に、この企業の社内メモと社内の状態を消します。`}
      </span>
      <button type="button" disabled={pending}
        onClick={() => {
          if (!confirm(withdrawnAt ? "退会の操作を取り消します。よろしいですか？" : `退会の操作を記録します。${CANDIDATE_NOTES_PURGE_DAYS}日後に社内メモが消えます。よろしいですか？`)) return;
          setError(null);
          start(async () => { const r = await setCompanyWithdrawn(companyId, !withdrawnAt); if (!r.ok) setError(r.error); });
        }}
        style={{ fontSize: 12, fontWeight: 600, fontFamily: "inherit", padding: "5px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", cursor: "pointer" }}>
        {pending ? "…" : withdrawnAt ? "退会の操作を取り消す" : "退会の操作を記録する"}
      </button>
      {error && <span style={{ fontSize: 12, color: "var(--error)" }}>{error}</span>}
    </div>
  );
}
