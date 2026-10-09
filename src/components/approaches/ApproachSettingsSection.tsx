"use client";

import { useState } from "react";
import { FormSection } from "@/components/profile/editor/formKit";
import { isReachableByCompanies } from "@/lib/constants/careerPreferences";
import { APPROACH_SETTING_LABEL } from "@/lib/constants/companyApproaches";
import { ApproachConsentQuestion, saveApproachConsent } from "./ApproachConsentQuestion";

/**
 * ★`/mypage/settings` の「企業からの声かけ」（2026-10-09）。
 *
 * ⚠️ /mypage のカードのトグルと同じ列（`ow_profiles.accept_company_approaches`）を書く。
 *    設定画面にも置くのは柴さんの指示（転職意欲を「今は考えていない」にしている人はカードに行が出ないので、
 *    ここが常に触れる置き場になる）。
 * ⚠️ 選んだだけでは保存しない（公開範囲の節と同じ「保存する」）。
 */
export function ApproachSettingsSection({
  initialValue,
  careerStance,
}: {
  initialValue: boolean | null;
  careerStance: string | null;
}) {
  const [saved, setSaved] = useState<boolean | null>(initialValue);
  const [value, setValue] = useState<boolean | null>(initialValue);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = value !== null && value !== saved;

  const save = async () => {
    if (!dirty || value === null) return;
    setSaving(true);
    setError(null);
    setDone(false);
    const r = await saveApproachConsent(value);
    setSaving(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setSaved(value);
    setDone(true);
  };

  return (
    <FormSection title={APPROACH_SETTING_LABEL}>
      <ApproachConsentQuestion value={value} onChange={(v) => { setValue(v); setDone(false); }} disabled={saving} showQuestion={false} name="approach-settings" />

      {/* ⚠️★転職意欲で止まっている人には、どちらを選んでも届かないことを書く（選んだのに何も起きない、を防ぐ） */}
      {!isReachableByCompanies(careerStance) && (
        <p style={{ margin: "10px 0 0", fontSize: 12, lineHeight: 1.7, color: "var(--ink-mute)" }}>
          いまは転職意欲が「今は考えていない」か未設定のため、どちらを選んでも声かけは届きません。
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !dirty}
          className="tap-min-h"
          style={{
            padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit",
            border: "none", cursor: dirty ? "pointer" : "default",
            background: dirty ? "var(--royal)" : "var(--line)",
            color: dirty ? "#fff" : "var(--ink-mute)",
          }}
        >
          {saving ? "保存中…" : "保存する"}
        </button>
        {done && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--success-ink)" }}>保存しました</span>}
        {error && <span style={{ fontSize: 12, fontWeight: 600, color: "var(--error)" }}>{error}</span>}
      </div>
    </FormSection>
  );
}
