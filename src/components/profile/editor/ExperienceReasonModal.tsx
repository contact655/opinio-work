"use client";

/**
 * ★「この会社を選んだ理由と、離れた理由」を聞く専用モーダル（2026-09-12）。
 *
 * ── なぜ職歴の編集モーダルから外したか ──────────────────────────────────────
 * 2026-08-19（フェーズ D-2）に「会社・職種・期間の直下」へ置いたが、
 * **職歴を1件直すたびに毎回この設問が目に入る**形だった。設問は「その会社について
 * 一度答えれば済むもの」で、役職を直す作業とは別の関心。**編集の本文から外し、
 * ①新規追加の保存直後 ②職歴カードのアイコン の2つの入口に寄せた。**
 *
 * ⚠️★**設問・選択肢・上限・スラッグは1文字も変えていない。** 置き場所だけを変えた。
 *    変えると 2026-08-19 に固定した並び順の意味（選択率の比較）が失われる。
 *
 * ⚠️★**保存は「両ステップ answered → 最後に1回」。** 各ステップの「あとで答える」は
 *    **何も保存せず閉じる**（途中まで書いたものも保存しない）。
 *    中途半端に1ステップ目だけ保存すると、「答えた／答えていない」の判定
 *    （`hasReasonAnswers`）が**答え終わっていない人まで回答済みにする。**
 *
 * ⚠️ 公開範囲は変わらない。**この設問の答えは本人と集計にしか使わない**
 *    （`careerReasons.ts` の「公開範囲」を参照）。緑バッジと補足文を消さないこと。
 */

import { useEffect, useMemo, useState } from "react";
import { ProfileEditModal } from "./ProfileEditModal";
import {
  JOIN_REASONS,
  LEAVE_REASONS,
  GAP_AXES,
  GAP_RATINGS,
  REASON_MAX,
  groupReasonsByAxis,
} from "@/lib/constants/careerReasons";

// ── 回答の形 ──────────────────────────────────────────────────────────────────

export type ReasonAnswers = {
  joinReasons: string[];
  joinReasonPrimary: string;
  leaveReasons: string[];
  /** 軸 → 評価。⚠️ **未回答はキーごと無い**（"未回答" という値を作らない） */
  gaps: Record<string, string>;
};

export const EMPTY_REASON_ANSWERS: ReasonAnswers = {
  joinReasons: [],
  joinReasonPrimary: "",
  leaveReasons: [],
  gaps: {},
};

/**
 * ⚠️ `Stint` を import しない（`CareerHistoryEditor` ↔ ここで循環する）。
 *    構造だけを受ける。
 */
export type ReasonSource = {
  joinReasons?: string[];
  joinReasonPrimary?: string;
  leaveReasons?: string[];
  gaps?: { axis: string; rating: string }[];
};

export function reasonAnswersFrom(src: ReasonSource | null | undefined): ReasonAnswers {
  if (!src) return EMPTY_REASON_ANSWERS;
  return {
    joinReasons: src.joinReasons ?? [],
    joinReasonPrimary: src.joinReasonPrimary ?? "",
    leaveReasons: src.leaveReasons ?? [],
    gaps: Object.fromEntries((src.gaps ?? []).map((g) => [g.axis, g.rating])),
  };
}

/**
 * 回答済みか。**入社理由 / 離れた理由 / ギャップのどれか1つでも入っていれば回答済み。**
 *
 * ⚠️ 「決め手」だけでは回答済みにしない。DB の CHECK が
 *    「決め手は入社理由の中から」を要求するので、決め手だけが入る行は存在しない。
 */
export function hasReasonAnswers(src: ReasonSource | null | undefined): boolean {
  if (!src) return false;
  return (
    (src.joinReasons?.length ?? 0) > 0 ||
    (src.leaveReasons?.length ?? 0) > 0 ||
    (src.gaps?.length ?? 0) > 0
  );
}

// ── チップ ────────────────────────────────────────────────────────────────────

/**
 * ⚠️★**タップ領域を 44px にする**（2026-08-28）。直す前は 36px（実測）だった。
 *    375px のモーダルにこのチップが46個並ぶ。
 *
 * ── ★`::after` で当たり判定だけ広げる案は捨てた（実測で動かなかった）──
 * `position: absolute` の `::after` を上下 -4.5px で重ねたが、`elementFromPoint` で
 * **拾えなかった**。`z-index: 0` を足しても、親の `gap` を 6 → 9px に広げても
 * **下側が当たらないまま**だった。**疑似要素のヒットテストは当てにしない。**
 *
 * ⚠️ `reason-chip` に**当たる CSS は無い**。ブラウザで高さを測るための目印。
 *    消すと再計測できなくなる。
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

const stepLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--royal)",
  letterSpacing: "0.06em",
  fontFamily: "var(--font-inter), var(--font-noto)",
};

export function ExperienceReasonModal({
  open,
  companyName,
  /** 終了年月がある在籍だけ「離れた理由」を出す。⚠️ 判定は呼び出し側（`hasLeftCompany`）に揃える */
  showLeave,
  initial,
  saving,
  justSaved,
  error,
  companyId,
  remaining,
  onNext,
  onSave,
  onClose,
}: {
  open: boolean;
  companyName: string;
  showLeave: boolean;
  initial: ReasonAnswers;
  saving: boolean;
  justSaved: boolean;
  error: string | null;
  /** ★保存後の「見返り」を引くための会社（2026-09-12）。
      ⚠️ **自由入力の会社では `null`。** その場合は在籍者数の行を**出さない**
         （代替の文言も置かない。CLAUDE.md「値が無いことを、ある値に置き換えない」）。 */
  companyId: string | null;
  /** この職歴を保存したあとに残っている未回答の件数。0 なら「次の職歴」を出さない */
  remaining: number;
  /** 次の未回答へ進む。⚠️ `remaining === 0` のときは渡らない */
  onNext: (() => void) | null;
  /** ★保存できたら true を返すこと。true のときだけ「見返り」の画面へ進む */
  onSave: (answers: ReasonAnswers) => Promise<boolean>;
  /** ⚠️ 「あとで答える」と ×。**何も保存せず閉じる** */
  onClose: () => void;
}) {
  /* ★`"done"` は保存後の「見返り」（2026-09-12 / 2-6）。
     ⚠️ ステップ表記の分母（1 / 2）はこの画面に出さない。**設問ではない。** */
  const [step, setStep] = useState<1 | 2 | "done">(1);
  /** 在籍者数・元在籍者数。⚠️ 取れなかったら `null` のまま＝行ごと出さない */
  const [peers, setPeers] = useState<{ current: number; alumni: number } | null>(null);
  const [answers, setAnswers] = useState<ReasonAnswers>(initial);
  /** 上限（`REASON_MAX`）に当たったことを伝える短い注記。次の操作で消える（2026-08-19） */
  const [limitNote, setLimitNote] = useState<null | "join" | "leave">(null);

  const dirty = useMemo(
    () => JSON.stringify(answers) !== JSON.stringify(initial),
    [answers, initial],
  );

  /** 全ステップを通して1つでも選んでいるか。⚠️ **「保存」を出すかの判定はこれだけ。** */
  const hasAnySelection =
    answers.joinReasons.length > 0 ||
    (showLeave && answers.leaveReasons.length > 0) ||
    Object.keys(answers.gaps).length > 0;

  /* ★保存後に「在籍している人／過去に在籍していた人」を引く（2026-09-12 / 2-6）。
     ⚠️ **既存の企業ページ用ルートをそのまま使う。** 数のために別ルートを作らない。
     ⚠️ 失敗しても画面にエラーを出さない ——**設問の保存はもう終わっている**ので、
        ここで赤い枠を出すと「保存できなかった」と読まれる。行が出ないだけにする。 */
  useEffect(() => {
    if (step !== "done" || !companyId) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/jobseeker/companies/${companyId}/employees`);
        if (!res.ok) throw new Error(String(res.status));
        const j = (await res.json()) as { totalCurrentCount?: number; totalAlumniCount?: number };
        if (!alive) return;
        if (typeof j.totalCurrentCount === "number" && typeof j.totalAlumniCount === "number") {
          setPeers({ current: j.totalCurrentCount, alumni: j.totalAlumniCount });
        }
      } catch (e) {
        // ⚠️ 握り潰さない。画面には出さないが、落ちたことは残す
        console.error("[reason-modal] employees:", (e as Error).message);
      }
    })();
    return () => { alive = false; };
  }, [step, companyId]);

  /* 入社理由・退職理由のチェック切り替え。
     ⚠️ 入社理由を外したら「決め手」も一緒に外す。DB の CHECK
        （ow_experiences_join_reason_primary_check）が「決め手は選んだ理由の中の1つ」を
        要求しており、揃っていないと保存が 400 になるため、UI 側で常に整合させる。
     ⚠️ 上限に達していたら**選ばせない**（2026-08-19）。既存の選択を押し出す形にすると、
        利用者が選んだものが黙って消える。代わりに短い注記を出す。 */
  function toggleReason(key: "joinReasons" | "leaveReasons", value: string) {
    const cur = answers[key];
    if (!cur.includes(value) && cur.length >= REASON_MAX) {
      setLimitNote(key === "joinReasons" ? "join" : "leave");
      return;
    }
    setLimitNote(null);
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    if (key === "joinReasons") {
      const primary =
        answers.joinReasonPrimary && next.includes(answers.joinReasonPrimary)
          ? answers.joinReasonPrimary
          : "";
      setAnswers({ ...answers, joinReasons: next, joinReasonPrimary: primary });
    } else {
      setAnswers({ ...answers, leaveReasons: next });
    }
  }

  /* 同じ選択肢をもう一度押すと未回答（キーごと削除）に戻す。
     ⚠️ "未回答" という値を作らない。未回答は行が無いことで表す。 */
  function setGap(axis: string, rating: string) {
    const next = { ...answers.gaps };
    if (next[axis] === rating) delete next[axis];
    else next[axis] = rating;
    setAnswers({ ...answers, gaps: next });
  }

  return (
    <ProfileEditModal
      open={open}
      /* ★題は現職かどうかで変える（2026-09-12 / 2-5）。**判定は `showLeave` に揃える**
            （呼び出し側の `hasLeftCompany` が唯一の実装）。現職の人に
            「離れた理由」と書いた題を見せない。 */
      title={showLeave ? "この会社を選んだ理由と、離れた理由" : "この会社を選んだ理由"}
      dirty={step === "done" ? false : dirty}
      saving={saving}
      justSaved={justSaved}
      error={error}
      saveLabel={step === 1 ? "次へ" : step === 2 ? "保存" : onNext ? `次の職歴に答える（残り${remaining}件）` : "閉じる"}
      /* ⚠️★**未入力でも「次へ」は押せる。** `dirty` と連動させない。
            答えないまま「次へ」が押せないと、ギャップだけ答えたい人が進めない。
         ⚠️★**0件で「次へ」を許すのは意図的**（ギャップだけ回答する経路）。
            **「保存」だけは全ステップ0件のとき出さない**（2026-09-12 / 柴さんの判断。
            不活性のボタンは置かない）。両方の意図があるので、片方だけ変えないこと。 */
      primaryEnabled
      hidePrimary={step === 2 && !hasAnySelection}
      /* ⚠️ 「あとで答える」は**確認を挟まずそのまま閉じる**（何も保存しない）。
            × と背景クリックは `dirty` のとき破棄の確認が出る。役割が違う。 */
      secondaryLabel={step === "done" ? (onNext ? "閉じる" : undefined) : "あとで答える"}
      onSecondary={onClose}
      onSave={() => {
        if (step === 1) { setStep(2); return; }
        if (step === "done") { if (onNext) onNext(); else onClose(); return; }
        /* ★保存できたときだけ「見返り」へ進む（2026-09-12 / 2-6）。
              失敗したらこの画面に留まり、`error` を出したまま押し直せる。 */
        void onSave(answers).then((ok) => { if (ok) setStep("done"); });
      }}
      onClose={onClose}
    >
      {/* ⚠️ 緑バッジと補足文は**編集モーダルにあったものをそのまま移した**。消さないこと。 */}
      {/* ⚠️★**バッジと一文は同じ行に置く**（2026-09-12 / 柴さんの指示）。
             2行に分けていたときは「あなた以外には表示されません」がバッジの言い換えになっていた。
             ⚠️ 狭い画面では折り返す（`flexWrap`）。**固定幅にしないこと。** */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 18, minWidth: 0 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--success-ink)",
            background: "var(--success-soft)",
            padding: "2px 8px",
            borderRadius: 100,
            letterSpacing: "0.03em",
            flexShrink: 0,
          }}
        >
          この内容は公開されません
        </span>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 500, lineHeight: 1.7, color: "var(--ink-mute)", minWidth: 0 }}>
          企業ごとの傾向の集計にだけ使います
        </p>
      </div>

      {step === 1 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={stepLabelStyle}>ステップ 1 / 2</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginTop: 4, lineHeight: 1.5, overflowWrap: "anywhere" }}>
              {companyName} を選んだ理由は？
            </div>
          </div>

          {/* 入社理由（軸ごと・3つまで） */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginBottom: 10 }}>
              {REASON_MAX}つまで選べます（{answers.joinReasons.length} / {REASON_MAX}）
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {groupReasonsByAxis(JOIN_REASONS).map((g) => (
                /* ⚠️ 軸のラベルとチップを横並びにしない。狭い画面でラベルを固定幅にすると
                      はみ出しの原因になる。 */
                <div key={g.axis} style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 5 }}>
                    {g.axisLabel}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 9, minWidth: 0 }}>
                    {g.options.map((o) => (
                      <ReasonChip
                        key={o.value}
                        label={o.label}
                        active={answers.joinReasons.includes(o.value)}
                        disabled={saving}
                        onClick={() => toggleReason("joinReasons", o.value)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {limitNote === "join" && (
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginTop: 8 }}>
                {REASON_MAX}つまでです。ほかを外してから選んでください。
              </div>
            )}
          </div>

          {/* 決め手（選んだ理由の中から1つ） */}
          {answers.joinReasons.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
                その中で、いちばんの決め手は
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
                {JOIN_REASONS.filter((o) => answers.joinReasons.includes(o.value)).map((o) => (
                  <ReasonChip
                    key={o.value}
                    label={o.label}
                    active={answers.joinReasonPrimary === o.value}
                    disabled={saving}
                    /* もう一度押すと未選択に戻す */
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        joinReasonPrimary: answers.joinReasonPrimary === o.value ? "" : o.value,
                      })
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* 退職理由 — ★終了日がある在籍にだけ出す（現職・終了日未入力には出さない） */}
          {showLeave && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>
                この会社を離れた理由
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginBottom: 10 }}>
                {REASON_MAX}つまで選べます（{answers.leaveReasons.length} / {REASON_MAX}）
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {groupReasonsByAxis(LEAVE_REASONS).map((g) => (
                  <div key={g.axis} style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 5 }}>
                      {g.axisLabel}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 9, minWidth: 0 }}>
                      {g.options.map((o) => (
                        <ReasonChip
                          key={o.value}
                          label={o.label}
                          active={answers.leaveReasons.includes(o.value)}
                          disabled={saving}
                          onClick={() => toggleReason("leaveReasons", o.value)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {limitNote === "leave" && (
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginTop: 8 }}>
                  {REASON_MAX}つまでです。ほかを外してから選んでください。
                </div>
              )}
            </div>
          )}
        </div>
      ) : step === 2 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={stepLabelStyle}>ステップ 2 / 2</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginTop: 4, lineHeight: 1.5 }}>
              入る前の想像と、実際のギャップ
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginBottom: 10, lineHeight: 1.6 }}>
              答えたい項目だけで大丈夫です。選んだものをもう一度押すと未回答に戻ります。
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {GAP_AXES.map((axis) => (
                <div key={axis.value} style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 5 }}>
                    {axis.label}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 9, minWidth: 0 }}>
                    {GAP_RATINGS.map((r) => (
                      <ReasonChip
                        key={r.value}
                        label={r.label}
                        active={answers.gaps[axis.value] === r.value}
                        disabled={saving}
                        onClick={() => setGap(axis.value, r.value)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ★保存後の「見返り」（2026-09-12 / 2-6）。
           ⚠️★**出すのは在籍者数という事実だけ。** 集計値・推定値・退職理由の分布は出さない。
           ⚠️★**自由入力の会社（`companyId` が無い）では行ごと出さない。**
              「まだ登録されていません」のような代替文も置かない。 */
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", lineHeight: 1.5, overflowWrap: "anywhere" }}>
            回答を保存しました
          </div>
          {peers && (
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-soft)", lineHeight: 1.8, overflowWrap: "anywhere" }}>
              {companyName} には、いま在籍している人が
              <span style={{ fontWeight: 700, color: "var(--ink)", margin: "0 3px" }}>{peers.current}</span>
              人、過去に在籍していた人が
              <span style={{ fontWeight: 700, color: "var(--ink)", margin: "0 3px" }}>{peers.alumni}</span>
              人います。
            </div>
          )}
          {remaining > 0 && (
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", lineHeight: 1.7 }}>
              まだ答えていない職歴が {remaining} 件あります。
            </div>
          )}
        </div>
      )}
    </ProfileEditModal>
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
  onClick,
}: {
  answered: boolean;
  onClick: () => void;
}) {
  const label = answered ? "理由を回答済み・編集" : "選んだ理由を回答する（非公開）";
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
      {answered ? (
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
          {/* 未回答の印。⚠️ 数字にしない（件数ではない） */}
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--royal)",
              border: "1.5px solid #fff",
            }}
          />
        </>
      )}
    </button>
  );
}
