"use client";

/**
 * ★「この会社について」モーダル（新形式 reason_version = 2。2026-10-16 に作り直した）。
 *   設計は docs/phase0-reason-modal-20261016.md。
 *
 * ── 流れ ─────────────────────────────────────────────────────────────────────
 *   ステップ1 … 入社するとき、期待していたこと（15個から3つまで）＋ いちばん期待していたこと
 *   ステップ2 … A 期待への評価 ／ B 入社前とのずれ（6項目）／ C 合っていたか（0〜10）／ D ひとこと ／ 離れた理由
 *   保存後   … まだ答えていない会社が残っていれば「次の会社にも答える」。無ければそのまま閉じる
 *
 * ⚠️★回答の単位は**会社**。どの役割の行から開いても、サーバーが保存先の行を決める（`reasonAnswers.ts`）。
 * ⚠️★旧形式（2026-10-16 より前の「選んだ理由」）の列には書かない。旧の回答がある会社は
 *    **初期値として出して答え直してもらう**（旧の回答は消さない）。
 * ⚠️ 「あとで答える」と × は**何も保存せず閉じる**。ただし、どのステップで閉じたかは記録する。
 * ⚠️ この内容は会社にも他の利用者にも出さない。文言（`PRIVACY_NOTE`）に他の利用者への表示をにおわせる言葉を入れない
 *    （プライバシーポリシーの改定まで）。
 */

import { useEffect, useMemo, useState } from "react";
import { ProfileEditModal } from "./ProfileEditModal";
import {
  EXPECTATIONS,
  EXPECTATION_LABELS,
  EXPECTATION_MAX,
  EXPECTATION_UNRATED,
  EXPECTATION_RATING_ENDS,
  SCALE_VALUES,
  FIT_SCORE_MIN,
  FIT_SCORE_MAX,
  GAP_SHIFT_AXES,
  GAP_SHIFT_MID,
  LEAVE_REASONS,
  REASON_MAX,
  NOTE_PROMPTS,
  NOTE_MAX_LENGTH,
  NOTE_CONSENT_HINT,
  noteConsentText,
  EMPTY_REASON_ANSWERS_V2,
  needsPrimary,
  type ReasonAnswersV2,
} from "@/lib/constants/careerReasons";

const PRIVACY_NOTE = "会社には伝わりません。あなたの回答は、あなたへの提案と、個人が分からない形の集計にだけ使います";

/** GET /api/jobseeker/experiences/[id]/reasons の形（`reasonAnswers.ts` の LoadedAnswers） */
export type LoadedReasonAnswers = {
  anchorId: string;
  version: 1 | 2 | null;
  canLeave: boolean;
  answers: ReasonAnswersV2;
};

// ── 回答済みの判定 ────────────────────────────────────────────────────────────

/**
 * ⚠️ `Stint` を import しない（`CareerHistoryEditor` ↔ ここで循環する）。構造だけを受ける。
 * `reasonVersion` は `GET /api/jobseeker/experiences/reasons-status` から来る（会社単位）。
 *   2 = 新形式で答え済み ／ 1 = 旧形式だけ ／ null = 未回答 ／ undefined = まだ取れていない
 */
export type ReasonSource = {
  joinReasons?: string[];
  leaveReasons?: string[];
  gaps?: { axis: string; rating: string }[];
  reasonVersion?: 1 | 2 | null;
};

/**
 * ★回答の状態（2026-10-16）。
 *   "answered" … 新形式（reason_version = 2）で答え済み
 *   "legacy"   … 旧形式だけ（質問が新しくなった。答え直してもらう）
 *   "none"     … 一度も答えていない
 * ⚠️ 状態がまだ取れていない間（`reasonVersion` が undefined）は、ページが読んだ旧形式の列で判定する
 *    （読み込み直後に印が揺れないように。旧形式の列があれば "legacy"）。
 */
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

/**
 * 「未回答」に数えないか。★**旧形式で答えた会社も数えない**（2026-10-16 / 柴さんの判断）。
 *   ＝「N件の職歴が未回答です」の帯の件数・「まとめて答える」・保存後の「次の会社にも答える」から外す。
 *   旧形式の会社には、帯とは別に控えめな一文と行の印（「質問が新しくなりました」）で答え直しを案内する。
 * ⚠️ 名前は互換のため残している。意味は「一度でも答えたか」。
 */
export function hasReasonAnswers(src: ReasonSource | null | undefined): boolean {
  return reasonState(src) !== "none";
}

// ── チップ ────────────────────────────────────────────────────────────────────

/**
 * ⚠️★タップ領域は 44px（2026-08-28）。`reason-chip` は計測用の目印（当たる CSS は無い）。消さないこと。
 */
function ReasonChip({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className="reason-chip"
      style={{
        minHeight: 44,
        display: "inline-flex",
        alignItems: "center",
        padding: "7px 14px",
        borderRadius: 100,
        border: `1.5px solid ${active ? "var(--royal)" : "var(--line)"}`,
        background: active ? "var(--royal-50)" : "#fff",
        color: active ? "var(--royal)" : "var(--ink-soft)",
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        fontFamily: "inherit",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        lineHeight: 1.4,
        transition: "border-color 0.12s, background 0.12s, color 0.12s",
      }}
    >
      {label}
    </button>
  );
}

// ── モーダル ──────────────────────────────────────────────────────────────────

type Step = 1 | 2 | "done";

export function ExperienceReasonModal({
  open,
  experienceId,
  companyName,
  remaining,
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
  /** この会社を除いて、まだ答えていない会社の数。0 なら保存後にそのまま閉じる */
  remaining: number;
  /** 次の未回答の会社へ。⚠️ `remaining === 0` のときは渡らない */
  onNext: (() => void) | null;
  /** 保存できたら呼ぶ（呼び出し側が「回答済み」の印を更新する） */
  onSaved: () => void;
  /** 閉じる（「あとで答える」・×・保存後の「閉じる」） */
  onClose: () => void;
  /** ★`/dev/preview` 用。渡すとサーバーから読まない */
  preload?: LoadedReasonAnswers;
  /** ★`/dev/preview` 用。渡すとサーバーに保存しない */
  onSaveOverride?: (a: ReasonAnswersV2) => Promise<boolean>;
}) {
  const [loaded, setLoaded] = useState<LoadedReasonAnswers | null>(preload ?? null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<ReasonAnswersV2>(preload?.answers ?? EMPTY_REASON_ANSWERS_V2);
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** 上限に当たったことを伝える注記。次の操作で消える */
  const [limitNote, setLimitNote] = useState<null | "expect" | "leave">(null);

  /* 開いたときに会社単位の回答を読む。⚠️ 失敗したら答えさせない（保存すると上書きになるため） */
  useEffect(() => {
    if (!open || preload) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/jobseeker/experiences/${experienceId}/reasons`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const j = (await res.json()) as LoadedReasonAnswers;
        if (!alive) return;
        setLoaded(j);
        setAnswers(j.answers);
      } catch (e) {
        console.error("[reason-modal] load:", (e as Error).message);
        if (alive) setLoadError("回答を読み込めませんでした。時間をおいてもう一度開いてください。");
      }
    })();
    return () => { alive = false; };
  }, [open, experienceId, preload]);

  const dirty = useMemo(
    () => !!loaded && JSON.stringify(answers) !== JSON.stringify(loaded.answers),
    [answers, loaded],
  );

  /** 閉じたときの記録。⚠️ 結果を待たない（記録の失敗で閉じる操作を止めない） */
  function recordClose(via: "later" | "close") {
    if (preload || step === "done") return;
    void fetch(`/api/jobseeker/experiences/${experienceId}/reasons/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: step === 1 ? "step1" : "step2", via }),
      keepalive: true,
    }).catch((e) => console.error("[reason-modal] close:", (e as Error).message));
  }

  function toggleExpectation(value: string) {
    const cur = answers.expectations;
    if (!cur.includes(value) && cur.length >= EXPECTATION_MAX) { setLimitNote("expect"); return; }
    setLimitNote(null);
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    /* いちばん: 1つだけなら自動でそれ。外した項目がいちばんだったら空に戻す。
       ⚠️★1つ → 2つに増えたときは空に戻す。1つ目で自動に決まった「いちばん」が残ると、
          2つ以上選んだのに本人が選ばないまま「次へ」に進めてしまう */
    const primary =
      next.length === 1 ? next[0]
        : cur.length === 1 && next.length > 1 ? null
          : answers.primary && next.includes(answers.primary) ? answers.primary : null;
    /* 外した項目の評価も消す（DB の CHECK が「選んだ項目だけ」を要求するわけではないが、API が弾く） */
    const ratings = Object.fromEntries(Object.entries(answers.ratings).filter(([k]) => next.includes(k)));
    setAnswers({ ...answers, expectations: next, primary, ratings });
  }

  function toggleLeave(value: string) {
    const cur = answers.leaveReasons;
    if (!cur.includes(value) && cur.length >= REASON_MAX) { setLimitNote("leave"); return; }
    setLimitNote(null);
    setAnswers({ ...answers, leaveReasons: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] });
  }

  /* ひとこと。⚠️ 本文が空なら保存しない（API に null で送る）。書き出しは本文より先に選ぶ */
  const noteDraft = answers.note ?? { prompt: "", body: "", displayConsent: false };
  /* ★80字を超えた分（2026-10-16 / 案A）。超えていても「保存」は押せる。
        ⚠️ そのときは**ひとことだけ送らない**（他の回答まで保存できずに閉じられてしまわないように）。
        黙って捨てないよう、保存ボタンのすぐ上に何が保存されないかを出す。 */
  const noteOver = Math.max(0, Array.from(noteDraft.body.trim()).length - NOTE_MAX_LENGTH);
  function setNote(patch: Partial<NonNullable<ReasonAnswersV2["note"]>>) {
    setAnswers({ ...answers, note: { ...noteDraft, ...patch } });
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      let ok: boolean;
      if (onSaveOverride) ok = await onSaveOverride(payloadFor(answers));
      else {
        const res = await fetch(`/api/jobseeker/experiences/${experienceId}/reasons`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadFor(answers)),
        });
        if (!res.ok) {
          let msg = "";
          try { msg = ((await res.json()) as { message?: string }).message ?? ""; } catch { /* 本文が無い */ }
          setSaveError(msg || "保存に失敗しました。もう一度お試しください。");
          return;
        }
        ok = true;
      }
      if (!ok) { setSaveError("保存に失敗しました。もう一度お試しください。"); return; }
      onSaved();
      if (onNext) setStep("done");
      else onClose();
    } finally {
      setSaving(false);
    }
  }

  const blockedByPrimary = step === 1 && needsPrimary(answers);
  const ready = !!loaded && !loadError;

  return (
    <ProfileEditModal
      open={open}
      title={`${companyName}について`}
      width={560}
      dirty={step === "done" ? false : dirty}
      saving={saving}
      justSaved={false}
      error={saveError ?? loadError}
      saveLabel={step === 1 ? "次へ" : step === 2 ? "保存" : `次の会社にも答える（残り${remaining}社）`}
      primaryEnabled
      primaryDisabled={!ready || blockedByPrimary}
      /* ⚠️ 何も答えていないときは「保存」を出さない（不活性のボタンは置かない。2026-09-12 の判断を引き継ぐ） */
      hidePrimary={step === 2 && !hasAnyAnswer(answers)}
      secondaryLabel={step === "done" ? "閉じる" : "あとで答える"}
      onSecondary={() => { recordClose("later"); onClose(); }}
      onSave={() => {
        if (step === 1) { setStep(2); return; }
        if (step === "done") { onNext?.(); return; }
        void save();
      }}
      onClose={() => { recordClose("close"); onClose(); }}
      footerTop={step === 1 && answers.expectations.length > 0 ? (
        <PrimaryPicker answers={answers} disabled={saving} onPick={(v) => setAnswers({ ...answers, primary: v })} />
      ) : step === 2 && noteOver > 0 ? (
        <div data-state="note-over-warning" role="status" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", lineHeight: 1.6 }}>
          ひとことが{NOTE_MAX_LENGTH}字を超えているため、ひとことだけ保存されません（あと{noteOver}字削ると保存されます）
        </div>
      ) : undefined}
    >
      {step !== "done" && (
        <p
          data-testid="reason-privacy-note"
          style={{ margin: "0 0 16px", fontSize: 12, fontWeight: 500, lineHeight: 1.7, color: "var(--ink-mute)" }}
        >
          {PRIVACY_NOTE}
        </p>
      )}

      {!ready && !loadError && (
        <div style={{ fontSize: 13, color: "var(--ink-mute)" }}>読み込んでいます…</div>
      )}

      {ready && step === 1 && (
        <div data-state="reason-step1">
          {loaded!.version === 1 && (
            <div style={{ fontSize: 12, lineHeight: 1.7, color: "var(--ink-soft)", background: "var(--line-soft)", borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>
              質問が変わりました。以前の回答をもとに入れてあるので、見直して答え直してください。
            </div>
          )}
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", lineHeight: 1.5, overflowWrap: "anywhere", marginBottom: 12 }}>
            {companyName}に入るとき、期待していたことは？（{EXPECTATION_MAX}つまで）
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, minWidth: 0 }}>
            {EXPECTATIONS.map((o) => (
              <ReasonChip
                key={o.value}
                label={o.label}
                active={answers.expectations.includes(o.value)}
                disabled={saving}
                onClick={() => toggleExpectation(o.value)}
              />
            ))}
          </div>
          {limitNote === "expect" && (
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginTop: 8 }}>
              {EXPECTATION_MAX}つまでです。ほかを外してから選んでください。
            </div>
          )}
        </div>
      )}

      {ready && step === 2 && (
        <div data-state="reason-step2" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <button
            type="button"
            onClick={() => setStep(1)}
            disabled={saving}
            style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, fontSize: 12, fontWeight: 600, color: "var(--ink-mute)", fontFamily: "inherit", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            ← 期待していたことに戻る
          </button>

          {/* A: 期待していたことへの評価（選んだ項目だけ。「タイミング・個人の事情」は聞かない）。
                 ★2026-10-16 に表の形にした（柴さんの指示）。問いは1回、言葉は見出しの行に1回だけ。
                 ⚠️「期待していた◯◯は」の文に項目名を埋め込まない（名詞によっては日本語として不自然になる） */}
          {answers.expectations.some((v) => !EXPECTATION_UNRATED.has(v)) && (
            <section data-state="reason-ratings" style={{ minWidth: 0 }}>
              <div style={questionStyle}>入社前に期待していたことは、実際どうでしたか？</div>
              <div className="rm-matrix">
                <div className="rm-row rm-head" aria-hidden="true">
                  <span />
                  <ScaleEnds low={EXPECTATION_RATING_ENDS.low} mid={EXPECTATION_RATING_ENDS.mid} high={EXPECTATION_RATING_ENDS.high} />
                </div>
                {answers.expectations.filter((v) => !EXPECTATION_UNRATED.has(v)).map((v) => (
                  <div key={v} className="rm-row" data-state="reason-rating">
                    <span className="rm-label">{EXPECTATION_LABELS[v] ?? v}</span>
                    <ScaleDots
                      name={EXPECTATION_LABELS[v] ?? v}
                      value={answers.ratings[v] ?? null}
                      ends={EXPECTATION_RATING_ENDS}
                      disabled={saving}
                      onChange={(n) => {
                        const ratings = { ...answers.ratings };
                        if (n === null) delete ratings[v]; else ratings[v] = n;
                        setAnswers({ ...answers, ratings });
                      }}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* B: 入社前の想像と比べて、どちらにずれたか（共通6項目・任意・最初は未選択）。
                 ★表の形。「想像通り」は見出しに1回だけ。左右の言葉は項目ごとに違うので行ごとに短く出す */}
          <section data-state="reason-shifts" style={{ minWidth: 0 }}>
            <div style={questionStyle}>入社前の想像と比べて、どちらにずれましたか？</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", lineHeight: 1.6, margin: "-4px 0 10px" }}>
              まん中が「{GAP_SHIFT_MID}」。答えたい項目だけで大丈夫です。
            </div>
            <div className="rm-matrix">
              {GAP_SHIFT_AXES.map((ax) => (
                <div key={ax.value} className="rm-row" data-state="reason-shift">
                  <span className="rm-label">{ax.label}</span>
                  <div style={{ minWidth: 0 }}>
                    <ScaleDots
                      name={ax.label}
                      value={answers.shifts[ax.value] ?? null}
                      ends={{ low: ax.left, mid: GAP_SHIFT_MID, high: ax.right }}
                      disabled={saving}
                      onChange={(n) => {
                        const shifts = { ...answers.shifts };
                        if (n === null) delete shifts[ax.value]; else shifts[ax.value] = n;
                        setAnswers({ ...answers, shifts });
                      }}
                    />
                    <div className="rm-sides" aria-hidden="true">
                      <span>{ax.left.replace(/^想像より/, "")}</span>
                      <span>{ax.right.replace(/^想像より/, "")}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* C: 合っていたか（0〜10・任意） */}
          <section data-state="reason-fit" style={{ minWidth: 0 }}>
            <div style={questionStyle}>
              この会社は、あなたに合っていましたか？
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginLeft: 6, whiteSpace: "nowrap" }}>（任意）</span>
            </div>
            <FitScale
              value={answers.fitScore}
              disabled={saving}
              onChange={(n) => setAnswers({ ...answers, fitScore: n })}
            />
          </section>

          {/* 離れた理由（終了した会社だけ・任意・今の選択肢のまま） */}
          {loaded!.canLeave && (
            <section data-state="reason-leave" style={{ minWidth: 0 }}>
              <div style={questionStyle}>
                この会社を離れた理由は？（{REASON_MAX}つまで）
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginLeft: 6, whiteSpace: "nowrap" }}>（任意）</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, minWidth: 0 }}>
                {LEAVE_REASONS.map((o) => (
                  <ReasonChip
                    key={o.value}
                    label={o.label}
                    active={answers.leaveReasons.includes(o.value)}
                    disabled={saving}
                    onClick={() => toggleLeave(o.value)}
                  />
                ))}
              </div>
              {limitNote === "leave" && (
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginTop: 8 }}>
                  {REASON_MAX}つまでです。ほかを外してから選んでください。
                </div>
              )}
            </section>
          )}

          {/* D: ひとこと（任意・80字）。⚠️ 他の利用者には表示しない（規約の改定まで）。表示への同意は任意 */}
          <section data-state="reason-note" style={{ minWidth: 0 }}>
            <div style={questionStyle}>
              ひとこと
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginLeft: 6, whiteSpace: "nowrap" }}>（任意・{NOTE_MAX_LENGTH}字まで）</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", margin: "-4px 0 8px" }}>書き出しを選んで、続きを書いてください。</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, minWidth: 0, marginBottom: 10 }}>
              {NOTE_PROMPTS.map((o) => (
                <ReasonChip
                  key={o.value}
                  label={o.label}
                  active={noteDraft.prompt === o.value}
                  disabled={saving}
                  onClick={() => setNote({ prompt: noteDraft.prompt === o.value && noteDraft.body.trim() === "" ? "" : o.value })}
                />
              ))}
            </div>
            {noteDraft.prompt !== "" && (
              <>
                <textarea
                  id="reason-note-body"
                  value={noteDraft.body}
                  disabled={saving}
                  rows={3}
                  aria-label={NOTE_PROMPTS.find((o) => o.value === noteDraft.prompt)?.label ?? "ひとこと"}
                  placeholder={NOTE_PROMPTS.find((o) => o.value === noteDraft.prompt)?.label}
                  onChange={(e) => setNote({ body: e.target.value })}
                  className="reason-note-input"
                />
                <div
                  data-state={Array.from(noteDraft.body.trim()).length > NOTE_MAX_LENGTH ? "note-over" : "note-ok"}
                  style={{ fontSize: 11, textAlign: "right", marginTop: 2, color: Array.from(noteDraft.body.trim()).length > NOTE_MAX_LENGTH ? "var(--error)" : "var(--ink-mute)" }}
                >
                  {Array.from(noteDraft.body.trim()).length} / {NOTE_MAX_LENGTH}
                </div>
                {noteDraft.body.trim() !== "" && (
                  <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 8, cursor: "pointer", minWidth: 0 }}>
                    <input
                      type="checkbox"
                      checked={noteDraft.displayConsent}
                      disabled={saving}
                      onChange={(e) => setNote({ displayConsent: e.target.checked })}
                      style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0 }}
                    />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", lineHeight: 1.6, overflowWrap: "anywhere" }}>
                        {noteConsentText(companyName)}
                      </span>
                      <span style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--ink-mute)", lineHeight: 1.6 }}>
                        {NOTE_CONSENT_HINT}
                      </span>
                    </span>
                  </label>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {step === "done" && (
        <div data-state="reason-done" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>回答を保存しました</div>
          <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
            まだ答えていない会社が {remaining} 社あります。
          </div>
        </div>
      )}
    </ProfileEditModal>
  );
}

const questionStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "var(--ink)",
  lineHeight: 1.6,
  overflowWrap: "anywhere",
  marginBottom: 8,
};

/** 保存で送る形。⚠️ ひとことは空・80字超なら送らない（null） */
function noteLength(a: ReasonAnswersV2): number {
  return a.note ? Array.from(a.note.body.trim()).length : 0;
}
function payloadFor(a: ReasonAnswersV2): ReasonAnswersV2 {
  const n = noteLength(a);
  return { ...a, note: a.note && n > 0 && n <= NOTE_MAX_LENGTH ? a.note : null };
}

/** 何か1つでも答えているか（「保存」を出すかの判定）。⚠️ 80字超のひとことは数えない（保存されないため） */
function hasAnyAnswer(a: ReasonAnswersV2): boolean {
  return (
    a.expectations.length > 0 ||
    Object.keys(a.ratings).length > 0 ||
    Object.keys(a.shifts).length > 0 ||
    a.fitScore !== null ||
    a.leaveReasons.length > 0 ||
    (noteLength(a) > 0 && noteLength(a) <= NOTE_MAX_LENGTH)
  );
}

/** 目盛りの名前（読み上げ用）。⚠️ 画面に言葉を出すのは見出しの両端と真ん中だけ */
function scaleLabel(n: number, ends: { low: string; mid: string; high: string }): string {
  if (n === 0) return ends.mid;
  const side = n < 0 ? ends.low : ends.high;
  const k = Math.abs(n);
  return k === 3 ? side : k === 2 ? `かなり${side}` : `少し${side}`;
}

/**
 * ★7段階（-3〜+3）の丸だけ。言葉は呼び出し側（見出しの行 `ScaleEnds`／行の左右 `rm-sides`）が出す。
 * 同じ目盛りをもう一度押すと未選択に戻る。⚠️ 未回答という値は作らない（キーごと無い）。
 * ⚠️ 幅は CSS の grid で7等分する（インラインに書かない）。375px で1つ約41px。
 */
function ScaleDots({
  name,
  value,
  ends,
  disabled,
  onChange,
}: {
  name: string;
  value: number | null;
  ends: { low: string; mid: string; high: string };
  disabled?: boolean;
  onChange: (v: number | null) => void;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="rm-dots">
      {SCALE_VALUES.map((n) => {
        const on = value === n;
        const label = scaleLabel(n, ends);
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={() => onChange(on ? null : n)}
            className="btn-fixed-size reason-scale-btn"
            data-on={on ? "1" : "0"}
            data-mid={n === 0 ? "1" : "0"}
          >
            <span aria-hidden="true" className="reason-scale-dot" />
          </button>
        );
      })}
      <style>{SCALE_CSS}</style>
    </div>
  );
}

/** 見出しの行の言葉（7列にそろえて、左端・まん中・右端にだけ置く） */
function ScaleEnds({ low, mid, high }: { low: string; mid: string; high: string }) {
  return (
    <div className="rm-ends">
      <span style={{ gridColumn: "1 / span 2", textAlign: "left" }}>{low}</span>
      <span style={{ gridColumn: "3 / span 3", textAlign: "center" }}>{mid}</span>
      <span style={{ gridColumn: "6 / span 2", textAlign: "right" }}>{high}</span>
    </div>
  );
}

/** ★0〜10（任意）。押した数字をもう一度押すと未選択に戻る */
function FitScale({
  value,
  disabled,
  onChange,
}: {
  value: number | null;
  disabled?: boolean;
  onChange: (v: number | null) => void;
}) {
  const nums = Array.from({ length: FIT_SCORE_MAX - FIT_SCORE_MIN + 1 }, (_, i) => FIT_SCORE_MIN + i);
  return (
    <div role="radiogroup" aria-label="この会社は、あなたに合っていましたか" className="reason-scale11">
      {nums.map((n) => {
        const on = value === n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(on ? null : n)}
            className="btn-fixed-size reason-fit-btn"
            data-on={on ? "1" : "0"}
          >
            {n}
          </button>
        );
      })}
      <style>{SCALE_CSS}</style>
    </div>
  );
}

/* ⚠️ この文字列は style タグの中に出る。コメントにバッククォートと不等号を書かないこと（ui-debugging の19） */
const SCALE_CSS = `
.rm-matrix { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.rm-row { display: grid; grid-template-columns: minmax(0, 8.5em) minmax(0, 1fr); align-items: center; column-gap: 10px; min-width: 0; }
.rm-head { align-items: end; }
.rm-label { font-size: 13px; font-weight: 600; color: var(--ink-soft); line-height: 1.5; overflow-wrap: anywhere; }
.rm-dots { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); min-width: 0; }
.rm-ends { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); font-size: 11px; font-weight: 500; color: var(--ink-mute); line-height: 1.4; min-width: 0; }
.rm-sides { display: flex; justify-content: space-between; gap: 8px; margin-top: -4px; font-size: 11px; font-weight: 500; color: var(--ink-mute); line-height: 1.4; }
.reason-scale-btn { height: 40px; border: none; background: none; padding: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; font-family: inherit; }
.reason-scale-btn:disabled { cursor: default; }
.reason-scale-dot { width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid var(--line); background: #fff; transition: background 0.12s, border-color 0.12s; }
.reason-scale-btn[data-on="1"] .reason-scale-dot { background: var(--royal); border-color: var(--royal); }
.reason-scale-btn:hover .reason-scale-dot { border-color: var(--royal); }
.reason-scale-btn[data-mid="1"] .reason-scale-dot { border-width: 2px; }
.reason-scale11 { display: grid; grid-template-columns: repeat(11, minmax(0, 1fr)); gap: 4px; }
.reason-fit-btn { height: 44px; border-radius: 8px; border: 1.5px solid var(--line); background: #fff; color: var(--ink-soft); font-size: 14px; font-weight: 600; font-family: var(--font-inter), var(--font-noto); cursor: pointer; padding: 0; }
.reason-fit-btn[data-on="1"] { background: var(--royal); border-color: var(--royal); color: #fff; }
.reason-fit-btn:disabled { cursor: default; }
.reason-note-input { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1.5px solid var(--line); border-radius: 10px; font-family: inherit; font-size: 14px; line-height: 1.6; color: var(--ink); resize: vertical; }
.reason-note-input:focus { outline: none; border-color: var(--royal); }
@media (max-width: 479px) {
  .reason-scale11 { grid-template-columns: repeat(6, minmax(0, 1fr)); }
  .rm-row { grid-template-columns: minmax(0, 1fr); row-gap: 0; }
  .rm-head > span:first-child { display: none; }
  .rm-label { margin-top: 6px; }
}
`;

/**
 * ★「いちばん期待していたこと」。フッターのすぐ上に固定で出す（スクロールしなくても必ず見える）。
 * 1つだけ選んだときは自動でそれ（押せない表示にする）。2つ以上で未選択なら「次へ」を押せない理由を出す。
 */
function PrimaryPicker({
  answers,
  disabled,
  onPick,
}: {
  answers: ReasonAnswersV2;
  disabled: boolean;
  onPick: (v: string) => void;
}) {
  const missing = needsPrimary(answers);
  return (
    <div data-state={missing ? "primary-missing" : "primary-set"}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: missing ? 2 : 6 }}>
        いちばん期待していたこと
      </div>
      {missing && (
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--royal)", marginBottom: 6 }}>1つ選ぶと「次へ」に進めます</div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, minWidth: 0 }}>
        {answers.expectations.map((v) => (
          <ReasonChip
            key={v}
            label={EXPECTATION_LABELS[v] ?? v}
            active={answers.primary === v}
            disabled={disabled}
            onClick={() => onPick(v)}
          />
        ))}
      </div>
    </div>
  );
}

// ── 職歴カードの入口アイコン ──────────────────────────────────────────────────

/**
 * ★職歴カードの右端に置く、本人だけの入口（2026-09-12）。
 *
 * ⚠️★**本人の `/mypage` にだけ出す。** `/u/[id]`・企業ページ・`/people` には出さない
 *    （理由データは非公開。`careerReasons.ts` の「公開範囲」）。
 *    `MergedTimeline` は公開画面と共用の部品なので、**渡されたときだけ描く**形にしてある。
 *
 * ⚠️ **回答内容（選んだチップ）はカードに出さない。** 出すと非公開のはずの答えが
 *    画面共有やスクリーンショットで漏れる経路になる。
 *
 * ⚠️ 文字は置かない。ツールチップ（`title`）と `aria-label` を**同じ文言**にする。
 */
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
  const label = legacy
    ? "質問が新しくなりました（この会社について答え直す）"
    : answered ? "この会社について回答済み・編集" : "この会社について答える（会社には伝わりません）";
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
