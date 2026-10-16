"use client";

import { useEffect, useState } from "react";
import { FormSection } from "@/components/profile/editor/formKit";

/**
 * ★「つながり」として表示してよいか（2026-10-16 / フェーズ3）。初期値はオフ。
 * ⚠️ 読み込みに失敗したら操作させない（オフに見せると、オンの人が誤って押し直す）。
 * ⚠️ 保存済みの値だけを画面の状態にする（押して失敗したら元に戻す）。
 */
export default function ConnectionSettingSection() {
  const [value, setValue] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/jobseeker/connection-setting", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { show_as_connection: boolean }) => { if (alive) setValue(d.show_as_connection === true); })
      .catch(() => { if (alive) setLoadError(true); });
    return () => { alive = false; };
  }, []);

  async function toggle(next: boolean) {
    if (saving || value === null) return;
    setSaving(true); setSaveError(null);
    try {
      const res = await fetch("/api/jobseeker/connection-setting", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ show_as_connection: next }),
      });
      if (!res.ok) throw new Error();
      setValue(next);
    } catch {
      setSaveError("保存できませんでした。もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormSection title="つながりとしての表示"
      desc="相互フォローしている人が、あなたの在籍中の会社のページを見たときに「この会社に、あなたのつながりがいます」としてあなたを表示します。相互フォローしていない人や企業には表示されません。">
      {loadError ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--error)" }}>設定を読み込めませんでした。時間をおいて開き直してください。</p>
      ) : (
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--ink)", cursor: value === null ? "default" : "pointer" }}>
          <input type="checkbox" id="show-as-connection" data-state={value === null ? "loading" : value ? "on" : "off"}
            checked={value === true} disabled={value === null || saving}
            onChange={(e) => void toggle(e.target.checked)} />
          相互フォローしている人に、在籍中の会社のページで表示する
        </label>
      )}
      {saveError && <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--error)" }}>{saveError}</p>}
    </FormSection>
  );
}
