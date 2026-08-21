"use client";

import { useState, useTransition } from "react";
import { changePlan } from "./actions";
import { PLAN_TYPES, PLAN_LABELS, PLAN_MONTHLY_FEE, BILLING_CYCLES, type PlanType } from "@/lib/constants/plans";

export type PlanHistoryRow = {
  id: string;
  planType: string;
  billingCycle: string;
  monthlyFee: number | null;
  startedAt: string | null;
  endedAt: string | null;
  status: string;
};

export type CompanyPlanRow = {
  companyId: string;
  companyName: string;
  isPublished: boolean;
  isApproved: boolean;
  /** ⚠️ active が無ければ null。既定値で埋めない */
  current: PlanHistoryRow | null;
  history: PlanHistoryRow[];
};

const CYCLE_LABELS: Record<string, string> = { monthly: "月額", yearly: "年額" };

function fmt(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function PlansClient({ rows }: { rows: CompanyPlanRow[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const [planType, setPlanType] = useState<PlanType>("free");
  const [cycle, setCycle] = useState<string>("monthly");

  function openEditor(row: CompanyPlanRow) {
    setEditing(row.companyId);
    setPlanType(((row.current?.planType ?? "free") as PlanType));
    setCycle(row.current?.billingCycle ?? "monthly");
    setMessage(null);
  }

  function save(companyId: string) {
    /* ⚠️ 月額は送らない。**サーバー側が定数から入れる。**
          画面で打たせると、LPの表示と DB の記録が食い違う。 */
    startTransition(async () => {
      const res = await changePlan(companyId, planType, cycle);
      if (res.ok) {
        setMessage({ kind: "ok", text: "プランを変更しました" });
        setEditing(null);
      } else {
        /* ⚠️ error を握り潰さず画面に出す（ActionResult 型の意味）。 */
        setMessage({ kind: "error", text: res.error ?? "変更に失敗しました" });
      }
    });
  }

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: "0 0 6px" }}>プラン管理</h1>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8, margin: 0 }}>
          企業管理者が紐付いている企業のみ表示しています（{rows.length}社）。
          <br />
          ⚠️ 決済は未実装です。請求は手作業で行います。プランの変更は履歴として積まれ、前のプランは終了扱いになります。
        </p>
      </div>

      {message && (
        <div style={{
          marginBottom: 18, padding: "12px 16px", borderRadius: 10, fontSize: 13,
          background: message.kind === "ok" ? "var(--success-soft)" : "var(--error-soft)",
          color: message.kind === "ok" ? "var(--success)" : "var(--error)",
          border: `1px solid ${message.kind === "ok" ? "#A7F3D0" : "#FCA5A5"}`,
        }}>{message.text}</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.map((row) => (
          <div key={row.companyId} style={{
            background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "18px 20px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{row.companyName}</div>
                <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 3 }}>
                  {row.isPublished ? "公開中" : "非公開"} / {row.isApproved ? "承認済み" : "未承認"}
                </div>
              </div>

              <div style={{ minWidth: 200 }}>
                {row.current ? (
                  <>
                    <span style={{
                      fontSize: 13, fontWeight: 700, padding: "4px 12px", borderRadius: 100,
                      background: row.current.planType === "free" ? "var(--bg-tint)" : "var(--royal-50)",
                      color: row.current.planType === "free" ? "var(--ink-soft)" : "var(--royal)",
                      border: `1px solid ${row.current.planType === "free" ? "var(--line)" : "var(--royal-100)"}`,
                    }}>
                      {PLAN_LABELS[row.current.planType as PlanType] ?? row.current.planType}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--ink-mute)", marginLeft: 10 }}>
                      {CYCLE_LABELS[row.current.billingCycle] ?? row.current.billingCycle}
                      {row.current.monthlyFee != null && ` / ${row.current.monthlyFee.toLocaleString()}円`}
                    </span>
                    <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 4 }}>
                      {fmt(row.current.startedAt)} 〜 {fmt(row.current.endedAt)}
                    </div>
                  </>
                ) : (
                  /* ⚠️ 「未設定」と「無料」を混ぜない。行が無いことをそのまま出す。 */
                  <span style={{ fontSize: 13, color: "var(--error)", fontWeight: 600 }}>
                    プラン未設定（要確認）
                  </span>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button type="button" onClick={() => setExpanded(expanded === row.companyId ? null : row.companyId)}
                  className="btn-fixed-size"
                  style={{
                    padding: "8px 14px", fontSize: 12, fontWeight: 600, borderRadius: 8,
                    background: "#fff", color: "var(--ink-soft)", border: "1px solid var(--line)", cursor: "pointer",
                  }}>
                  履歴（{row.history.length}）
                </button>
                <button type="button" onClick={() => openEditor(row)} disabled={isPending}
                  className="btn-fixed-size"
                  style={{
                    padding: "8px 16px", fontSize: 12, fontWeight: 700, borderRadius: 8,
                    background: "var(--royal)", color: "#fff", border: "none",
                    cursor: isPending ? "default" : "pointer",
                  }}>
                  変更
                </button>
              </div>
            </div>

            {editing === row.companyId && (
              <div style={{
                marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line-soft)",
                display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap",
              }}>
                <label style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                  プラン<br />
                  <select value={planType} onChange={(e) => setPlanType(e.target.value as PlanType)}
                    style={{ marginTop: 4, padding: "8px 10px", fontSize: 13, borderRadius: 8, border: "1px solid var(--line)" }}>
                    {PLAN_TYPES.map((p) => <option key={p} value={p}>{PLAN_LABELS[p]}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                  支払い周期<br />
                  <select value={cycle} onChange={(e) => setCycle(e.target.value)}
                    style={{ marginTop: 4, padding: "8px 10px", fontSize: 13, borderRadius: 8, border: "1px solid var(--line)" }}>
                    {BILLING_CYCLES.map((c) => <option key={c} value={c}>{CYCLE_LABELS[c]}</option>)}
                  </select>
                </label>
                {/* ⚠️ 月額は入力させない。プランを選べば定数から決まる。 */}
                <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                  月額（自動）<br />
                  <div style={{
                    marginTop: 4, padding: "8px 12px", fontSize: 13, borderRadius: 8,
                    background: "var(--bg-tint)", border: "1px solid var(--line)",
                    color: "var(--ink)", fontWeight: 700, minWidth: 120,
                  }}>
                    {PLAN_MONTHLY_FEE[planType].toLocaleString()}円
                    <span style={{ fontSize: 11, fontWeight: 400, color: "var(--ink-mute)" }}>（税別）</span>
                  </div>
                </div>
                <button type="button" onClick={() => save(row.companyId)} disabled={isPending}
                  className="btn-fixed-size"
                  style={{
                    padding: "9px 18px", fontSize: 13, fontWeight: 700, borderRadius: 8,
                    background: "var(--royal)", color: "#fff", border: "none", cursor: isPending ? "default" : "pointer",
                  }}>
                  {isPending ? "保存中…" : "保存"}
                </button>
                <button type="button" onClick={() => setEditing(null)} disabled={isPending}
                  className="btn-fixed-size"
                  style={{
                    padding: "9px 14px", fontSize: 13, borderRadius: 8,
                    background: "#fff", color: "var(--ink-soft)", border: "1px solid var(--line)", cursor: "pointer",
                  }}>
                  やめる
                </button>
              </div>
            )}

            {expanded === row.companyId && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line-soft)" }}>
                {row.history.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: 0 }}>履歴はありません。</p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "var(--bg-tint)" }}>
                          {["プラン", "周期", "月額", "開始", "終了", "状態"].map((h) => (
                            <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "var(--ink-soft)", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {row.history.map((h) => (
                          <tr key={h.id} style={{ borderBottom: "1px solid var(--line-soft)" }}>
                            <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{PLAN_LABELS[h.planType as PlanType] ?? h.planType}</td>
                            <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{CYCLE_LABELS[h.billingCycle] ?? h.billingCycle}</td>
                            <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{h.monthlyFee != null ? `${h.monthlyFee.toLocaleString()}円` : "—"}</td>
                            <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{fmt(h.startedAt)}</td>
                            <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{fmt(h.endedAt)}</td>
                            <td style={{ padding: "8px 12px", whiteSpace: "nowrap", fontWeight: h.status === "active" ? 700 : 400,
                                         color: h.status === "active" ? "var(--success)" : "var(--ink-mute)" }}>{h.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
