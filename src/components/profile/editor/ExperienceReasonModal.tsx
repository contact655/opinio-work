"use client";

/**
 * ★入社後レビュー「株式会社◯◯について」（2026-10-16 に作り直した。フェーズ1）。
 *   データは ow_workplace_reviews ほか（migration 20261016190000）。決めごとは lib/workplaceReview/constants.ts。
 *
 * ── 流れ ─────────────────────────────────────────────────────────────────────
 *   ① 必須（約30秒）… 合っていたか（0〜10）／入社前の期待と比べて（4項目 × 3択）
 *   ② 任意 … 実際はどちら寄りだったか（6軸 × 5段階。軸はマスタ）
 *   ③ 任意 … 働き方の事実（3項目 × 4択）／合う人（タグ）／入る前に知りたかったこと（80字）
 *   ④ 完了 … あなたが合う職場の傾向（本人の回答だけ。ルールで組む。lib/workplaceReview/tendency.ts）
 *
 * ⚠️★「次へ」「ここで保存」のたびに保存する。①を答えて「次へ」を押した時点で①は残る（②で閉じても消えない）。
 * ⚠️★開き直したら続きから: 未回答→① ／ ①まで→②（②に回答があれば③）／ 最後まで→①（見直し）。
 * ⚠️ 回答は公開しない。会社にも伝えない。文言に「公開」「表示」をにおわせる言葉を足さない。
 * ⚠️ 選択肢はすべて button。もう一度押すと外れる。
 * ⚠️ 旧形式（ow_experience_reviews ほか・旧の列）には書かない。
 */

import { useEffect, useMemo, useState } from "react";
import { ProfileEditModal } from "./ProfileEditModal";
import {
  AXIS_SCALE,
  EMPTY_ANSWERS,
  FACT_ITEMS,
  FIT_SCORE_ENDS,
  FIT_SCORE_MAX,
  FIT_SCORE_MIN,
  GAP_CHOICES,
  GAP_ITEMS,
  MEMO_MAX,
  memoLength,
  requiredDone,
  type ReviewAxis,
  type ReviewFitTag,
  type ReviewStatus,
  type WorkplaceReviewAnswers,
} from "@/lib/workplaceReview/constants";
import type { Tendency } from "@/lib/workplaceReview/tendency";
import { LEAVE_REASONS } from "@/lib/constants/careerReasons";
import { LEAVE_REASON_MAX } from "@/lib/workplaceReview/constants";
import { CAREER_CONSULT_URL } from "@/lib/constants/externalLinks";

const PRIVACY_NOTE = "回答は公開されず、会社にも伝わりません。あなたに合う会社を探すためだけに使います。";

/** ④のボタンの行き先（2026-10-16 / フェーズ0の調査で決めた） */
const FIT_COMPANIES_HREF = "/mypage/proposals";
/* ★キャリア相談の予約ページは lib/constants/externalLinks.ts の CAREER_CONSULT_URL（1か所）。
      null のあいだは「キャリア相談する」を出さない。値が入れば新しいタブで開く */

/** GET /api/jobseeker/experiences/[id]/review の形（lib/workplaceReview/server.ts の LoadedReview） */
export type LoadedWorkplaceReview = {
  anchorId: string;
  /** ★この会社について何か回答が残っているか（削除の操作を出すか。2026-10-26）。古いプレビューでは無いことがある */
  hasStoredAnswers?: boolean;
  /** 終了した会社か（③の末尾に「離れた理由」を出すか） */
  canLeave: boolean;
  status: ReviewStatus | null;
  answers: WorkplaceReviewAnswers;
  masters: { axes: ReviewAxis[]; tags: ReviewFitTag[] };
};

/** 互換のため残す（dev/preview の古い import 用）。中身は新しい形 */
export type LoadedReasonAnswers = LoadedWorkplaceReview;

// ── 回答済みの判定（行の印）──────────────────────────────────────────────────

/**
 * ⚠️ `Stint` を import しない（`CareerHistoryEditor` ↔ ここで循環する）。構造だけを受ける。
 * `reasonVersion` は `GET /api/jobseeker/experiences/reasons-status` から来る（会社単位）。
 *   2 = 新しい入社後レビューで答え済み ／ 1 = それより前の形式だけ ／ null = 未回答 ／ undefined = まだ取れていない
 */
export type ReasonSource = {
  joinReasons?: string[];
  leaveReasons?: string[];
  gaps?: { axis: string; rating: string }[];
  reasonVersion?: 1 | 2 | null;
};

export type ReasonState = "answered" | "legacy" | "none";

export function reasonState(src: ReasonSource | null | undefined): ReasonState {
  if (!src) return "none";
  if (src.reasonVersion === 2) return "answered";
  if (src.reasonVersion === 1) return "legacy";
  if (src.reasonVersion === null) return "none";
  const old =
    (src.joinReasons?.length ?? 0) > 0 ||
    (src.leaveReasons?.length ?? 0) > 0 ||
    (src.gaps?.length ?? 0) > 0;
  return old ? "legacy" : "none";
}

/** 「未回答」に数えないか（一度でも答えたか）。⚠️ 名前は互換のため */
export function hasReasonAnswers(src: ReasonSource | null | undefined): boolean {
  return reasonState(src) !== "none";
}

// ── 部品 ──────────────────────────────────────────────────────────────────────

/** 選べるボタン。⚠️ 高さ44px。もう一度押すと外れる（呼び出し側が null を渡す） */
function Choice({ label, active, disabled, onClick, ariaLabel, className = "wr-choice" }: {
  label: React.ReactNode; active: boolean; disabled?: boolean; onClick: () => void; ariaLabel?: string; className?: string;
}) {
  return (
    <button type="button" className={`btn-fixed-size ${className}`} aria-pressed={active} aria-label={ariaLabel}
      disabled={disabled} onClick={onClick} data-active={active ? "on" : "off"}>
      {label}
    </button>
  );
}

function Progress({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div data-state={`wr-progress-${step}`} style={{ margin: "0 0 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}>
        <span>{step} / 3{step === 1 ? "　必須・約30秒" : "　任意"}</span>
        <span style={{ color: "var(--ink-mute)", fontWeight: 500 }}>2・3 は任意です</span>
      </div>
      <div aria-hidden="true" style={{ marginTop: 6, height: 4, borderRadius: 999, background: "var(--line)", overflow: "hidden" }}>
        <div style={{ width: `${(step / 3) * 100}%`, height: "100%", background: "var(--royal)", transition: "width 0.2s" }} />
      </div>
    </div>
  );
}

const Q = { fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: "0 0 10px", lineHeight: 1.6 } as const;

/* ⚠️ この style のコメントにバッククォートと不等号を書かない（ハイドレーションが壊れる）。
      ⚠️ 属性セレクタの値に引用符を書かない（サーバーだけ実体参照に変わり、ハイドレーションが壊れる） */
const CSS = `
  .wr-choice { min-height: 44px; min-width: 0; padding: 6px 4px; border-radius: 10px; border: 1.5px solid var(--line);
    background: #fff; color: var(--ink-soft); font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer;
    line-height: 1.3; transition: border-color 0.12s, background 0.12s, color 0.12s; }
  .wr-choice[data-active=on] { border-color: var(--royal); background: var(--royal-50); color: var(--royal); font-weight: 700; }
  .wr-choice:disabled { cursor: default; opacity: 0.5; }
  .wr-fit { display: grid; grid-template-columns: repeat(11, minmax(0, 1fr)); gap: 4px; }
  .wr-fit .wr-choice { padding: 6px 0; font-size: 14px; }
  @media (max-width: 639px) {
    .wr-fit { grid-template-columns: repeat(6, minmax(44px, 1fr)); row-gap: 6px; }
  }
  .wr-ends { display: flex; justify-content: space-between; gap: 8px; margin-top: 6px; font-size: 11px; color: var(--ink-mute); }
  .wr-gap { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-top: 6px; }
  .wr-axis { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px; margin-top: 6px; }
  .wr-axis .wr-choice { font-size: 12px; white-space: nowrap; }
  .wr-sides { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; font-weight: 600; color: var(--ink); line-height: 1.5; }
  .wr-sides span:last-child { text-align: right; }
  .wr-fact { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin-top: 6px; }
  .wr-fact .wr-choice { font-size: 12px; }
  .wr-tags { display: flex; flex-wrap: wrap; gap: 8px; }
  .wr-tags .wr-choice { padding: 6px 14px; border-radius: 999px; }
  .wr-memo { width: 100%; min-height: 72px; padding: 10px 12px; border-radius: 10px; border: 1.5px solid var(--line);
    font-size: 14px; line-height: 1.6; font-family: inherit; resize: vertical; box-sizing: border-box; }
  .wr-dots { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px; margin-top: 6px; }
  .wr-dot { height: 22px; display: flex; align-items: center; justify-content: center; }
  .wr-dot span { width: 14px; height: 14px; border-radius: 50%; }
  @media (max-width: 400px) {
    .wr-axis .wr-choice, .wr-fact .wr-choice { font-size: 11px; }
  }
`;

type Step = 1 | 2 | 3 | "done";

/** 開き直したときに始めるステップ */
function startStep(loaded: LoadedWorkplaceReview): 1 | 2 | 3 {
  if (loaded.status === "required_done") return Object.keys(loaded.answers.axes).length > 0 ? 3 : 2;
  return 1;
}

export function ExperienceReasonModal({
  open,
  experienceId,
  companyName,
  nextCompanyName = null,
  onNext,
  onSaved,
  onClose,
  preload,
  onSaveOverride,
}: {
  open: boolean;
  /** 開いた行の id（どの役割でもよい。保存先の行はサーバーが決める） */
  experienceId: string;
  companyName: string;
  /** 互換のため受ける（未使用）。⚠️ 残りの会社は nextCompanyName と onNext で出す */
  remaining?: number;
  /** ④の下に出す「◯◯もふり返ると…」の会社名。無ければ出さない */
  nextCompanyName?: string | null;
  /** その会社のレビューを開く */
  onNext: (() => void) | null;
  /** 保存できたら呼ぶ（呼び出し側が「回答済み」の印を更新する） */
  onSaved: () => void;
  onClose: () => void;
  /** ★`/dev/preview` 用。渡すとサーバーから読まない */
  preload?: LoadedWorkplaceReview;
  /** ★`/dev/preview` 用。渡すとサーバーに保存しない。④の傾向を返す */
  onSaveOverride?: (a: WorkplaceReviewAnswers, complete: boolean) => Promise<{ ok: boolean; tendency: Tendency | null }>;
}) {
  const [loaded, setLoaded] = useState<LoadedWorkplaceReview | null>(preload ?? null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<WorkplaceReviewAnswers>(preload?.answers ?? EMPTY_ANSWERS);
  const [saved, setSaved] = useState<WorkplaceReviewAnswers | null>(preload ? preload.answers : null);
  const [step, setStep] = useState<Step>(preload ? startStep(preload) : 1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tendency, setTendency] = useState<Tendency | null>(null);

  /* 開いたときに会社単位の回答を読む。⚠️ 失敗したら答えさせない（保存すると上書きになるため） */
  useEffect(() => {
    if (!open || preload) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/jobseeker/experiences/${experienceId}/review`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const j = (await res.json()) as LoadedWorkplaceReview;
        if (!alive) return;
        setLoaded(j);
        setAnswers(j.answers);
        setSaved(j.answers);
        setStep(startStep(j));
      } catch (e) {
        console.error("[workplace-review] load:", (e as Error).message);
        if (alive) setLoadError("回答を読み込めませんでした。時間をおいてもう一度開いてください。");
      }
    })();
    return () => { alive = false; };
  }, [open, experienceId, preload]);

  const dirty = useMemo(() => !!saved && JSON.stringify(answers) !== JSON.stringify(saved), [answers, saved]);
  const ready = !!loaded && !loadError;
  const canSave = ready && requiredDone(answers);
  const memoOver = memoLength(answers.memo) > MEMO_MAX;

  /** 保存して次へ進む。⚠️ 失敗したら進まない（入力は残る） */
  async function saveAndGo(next: Step, complete: boolean) {
    if (!canSave || memoOver) return;
    setSaving(true);
    setSaveError(null);
    try {
      let t: Tendency | null = null;
      if (onSaveOverride) {
        const r = await onSaveOverride(answers, complete);
        if (!r.ok) { setSaveError("保存に失敗しました。もう一度お試しください。"); return; }
        t = r.tendency;
      } else {
        const res = await fetch(`/api/jobseeker/experiences/${experienceId}/review`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers, complete }),
        });
        const j = (await res.json().catch(() => ({}))) as { message?: string; tendency?: Tendency | null };
        if (!res.ok) { setSaveError(j.message || "保存に失敗しました。もう一度お試しください。"); return; }
        t = j.tendency ?? null;
      }
      setSaved(answers);
      setTendency(t);
      onSaved();
      setStep(next);
    } finally {
      setSaving(false);
    }
  }

  const setGap = (k: (typeof GAP_ITEMS)[number]["key"], v: number) =>
    setAnswers((a) => ({ ...a, gaps: { ...a.gaps, [k]: a.gaps[k] === v ? null : v } }));
  const setAxis = (k: string, v: number) =>
    setAnswers((a) => {
      const axes = { ...a.axes };
      if (axes[k] === v) delete axes[k]; else axes[k] = v;
      return { ...a, axes };
    });
  const setFact = (k: (typeof FACT_ITEMS)[number]["key"], v: number) =>
    setAnswers((a) => ({ ...a, facts: { ...a.facts, [k]: a.facts[k] === v ? null : v } }));
  const toggleTag = (k: string) =>
    setAnswers((a) => ({ ...a, tags: a.tags.includes(k) ? a.tags.filter((x) => x !== k) : [...a.tags, k] }));
  const [leaveLimit, setLeaveLimit] = useState(false);
  const toggleLeave = (k: string) => {
    if (!answers.leaveReasons.includes(k) && answers.leaveReasons.length >= LEAVE_REASON_MAX) { setLeaveLimit(true); return; }
    setLeaveLimit(false);
    setAnswers((a) => ({ ...a, leaveReasons: a.leaveReasons.includes(k) ? a.leaveReasons.filter((x) => x !== k) : [...a.leaveReasons, k] }));
  };

  /* フッター */
  const footer = step === 1
    ? { save: "次へ（任意・約1分）", onSave: () => void saveAndGo(2, false), extra: "ここで保存", onExtra: () => void saveAndGo("done", false) }
    : step === 2
      ? { save: "次へ", onSave: () => void saveAndGo(3, false), extra: "ここで保存して終える", onExtra: () => void saveAndGo("done", false) }
      : step === 3
        ? { save: "保存する", onSave: () => void saveAndGo("done", true), extra: undefined, onExtra: undefined }
        : { save: "この傾向に合う会社を見る", onSave: () => { window.location.assign(FIT_COMPANIES_HREF); }, extra: undefined, onExtra: undefined };

  return (
    <ProfileEditModal
      open={open}
      title={`${companyName}について`}
      width={600}
      dirty={step === "done" ? false : dirty}
      saving={saving}
      justSaved={false}
      error={saveError ?? loadError}
      saveLabel={footer.save}
      primaryEnabled
      primaryDisabled={step !== "done" && (!canSave || memoOver)}
      extraLabel={footer.extra}
      onExtra={footer.onExtra}
      extraDisabled={!canSave || memoOver}
      secondaryLabel={step === "done" ? (CAREER_CONSULT_URL ? "キャリア相談する" : undefined) : "あとで答える"}
      onSecondary={() => {
        if (step === "done") {
          if (CAREER_CONSULT_URL) window.open(CAREER_CONSULT_URL, "_blank", "noopener,noreferrer");
          return;
        }
        onClose();
      }}
      onSave={footer.onSave}
      onClose={onClose}
    >
      <style>{CSS}</style>
      {!ready && !loadError && <div style={{ fontSize: 13, color: "var(--ink-mute)" }}>読み込んでいます…</div>}

      {ready && step !== "done" && <Progress step={step} />}

      {ready && step === 1 && (
        <div data-state="wr-step-1" style={{ display: "grid", gap: 22, minWidth: 0 }}>
          <p data-testid="reason-privacy-note" style={{ margin: 0, fontSize: 12, fontWeight: 500, lineHeight: 1.7, color: "var(--ink-mute)" }}>
            {PRIVACY_NOTE}
          </p>
          <section style={{ minWidth: 0 }}>
            <h3 style={Q}>この会社は、あなたに合っていましたか？</h3>
            <div className="wr-fit" role="group" aria-label="合っていた度合い（0〜10）">
              {Array.from({ length: FIT_SCORE_MAX - FIT_SCORE_MIN + 1 }, (_, i) => FIT_SCORE_MIN + i).map((n) => (
                <Choice key={n} label={n} active={answers.fitScore === n} disabled={saving}
                  onClick={() => setAnswers((a) => ({ ...a, fitScore: a.fitScore === n ? null : n }))} />
              ))}
            </div>
            <div className="wr-ends"><span>{FIT_SCORE_ENDS.low}</span><span>{FIT_SCORE_ENDS.high}</span></div>
          </section>
          <section style={{ minWidth: 0 }}>
            <h3 style={Q}>入社前の期待と比べて、実際はどうでしたか？</h3>
            <div style={{ display: "grid", gap: 14 }}>
              {GAP_ITEMS.map((g) => (
                <div key={g.key} data-state="wr-gap-item" style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                    {g.label}
                    <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 500, color: "var(--ink-mute)" }}>{g.hint}</span>
                  </div>
                  <div className="wr-gap" role="group" aria-label={g.label}>
                    {GAP_CHOICES.map((label, v) => (
                      <Choice key={v} label={label} active={answers.gaps[g.key] === v} disabled={saving} onClick={() => setGap(g.key, v)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
          {!requiredDone(answers) && (
            <p data-state="wr-required-hint" style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)" }}>
              すべてに答えると保存できます。
            </p>
          )}
        </div>
      )}

      {ready && step === 2 && loaded && (
        <div data-state="wr-step-2" style={{ minWidth: 0 }}>
          <h3 style={Q}>実際はどちら寄りでしたか？</h3>
          <p style={{ margin: "-4px 0 16px", fontSize: 12, lineHeight: 1.7, color: "var(--ink-mute)" }}>
            良い・悪いではなく、実態に近いほうを選んでください。わからない項目は飛ばして大丈夫です。
          </p>
          <div style={{ display: "grid", gap: 18 }}>
            {loaded.masters.axes.map((ax) => (
              <div key={ax.key} data-state="wr-axis" style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 4 }}>{ax.name}</div>
                <div className="wr-sides"><span>{ax.leftText}</span><span>{ax.rightText}</span></div>
                <div className="wr-axis" role="group" aria-label={ax.name}>
                  {AXIS_SCALE.map((label, v) => (
                    <Choice key={v} label={label} active={answers.axes[ax.key] === v} disabled={saving} onClick={() => setAxis(ax.key, v)}
                      ariaLabel={`${ax.name}: ${label.replace(/[←→]/g, "").trim()}${v < 2 ? `（${ax.leftText}）` : v > 2 ? `（${ax.rightText}）` : ""}`} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {ready && step === 3 && loaded && (
        <div data-state="wr-step-3" style={{ display: "grid", gap: 22, minWidth: 0 }}>
          <section style={{ minWidth: 0 }}>
            <h3 style={Q}>働き方について教えてください</h3>
            <div style={{ display: "grid", gap: 14 }}>
              {FACT_ITEMS.map((f) => (
                <div key={f.key} data-state="wr-fact" style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{f.label}</div>
                  <div className="wr-fact" role="group" aria-label={f.label}>
                    {f.choices.map((label, v) => (
                      <Choice key={v} label={label} active={answers.facts[f.key] === v} disabled={saving} onClick={() => setFact(f.key, v)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section style={{ minWidth: 0 }}>
            <h3 style={{ ...Q, marginBottom: 4 }}>どんな人に合う会社だと思いますか？</h3>
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--ink-mute)" }}>いくつでも選べます</p>
            <div className="wr-tags">
              {loaded.masters.tags.map((t) => (
                <Choice key={t.key} label={t.label} active={answers.tags.includes(t.key)} disabled={saving} onClick={() => toggleTag(t.key)} />
              ))}
            </div>
          </section>
          <section style={{ minWidth: 0 }}>
            <label htmlFor="wr-memo" style={{ ...Q, display: "block" }}>
              入る前に知りたかったこと
              <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>（任意・{MEMO_MAX}字まで）</span>
            </label>
            <textarea id="wr-memo" className="wr-memo" value={answers.memo} disabled={saving} rows={3}
              placeholder="例：最初の3ヶ月は商材理解のインプットが多い"
              onChange={(e) => setAnswers((a) => ({ ...a, memo: e.target.value }))} />
            <div data-state={memoOver ? "memo-over" : "memo-ok"}
              style={{ fontSize: 11, textAlign: "right", marginTop: 2, color: memoOver ? "var(--error)" : "var(--ink-mute)" }}>
              {memoLength(answers.memo)} / {MEMO_MAX}
            </div>
          </section>
          {/* ★離れた理由（終了した会社だけ・任意）。選択肢と保存先は以前のまま（2026-10-16 / 柴さんの指示） */}
          {loaded.canLeave && (
            <section data-state="wr-leave" style={{ minWidth: 0 }}>
              <h3 style={{ ...Q, marginBottom: 4 }}>この会社を離れた理由は？</h3>
              <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--ink-mute)" }}>任意・{LEAVE_REASON_MAX}つまで</p>
              <div className="wr-tags">
                {LEAVE_REASONS.map((o) => (
                  <Choice key={o.value} label={o.label} active={answers.leaveReasons.includes(o.value)} disabled={saving} onClick={() => toggleLeave(o.value)} />
                ))}
              </div>
              {leaveLimit && (
                <p role="status" style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}>
                  {LEAVE_REASON_MAX}つまでです。ほかを外してから選んでください。
                </p>
              )}
            </section>
          )}
        </div>
      )}

      {step === "done" && (
        <TendencyView tendency={tendency} nextCompanyName={onNext ? nextCompanyName : null} onNext={onNext} />
      )}

      {/* ★本人が回答を消せる（2026-10-26 / フェーズ1a-4）。回答が残っているときだけ出す */}
      {ready && step !== "done" && loaded.hasStoredAnswers && !onSaveOverride && (
        <DeleteAnswers experienceId={experienceId} disabled={saving} onDeleted={() => { onSaved(); onClose(); }} />
      )}
    </ProfileEditModal>
  );
}

// ── 回答の削除（2026-10-26 / フェーズ1a-4）──────────────────────────────────

/**
 * ★この会社についての回答（入社後レビュー・決め手・退職理由・ギャップ）をすべて消す。
 * ⚠️ 元に戻せないので、押したらその場で確認を出す（window.confirm は使わない）。
 * ⚠️ 消したものは次回以降の集計から外れる（DELETE /api/jobseeker/experiences/[id]/review）。
 */
export function DeleteAnswers({ experienceId, disabled, onDeleted }: { experienceId: string; disabled: boolean; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobseeker/experiences/${experienceId}/review`, { method: "DELETE" });
      if (!res.ok) { setError("削除に失敗しました。もう一度お試しください。"); return; }
      onDeleted();
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div data-state={confirming ? "wr-delete-confirm" : "wr-delete"} style={{ marginTop: 24, paddingTop: 14, borderTop: "1px solid var(--line)", fontSize: 12 }}>
      {!confirming ? (
        <button type="button" disabled={disabled} onClick={() => setConfirming(true)}
          style={{ background: "none", border: 0, padding: 0, color: "var(--ink-mute)", textDecoration: "underline", cursor: "pointer", fontSize: 12 }}>
          この会社への回答を削除する
        </button>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          <p style={{ margin: 0, color: "var(--ink-soft)", lineHeight: 1.7 }}>
            この会社について答えた内容（決め手・いちばん求めていたこと・合っていたか、以前の質問への回答）をすべて削除します。元に戻せません。
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" disabled={busy} onClick={() => void run()}
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>
              {busy ? "削除しています…" : "削除する"}
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirming(false)}
              style={{ padding: "6px 12px", borderRadius: 8, border: 0, background: "none", color: "var(--ink-mute)", cursor: "pointer", fontSize: 12 }}>
              やめる
            </button>
          </div>
          {error && <p role="alert" style={{ margin: 0, color: "var(--ink)" }}>{error}</p>}
        </div>
      )}
    </div>
  );
}

// ── ④ あなたが合う職場の傾向 ───────────────────────────────────────────────

export function TendencyView({ tendency, nextCompanyName, onNext }: {
  tendency: Tendency | null;
  nextCompanyName: string | null;
  onNext: (() => void) | null;
}) {
  return (
    <div data-state="wr-done" style={{ display: "grid", gap: 16, minWidth: 0 }}>
      <style>{CSS}</style>
      <div>
        <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>ありがとうございました</div>
        <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)" }}>
          これまでの回答から、あなたが合う職場の傾向をまとめました。この結果はあなたにだけ表示されます。
        </p>
      </div>

      {tendency === null ? (
        <p data-state="wr-tendency-failed" style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)" }}>
          回答は保存しました。傾向の表示に失敗したので、時間をおいてもう一度開いてください。
        </p>
      ) : tendency.kind === "none" ? (
        <Box state="wr-tendency-none">
          「実際はどちら寄りでしたか？」に答えると、あなたに合う職場の傾向がわかります。
        </Box>
      ) : tendency.kind === "single" ? (
        <Box state="wr-tendency-single">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{tendency.company.name}（{tendency.company.fitScore}点）での回答</div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
            {tendency.summary.map((s) => (
              <li key={s.key} style={{ fontSize: 13 }}>
                <span style={{ color: "var(--ink-mute)", marginRight: 6 }}>{s.name}</span>{s.label}
              </li>
            ))}
          </ul>
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--ink-soft)" }}>
            ほかの職歴もふり返ると、あなたに合う職場の傾向がわかります
          </p>
        </Box>
      ) : tendency.kind === "small_gap" ? (
        <Box state="wr-tendency-small">
          {tendency.high.name}（{tendency.high.fitScore}点）と{tendency.low.name}（{tendency.low.fitScore}点）の差が小さく、傾向はまだ出ていません。
        </Box>
      ) : (
        <div data-state="wr-tendency-compare" style={{ display: "grid", gap: 12, minWidth: 0 }}>
          {tendency.headline && (
            <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.7, color: "var(--ink)" }}>{tendency.headline}</div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 12, color: "var(--ink-soft)" }}>
            <span><Mark filled /> {tendency.high.name}（{tendency.high.fitScore}点）</span>
            <span><Mark /> {tendency.low.name}（{tendency.low.fitScore}点）</span>
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            {tendency.axes.map((a) => (
              <div key={a.key} data-state={`wr-compare-${a.level}`} style={{ minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, fontWeight: 700, color: "var(--ink-mute)" }}>
                  <span>{a.name}</span>
                  <span>{a.level === "large" ? "差が大きい" : a.level === "small" ? "差は小さい" : "差なし"}</span>
                </div>
                <div className="wr-sides" style={{ fontWeight: 500, fontSize: 11, marginTop: 2 }}><span>{a.leftText}</span><span>{a.rightText}</span></div>
                <div className="wr-dots" aria-label={`${a.name}: ${a.level}`}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="wr-dot" style={{ background: "var(--bg-tint, #F7F9FC)", borderRadius: 6 }}>
                      {i === a.high && <Mark filled />}
                      {i === a.low && i !== a.high && <Mark />}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {tendency.axes.length === 0 && (
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)" }}>両方の会社で答えた軸がないため、比べられませんでした。</p>
          )}
        </div>
      )}

      {nextCompanyName && onNext && (
        <div data-state="wr-next" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap",
          padding: "12px 14px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 13 }}>
          <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{nextCompanyName}もふり返ると、傾向の精度が上がります</span>
          <button type="button" onClick={onNext}
            style={{ border: "none", background: "none", color: "var(--royal)", fontWeight: 700, fontSize: 13, cursor: "pointer", padding: "8px 0", fontFamily: "inherit" }}>
            ふり返る →
          </button>
        </div>
      )}
    </div>
  );
}

function Box({ state, children }: { state: string; children: React.ReactNode }) {
  return (
    <div data-state={state} style={{ padding: "14px 16px", borderRadius: 10, background: "var(--bg-tint, #F7F9FC)", border: "1px solid var(--line)", fontSize: 13, lineHeight: 1.8, color: "var(--ink)" }}>
      {children}
    </div>
  );
}

/** 高フィット側＝塗り、低フィット側＝白抜き */
function Mark({ filled = false }: { filled?: boolean }) {
  return (
    <span aria-hidden="true" style={{
      display: "inline-block", width: 14, height: 14, borderRadius: "50%", verticalAlign: "-2px",
      background: filled ? "var(--royal)" : "#fff", border: "2px solid var(--royal)", boxSizing: "border-box",
    }} />
  );
}

// ── 行の印 ──────────────────────────────────────────────────────────────────

export function ReasonEntryButton({
  answered,
  legacy = false,
  onClick,
}: {
  answered: boolean;
  /** ★旧形式だけで答えた会社（2026-10-16）。印を「質問が新しくなりました」にする */
  legacy?: boolean;
  onClick: () => void;
}) {
  /* ★2026-10-16 に問いを「この会社について」に変えた */
  /* ★2026-10-27（フェーズ1c）: 転機の3問に入れ替えたので文言を合わせた */
  const label = legacy
    ? "質問が新しくなりました（この会社の転機について答え直す）"
    : answered ? "この会社の転機について回答済み・編集" : "この会社の転機について答える（誰にも表示されません）";
  const showCheck = answered && !legacy;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="btn-fixed-size tap-target"
      style={{
        position: "relative",
        width: 30,
        height: 30,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        color: "var(--ink-mute)",
        flexShrink: 0,
      }}
    >
      {showCheck ? (
        /* 回答済み: チェック付きの吹き出し */
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          <polyline points="9 11.5 11.2 13.7 15.2 9.7" />
        </svg>
      ) : (
        <>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          {/* 未回答の印（塗りの点）。★旧形式だけの会社は白抜きの輪（「質問が新しくなりました」）。
                 ⚠️ 数字にしない（件数ではない） */}
          <span
            aria-hidden="true"
            data-state={legacy ? "reason-mark-legacy" : "reason-mark-none"}
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: legacy ? "#fff" : "var(--royal)",
              border: legacy ? "1.5px solid var(--royal)" : "1.5px solid #fff",
              boxSizing: "border-box",
            }}
          />
        </>
      )}
    </button>
  );
}
