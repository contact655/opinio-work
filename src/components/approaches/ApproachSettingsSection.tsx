"use client";

import { useState } from "react";
import { FormSection } from "@/components/profile/editor/formKit";
import { isReachableByCompanies } from "@/lib/constants/careerPreferences";
import { APPROACH_SETTING_LABEL, approachConsentText } from "@/lib/constants/companyApproaches";
import { saveApproachConsent } from "./ApproachConsentQuestion";

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
    /* ★見出し・説明・スイッチはモックの文言（2026-10-11）。⚠️ 書く列は今までどおり `accept_company_approaches`（保存は「保存する」）。
          ⚠️ 未設定（null）は「オフ」と同じ見た目にしない。スイッチの横に「まだ選んでいません」と出す */
    <FormSection title="企業からのメッセージ">
      <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)" }}>
        企業が理由を添えて送るメッセージです。そのまま返信できます。届く範囲は、ここで絞れます。見送っても企業には伝わりません。
        {/* ⚠️ 同意の範囲（在籍した会社とそのグループ会社からは届かない）は消さない（`APPROACH_CONSENT_DESCRIPTION` と同じ事実） */}
        在籍した会社とそのグループ会社からは届きません。
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button type="button" role="switch" aria-checked={value === true} aria-label={APPROACH_SETTING_LABEL} disabled={saving}
          data-state={value === true ? "on" : value === false ? "off" : "unset"}
          onClick={() => { setValue(value === true ? false : true); setDone(false); }}
          className="btn-fixed-size"
          style={{ position: "relative", width: 44, height: 26, borderRadius: 999, border: "none", padding: 0, cursor: saving ? "default" : "pointer", background: value === true ? "var(--royal)" : "var(--line)", flexShrink: 0 }}>
          <span aria-hidden style={{ position: "absolute", top: 3, left: value === true ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.2)", transition: "left 0.15s" }} />
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{APPROACH_SETTING_LABEL}</span>
        <span data-state="approach-setting-value" style={{ fontSize: 12.5, color: "var(--ink-mute)" }}>
          {value === null ? "まだ選んでいません" : approachConsentText(value)}
        </span>
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.7, color: "var(--ink-mute)" }}>
        オフにすると、企業の候補者検索で「メッセージを送れます」と表示されなくなります。
      </p>

      {/* ⚠️★転職意欲で止まっている人には、どちらを選んでも届かないことを書く（選んだのに何も起きない、を防ぐ） */}
      {!isReachableByCompanies(careerStance) && (
        <p style={{ margin: "10px 0 0", fontSize: 12, lineHeight: 1.7, color: "var(--ink-mute)" }}>
          いまは転職意欲が「今は考えていない」か未設定のため、どちらを選んでも企業からのメッセージは届きません。
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
