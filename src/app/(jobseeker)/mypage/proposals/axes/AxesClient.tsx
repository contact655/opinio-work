"use client";

import { useState } from "react";
import Link from "next/link";
import { parseFitAxesAnswer, type ParsedAxis } from "@/lib/fitAxes/parse";
import type { FitAxisValue } from "@/lib/fitAxes/axes";

/**
 * ★「相性のものさし」の画面（2026-10-15）。
 *
 * 流れ: 見る（作成済み）／始める → ①質問文をコピー → ②AI の答えを貼る → ③確認して保存
 *       「AI を使わずに答える」は①②を飛ばして③へ
 *
 * ⚠️★**貼り付けた文章はこの画面の中だけで読み取って捨てる。サーバーへ送らない。**
 *    送るのは③で本人が確認した数字だけ（/api/jobseeker/fit-axes）。保存したら貼り付け欄の中身も消す。
 * ⚠️ AI が添えた理由は③で見せるだけ。保存しない。
 */

type Axis = { key: string; name: string; left: string; right: string };
type Step = "view" | "choose" | "paste" | "confirm";
/** undefined = まだ選んでいない（③で本人に選ばせる） */
type Draft = Record<string, FitAxisValue | undefined>;

const NOTE = "貼り付けた文章は保存されません。保存されるのは、あなたが確認した数字だけです。この内容は会社には表示されません。";

export default function AxesClient({
  axes, prompt, saved, savedAt, loadFailed, pastReasons,
}: {
  axes: Axis[];
  prompt: string;
  saved: Record<string, FitAxisValue> | null;
  savedAt: string | null;
  loadFailed: boolean;
  pastReasons: { company: string; labels: string[] }[];
}) {
  const hasSaved = !!saved && Object.keys(saved).length > 0;
  const [current, setCurrent] = useState<Record<string, FitAxisValue> | null>(hasSaved ? saved : null);
  const [step, setStep] = useState<Step>(hasSaved ? "view" : "choose");
  const [pasted, setPasted] = useState("");
  const [draft, setDraft] = useState<Draft>({});
  const [reasons, setReasons] = useState<Record<string, string | null>>({});
  const [source, setSource] = useState<"ai_paste" | "manual">("manual");
  const [readCount, setReadCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function startManual() {
    setSource("manual");
    setDraft({});
    setReasons({});
    setReadCount(null);
    setStep("confirm");
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setErr("コピーできませんでした。質問文を選択してコピーしてください。");
    }
  }

  function readPasted() {
    /* ★ブラウザの中だけで読み取る（サーバーに送らない） */
    const parsed: Record<string, ParsedAxis> = parseFitAxesAnswer(pasted, axes.map((a) => a.key));
    const d: Draft = {};
    const r: Record<string, string | null> = {};
    for (const a of axes) {
      if (a.key in parsed) {
        d[a.key] = parsed[a.key].value;
        r[a.key] = parsed[a.key].reason;
      }
    }
    setDraft(d);
    setReasons(r);
    setReadCount(Object.keys(parsed).length);
    setSource("ai_paste");
    setStep("confirm");
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const answers: Record<string, FitAxisValue> = {};
      for (const a of axes) answers[a.key] = draft[a.key] ?? null;
      const res = await fetch("/api/jobseeker/fit-axes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, source }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(json.error ?? "保存できませんでした");
        return;
      }
      setCurrent(answers);
      /* ★貼り付けた文章と AI の理由は、保存したら画面からも消す */
      setPasted("");
      setReasons({});
      setStep("view");
    } catch {
      setErr("保存できませんでした。通信を確かめてもう一度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("相性のものさしを削除します。よろしいですか？")) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/jobseeker/fit-axes", { method: "DELETE" });
      if (!res.ok) {
        setErr("削除できませんでした");
        return;
      }
      setCurrent(null);
      setStep("choose");
    } finally {
      setBusy(false);
    }
  }

  const allChosen = axes.every((a) => draft[a.key] !== undefined);
  const btn = { fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 8, cursor: "pointer", minHeight: 36 } as const;

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 64px" }}>
      <p style={{ margin: "0 0 8px", fontSize: 12 }}>
        <Link href="/mypage/proposals" style={{ color: "var(--royal)" }}>← あなたに合う会社</Link>
      </p>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>相性のものさし</h1>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)", margin: "0 0 18px" }}>
        仕事の進め方や好みを6つの軸で表したものです。<strong>あなたにだけ表示され、会社には表示されません。</strong>
      </p>

      {err && <p role="alert" style={{ fontSize: 13, color: "#B3261E", background: "#FDF2F2", border: "1px solid #F0C7C7", borderRadius: 8, padding: "10px 12px", margin: "0 0 14px" }}>{err}</p>}
      {loadFailed && <p role="alert" style={{ fontSize: 13, color: "#B3261E", margin: "0 0 14px" }}>保存済みのものさしを読み込めませんでした。<strong>「未作成」という意味ではありません。</strong></p>}

      {/* ── 見る（作成済み）── */}
      {step === "view" && current && (
        <section data-state="axes-view">
          <AxesSummary axes={axes} values={current} />
          {savedAt && <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: "8px 0 0" }}>最後に保存した日：{savedAt.slice(0, 10)}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setStep("choose")} style={{ ...btn, border: "none", background: "var(--royal)", color: "#fff" }}>作り直す</button>
            <button type="button" onClick={remove} disabled={busy} style={{ ...btn, border: "none", background: "none", color: "var(--ink-soft)", textDecoration: "underline" }}>削除する</button>
          </div>
        </section>
      )}

      {/* ── 始め方を選ぶ ── */}
      {step === "choose" && (
        <section data-state="axes-choose" style={{ display: "grid", gap: 10 }}>
          <button type="button" onClick={() => setStep("paste")}
            style={{ textAlign: "left", border: "1px solid var(--line)", borderRadius: 10, padding: "14px 16px", background: "#fff", cursor: "pointer" }}>
            <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>自分のAIで作る（約3分）</span>
            <span style={{ display: "block", fontSize: 12, color: "var(--ink-soft)", marginTop: 2, lineHeight: 1.7 }}>
              ふだん使っている Claude や ChatGPT に質問文を貼り、答えをここに貼り戻します。OPINIO は AI に何も送りません。
            </span>
          </button>
          <button type="button" onClick={startManual}
            style={{ textAlign: "left", border: "1px solid var(--line)", borderRadius: 10, padding: "14px 16px", background: "#fff", cursor: "pointer" }}>
            <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>AIを使わずに答える</span>
            <span style={{ display: "block", fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>6つの質問に、この画面で直接答えます。</span>
          </button>
          {current && <button type="button" onClick={() => setStep("view")} style={{ ...btn, border: "none", background: "none", color: "var(--ink-soft)", justifySelf: "start" }}>やめる</button>}
        </section>
      )}

      {/* ── ①コピー ②貼り付け ── */}
      {step === "paste" && (
        <section data-state="axes-paste">
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 6px" }}>① 質問文をコピーして、自分のAIに貼る</h2>
          <textarea readOnly value={prompt} rows={10} aria-label="自分のAIに貼る質問文"
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 12, lineHeight: 1.6, background: "var(--bg-tint)", resize: "vertical" }} />
          <button type="button" onClick={copyPrompt} style={{ ...btn, marginTop: 6, border: "1px solid var(--line)", background: "#fff", color: "var(--ink)" }}>
            {copied ? "コピーしました" : "コピー"}
          </button>

          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "20px 0 6px" }}>② AIの答えを、そのまま貼り付ける</h2>
          <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={8} aria-label="AIの答え"
            placeholder={"[work_style] 2: …\n[phase] 1: …"}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, lineHeight: 1.6, resize: "vertical" }} />
          <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: "4px 0 0", lineHeight: 1.7 }}>{NOTE}</p>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" onClick={readPasted} disabled={!pasted.trim()}
              style={{ ...btn, border: "none", background: "var(--royal)", color: "#fff", opacity: pasted.trim() ? 1 : 0.5 }}>読み取って確認する</button>
            <button type="button" onClick={() => setStep(current ? "view" : "choose")} style={{ ...btn, border: "none", background: "none", color: "var(--ink-soft)" }}>やめる</button>
          </div>
        </section>
      )}

      {/* ── ③確認して保存 ── */}
      {step === "confirm" && (
        <section data-state="axes-confirm">
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 6px" }}>③ 確認して保存する</h2>
          {readCount !== null && (
            <p data-state="axes-read-count" style={{ fontSize: 13, margin: "0 0 10px" }}>
              6つの軸のうち <strong>{readCount}つ</strong> を読み取りました。
              {readCount < axes.length && "読み取れなかった軸は、あなたが選んでください。"}
            </p>
          )}
          <div className="axes-confirm-grid">
            <div style={{ display: "grid", gap: 12 }}>
              {axes.map((a) => (
                <AxisPicker key={a.key} axis={a} value={draft[a.key]} reason={reasons[a.key] ?? null}
                  onChange={(v) => setDraft((d) => ({ ...d, [a.key]: v }))} />
              ))}
            </div>
            {/* ★参考だけ。初期値には使わない（柴さんの判断） */}
            {pastReasons.length > 0 && (
              <aside data-state="axes-past-reasons" style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px", background: "var(--bg-tint)", fontSize: 12, lineHeight: 1.7, alignSelf: "start" }}>
                <p style={{ margin: "0 0 6px", fontWeight: 700 }}>参考：以前、入社の決め手に挙げたもの</p>
                {pastReasons.map((r, i) => (
                  <p key={i} style={{ margin: "0 0 4px", color: "var(--ink-soft)" }}>{r.company}：{r.labels.join("・")}</p>
                ))}
              </aside>
            )}
          </div>
          <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: "12px 0 0", lineHeight: 1.7 }}>{NOTE}</p>
          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" onClick={save} disabled={busy || !allChosen}
              style={{ ...btn, border: "none", background: "var(--royal)", color: "#fff", opacity: allChosen && !busy ? 1 : 0.5 }}>保存する</button>
            {!allChosen && <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>すべての軸を選ぶと保存できます（「わからない」も選べます）</span>}
            <button type="button" onClick={() => setStep(current ? "view" : "choose")} style={{ ...btn, border: "none", background: "none", color: "var(--ink-soft)" }}>やめる</button>
          </div>
          <style>{`
            .axes-confirm-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
            @media (min-width: 900px) { .axes-confirm-grid { grid-template-columns: minmax(0, 1fr) 220px; } }
          `}</style>
        </section>
      )}
    </main>
  );
}

function AxisPicker({ axis, value, reason, onChange }: {
  axis: Axis; value: FitAxisValue | undefined; reason: string | null; onChange: (v: FitAxisValue) => void;
}) {
  const opts: { v: FitAxisValue; label: string }[] = [1, 2, 3, 4, 5].map((n) => ({ v: n as FitAxisValue, label: String(n) }));
  return (
    <div data-axis={axis.key} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px", background: "#fff" }}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
        {axis.name}
        {value === undefined && <span data-state="axis-unset" style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: "#8A6D3B" }}>未入力</span>}
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, color: "var(--ink-soft)", margin: "6px 0 4px" }}>
        <span>1＝{axis.left}</span><span style={{ textAlign: "right" }}>5＝{axis.right}</span>
      </div>
      <div role="radiogroup" aria-label={axis.name} style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {[...opts, { v: null as FitAxisValue, label: "わからない" }].map((o) => {
          const on = value === o.v;
          return (
            <button key={o.label} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.v)}
              style={{
                minWidth: o.v === null ? 84 : 40, minHeight: 36, padding: "4px 8px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                border: on ? "2px solid var(--royal)" : "1px solid var(--line)", background: on ? "#EEF2FB" : "#fff", color: "var(--ink)",
              }}>
              {o.label}
            </button>
          );
        })}
      </div>
      {/* ⚠️ AI が添えた理由は見せるだけ。保存しない */}
      {reason && <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6 }}>AIの理由（保存されません）：{reason}</p>}
    </div>
  );
}

/** 保存済みのものさしの表示。「あなたに合う会社」の入口のカードでも同じ形を使う */
export function AxesSummary({ axes, values }: { axes: Axis[]; values: Record<string, FitAxisValue> }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
      {axes.map((a) => {
        const v = values[a.key];
        return (
          <li key={a.key} style={{ fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontWeight: 600 }}>{a.name}</span>
              <span style={{ color: "var(--ink-soft)" }}>{v == null ? "わからない" : `${v}`}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--ink-soft)" }}>
              <span style={{ flex: "0 0 auto", maxWidth: "35%" }}>{a.left}</span>
              <span aria-hidden style={{ flex: 1, minWidth: 40, height: 6, borderRadius: 3, background: "var(--line)", position: "relative" }}>
                {v != null && <span style={{ position: "absolute", top: -3, left: `calc(${((v - 1) / 4) * 100}% - 6px)`, width: 12, height: 12, borderRadius: 6, background: "var(--royal)" }} />}
              </span>
              <span style={{ flex: "0 0 auto", maxWidth: "35%", textAlign: "right" }}>{a.right}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
