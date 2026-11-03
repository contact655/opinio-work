"use client";

import { useState } from "react";
import { currentYm, jobChangeEndError } from "@/lib/experiences/jobChange";

/**
 * ★現職の会社名を変えて保存しようとしたとき、保存の前に1回だけ聞く（2026-11-04 / 柴さんの判断）。
 *   「転職しました」→ 前の会社を辞めた月を聞く → 呼び出し側が「職歴を追加」を新しい会社で開く
 *   「会社名の修正です」→ 呼び出し側がそのまま上書きで保存する（決め手の回答は消さない）
 * ⚠️ 判定（聞くかどうか）と辞めた月のチェックは lib/experiences/jobChange.ts。ここに書き写さない
 * ⚠️ 見た目は /dev/preview/job-change で確かめる（本番のデータでは出しにくい）
 */
export type JobChangeDialogProps = {
  fromCompany: string;
  toCompany: string;
  /** 前の会社の入社月（現職の役割が複数あれば、いちばん新しい入社月）。"YYYY-MM" */
  latestStartedAt: string;
  saving?: boolean;
  /** 「会社名の修正です」 */
  onCorrection: () => void;
  /** 「転職しました」で辞めた月を決めたとき。"YYYY-MM" */
  onJobChange: (endedAt: string) => void;
  onCancel: () => void;
  /** プレビュー用。最初から「辞めた月」の段で開く */
  initialStep?: "choose" | "end";
};

const NOW_YEAR = Number(currentYm().slice(0, 4));
const YEARS = Array.from({ length: NOW_YEAR - 1979 }, (_, i) => NOW_YEAR - i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const selectStyle: React.CSSProperties = {
  flex: 1, minWidth: 0, border: "1.5px solid transparent", borderRadius: 8, padding: "12px 12px",
  fontSize: 14, color: "var(--ink)", background: "#F2F4F7", fontFamily: "inherit",
};
const choiceStyle: React.CSSProperties = {
  display: "block", width: "100%", textAlign: "left", padding: "14px 16px", borderRadius: 12,
  border: "1px solid var(--line)", background: "#fff", fontFamily: "inherit", cursor: "pointer",
};

export default function JobChangeDialog({
  fromCompany, toCompany, latestStartedAt, saving = false, onCorrection, onJobChange, onCancel, initialStep = "choose",
}: JobChangeDialogProps) {
  const [step, setStep] = useState<"choose" | "end">(initialStep);
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [touched, setTouched] = useState(false);
  const endedAt = year && month ? `${year}-${month.padStart(2, "0")}` : "";
  const error = jobChangeEndError(endedAt, latestStartedAt);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={saving ? undefined : onCancel} style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.45)" }} />
      <div role="dialog" aria-modal="true" aria-label="会社が変わりました" data-state={`job-change-${step}`}
           style={{ position: "relative", zIndex: 1, background: "#fff", borderRadius: 16, width: "min(480px, 100%)", padding: 24, boxShadow: "0 24px 64px rgba(0,0,0,0.25)" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
          {step === "choose" ? "会社が変わりました。どちらですか？" : `${fromCompany}を辞めた月は？`}
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)", overflowWrap: "anywhere" }}>
          {fromCompany} → {toCompany}
        </p>

        {step === "choose" ? (
          <div style={{ display: "grid", gap: 10 }}>
            <button type="button" className="tap-min-h" data-action="job-change" disabled={saving} onClick={() => setStep("end")} style={choiceStyle}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>転職しました</span>
              <span style={{ display: "block", marginTop: 4, fontSize: 12, lineHeight: 1.7, color: "var(--ink-mute)" }}>
                {fromCompany}の職歴は辞めた月までとして残し、{toCompany}を新しい職歴として追加します。
              </span>
            </button>
            <button type="button" className="tap-min-h" data-action="company-correction" disabled={saving} onClick={onCorrection} style={choiceStyle}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>会社名の修正です</span>
              <span style={{ display: "block", marginTop: 4, fontSize: 12, lineHeight: 1.7, color: "var(--ink-mute)" }}>
                同じ会社の名前を直します。この職歴はそのまま上書きします。
              </span>
            </button>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
              <button type="button" className="tap-min-h" onClick={onCancel} disabled={saving}
                style={{ padding: "10px 18px", borderRadius: 999, border: "1px solid var(--line)", background: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: "var(--ink-soft)", cursor: "pointer" }}>
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", gap: 8 }}>
              <select aria-label="辞めた年" value={year} onChange={(e) => { setYear(e.target.value); setTouched(true); }} style={selectStyle}>
                <option value="">年</option>
                {YEARS.map((y) => <option key={y} value={String(y)}>{y}年</option>)}
              </select>
              <select aria-label="辞めた月" value={month} onChange={(e) => { setMonth(e.target.value); setTouched(true); }} style={selectStyle}>
                <option value="">月</option>
                {MONTHS.map((m) => <option key={m} value={String(m)}>{m}月</option>)}
              </select>
            </div>
            {touched && endedAt && error && (
              <p role="alert" data-state="job-change-end-error" style={{ margin: "8px 0 0", fontSize: 12, color: "var(--danger-ink, #b91c1c)" }}>{error}</p>
            )}
            <p style={{ margin: "12px 0 18px", fontSize: 12, lineHeight: 1.7, color: "var(--ink-mute)" }}>
              次に、{toCompany}の職歴を追加する画面を開きます。入社月は辞めた月の翌月にしてあります（変えられます）。
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <button type="button" className="tap-min-h" onClick={() => setStep("choose")} disabled={saving}
                style={{ marginRight: "auto", padding: "10px 4px", background: "none", border: "none", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: "var(--ink-mute)", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>
                戻る
              </button>
              <button type="button" className="tap-min-h" onClick={onCancel} disabled={saving}
                style={{ padding: "10px 18px", borderRadius: 999, border: "1px solid var(--line)", background: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: "var(--ink-soft)", cursor: "pointer" }}>
                キャンセル
              </button>
              <button type="button" className="tap-min-h" data-action="job-change-next" disabled={!!error || saving}
                onClick={() => { if (!error) onJobChange(endedAt); }}
                style={{ padding: "10px 22px", borderRadius: 999, border: "none", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: "#fff", background: error || saving ? "var(--ink-mute)" : "var(--royal)", cursor: error ? "default" : "pointer" }}>
                次へ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
