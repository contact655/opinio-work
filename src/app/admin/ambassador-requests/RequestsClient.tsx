"use client";

import { useState, useTransition } from "react";
import { approveRequest, dismissRequest } from "./actions";

export type AmbassadorRequest = {
  id: string;
  companyId: string;
  companyName: string;
  userId: string;
  userName: string;
  /** 本人が申請した時刻（`consent_at`。無ければ `created_at`） */
  appliedAt: string | null;
  /** その企業に通知の宛先があるか。0 なら企業側に承認できる人がいない */
  companyRecipients: number;
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

/** 申請からの経過日数。⚠️ 「何日放置されているか」が運営の判断材料になる */
function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function RequestsClient({ requests }: { requests: AmbassadorRequest[] }) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  /* ⚠️ 確認は行ごとに持つ。1つにすると別の行を誤爆する（/biz/members と同じ） */
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, id: string) {
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "処理に失敗しました");
      else setConfirmId(null);
      setBusyId(null);
    });
  }

  if (requests.length === 0) {
    return (
      <div style={{
        background: "var(--bg-tint)", border: "1px dashed var(--line)", borderRadius: 10,
        padding: 24, textAlign: "center", color: "var(--ink-mute)", fontSize: 13,
      }}>
        未承認の申請はありません。
      </div>
    );
  }

  return (
    <>
      {error && (
        <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: "var(--error)" }}>{error}</p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {requests.map((r) => {
          const d = daysAgo(r.appliedAt);
          const busy = busyId === r.id && pending;
          return (
            <div key={r.id} style={{
              background: "#fff", border: "1px solid var(--line)", borderRadius: 10,
              padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
            }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                  {r.companyName}
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 2 }}>
                  {r.userName}
                  <span style={{ color: "var(--ink-mute)" }}>
                    {" ・ "}{fmt(r.appliedAt)} 申請
                    {d !== null && d >= 1 && <>（{d}日前）</>}
                  </span>
                </div>
                {/* ⚠️ 宛先0件＝企業側に承認できる人がいない。運営が代理で判断する対象。 */}
                {r.companyRecipients === 0 && (
                  <div style={{ fontSize: 12, color: "#92400e", marginTop: 4, fontWeight: 600 }}>
                    この企業は通知の宛先が0件です（企業側に承認できる担当者がいません）
                  </div>
                )}
              </div>

              {confirmId === r.id ? (
                <div style={{ background: "var(--bg-tint)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px", minWidth: 300 }}>
                  <p style={{ margin: "0 0 8px", fontSize: 12, lineHeight: 1.6, color: "var(--ink)", fontWeight: 600 }}>
                    見送ると申請は削除され、その旨のメールが本人に届きます。取り消せません。
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button" className="btn-fixed-size" disabled={busy}
                      onClick={() => run(() => dismissRequest(r.id), r.id)}
                      style={{
                        flex: 1, height: 32, borderRadius: 6, fontSize: 12, fontWeight: 700,
                        fontFamily: "inherit", cursor: busy ? "wait" : "pointer",
                        border: "none", background: "var(--error)", color: "#fff",
                      }}
                    >
                      {busy ? "..." : "見送る"}
                    </button>
                    <button
                      type="button" className="btn-fixed-size" disabled={busy}
                      onClick={() => setConfirmId(null)}
                      style={{
                        flex: 1, height: 32, borderRadius: 6, fontSize: 12, fontWeight: 600,
                        fontFamily: "inherit", cursor: "pointer",
                        border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)",
                      }}
                    >
                      やめる
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    type="button" className="btn-fixed-size" disabled={busy}
                    onClick={() => run(() => approveRequest(r.id), r.id)}
                    style={{
                      height: 32, padding: "0 14px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                      fontFamily: "inherit", cursor: busy ? "wait" : "pointer",
                      border: "none", background: "var(--royal)", color: "#fff",
                    }}
                  >
                    {busy ? "..." : "承認する"}
                  </button>
                  <button
                    type="button" className="btn-fixed-size"
                    onClick={() => setConfirmId(r.id)}
                    style={{
                      height: 32, padding: "0 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                      fontFamily: "inherit", cursor: "pointer",
                      border: "1px solid var(--line)", background: "#fff", color: "var(--ink-mute)",
                    }}
                  >
                    見送る
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
