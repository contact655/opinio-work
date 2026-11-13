"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CompanyMatchesView, CompanyManagerRow } from "@/lib/nextManager/server";
import { COMPANY_RECORD_NOTE, matchResultLabel } from "@/lib/nextManager/constants";

/* 結果ごとの色（モック）。⚠️ 色だけで区別しない（文字も必ず出す） */
const TONE: Record<string, React.CSSProperties> = {
  next_step: { background: "#EAF0FC", color: "#1A4296" },
  continue: { background: "#EEF0F3", color: "#3E4656" },
  declined: { background: "#FBECE0", color: "#8A4B0F" },
  hired: { background: "#E3F3EA", color: "#17633F" },
  pending: { background: "#fff", color: "var(--ink-mute)", border: "1px solid var(--line)" },
};

function fmt(iso: string | null): string {
  if (!iso) return "未定";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "未定";
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * ★候補者管理（Next Manager / 2026-11-13）。⚠️ メッセージ本文は出さない。
 *   退職などで会社を外れたマネージャーの記録には「退職済み」、引き継ぎ後は「退職済み → ◯◯が引き継ぎ」。
 */
export default function ManagerMatchesClient({ view, viewAll, canHandover }: {
  view: CompanyMatchesView | null;
  viewAll: boolean;
  canHandover: boolean;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 20, minWidth: 0 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "var(--ink)" }}>候補者管理</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.7 }}>
          採用中のマネージャーがマッチングした人と、面談の記録が貯まっていきます。マネージャーが退職しても、記録は会社に残ります。
          {!viewAll && " あなたが担当の記録だけを表示しています。"}
        </p>
      </div>

      {view === null ? (
        <p role="alert" data-state="manager-matches-error" style={{ margin: 0, fontSize: 14, color: "var(--error)" }}>
          読み込めませんでした（0件という意味ではありません）。時間をおいて開き直してください。
        </p>
      ) : (
        <div className="mm-layout" style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
          <section aria-label="マッチングした求職者" style={{ flex: "999 1 640px", minWidth: 0, background: "#fff", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>マッチングした求職者</h2>
              <span data-state="manager-matches-count" style={{ fontSize: 13, color: "var(--ink-mute)" }}>全 {view.rows.length} 件</span>
            </div>
            {view.rows.length === 0 ? (
              <p data-state="manager-matches-empty" style={{ margin: 0, padding: "28px 18px", fontSize: 14, color: "var(--ink-mute)", lineHeight: 1.8 }}>
                まだマッチングした人はいません。マネージャーが「採用中」にしたうえで、メッセージに相手が返信すると、ここに記録が1件できます。
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 760 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-tint, #F6F7F9)", color: "var(--ink-mute)", fontSize: 12, textAlign: "left" }}>
                      <th style={{ padding: "10px 18px", fontWeight: 700 }}>求職者</th>
                      <th style={{ padding: "10px 12px", fontWeight: 700 }}>担当マネージャー</th>
                      <th style={{ padding: "10px 12px", fontWeight: 700 }}>マッチング日</th>
                      <th style={{ padding: "10px 12px", fontWeight: 700 }}>面談日</th>
                      <th style={{ padding: "10px 12px", fontWeight: 700 }}>結果</th>
                      <th style={{ padding: "10px 18px 10px 12px", fontWeight: 700 }}>メモ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.rows.map((r) => (
                      <tr key={r.id} data-state="manager-match-row" style={{ borderTop: "1px solid var(--line)", verticalAlign: "top" }}>
                        <td style={{ padding: "12px 18px", fontWeight: 700, whiteSpace: "nowrap" }}>
                          <Link href={`/u/${r.candidateId}`} style={{ color: "var(--ink)" }}>{r.candidateName}</Link>
                          {r.jobTitle && <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginTop: 2 }}>{r.jobTitle}</div>}
                        </td>
                        <td style={{ padding: "12px" }}>
                          {/* ★引き継いだ記録は、もとの担当の名前の下に「退職済み → 後任が引き継ぎ」（モック） */}
                          {!r.managerLeft && r.handedOverFromName ? (
                            <>
                              <div style={{ whiteSpace: "nowrap" }}>{r.handedOverFromName}</div>
                              <div data-state="manager-handed-over" style={{ fontSize: 12, color: "#8A4B0F", whiteSpace: "nowrap" }}>
                                {r.handedOverFromLeft ? "退職済み → " : ""}{r.managerName}が引き継ぎ
                              </div>
                            </>
                          ) : (
                            <>
                              <div style={{ whiteSpace: "nowrap" }}>{r.managerName ?? "（退会済み）"}</div>
                              {r.managerLeft && (
                                <div data-state="manager-left" style={{ fontSize: 12, color: "#8A4B0F", whiteSpace: "nowrap" }}>退職済み（引き継ぎ待ち）</div>
                              )}
                            </>
                          )}
                        </td>
                        <td style={{ padding: "12px", color: "var(--ink-soft)", whiteSpace: "nowrap" }}>{fmt(r.matchedAt)}</td>
                        <td style={{ padding: "12px", color: "var(--ink-soft)", whiteSpace: "nowrap" }}>{fmt(r.metOn)}</td>
                        <td style={{ padding: "12px" }}>
                          <span data-state={`result-${r.result ?? "pending"}`} style={{ display: "inline-block", fontSize: 12, fontWeight: 700, borderRadius: 999, padding: "4px 10px", whiteSpace: "nowrap", ...(TONE[r.result ?? "pending"]) }}>
                            {matchResultLabel(r.result)}
                          </span>
                        </td>
                        <td style={{ padding: "12px 18px 12px 12px", color: "var(--ink-soft)", fontSize: 13, lineHeight: 1.6, minWidth: 200, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{r.memo ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <aside style={{ flex: "1 1 260px", minWidth: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16 }}>
            <ManagersCard managers={view.managers} successors={view.successors} canHandover={canHandover} />
            <section aria-label="会社に残らないもの" style={{ background: "var(--bg-tint, #F1F3F6)", borderRadius: 12, padding: 18 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700 }}>会社に残らないもの</h2>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)" }}>{COMPANY_RECORD_NOTE}</p>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

function ManagersCard({ managers, successors, canHandover }: { managers: CompanyManagerRow[]; successors: { userId: string; name: string }[]; canHandover: boolean }) {
  const active = managers.filter((m) => !m.left);
  const left = managers.filter((m) => m.left);
  return (
    <section aria-label="採用中のマネージャー" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: 18, display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>採用中のマネージャー</h2>
      {active.length === 0 && left.length === 0 && (
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.7 }}>まだいません。マネージャー本人がマイページの設定で「採用中」にすると、ここに出ます。</p>
      )}
      {active.map((m) => (
        <div key={m.userId} data-state="manager-active" style={{ display: "grid", gap: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>
            {m.name}
            {!m.hiring && <span style={{ marginLeft: 6, fontSize: 11.5, fontWeight: 600, color: "var(--ink-mute)" }}>（いまは採用中ではありません）</span>}
          </span>
          <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{[m.department, `マッチング ${m.matchCount}名`].filter(Boolean).join("・")}</span>
        </div>
      ))}
      {left.map((m) => (
        <div key={m.userId} data-state="manager-left-row" style={{ display: "grid", gap: 6, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-soft)" }}>{m.name}（退職済み）</span>
          {m.matchCount > 0 ? (
            <>
              <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>引き継ぎ待ちの記録 {m.matchCount}件</span>
              {canHandover && <HandoverForm fromUserId={m.userId} successors={successors} />}
            </>
          ) : (
            <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{m.handedOverToName ? `記録は${m.handedOverToName}に引き継ぎ済み` : "記録はありません"}</span>
          )}
        </div>
      ))}
    </section>
  );
}

function HandoverForm({ fromUserId, successors }: { fromUserId: string; successors: { userId: string; name: string }[] }) {
  const router = useRouter();
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = successors.filter((s) => s.userId !== fromUserId);
  if (options.length === 0) return <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>引き継げるメンバーがいません。</span>;
  const submit = async () => {
    if (!to || busy) return;
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/biz/manager-matches/handover", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromUserId, toUserId: to }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) { setError(d?.error ?? "引き継げませんでした"); return; }
      router.refresh();
    } catch {
      setError("引き継げませんでした");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      <label style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }} htmlFor={`ho-${fromUserId}`}>引き継ぎ先</label>
      <select id={`ho-${fromUserId}`} value={to} onChange={(e) => setTo(e.target.value)} disabled={busy}
        style={{ flex: "1 1 140px", minWidth: 0, border: "1px solid var(--line)", borderRadius: 8, padding: "7px 8px", fontSize: 13, fontFamily: "inherit", background: "#fff" }}>
        <option value="">引き継ぎ先を選ぶ</option>
        {options.map((s) => <option key={s.userId} value={s.userId}>{s.name}</option>)}
      </select>
      <button type="button" onClick={() => void submit()} disabled={!to || busy} data-action="handover" className="tap-min-h"
        style={{ padding: "7px 14px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700, fontFamily: "inherit", background: to ? "var(--ink)" : "var(--line)", color: to ? "#fff" : "var(--ink-mute)", cursor: to && !busy ? "pointer" : "default" }}>
        {busy ? "引き継ぎ中…" : "引き継ぐ"}
      </button>
      {error && <span role="alert" style={{ width: "100%", fontSize: 12, color: "var(--error)" }}>{error}</span>}
    </div>
  );
}
