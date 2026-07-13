"use client";

import { useState, useTransition } from "react";
import { grantBonusCredits, updateMonthlyLimit } from "./actions";

type Quota = {
  companyId: string;
  companyName: string;
  quotaId: string | null;
  monthlyLimit: number;
  bonusCredits: number;
  usedThisMonth: number;
  periodStart: string | null;
};

export default function ScoutQuotasClient({ quotas: initial }: { quotas: Quota[] }) {
  const [quotas, setQuotas] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function flash(m: string) {
    setMsg(m);
    setTimeout(() => setMsg(null), 3000);
  }

  function handleGrant(companyId: string, amount: number) {
    startTransition(async () => {
      const res = await grantBonusCredits(companyId, amount);
      if (res.error) { alert(res.error); return; }
      setQuotas(prev => prev.map(q => q.companyId === companyId
        ? { ...q, bonusCredits: q.bonusCredits + amount, quotaId: res.quotaId ?? q.quotaId }
        : q));
      flash(`+${amount} 通を付与しました`);
    });
  }

  function handleMonthlyLimit(companyId: string, limit: number) {
    startTransition(async () => {
      const res = await updateMonthlyLimit(companyId, limit);
      if (res.error) { alert(res.error); return; }
      setQuotas(prev => prev.map(q => q.companyId === companyId ? { ...q, monthlyLimit: limit } : q));
      flash(`月次上限を ${limit} 通に変更しました`);
    });
  }

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", marginBottom: 4 }}>スカウト枠管理</h1>
          <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>
            企業ごとのスカウト送信枠を管理します。月次リセットはDBトリガーで自動的に行われます。
          </p>
        </div>
        {msg && (
          <div style={{ background: "var(--success-soft)", border: "1px solid #a7f3d0", borderRadius: 8, padding: "8px 16px", fontSize: 13, color: "var(--success)", fontWeight: 600 }}>
            ✓ {msg}
          </div>
        )}
      </div>

      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 12, border: "1px solid var(--line)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "var(--bg-tint)" }}>
            <tr>
              {["企業", "月次上限", "追加枠", "今月使用", "残り", "追加付与", "上限変更"].map(h => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontWeight: 600, fontSize: 12, color: "var(--ink)", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {quotas.map((q) => {
              const remaining = Math.max(0, q.monthlyLimit + q.bonusCredits - q.usedThisMonth);
              return (
                <tr key={q.companyId} style={{ borderBottom: "1px solid var(--line-soft)" }}>
                  <td style={TD}><span style={{ fontWeight: 600 }}>{q.companyName}</span></td>
                  <td style={TD}>{q.monthlyLimit} 通</td>
                  <td style={TD}>
                    {q.bonusCredits > 0
                      ? <span style={{ color: "var(--success)", fontWeight: 700 }}>+{q.bonusCredits}</span>
                      : <span style={{ color: "var(--ink-mute)" }}>—</span>}
                  </td>
                  <td style={TD}>{q.usedThisMonth} 通</td>
                  <td style={TD}>
                    <span style={{
                      fontWeight: 700,
                      color: remaining === 0 ? "var(--error)" : remaining < 5 ? "#d97706" : "var(--success)",
                    }}>
                      {remaining} 通
                    </span>
                  </td>
                  <td style={TD}>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[10, 30, 50].map(amt => (
                        <button
                          key={amt}
                          onClick={() => handleGrant(q.companyId, amt)}
                          disabled={isPending}
                          style={{ fontSize: 11, padding: "4px 10px", border: "1px solid var(--royal-100)", borderRadius: 6, background: "var(--royal-50)", color: "var(--royal)", cursor: "pointer", fontWeight: 600 }}
                        >
                          +{amt}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td style={TD}>
                    <MonthlyLimitEditor
                      currentLimit={q.monthlyLimit}
                      onSave={(v) => handleMonthlyLimit(q.companyId, v)}
                      disabled={isPending}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MonthlyLimitEditor({ currentLimit, onSave, disabled }: {
  currentLimit: number;
  onSave: (v: number) => void;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(currentLimit.toString());

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        style={{ fontSize: 11, padding: "4px 10px", border: "1px solid var(--line)", borderRadius: 6, background: "#fff", cursor: "pointer" }}
      >
        変更
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input
        type="number"
        min={0}
        max={500}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        style={{ width: 60, padding: "4px 8px", border: "1px solid var(--line)", borderRadius: 6, fontSize: 13 }}
        autoFocus
      />
      <button
        onClick={() => { onSave(parseInt(val) || 0); setEditing(false); }}
        disabled={disabled}
        style={{ fontSize: 11, padding: "4px 10px", border: "none", borderRadius: 6, background: "var(--royal)", color: "#fff", cursor: "pointer", fontWeight: 600 }}
      >
        保存
      </button>
      <button
        onClick={() => { setVal(currentLimit.toString()); setEditing(false); }}
        style={{ fontSize: 11, padding: "4px 8px", border: "1px solid var(--line)", borderRadius: 6, background: "#fff", cursor: "pointer" }}
      >
        ×
      </button>
    </div>
  );
}

const TD: React.CSSProperties = { padding: "12px 14px", color: "var(--ink-soft)", verticalAlign: "middle" };
