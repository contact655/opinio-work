"use client";

import { useState } from "react";
import {
  DECLINE_NOTE_MAX,
  declineReasonsFor,
  type DeclineSide,
} from "@/lib/constants/declineReasons";

/**
 * ④ 見送り理由のシート。**②と⑨の両方から呼ぶ共通部品。**
 *
 * ⚠️★**理由は1つだけ選ばせる（複数選択にしない）。**
 *    「いちばんの理由」が取れなくなり、集計が「何となく全部」になる。
 *    DB も `reason text`（配列ではない）で、`(proposal_id, side)` が一意。
 *
 * ⚠️★**選択肢を JSX に直書きしないこと。** `declineReasonsFor(side)` を通す。
 *    直書きすると API・DB の CHECK と綴りがずれ、
 *    「選べるのに保存できない」が静かに生まれる。
 *
 * ⚠️★**相手に何が伝わるかを画面に書く。** いまはどちらの理由も相手に渡していない。
 *    渡すようにする日が来たら、**この文言を先に直すこと。**
 */
export default function DeclineSheet({
  side,
  onCancel,
  onSubmit,
  pending,
}: {
  side: DeclineSide;
  onCancel: () => void;
  onSubmit: (reason: string, note: string) => void;
  pending: boolean;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const options = declineReasonsFor(side);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="見送る理由"
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.35)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 60,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 12, padding: 20,
          width: "100%", maxWidth: 420, maxHeight: "85vh", overflowY: "auto",
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>見送る理由を1つ選んでください</h2>
        <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "0 0 14px", lineHeight: 1.7 }}>
          {/* ★いま相手に渡していないことを、そのまま書く */}
          {side === "candidate"
            ? "この内容は企業には伝わりません。次の提案の精度を上げるためだけに使います。"
            : "この内容は候補者には伝わりません。次の提案の精度を上げるためだけに使います。"}
        </p>

        <div style={{ display: "grid", gap: 2, marginBottom: 14 }}>
          {options.map((o) => (
            <label
              key={o.value}
              style={{
                display: "flex", gap: 10, alignItems: "center", padding: "10px 12px",
                borderRadius: 8, cursor: "pointer", fontSize: 14,
                border: `1px solid ${reason === o.value ? "var(--royal)" : "var(--line)"}`,
                background: reason === o.value ? "#F5F7FD" : "#fff",
              }}
            >
              <input
                type="radio"
                name="decline-reason"
                value={o.value}
                checked={reason === o.value}
                onChange={() => setReason(o.value)}
              />
              {o.label}
            </label>
          ))}
        </div>

        <label style={{ display: "block", fontSize: 12, color: "var(--ink-soft)", marginBottom: 4 }}>
          補足（任意・1行）
        </label>
        <input
          type="text"
          value={note}
          maxLength={DECLINE_NOTE_MAX}
          onChange={(e) => setNote(e.target.value)}
          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", marginBottom: 16, fontSize: 14 }}
        />

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            disabled={pending}
            style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", cursor: "pointer" }}
          >
            やめる
          </button>
          <button
            onClick={() => onSubmit(reason, note)}
            /* ⚠️ 理由を選ぶまで押せない。既定値で埋めない */
            disabled={!reason || pending}
            style={{
              padding: "9px 14px", borderRadius: 8, border: "none",
              background: "var(--royal)", color: "#fff", fontWeight: 600,
              cursor: reason && !pending ? "pointer" : "default",
              opacity: reason && !pending ? 1 : 0.5,
            }}
          >
            {pending ? "保存中…" : "見送る"}
          </button>
        </div>
      </div>
    </div>
  );
}
