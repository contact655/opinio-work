"use client";

/**
 * ★転機の3問「株式会社◯◯について」（2026-10-27 / フェーズ1c）。入社後レビュー（ExperienceReasonModal）を置き換えた。
 *   データは ow_career_turns（migration 20261027090000）。選択肢・文言は lib/careerTurns/constants.ts。
 *
 *   Q1 その会社を選んだ決め手（3つまで）／ Q2 いちばん求めていたこと（1つ）／ Q3 入って1年たったころ（1〜5。1年たっていなければ出さない）
 *   3問を保存すると「もう少し詳しく（任意）」の段（6軸・働き方の事実・入る前に知りたかったこと。lib/careerTurns/detail.ts）。
 *   飛ばしても3問は保存済み。最後に、本人の回答だけから作った「あなたが合う職場の傾向」を出す（lib/careerTurns/tendency.ts）。
 *
 * ⚠️ 1画面に3問（1つの転機は1分以内）。どれか1つ答えれば保存できる。
 * ⚠️ 「この転機は答えない」を選べる（回答は残さない）。「あとで答える」は何も保存しない。
 * ⚠️ 回答は誰にも表示しない。文言に「公開」をにおわせる言葉を足さない。
 * ⚠️ 選択肢はすべて button。もう一度押すと外れる。
 * ⚠️ 入社後レビュー（ow_workplace_reviews）には書かない。表とデータは残してある（柴さんの判断）。
 */

import { useEffect, useMemo, useState } from "react";
import { AXIS_SCALE, FACT_ITEMS, MEMO_MAX, memoLength, type ReviewAxis } from "@/lib/workplaceReview/constants";
import { EMPTY_TURN_DETAIL, hasAnyDetail, type CareerTurnDetail } from "@/lib/careerTurns/detail";
import { ProfileEditModal } from "./ProfileEditModal";
import { DeleteAnswers } from "./ExperienceReasonModal";
import {
  CAREER_TURN_PRIVACY_NOTE,
  DECISIVE_REASONS,
  DECISIVE_REASON_MAX,
  EMPTY_TURN_ANSWERS,
  FIT_AFTER_YEAR_ENDS,
  FIT_AFTER_YEAR_MAX,
  FIT_AFTER_YEAR_MIN,
  NEXT_PRIORITIES,
  hasAnyAnswer,
  nextPriorityQuestion,
  type CareerTurnAnswers,
} from "@/lib/careerTurns/constants";

/** 傾向の下のボタンの行き先（入社後レビューと同じ） */
const FIT_COMPANIES_HREF = "/mypage/proposals";

/** GET /api/jobseeker/experiences/[id]/turn の形（lib/careerTurns/server.ts の LoadedTurn） */
export type LoadedCareerTurn = {
  anchorId: string;
  isFirst: boolean;
  canAskFit: boolean;
  status: "answered" | "skipped" | "legacy" | "none";
  answers: CareerTurnAnswers;
  hasStoredAnswers?: boolean;
  /** ★任意の段「もう少し詳しく」（2026-10-27） */
  detail?: CareerTurnDetail;
  axes?: ReviewAxis[];
};

function Choice({ label, active, disabled, onClick }: { label: React.ReactNode; active: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="btn-fixed-size ct-choice" aria-pressed={active} disabled={disabled} onClick={onClick} data-active={active ? "on" : "off"}>
      {label}
    </button>
  );
}

const Q = { fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: "0 0 4px", lineHeight: 1.6 } as const;
const HINT = { margin: "0 0 10px", fontSize: 12, color: "var(--ink-mute)" } as const;

/* ⚠️ この style のコメントにバッククォートと不等号を書かない（ハイドレーションが壊れる）。
      ⚠️ 属性セレクタの値に引用符を書かない */
const CSS = `
  .ct-choice { min-height: 40px; min-width: 0; padding: 6px 14px; border-radius: 999px; border: 1.5px solid var(--line);
    background: #fff; color: var(--ink-soft); font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer;
    line-height: 1.3; transition: border-color 0.12s, background 0.12s, color 0.12s; }
  .ct-choice[data-active=on] { border-color: var(--royal); background: var(--royal-50); color: var(--royal); font-weight: 700; }
  .ct-choice:disabled { cursor: default; opacity: 0.5; }
  .ct-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .ct-fit { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
  .ct-fit .ct-choice { border-radius: 10px; padding: 6px 0; font-size: 14px; min-height: 44px; }
  .ct-ends { display: flex; justify-content: space-between; gap: 8px; margin-top: 6px; font-size: 11px; color: var(--ink-mute); }
  .ct-axis { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px; margin-top: 6px; }
  .ct-axis .ct-choice, .ct-fact .ct-choice { border-radius: 10px; padding: 6px 2px; font-size: 12px; min-height: 40px; white-space: nowrap; }
  .ct-fact { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin-top: 6px; }
  .ct-sides { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; font-weight: 600; color: var(--ink); line-height: 1.5; }
  .ct-sides span:last-child { text-align: right; }
  .ct-memo { width: 100%; min-height: 72px; padding: 10px 12px; border-radius: 10px; border: 1.5px solid var(--line);
    font-size: 16px; line-height: 1.6; font-family: inherit; resize: vertical; box-sizing: border-box; }
  @media (max-width: 400px) { .ct-axis .ct-choice, .ct-fact .ct-choice { font-size: 11px; } }
`;

export function CareerTurnModal({
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
  /** 開いた行の id（どの役割でもよい。保存先の行＝その会社のいちばん古い行はサーバーが決める） */
  experienceId: string;
  companyName: string;
  /** 傾向の下に出す「◯◯もふり返る」の会社名。無ければ出さない */
  nextCompanyName?: string | null;
  onNext: (() => void) | null;
  /** 保存（または「答えない」）できたら呼ぶ。呼び出し側が「回答済み」の印を更新する */
  onSaved: () => void;
  onClose: () => void;
  /** ★`/dev/preview` 用。渡すとサーバーから読まない */
  preload?: LoadedCareerTurn;
  /** ★`/dev/preview` 用。渡すとサーバーに保存しない。傾向の文を返す */
  onSaveOverride?: (a: CareerTurnAnswers | null) => Promise<{ ok: boolean; tendency: string[] | null }>;
}) {
  const [loaded, setLoaded] = useState<LoadedCareerTurn | null>(preload ?? null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<CareerTurnAnswers>(preload?.answers ?? EMPTY_TURN_ANSWERS);
  const [saved, setSaved] = useState<CareerTurnAnswers | null>(preload ? preload.answers : null);
  /* ★段: null = 3問 ／ detail = 任意の段「もう少し詳しく」 ／ saved = 傾向 ／ skipped = 答えない */
  const [done, setDone] = useState<null | { kind: "detail"; tendency: string[] | null } | { kind: "saved"; tendency: string[] | null } | { kind: "skipped" }>(null);
  const [detail, setDetail] = useState<CareerTurnDetail>(preload?.detail ?? EMPTY_TURN_DETAIL);
  const [savedDetail, setSavedDetail] = useState<CareerTurnDetail>(preload?.detail ?? EMPTY_TURN_DETAIL);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [limitHit, setLimitHit] = useState(false);

  /* 開いたときに読む。⚠️ 失敗したら答えさせない（保存すると上書きになるため） */
  useEffect(() => {
    if (!open || preload) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/jobseeker/experiences/${experienceId}/turn`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const j = (await res.json()) as LoadedCareerTurn;
        if (!alive) return;
        setLoaded(j);
        setAnswers(j.answers);
        setSaved(j.answers);
        setDetail(j.detail ?? EMPTY_TURN_DETAIL);
        setSavedDetail(j.detail ?? EMPTY_TURN_DETAIL);
      } catch (e) {
        console.error("[career-turn] load:", (e as Error).message);
        if (alive) setLoadError("回答を読み込めませんでした。時間をおいてもう一度開いてください。");
      }
    })();
    return () => { alive = false; };
  }, [open, experienceId, preload]);

  const ready = !!loaded && !loadError;
  /* ★旧の決め手を写しただけの転機（legacy）は、触らなくても保存できる（新しい画面で確かめた、という記録になる） */
  const dirty = useMemo(() => !!saved && JSON.stringify(answers) !== JSON.stringify(saved), [answers, saved]);
  const canSave = ready && hasAnyAnswer(answers) && (dirty || loaded?.status === "legacy" || loaded?.status === "none");

  async function submit(skip: boolean) {
    if (!ready || (!skip && !canSave)) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (onSaveOverride) {
        const r = await onSaveOverride(skip ? null : answers);
        if (!r.ok) { setSaveError("保存に失敗しました。もう一度お試しください。"); return; }
        setDone(skip ? { kind: "skipped" } : { kind: "detail", tendency: r.tendency });
      } else {
        const res = await fetch(`/api/jobseeker/experiences/${experienceId}/turn`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(skip ? { skip: true } : { answers }),
        });
        const j = (await res.json().catch(() => ({}))) as { message?: string; tendency?: string[] | null };
        if (!res.ok) { setSaveError(j.message || "保存に失敗しました。もう一度お試しください。"); return; }
        /* ★3問を保存したら任意の段へ（飛ばしても3問は保存済み） */
        setDone(skip ? { kind: "skipped" } : { kind: "detail", tendency: j.tendency ?? null });
      }
      if (!skip) setSaved(answers);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const detailDirty = JSON.stringify(detail) !== JSON.stringify(savedDetail);
  const memoOver = memoLength(detail.memo) > MEMO_MAX;
  /** 任意の段を保存して傾向へ。⚠️ 失敗したら進まない（入力は残る）。3問は保存済みなので影響しない */
  async function saveDetail() {
    if (done?.kind !== "detail" || memoOver) return;
    const tendency = done.tendency;
    if (!detailDirty) { setDone({ kind: "saved", tendency }); return; }
    setSaving(true);
    setSaveError(null);
    try {
      if (!onSaveOverride) {
        const res = await fetch(`/api/jobseeker/experiences/${experienceId}/turn`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ detail }),
        });
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        if (!res.ok) { setSaveError(j.message || "保存に失敗しました。もう一度お試しください。"); return; }
      }
      setSavedDetail(detail);
      setDone({ kind: "saved", tendency });
    } finally {
      setSaving(false);
    }
  }
  const setAxis = (k: string, v: number) => setDetail((d) => {
    const axes = { ...d.axes };
    if (axes[k] === v) delete axes[k]; else axes[k] = v;
    return { ...d, axes };
  });
  const setFact = (k: (typeof FACT_ITEMS)[number]["key"], v: number) =>
    setDetail((d) => ({ ...d, facts: { ...d.facts, [k]: d.facts[k] === v ? null : v } }));

  const toggleReason = (k: string) => {
    if (!answers.decisiveReasons.includes(k) && answers.decisiveReasons.length >= DECISIVE_REASON_MAX) { setLimitHit(true); return; }
    setLimitHit(false);
    setAnswers((a) => ({ ...a, decisiveReasons: a.decisiveReasons.includes(k) ? a.decisiveReasons.filter((x) => x !== k) : [...a.decisiveReasons, k] }));
  };

  /* ★「ふり返る」で次の会社へ（傾向の画面の下と、「答えない」のあと） */
  const nextRow = nextCompanyName && onNext ? (
    <div data-state="ct-next" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap",
      padding: "12px 14px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 13 }}>
      <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{nextCompanyName}の転機もふり返る</span>
      <button type="button" onClick={onNext}
        style={{ border: "none", background: "none", color: "var(--royal)", fontWeight: 700, fontSize: 13, cursor: "pointer", padding: "8px 0", fontFamily: "inherit" }}>
        ふり返る →
      </button>
    </div>
  ) : null;

  return (
    <ProfileEditModal
      open={open}
      title={`${companyName}について`}
      width={600}
      dirty={done ? (done.kind === "detail" ? detailDirty : false) : dirty}
      saving={saving}
      justSaved={false}
      error={saveError ?? loadError}
      saveLabel={!done ? "保存する" : done.kind === "detail" ? "保存する" : done.kind === "saved" ? "この傾向に合う会社を見る" : "閉じる"}
      primaryEnabled
      primaryDisabled={(!done && !canSave) || (done?.kind === "detail" && memoOver)}
      extraLabel={!done ? "この転機は答えない" : done.kind === "detail" ? "飛ばす" : undefined}
      onExtra={!done ? () => void submit(true) : done.kind === "detail" ? () => setDone({ kind: "saved", tendency: done.tendency }) : undefined}
      extraDisabled={!ready || saving}
      secondaryLabel={done ? undefined : "あとで答える"}
      onSecondary={done ? undefined : onClose}
      onSave={() => {
        if (!done) { void submit(false); return; }
        if (done.kind === "detail") { void saveDetail(); return; }
        if (done.kind === "saved") window.location.assign(FIT_COMPANIES_HREF);
        else onClose();
      }}
      onClose={onClose}
    >
      <style>{CSS}</style>
      {!ready && !loadError && <div style={{ fontSize: 13, color: "var(--ink-mute)" }}>読み込んでいます…</div>}

      {ready && loaded && !done && (
        <div data-state="ct-form" style={{ display: "grid", gap: 22, minWidth: 0 }}>
          <p data-testid="career-turn-privacy-note" style={{ margin: 0, fontSize: 12, fontWeight: 500, lineHeight: 1.7, color: "var(--ink-mute)" }}>
            {CAREER_TURN_PRIVACY_NOTE}
          </p>
          {loaded.status === "legacy" && (
            <p data-state="ct-legacy" style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: "var(--ink-soft)" }}>
              以前に答えた決め手を入れてあります。確かめて保存してください。
            </p>
          )}
          <section data-state="ct-q1" style={{ minWidth: 0 }}>
            <h3 style={Q}>{companyName}を選んだ決め手は？</h3>
            <p style={HINT}>{DECISIVE_REASON_MAX}つまで</p>
            <div className="ct-chips" role="group" aria-label="決め手（3つまで）">
              {DECISIVE_REASONS.map((o) => (
                <Choice key={o.value} label={o.label} active={answers.decisiveReasons.includes(o.value)} disabled={saving} onClick={() => toggleReason(o.value)} />
              ))}
            </div>
            {limitHit && (
              <p role="status" style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}>
                {DECISIVE_REASON_MAX}つまでです。ほかを外してから選んでください。
              </p>
            )}
          </section>
          <section data-state="ct-q2" style={{ minWidth: 0 }}>
            <h3 style={Q}>{nextPriorityQuestion(loaded.isFirst)}</h3>
            <p style={HINT}>1つ</p>
            <div className="ct-chips" role="group" aria-label="いちばん求めていたこと">
              {NEXT_PRIORITIES.map((o) => (
                <Choice key={o.value} label={o.label} active={answers.nextPriority === o.value} disabled={saving}
                  onClick={() => setAnswers((a) => ({ ...a, nextPriority: a.nextPriority === o.value ? null : o.value }))} />
              ))}
            </div>
          </section>
          {/* ★入社から1年たっていない職歴では聞かない（柴さんの決定）。1年たった時点で改めて聞く仕組みはまだ無い（docs/todo.md） */}
          {loaded.canAskFit && (
            <section data-state="ct-q3" style={{ minWidth: 0 }}>
              <h3 style={Q}>入って1年たったころ、合っていましたか？</h3>
              <p style={HINT}>5段階</p>
              <div className="ct-fit" role="group" aria-label="入って1年たったころ、合っていたか（1〜5）">
                {Array.from({ length: FIT_AFTER_YEAR_MAX - FIT_AFTER_YEAR_MIN + 1 }, (_, i) => FIT_AFTER_YEAR_MIN + i).map((n) => (
                  <Choice key={n} label={n} active={answers.fitAfterYear === n} disabled={saving}
                    onClick={() => setAnswers((a) => ({ ...a, fitAfterYear: a.fitAfterYear === n ? null : n }))} />
                ))}
              </div>
              <div className="ct-ends"><span>{FIT_AFTER_YEAR_ENDS.low}</span><span>{FIT_AFTER_YEAR_ENDS.high}</span></div>
            </section>
          )}
          {!hasAnyAnswer(answers) && (
            <p data-state="ct-required-hint" style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)" }}>
              どれか1つ答えると保存できます。
            </p>
          )}
        </div>
      )}

      {/* ★任意の段「もう少し詳しく」（2026-10-27 / 柴さんの指示）。飛ばしても3問は保存済み */}
      {done?.kind === "detail" && loaded && (
        <div data-state="ct-detail" style={{ display: "grid", gap: 22, minWidth: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>もう少し詳しく（任意）</div>
            <p style={{ margin: "4px 0 0", fontSize: 12, lineHeight: 1.7, color: "var(--ink-mute)" }}>
              3つの質問の回答は保存しました。ここは飛ばしても大丈夫です。{CAREER_TURN_PRIVACY_NOTE}
            </p>
          </div>
          {(loaded.axes ?? []).length > 0 && (
            <section style={{ minWidth: 0 }}>
              <h3 style={Q}>実際はどちら寄りでしたか？</h3>
              <p style={HINT}>良い・悪いではなく、実態に近いほうを選んでください。わからない項目は飛ばせます。</p>
              <div style={{ display: "grid", gap: 16 }}>
                {(loaded.axes ?? []).map((ax) => (
                  <div key={ax.key} data-state="ct-axis-item" style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 4 }}>{ax.name}</div>
                    <div className="ct-sides"><span>{ax.leftText}</span><span>{ax.rightText}</span></div>
                    <div className="ct-axis" role="group" aria-label={ax.name}>
                      {AXIS_SCALE.map((label, v) => (
                        <Choice key={v} label={label} active={detail.axes[ax.key] === v} disabled={saving} onClick={() => setAxis(ax.key, v)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          <section style={{ minWidth: 0 }}>
            <h3 style={Q}>働き方について教えてください</h3>
            <div style={{ display: "grid", gap: 14, marginTop: 8 }}>
              {FACT_ITEMS.map((f) => (
                <div key={f.key} data-state="ct-fact-item" style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{f.label}</div>
                  <div className="ct-fact" role="group" aria-label={f.label}>
                    {f.choices.map((label, v) => (
                      <Choice key={v} label={label} active={detail.facts[f.key] === v} disabled={saving} onClick={() => setFact(f.key, v)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section style={{ minWidth: 0 }}>
            <label htmlFor="ct-memo" style={{ ...Q, display: "block" }}>
              入る前に知りたかったこと
              <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>（{MEMO_MAX}字まで）</span>
            </label>
            <textarea id="ct-memo" className="ct-memo" value={detail.memo} disabled={saving} rows={3}
              placeholder="例：最初の3ヶ月は商材理解のインプットが多い"
              onChange={(e) => setDetail((d) => ({ ...d, memo: e.target.value }))} />
            <div data-state={memoOver ? "memo-over" : "memo-ok"}
              style={{ fontSize: 11, textAlign: "right", marginTop: 2, color: memoOver ? "var(--error)" : "var(--ink-mute)" }}>
              {memoLength(detail.memo)} / {MEMO_MAX}
            </div>
          </section>
          {!hasAnyDetail(detail) && (
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)" }}>答えない場合は「飛ばす」を押してください。</p>
          )}
        </div>
      )}

      {done?.kind === "saved" && (
        <div data-state="ct-done" style={{ display: "grid", gap: 16, minWidth: 0 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>あなたが合う職場の傾向</div>
            <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)" }}>
              あなたの回答だけからまとめました。この結果はあなたにだけ表示されます。
            </p>
          </div>
          {done.tendency === null ? (
            <p data-state="ct-tendency-failed" style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)" }}>
              回答は保存しました。傾向の表示に失敗したので、時間をおいてもう一度開いてください。
            </p>
          ) : (
            <ul data-state="ct-tendency" style={{ margin: 0, padding: "14px 16px", listStyle: "none", display: "grid", gap: 8, borderRadius: 10,
              background: "var(--bg-tint, #F7F9FC)", border: "1px solid var(--line)", fontSize: 14, lineHeight: 1.8, color: "var(--ink)" }}>
              {done.tendency.map((s) => <li key={s}>{s}</li>)}
            </ul>
          )}
          {nextRow}
        </div>
      )}

      {done?.kind === "skipped" && (
        <div data-state="ct-skipped" style={{ display: "grid", gap: 16, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: "var(--ink)" }}>この転機は答えない、として記録しました。あとからいつでも答えられます。</p>
          {nextRow}
        </div>
      )}

      {/* ★本人が回答を消せる（1a-4）。何か回答が残っているときだけ */}
      {ready && loaded && !done && loaded.hasStoredAnswers && !onSaveOverride && (
        <DeleteAnswers experienceId={experienceId} disabled={saving} onDeleted={() => { onSaved(); onClose(); }} />
      )}
    </ProfileEditModal>
  );
}
