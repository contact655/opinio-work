"use client";

import { useState } from "react";
import { PREFILL_FIELD_LABELS, JOB_PREFILL_MAX_CHARS, JOB_PREFILL_DAILY_LIMIT, type JobPrefillDraft } from "@/lib/jobs/prefillFields";
import {
  CONTRACT_PERIODS, CONTRACT_RENEWALS, WORKPLACE_CHANGE_SCOPES, DUTIES_CHANGE_SCOPES, YES_NO,
  SOCIAL_INSURANCES, SMOKING_MEASURES, labelOf, type LaborTerms,
} from "@/lib/jobs/laborTerms";
import { REMOTE_WORK_STATUSES } from "@/lib/constants/workStyle";

/**
 * ★求人票を貼り付けて下書きを作る（段階3 / 2026-10-11 / 柴さんの指示）。
 *
 * ⚠️★**読み取った値はフォームに自動で入れない。** 1項目ずつ「下書き・要確認」として並べ、
 *    人が「確認して入れる」を押したものだけを `onApply` でフォームに入れる。
 *    ＝ 押すまでは公開の条件（missingForPublish）にも数えないし、保存（自動保存）もされない。
 * ⚠️ 貼り付けた文章はこの画面の中だけ。サーバーは保存もログもしない（lib/jobs/prefill.ts）。
 * ⚠️ 入口はキー（ANTHROPIC_API_KEY）が無いとき出さない（呼ぶ側が `prefillEnabled` で決める）。
 */

type TopKey = Exclude<keyof JobPrefillDraft, "labor">;
type LaborKey = keyof LaborTerms;

const LABOR_ROWS: { key: LaborKey; label: string; show: (v: unknown) => string }[] = [
  { key: "contractPeriod", label: "契約期間", show: (v) => labelOf(CONTRACT_PERIODS, String(v)) ?? String(v) },
  { key: "contractPeriodDetail", label: "契約期間（期間）", show: String },
  { key: "contractRenewal", label: "契約の更新", show: (v) => labelOf(CONTRACT_RENEWALS, String(v)) ?? String(v) },
  { key: "workplaceChangeScope", label: "就業場所の変更の範囲", show: (v) => labelOf(WORKPLACE_CHANGE_SCOPES, String(v)) ?? String(v) },
  { key: "dutiesChangeScope", label: "業務の変更の範囲", show: (v) => labelOf(DUTIES_CHANGE_SCOPES, String(v)) ?? String(v) },
  { key: "breakTime", label: "休憩時間", show: String },
  { key: "overtime", label: "時間外労働の有無", show: (v) => labelOf(YES_NO, String(v)) ?? String(v) },
  { key: "fixedOvertime", label: "固定残業代", show: (v) => labelOf(YES_NO, String(v)) ?? String(v) },
  { key: "fixedOvertimeHours", label: "固定残業の時間（月）", show: (v) => `${v}時間` },
  { key: "fixedOvertimePay", label: "固定残業代の金額（月）", show: (v) => `${Number(v).toLocaleString("ja-JP")}円` },
  { key: "socialInsurance", label: "社会保険", show: (v) => SOCIAL_INSURANCES.filter((o) => (v as string[]).includes(o.value)).map((o) => o.label).join("・") },
  { key: "smokingMeasure", label: "受動喫煙防止の措置", show: (v) => labelOf(SMOKING_MEASURES, String(v)) ?? String(v) },
  { key: "smokingNote", label: "受動喫煙防止の措置（内容）", show: String },
];

function showTop(key: TopKey, v: unknown): string {
  if (Array.isArray(v)) return v.join("・");
  if (key === "remoteWorkStatus") return labelOf(REMOTE_WORK_STATUSES, String(v)) ?? String(v);
  return String(v);
}

type Item =
  | { kind: "top"; key: TopKey; label: string; value: unknown; text: string }
  | { kind: "labor"; key: LaborKey; label: string; value: unknown; text: string };

function toItems(d: JobPrefillDraft): Item[] {
  const items: Item[] = [];
  for (const { key, label } of PREFILL_FIELD_LABELS) {
    const v = d[key];
    if (v === undefined) continue;
    items.push({ kind: "top", key, label, value: v, text: showTop(key, v) });
  }
  for (const r of LABOR_ROWS) {
    const v = d.labor?.[r.key];
    if (v === undefined) continue;
    items.push({ kind: "labor", key: r.key, label: r.label, value: v, text: r.show(v) });
  }
  return items;
}

export function JobPrefillPanel(props: {
  /** いまフォームに入っている値（上書きになるかを示すため） */
  currentText: (item: { kind: "top" | "labor"; key: string }) => string;
  onApplyTop: (key: TopKey, value: unknown) => void;
  onApplyLabor: (patch: Partial<LaborTerms>) => void;
  /** ⚠️ /dev/preview 専用（読み取り後の状態を描くため）。画面からは渡さない */
  initialDraft?: JobPrefillDraft;
}) {
  const [open, setOpen] = useState(!!props.initialDraft);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[] | null>(props.initialDraft ? toItems(props.initialDraft) : null);
  const [remaining, setRemaining] = useState<number | null>(null);

  async function read() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/biz/jobs/prefill", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.error ?? "読み取りに失敗しました"); return; }
      setItems(toItems(j.draft ?? {}));
      setRemaining(typeof j.remaining === "number" ? j.remaining : null);
    } catch {
      setError("読み取りに失敗しました。時間をおいてお試しください");
    } finally {
      setBusy(false);
    }
  }

  function apply(it: Item) {
    if (it.kind === "top") props.onApplyTop(it.key, it.value);
    else props.onApplyLabor({ [it.key]: it.value } as Partial<LaborTerms>);
    setItems((xs) => (xs ?? []).filter((x) => !(x.kind === it.kind && x.key === it.key)));
  }
  function applyAll() {
    const rest = items ?? [];
    const labor: Partial<LaborTerms> = {};
    for (const it of rest) {
      if (it.kind === "top") props.onApplyTop(it.key, it.value);
      else (labor as Record<string, unknown>)[it.key] = it.value;
    }
    if (Object.keys(labor).length) props.onApplyLabor(labor);
    setItems([]);
  }
  const dismiss = (it: Item) => setItems((xs) => (xs ?? []).filter((x) => !(x.kind === it.kind && x.key === it.key)));

  if (!open) {
    return (
      <div style={{ marginBottom: 16 }}>
        <button type="button" onClick={() => setOpen(true)} data-state="prefill-open"
          style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          求人票を貼り付けて下書きを作る
        </button>
      </div>
    );
  }

  return (
    <section data-state="prefill-panel" style={{ marginBottom: 20, padding: 16, border: "1px solid var(--line)", borderRadius: 12, background: "var(--bg-tint)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>求人票を貼り付けて下書きを作る</h3>
        <button type="button" onClick={() => setOpen(false)} aria-label="閉じる"
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-mute)", fontSize: 15 }}>✕</button>
      </div>
      <p style={{ margin: "0 0 10px", fontSize: 12.5, lineHeight: 1.7, color: "var(--ink-soft)" }}>
        お手元の求人票の文章を貼り付けると、読み取った内容を「下書き・要確認」として並べます。
        確認して「入れる」を押した項目だけがフォームに入ります。貼り付けた文章は保存しません。
      </p>
      {items === null && (
        <>
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={JOB_PREFILL_MAX_CHARS} rows={8}
            aria-label="求人票の文章" placeholder="求人票の文章をここに貼り付けてください"
            style={{ width: "100%", boxSizing: "border-box", padding: 10, border: "1px solid var(--line)", borderRadius: 8, fontSize: 13, lineHeight: 1.6, fontFamily: "inherit", resize: "vertical", background: "#fff" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => void read()} disabled={busy || !text.trim()} className="btn-fixed-size"
              style={{ height: 36, padding: "0 18px", borderRadius: 8, border: "none", background: "var(--royal)", color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: busy || !text.trim() ? "default" : "pointer", opacity: busy || !text.trim() ? 0.6 : 1 }}>
              {busy ? "読み取り中…" : "読み取る"}
            </button>
            <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{text.length.toLocaleString("ja-JP")} / {JOB_PREFILL_MAX_CHARS.toLocaleString("ja-JP")}字 ・ 1日{JOB_PREFILL_DAILY_LIMIT}回まで</span>
          </div>
        </>
      )}
      {error && <p role="alert" style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--error)" }}>{error}</p>}

      {items !== null && (
        <div>
          {items.length === 0 ? (
            <p data-state="prefill-done" style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)" }}>
              下書きの項目はありません。{remaining !== null && `（今日あと${remaining}回使えます）`}
            </p>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((it) => {
                  const cur = props.currentText(it);
                  return (
                    <div key={`${it.kind}:${it.key}`} data-state="prefill-item" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>{it.label}</span>
                        {/* ⚠️ 黄色は「注意・未完了」の色（ui-conventions）。確認するまでは未完了 */}
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 100, background: "var(--warm-soft)", color: "var(--warm-ink)" }}>下書き・要確認</span>
                      </div>
                      <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--ink-soft)", whiteSpace: "pre-wrap", maxHeight: 160, overflowY: "auto", overflowWrap: "anywhere" }}>{it.text}</div>
                      {cur && <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--ink-mute)", overflowWrap: "anywhere" }}>いまの入力（入れると置き換わります）：{cur.length > 60 ? `${cur.slice(0, 60)}…` : cur}</div>}
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button type="button" onClick={() => apply(it)} data-state="prefill-apply"
                          style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid var(--royal)", background: "#fff", color: "var(--royal)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          確認して入れる
                        </button>
                        <button type="button" onClick={() => dismiss(it)}
                          style={{ padding: "5px 10px", borderRadius: 8, border: "none", background: "none", color: "var(--ink-mute)", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
                          使わない
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                <button type="button" onClick={applyAll}
                  style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  内容を確認したので、残りをすべて入れる
                </button>
                {remaining !== null && <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>今日あと{remaining}回使えます</span>}
              </div>
            </>
          )}
          <button type="button" onClick={() => { setItems(null); setText(""); }}
            style={{ marginTop: 10, padding: 0, border: "none", background: "none", color: "var(--royal)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            別の求人票を貼り付ける
          </button>
        </div>
      )}
    </section>
  );
}
