"use client";

import { useState, useTransition } from "react";
import { dismissRequest, toggleReviewed } from "./actions";

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
  /** 運営が確認した時刻。**null は未確認**（運営専用の列） */
  reviewedAt: string | null;
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
        自己申告の面談対応者はいません。
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
              /* ★未確認は色で分かるようにする（2026-08-25）。確認済みは白に沈める。
                    ⚠️ 未確認＝悪い、ではない。**まだ見ていない**というだけなので、
                       エラー色（赤）にしないこと。 */
              background: r.reviewedAt ? "#fff" : "#FFFBEB",
              border: `1px solid ${r.reviewedAt ? "var(--line)" : "#FDE68A"}`, borderRadius: 10,
              padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
            }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                    {r.companyName}
                  </span>
                  {!r.reviewedAt && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                      background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D",
                      whiteSpace: "nowrap",
                    }}>未確認</span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 2 }}>
                  {r.userName}
                  <span style={{ color: "var(--ink-mute)" }}>
                    {" ・ "}{fmt(r.appliedAt)} からON
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
                    企業ページから外すと登録は削除され、その旨のメールが本人に届きます。取り消せません。
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
                /* ★「承認する」は 2026-08-24 に外した。会社の事前承認を廃止したので、
                      ここに出る行は**すでに掲載中**——承認する対象が無い。
                   ⚠️ 運営の操作は「企業ページから外す」1つだけ。戻さないこと。 */
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  {/* ★確認の記録（2026-08-25）。⚠️ **掲載状態は変えない**し通知も送らない。
                         運営のメモで、本人にも企業にも見えない。
                      ⚠️ もう一度押すと未確認に戻せる（押し間違いで情報を消さない）。 */}
                  <button
                    type="button" className="btn-fixed-size" disabled={busy}
                    onClick={() => run(() => toggleReviewed(r.id, !r.reviewedAt), r.id)}
                    style={{
                      height: 32, padding: "0 14px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                      fontFamily: "inherit", cursor: busy ? "wait" : "pointer",
                      border: r.reviewedAt ? "1px solid var(--line)" : "none",
                      background: r.reviewedAt ? "#fff" : "var(--royal)",
                      color: r.reviewedAt ? "var(--ink-mute)" : "#fff",
                    }}
                  >
                    {busy ? "..." : r.reviewedAt ? "未確認に戻す" : "確認した"}
                  </button>
                  <button
                    type="button" className="btn-fixed-size" disabled={busy}
                    onClick={() => setConfirmId(r.id)}
                    style={{
                      height: 32, padding: "0 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                      fontFamily: "inherit", cursor: busy ? "wait" : "pointer",
                      border: "1px solid var(--line)", background: "#fff", color: "var(--ink-mute)",
                    }}
                  >
                    企業ページから外す
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
