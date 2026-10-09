"use client";

import {
  APPROACH_CONSENT_DESCRIPTION,
  APPROACH_CONSENT_OPTIONS,
  APPROACH_CONSENT_QUESTION,
} from "@/lib/constants/companyApproaches";

/**
 * ★「企業からの声かけを受け取りますか？」の問い（2026-10-09）。**問い・説明・選択肢はここだけ。**
 *
 * 使う場所: オンボーディング（登録の途中 / `/onboarding/stance`）・`/mypage` の一度だけの確認カード・
 * `/mypage/settings`。⚠️ 説明文は同意の範囲そのものなので、入口ごとに言い換えないこと。
 *
 * ⚠️★既定値を持たない。`value` が null のときはどちらも選ばれていない状態で出す。
 */
export function ApproachConsentQuestion({
  value,
  onChange,
  disabled = false,
  showQuestion = true,
  name = "accept-company-approaches",
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  /** 見出しの問いを出すか。⚠️ `FormSection` の中では見出しが既にあるので出さない */
  showQuestion?: boolean;
  /** ⚠️ 同じ画面に2つ出すことはないが、radio の name は画面内で一意にする */
  name?: string;
}) {
  return (
    <div>
      {showQuestion && (
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" }}>
          {APPROACH_CONSENT_QUESTION}
        </div>
      )}
      <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)" }}>
        {APPROACH_CONSENT_DESCRIPTION}
      </p>
      <div role="radiogroup" aria-label={APPROACH_CONSENT_QUESTION} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {APPROACH_CONSENT_OPTIONS.map((o) => {
          const on = value === o.value;
          return (
            <label
              key={String(o.value)}
              className="tap-min-h"
              data-approach-option={String(o.value)}
              style={{
                flex: "1 1 140px", display: "flex", alignItems: "center", gap: 10,
                cursor: disabled ? "default" : "pointer",
                padding: "12px 14px", borderRadius: 12,
                border: `1.5px solid ${on ? "var(--royal)" : "var(--line)"}`,
                background: on ? "var(--royal-50)" : "#fff",
                opacity: disabled ? 0.6 : 1,
              }}
            >
              <input
                type="radio"
                name={name}
                checked={on}
                disabled={disabled}
                onChange={() => onChange(o.value)}
              />
              <span style={{ fontSize: 14, fontWeight: on ? 700 : 500, color: "var(--ink)" }}>{o.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** 保存。⚠️ 書く経路は `PUT /api/jobseeker/career-preferences` だけ。新しいルートを作らない */
export async function saveApproachConsent(v: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/jobseeker/career-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accept_company_approaches: v }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { ok: false, error: (json && typeof json.error === "string" && json.error) || "保存できませんでした" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "保存できませんでした" };
  }
}
