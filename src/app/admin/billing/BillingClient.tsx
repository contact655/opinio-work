"use client";

import { useState, useTransition, useRef } from "react";
import { updateBillingStatus, updateBillingNote } from "./actions";

export type BillingRecord = {
  id: string;
  companyName: string;
  jobTitle: string;
  applicantName: string;
  hiredSalary: number;
  hiredConfirmedAt: string;
  billingStatus: "unpaid" | "invoiced" | "paid";
  billingNote: string | null;
  invoicedAt: string | null;
  paidAt: string | null;
};

const STATUS_CONFIG = {
  unpaid:   { label: "未請求",  bg: "#FEF3C7", color: "#B45309", border: "#FDE68A" },
  invoiced: { label: "請求済み", bg: "#EFF3FC", color: "var(--royal)", border: "#DCE5F7" },
  paid:     { label: "入金済み", bg: "#ECFDF5", color: "var(--success)", border: "#A7F3D0" },
} as const;

function formatYen(man: number) {
  return `${man.toLocaleString()}万円`;
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
}

function NoteCell({ record }: { record: BillingRecord }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(record.billingNote ?? "");
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLInputElement>(null);

  function handleSave() {
    startTransition(async () => {
      await updateBillingNote(record.id, value);
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <input
          ref={ref}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
          style={{
            fontSize: 12, padding: "4px 8px", borderRadius: 6,
            border: "1.5px solid var(--royal)", outline: "none",
            width: 160, fontFamily: "inherit",
          }}
          placeholder="請求書番号など"
        />
        <button onClick={handleSave} disabled={isPending}
          style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "none", background: "var(--royal)", color: "#fff", cursor: "pointer" }}>
          {isPending ? "…" : "保存"}
        </button>
      </div>
    );
  }
  return (
    <button onClick={() => setEditing(true)} style={{
      background: "none", border: "none", cursor: "pointer", padding: 0,
      fontSize: 12, color: value ? "var(--ink-soft)" : "var(--ink-mute)",
      textAlign: "left",
    }}>
      {value || <span style={{ fontSize: 11 }}>メモを追加</span>}
    </button>
  );
}

function StatusSelect({ record }: { record: BillingRecord }) {
  const [isPending, startTransition] = useTransition();
  const cfg = STATUS_CONFIG[record.billingStatus];
  return (
    <select
      value={record.billingStatus}
      disabled={isPending}
      onChange={(e) => {
        startTransition(() => updateBillingStatus(record.id, e.target.value as "unpaid" | "invoiced" | "paid"));
      }}
      style={{
        fontSize: 11, fontWeight: 700, padding: "4px 8px", borderRadius: 6,
        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
        cursor: "pointer", outline: "none", fontFamily: "inherit",
        opacity: isPending ? 0.5 : 1,
      }}
    >
      <option value="unpaid">未請求</option>
      <option value="invoiced">請求済み</option>
      <option value="paid">入金済み</option>
    </select>
  );
}

export function BillingClient({ records }: { records: BillingRecord[] }) {
  const unpaidCount   = records.filter((r) => r.billingStatus === "unpaid").length;
  const invoicedCount = records.filter((r) => r.billingStatus === "invoiced").length;
  const paidCount     = records.filter((r) => r.billingStatus === "paid").length;
  const totalFee      = records.reduce((s, r) => s + Math.round(r.hiredSalary * 0.1), 0);
  const paidFee       = records.filter((r) => r.billingStatus === "paid")
                               .reduce((s, r) => s + Math.round(r.hiredSalary * 0.1), 0);

  return (
    <>
      {/* KPI */}
      <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
        {[
          { label: "未請求",   count: unpaidCount,   amount: null, bg: "#FEF3C7", color: "#B45309", border: "#FDE68A" },
          { label: "請求済み", count: invoicedCount, amount: null, bg: "#EFF3FC", color: "var(--royal)", border: "#DCE5F7" },
          { label: "入金済み", count: paidCount,     amount: formatYen(paidFee), bg: "#ECFDF5", color: "var(--success)", border: "#A7F3D0" },
          { label: "累計請求額合計", count: null, amount: formatYen(totalFee), bg: "#F3E8FF", color: "#7C3AED", border: "#DDD6FE" },
        ].map(({ label, count, amount, bg, color, border }) => (
          <div key={label} style={{ padding: "14px 20px", borderRadius: 12, background: bg, border: `1px solid ${border}`, minWidth: 140 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
            {count !== null && (
              <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: "Inter, sans-serif", lineHeight: 1 }}>{count}<span style={{ fontSize: 13, marginLeft: 2 }}>件</span></div>
            )}
            {amount && (
              <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: "Inter, sans-serif", lineHeight: 1, marginTop: count !== null ? 4 : 0 }}>{amount}</div>
            )}
          </div>
        ))}
      </div>

      {/* Table */}
      {records.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: "var(--ink-mute)" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>採用確定の報告はまだありません</p>
          <p style={{ fontSize: 13, color: "var(--ink-mute)" }}>企業側が採用確定を報告すると、ここに表示されます</p>
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid var(--line)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-tint)", borderBottom: "1px solid var(--line)" }}>
                {["企業名", "採用者", "求人", "申告年収", "請求額(10%)", "採用確定日", "ステータス", "メモ"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, color: "var(--ink-mute)", fontWeight: 700, letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--line-soft)" }} className="billing-row">
                  <td style={{ padding: "12px 14px", fontWeight: 600, color: "var(--ink)" }}>{r.companyName}</td>
                  <td style={{ padding: "12px 14px", color: "var(--ink-soft)" }}>{r.applicantName || "—"}</td>
                  <td style={{ padding: "12px 14px", color: "var(--ink-soft)", fontSize: 12, maxWidth: 180 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{r.jobTitle}</span>
                  </td>
                  <td style={{ padding: "12px 14px", fontFamily: "Inter, sans-serif", fontWeight: 600, color: "var(--ink)" }}>
                    {formatYen(r.hiredSalary)}
                  </td>
                  <td style={{ padding: "12px 14px", fontFamily: "Inter, sans-serif", fontWeight: 700, color: "var(--success)", fontSize: 14 }}>
                    {formatYen(Math.round(r.hiredSalary * 0.1))}
                  </td>
                  <td style={{ padding: "12px 14px", color: "var(--ink-mute)", fontSize: 12, whiteSpace: "nowrap", fontFamily: "Inter, sans-serif" }}>
                    {formatDate(r.hiredConfirmedAt)}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <StatusSelect record={r} />
                    {r.billingStatus === "invoiced" && r.invoicedAt && (
                      <div style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 3 }}>
                        {formatDate(r.invoicedAt)}
                      </div>
                    )}
                    {r.billingStatus === "paid" && r.paidAt && (
                      <div style={{ fontSize: 10, color: "var(--success)", marginTop: 3 }}>
                        {formatDate(r.paidAt)} 入金
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <NoteCell record={r} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <style>{`.billing-row:hover { background: var(--bg-tint); } .billing-row:last-child { border-bottom: none; }`}</style>
    </>
  );
}
