"use client";

/**
 * ★入社後のふり返り（入社3か月・入社1年。2026-11-20 / 柴さんの指示）。
 *   データは ow_join_checkins / ow_join_checkin_axes。時点・いつ聞くか・検証は lib/joinCheckin/constants.ts。
 *
 * 画面: ① 合っているか（0〜10）と入社前の話との差（4項目）… 必須
 *       ② 職場の実態（環境の軸）と主に向き合っている相手 … 任意
 *       ③ あなたが合う職場の傾向（本人の回答だけ。入社後レビューの TendencyView をそのまま使う）
 *
 * ⚠️ 物差しと文言は入社後レビューと同じ（lib/workplaceReview/constants.ts）。片方だけ変えないこと。
 * ⚠️ 「今回は答えない」を押すと、その時点はもう聞かない（skipped_at）。× で閉じたときは記録しない（次に開けばまた出る）。
 * ⚠️★「この回答は会社には見えません」を必ず出す（CHECKIN_PRIVACY_NOTE）。
 * ⚠️ この style のコメントに不等号・アンパサンド・バッククォートを書かない（ハイドレーションが壊れる）。
 */

import { useEffect, useRef, useState } from "react";
import { ProfileEditModal } from "./ProfileEditModal";
import { TendencyView } from "./ExperienceReasonModal";
import { AXIS_SCALE, GAP_CHOICES, GAP_ITEMS, type ReviewAxis } from "@/lib/workplaceReview/constants";
import type { Tendency } from "@/lib/workplaceReview/tendency";
import {
  CHECKIN_CUSTOMERS, CHECKIN_FIT_ENDS, CHECKIN_FIT_MAX, CHECKIN_FIT_MIN, CHECKIN_PRIVACY_NOTE, checkpointOf,
  type CheckinGapKey, type CheckpointKey,
} from "@/lib/joinCheckin/constants";

/** GET /api/jobseeker/experiences/[id]/checkin の形（lib/joinCheckin/server.ts の LoadedCheckin） */
export type LoadedCheckinView = {
  anchorId: string;
  checkpoint: CheckpointKey;
  status: "answered" | "skipped" | "none";
  canAnswer: boolean;
  answers: { fitScore: number; gaps: Record<CheckinGapKey, number>; axes: Record<string, number>; customer: string | null } | null;
  masters: { axes: ReviewAxis[] };
};

type Draft = {
  fitScore: number | null;
  gaps: Record<CheckinGapKey, number | null>;
  axes: Record<string, number>;
  customer: string | null;
};
const EMPTY: Draft = { fitScore: null, gaps: { gap_job: null, gap_pay: null, gap_growth: null, gap_culture: null }, axes: {}, customer: null };

const Q = { fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: "0 0 10px", lineHeight: 1.6 } as const;

const CSS = `
  .jc-choice { min-height: 44px; min-width: 0; padding: 6px 4px; border-radius: 10px; border: 1.5px solid var(--line);
    background: #fff; color: var(--ink-soft); font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer;
    line-height: 1.3; transition: border-color 0.12s, background 0.12s, color 0.12s; }
  .jc-choice[data-active=on] { border-color: var(--royal); background: var(--royal-50); color: var(--royal); font-weight: 700; }
  .jc-choice:disabled { cursor: default; opacity: 0.5; }
  .jc-fit { display: grid; grid-template-columns: repeat(11, minmax(0, 1fr)); gap: 4px; }
  .jc-fit .jc-choice { padding: 6px 0; font-size: 14px; }
  @media (max-width: 639px) { .jc-fit { grid-template-columns: repeat(6, minmax(44px, 1fr)); row-gap: 6px; } }
  .jc-ends { display: flex; justify-content: space-between; gap: 8px; margin-top: 6px; font-size: 11px; color: var(--ink-mute); }
  .jc-gap { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-top: 6px; }
  .jc-axis { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px; margin-top: 6px; }
  .jc-axis .jc-choice { font-size: 12px; white-space: nowrap; }
  .jc-sides { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; font-weight: 600; color: var(--ink); line-height: 1.5; }
  .jc-sides span:last-child { text-align: right; }
  .jc-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .jc-chips .jc-choice { padding: 6px 14px; border-radius: 999px; }
  @media (max-width: 400px) { .jc-axis .jc-choice { font-size: 11px; } }
`;

function Choice({ label, active, disabled, onClick, ariaLabel }: {
  label: React.ReactNode; active: boolean; disabled?: boolean; onClick: () => void; ariaLabel?: string;
}) {
  return (
    <button type="button" className="btn-fixed-size jc-choice" aria-pressed={active} aria-label={ariaLabel}
      disabled={disabled} onClick={onClick} data-active={active ? "on" : "off"}>
      {label}
    </button>
  );
}

function requiredDone(d: Draft): boolean {
  return d.fitScore !== null && GAP_ITEMS.every((g) => d.gaps[g.key] !== null);
}

export function JoinCheckinModal({
  open,
  experienceId,
  companyName,
  checkpoint,
  onSaved,
  onClose,
  preview,
}: {
  open: boolean;
  /** 開いた職歴の id（どの役割でもよい。保存先＝その会社のいちばん古い行はサーバーが決める） */
  experienceId: string;
  companyName: string;
  /** 聞く時点。省略するとサーバーが「いま聞くべき時点」を決める */
  checkpoint?: CheckpointKey;
  onSaved?: () => void;
  onClose: () => void;
  /** ★`/dev/preview` 用。渡すとサーバーと通信しない */
  preview?: { loaded: LoadedCheckinView; tendency: Tendency | null };
}) {
  const [loaded, setLoaded] = useState<LoadedCheckinView | null>(preview?.loaded ?? null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(() => fromLoaded(preview?.loaded ?? null));
  const [step, setStep] = useState<1 | 2 | "done">(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tendency, setTendency] = useState<Tendency | null>(null);
  /* ⚠️ 親は onClose を毎回作り直すので、読み込みの effect の依存に入れない */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || preview) return;
    let alive = true;
    (async () => {
      try {
        const qs = checkpoint ? `?checkpoint=${checkpoint}` : "";
        const res = await fetch(`/api/jobseeker/experiences/${experienceId}/checkin${qs}`, { cache: "no-store" });
        const j = (await res.json().catch(() => ({}))) as LoadedCheckinView & { error?: string };
        if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
        if (!alive) return;
        setLoaded(j);
        setDraft(fromLoaded(j));
      } catch (e) {
        console.error("[JoinCheckinModal] load:", (e as Error).message);
        if (alive) setLoadError("読み込みに失敗しました。時間をおいてお試しください。");
      }
    })();
    return () => { alive = false; };
  }, [open, experienceId, checkpoint, preview]);

  async function put(body: Record<string, unknown>): Promise<{ tendency?: Tendency | null }> {
    if (preview) return { tendency: preview.tendency };
    const res = await fetch(`/api/jobseeker/experiences/${experienceId}/checkin`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const j = (await res.json().catch(() => ({}))) as { message?: string; tendency?: Tendency | null };
    if (!res.ok) throw new Error(j.message ?? "保存に失敗しました。もう一度お試しください。");
    return j;
  }

  async function save() {
    if (!loaded || !requiredDone(draft)) return;
    setSaving(true); setSaveError(null);
    try {
      const j = await put({ checkpoint: loaded.checkpoint, answers: draft });
      setTendency(j.tendency ?? null);
      setStep("done");
      onSaved?.();
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  /* ★「今回は答えない」。その時点はもう聞かない。⚠️ 答えてあるときは出さない */
  async function skip() {
    if (!loaded) return;
    setSaving(true); setSaveError(null);
    try {
      await put({ checkpoint: loaded.checkpoint, skip: true });
      onCloseRef.current();
    } catch (e) {
      setSaveError((e as Error).message);
      setSaving(false);
    }
  }

  if (!open) return null;
  const ready = !!loaded;
  const cp = loaded ? checkpointOf(loaded.checkpoint) : null;
  const canSkip = ready && loaded!.status !== "answered" && step !== "done";

  const footer = step === 1
    ? { label: "次へ（任意・約30秒）", onSave: () => setStep(2), disabled: !ready || !loaded!.canAnswer || !requiredDone(draft) }
    : step === 2
      ? { label: "保存する", onSave: () => void save(), disabled: !requiredDone(draft) }
      : { label: "閉じる", onSave: () => onClose(), disabled: false };

  return (
    <ProfileEditModal
      open={open}
      title={cp ? `${companyName}について（${cp.label}）` : `${companyName}について`}
      width={600}
      dirty={false}
      /* ★入力が変わっていれば、閉じるときに「破棄しますか？」を出す（2026-11-27） */
      changed={step !== "done" && JSON.stringify(draft) !== JSON.stringify(fromLoaded(loaded))}
      saving={saving}
      justSaved={false}
      error={saveError ?? loadError}
      saveLabel={footer.label}
      primaryEnabled
      primaryDisabled={footer.disabled}
      extraLabel={step === 2 ? "戻る" : undefined}
      onExtra={step === 2 ? () => setStep(1) : undefined}
      secondaryLabel={canSkip ? "今回は答えない" : undefined}
      onSecondary={canSkip ? () => void skip() : undefined}
      onSave={footer.onSave}
      onClose={onClose}
    >
      <style>{CSS}</style>
      {!ready && !loadError && <div style={{ fontSize: 13, color: "var(--ink-mute)" }}>読み込んでいます…</div>}

      {ready && !loaded!.canAnswer && step !== "done" && (
        <p data-state="jc-too-early" style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)" }}>
          {cp!.label}のふり返りは、入社からその期間がたってからお聞きします。
        </p>
      )}

      {ready && loaded!.canAnswer && step === 1 && (
        <div data-state="jc-step-1" style={{ display: "grid", gap: 22, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)" }}>
            {cp!.lead}。いまの職場について教えてください。
          </p>
          <section style={{ minWidth: 0 }}>
            <h3 style={Q}>この会社は、あなたに合っていますか？</h3>
            <div className="jc-fit" role="group" aria-label="合っている度合い（0〜10）">
              {Array.from({ length: CHECKIN_FIT_MAX - CHECKIN_FIT_MIN + 1 }, (_, i) => CHECKIN_FIT_MIN + i).map((n) => (
                <Choice key={n} label={n} active={draft.fitScore === n} disabled={saving}
                  onClick={() => setDraft((d) => ({ ...d, fitScore: d.fitScore === n ? null : n }))} />
              ))}
            </div>
            <div className="jc-ends"><span>{CHECKIN_FIT_ENDS.low}</span><span>{CHECKIN_FIT_ENDS.high}</span></div>
          </section>
          <section style={{ minWidth: 0 }}>
            <h3 style={Q}>入社前に聞いていた話と比べて、実際はどうですか？</h3>
            <div style={{ display: "grid", gap: 14 }}>
              {GAP_ITEMS.map((g) => (
                <div key={g.key} data-state="jc-gap-item" style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                    {g.label}
                    <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 500, color: "var(--ink-mute)" }}>{g.hint}</span>
                  </div>
                  <div className="jc-gap" role="group" aria-label={g.label}>
                    {GAP_CHOICES.map((label, v) => (
                      <Choice key={v} label={label} active={draft.gaps[g.key] === v} disabled={saving}
                        onClick={() => setDraft((d) => ({ ...d, gaps: { ...d.gaps, [g.key]: d.gaps[g.key] === v ? null : v } }))} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
          {!requiredDone(draft) && (
            <p data-state="jc-required-hint" style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)" }}>すべてに答えると次へ進めます。</p>
          )}
          <p data-testid="join-checkin-privacy-note" style={{ margin: 0, fontSize: 12.5, fontWeight: 600, lineHeight: 1.7, color: "var(--ink-soft)" }}>
            {CHECKIN_PRIVACY_NOTE}
          </p>
        </div>
      )}

      {ready && loaded!.canAnswer && step === 2 && (
        <div data-state="jc-step-2" style={{ display: "grid", gap: 22, minWidth: 0 }}>
          <section style={{ minWidth: 0 }}>
            <h3 style={Q}>職場は、実際どちら寄りですか？</h3>
            <p style={{ margin: "-4px 0 16px", fontSize: 12, lineHeight: 1.7, color: "var(--ink-mute)" }}>
              良い・悪いではなく、実態に近いほうを選んでください。わからない項目は飛ばして大丈夫です。
            </p>
            <div style={{ display: "grid", gap: 18 }}>
              {loaded!.masters.axes.map((ax) => (
                <div key={ax.key} data-state="jc-axis" style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 4 }}>{ax.name}</div>
                  <div className="jc-sides"><span>{ax.leftText}</span><span>{ax.rightText}</span></div>
                  <div className="jc-axis" role="group" aria-label={ax.name}>
                    {AXIS_SCALE.map((label, v) => (
                      <Choice key={v} label={label} active={draft.axes[ax.key] === v} disabled={saving}
                        ariaLabel={`${ax.name}: ${label.replace(/[←→]/g, "").trim()}${v < 2 ? `（${ax.leftText}）` : v > 2 ? `（${ax.rightText}）` : ""}`}
                        onClick={() => setDraft((d) => {
                          const axes = { ...d.axes };
                          if (axes[ax.key] === v) delete axes[ax.key]; else axes[ax.key] = v;
                          return { ...d, axes };
                        })} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section style={{ minWidth: 0 }}>
            <h3 style={{ ...Q, marginBottom: 4 }}>主に向き合っている相手は？</h3>
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--ink-mute)" }}>1つ選べます（任意）</p>
            <div className="jc-chips" role="group" aria-label="主に向き合っている相手">
              {CHECKIN_CUSTOMERS.map((c) => (
                <Choice key={c.value} label={c.label} active={draft.customer === c.value} disabled={saving}
                  onClick={() => setDraft((d) => ({ ...d, customer: d.customer === c.value ? null : c.value }))} />
              ))}
            </div>
          </section>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, lineHeight: 1.7, color: "var(--ink-soft)" }}>{CHECKIN_PRIVACY_NOTE}</p>
        </div>
      )}

      {step === "done" && <TendencyView tendency={tendency} nextCompanyName={null} onNext={null} />}
    </ProfileEditModal>
  );
}

function fromLoaded(l: LoadedCheckinView | null): Draft {
  if (!l?.answers) return EMPTY;
  return { fitScore: l.answers.fitScore, gaps: { ...l.answers.gaps }, axes: { ...l.answers.axes }, customer: l.answers.customer };
}
