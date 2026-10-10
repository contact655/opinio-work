"use client";

import { useState } from "react";
import { ApproachConsentQuestion, saveApproachConsent } from "./ApproachConsentQuestion";

/**
 * ★/mypage の最上部（「届いているもの」の位置）に**一度だけ**出す確認カード（2026-10-09）。
 *
 * 出す条件は呼び出し側が決める: `accept_company_approaches` が null（まだ選んでいない）かつ
 * 転職意欲が企業に届く状態（`isReachableByCompanies`）のときだけ。
 * ⚠️★「今は考えていない」・未設定の人には出さない。どちらを選んでも声かけは届かないので、
 *    聞くと「受け取る」を選んだのに何も起きない形になる（転職意欲を変えた日に、このカードが出る）。
 * ⚠️★選んだら二度と出さない。保存したら呼び出し側の値を true / false にする（null に戻す経路は無い。
 *    API も null を受け付けない）。
 * ⚠️ 選んだだけでは保存しない。誤タップで同意の向きが決まらないよう「決定する」を押させる。
 */
export function ApproachConsentCard({ onSaved }: { onSaved: (v: boolean) => void }) {
  const [value, setValue] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (value === null || saving) return;
    setSaving(true);
    setError(null);
    const r = await saveApproachConsent(value);
    setSaving(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onSaved(value);
  };

  return (
    <section
      aria-label="企業からのメッセージリクエストの設定"
      data-state="approach-consent-card"
      style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "16px 18px", marginBottom: 16 }}
    >
      <ApproachConsentQuestion value={value} onChange={setValue} disabled={saving} name="approach-consent-card" />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={value === null || saving}
          className="tap-min-h"
          style={{
            padding: "9px 20px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
            background: value === null ? "var(--line)" : "var(--royal)",
            color: value === null ? "var(--ink-mute)" : "#fff",
            cursor: value === null || saving ? "default" : "pointer",
          }}
        >
          {saving ? "保存中…" : "決定する"}
        </button>
        <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>あとから「転職・面談の状況」と設定で変えられます</span>
      </div>
      {error && <p style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 600, color: "var(--error)" }}>{error}</p>}
    </section>
  );
}
