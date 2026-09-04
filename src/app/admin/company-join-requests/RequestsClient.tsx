"use client";

import { useState, useTransition } from "react";
import type { OpenJoinRequest } from "@/lib/business/joinRequests";
import { approveJoinRequest, rejectJoinRequest } from "./actions";

function fmt(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

/** ⚠️ 何日放置されているかが運営の判断材料になる（面談対応者の一覧と同じ考え方） */
function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function RequestsClient({ requests }: { requests: OpenJoinRequest[] }) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  /* ⚠️ 確認は行ごとに持つ。1つにすると別の行を誤爆する */
  const [confirm, setConfirm] = useState<{ id: string; kind: "approve" | "reject" } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, id: string) {
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "処理に失敗しました");
      else setConfirm(null);
      setBusyId(null);
    });
  }

  if (requests.length === 0) {
    return (
      <div style={{
        background: "var(--bg-tint)", border: "1px dashed var(--line)", borderRadius: 10,
        padding: 24, textAlign: "center", color: "var(--ink-mute)", fontSize: 13,
      }}>
        対応が必要な依頼はありません。
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
          const busy = busyId === r.id && pending;
          const d = daysAgo(r.sentAt);
          const c = confirm?.id === r.id ? confirm.kind : null;
          return (
            <div key={r.id} style={{
              /* ⚠️ 未対応＝悪い、ではない。エラー色（赤）にしない（面談対応者の一覧と揃える） */
              background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10,
              padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
            }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>
                  {r.userName}
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>
                    {"　"}→{"　"}{r.companyName}
                  </span>
                  {r.isTest && (
                    <span style={{
                      marginLeft: 8, fontSize: 10, fontWeight: 700, padding: "2px 6px",
                      borderRadius: 4, background: "var(--line-soft)", color: "var(--ink-mute)",
                    }}>検証用アカウント</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.8 }}>
                  {r.userEmail ?? "メールアドレス未登録"}
                  {"　"}／{"　"}{fmt(r.sentAt)}
                  {d >= 1 && `（${d}日前）`}
                </div>
                {/* ★判断の材料。⚠️ これは本人性の証明ではない（`emailDomains.ts` の注記） */}
                <div style={{ fontSize: 12, lineHeight: 1.8, marginTop: 2 }}>
                  {r.domainMatch === true && (
                    <span style={{ color: "var(--success-ink)", fontWeight: 700 }}>
                      メールのドメインが企業サイトと一致
                    </span>
                  )}
                  {r.domainMatch === false && (
                    <span style={{ color: "var(--warm-ink)", fontWeight: 700 }}>
                      メールのドメインが企業サイトと違う
                    </span>
                  )}
                  {r.domainMatch === null && (
                    <span style={{ color: "var(--ink-mute)" }}>
                      ドメインで照合できません（フリーメール、または企業サイト未登録）
                    </span>
                  )}
                  {r.companyRecipients === 0 && (
                    <span style={{ color: "var(--ink-mute)" }}>
                      {"　"}／{"　"}この企業には担当者がいないため、依頼は誰にも届いていません
                    </span>
                  )}
                  {r.companyRecipients > 0 && (
                    <span style={{ color: "var(--ink-mute)" }}>
                      {"　"}／{"　"}企業の担当者 {r.companyRecipients} 名にも届いています
                    </span>
                  )}
                </div>
              </div>

              {c === null && (
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setConfirm({ id: r.id, kind: "approve" })}
                    disabled={busy}
                    style={{
                      padding: "8px 14px", borderRadius: 8, border: "none",
                      background: "var(--royal)", color: "#fff",
                      fontSize: 13, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    担当者に追加する
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirm({ id: r.id, kind: "reject" })}
                    disabled={busy}
                    style={{
                      padding: "8px 14px", borderRadius: 8,
                      border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)",
                      fontSize: 13, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    見送る
                  </button>
                </div>
              )}

              {/* ⚠️ 二段階にする。押すとその企業の管理画面をその人に渡すことになる */}
              {c !== null && (
                <div style={{ flexBasis: "100%", background: "#fff", border: "1px solid var(--line)", borderRadius: 8, padding: "12px 14px" }}>
                  <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--ink)", lineHeight: 1.8 }}>
                    {c === "approve" ? (
                      <>
                        <strong>{r.userName}</strong> さんを <strong>{r.companyName}</strong> の
                        担当者（admin）に追加します。企業情報の編集と求人の掲載ができるようになり、
                        本人にはメールが届きます。
                        <br />
                        <span style={{ color: "var(--warm-ink)", fontWeight: 700 }}>
                          OPINIO は在籍確認をしていません。ドメインの一致は本人である証明にはなりません。
                        </span>
                      </>
                    ) : (
                      <>
                        この依頼を見送ります。<strong>本人には通知されません。</strong>
                        依頼はもう一度送れます。
                      </>
                    )}
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(
                        () => (c === "approve" ? approveJoinRequest(r.id) : rejectJoinRequest(r.id)),
                        r.id,
                      )}
                      style={{
                        padding: "8px 14px", borderRadius: 8, border: "none",
                        background: c === "approve" ? "var(--royal)" : "var(--ink-soft)", color: "#fff",
                        fontSize: 13, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {busy ? "処理中..." : c === "approve" ? "追加する" : "見送る"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirm(null)}
                      style={{
                        padding: "8px 14px", borderRadius: 8,
                        border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)",
                        fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      やめる
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
