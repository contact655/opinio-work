"use client";

/**
 * ★入社の決め手（1問）「この会社に決めた理由は？（3つまで）」（2026-11-02 / 柴さんの指示）。
 *   転機の3問（CareerTurnModal）の表示を止めて、これに置き換えた（コードと表は残してある）。
 *   データは ow_join_decisions（migration 20261102090000）。選択肢・文言は lib/joinDecision/constants.ts。
 *
 * 出す時機:
 *   ・現職の会社を登録・更新したとき（CareerHistoryEditor）。⚠️ まだ答えていない・スキップしていない会社だけ（`prompt`）
 *   ・スキップした人には30日後に1回だけ（ホームのカード。開いたら reshown を記録する）
 *
 * ⚠️ 順位・★は無い。3つまで。任意（スキップできる）。閉じる（×・Esc）もスキップとして記録する。
 * ⚠️★「この回答は会社には見えません」を必ず出す（JOIN_DECISION_PRIVACY_NOTE）。
 * ⚠️ まとまり（仕事・人・会社・条件）の並びは開くたびにランダム。⚠️ マウント後に並べ替える（サーバーと食い違わないように）。
 */

import { useEffect, useRef, useState } from "react";
import { ProfileEditModal } from "./ProfileEditModal";
import {
  JOIN_DECISION_GROUPS,
  JOIN_DECISION_MAX,
  JOIN_DECISION_PRIVACY_NOTE,
  JOIN_DECISION_QUESTION,
  shuffledGroups,
  type JoinDecisionGroup,
} from "@/lib/joinDecision/constants";

/** GET /api/jobseeker/experiences/[id]/decision の形（lib/joinDecision/server.ts の LoadedJoinDecision） */
export type LoadedJoinDecisionView = {
  anchorId: string;
  status: "answered" | "skipped" | "none";
  reasons: string[];
  prompt: "first" | "reshow" | null;
};

const CSS = `
  .jd-choice { min-height: 40px; min-width: 0; padding: 6px 14px; border-radius: 999px; border: 1.5px solid var(--line);
    background: #fff; color: var(--ink-soft); font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer;
    line-height: 1.4; text-align: left; transition: border-color 0.12s, background 0.12s, color 0.12s; }
  .jd-choice[data-active=on] { border-color: var(--royal); background: var(--royal-50); color: var(--royal); font-weight: 700; }
  .jd-choice:disabled { cursor: default; opacity: 0.5; }
  .jd-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .jd-group-label { margin: 0 0 6px; font-size: 12px; font-weight: 700; color: var(--ink-mute); }
`;

export function JoinDecisionModal({
  open,
  experienceId,
  companyName,
  onlyWhenPrompted = false,
  onSaved,
  onClose,
  preview,
}: {
  open: boolean;
  /** 開いた職歴の id（どの役割でもよい。保存先＝その会社のいちばん古い行はサーバーが決める） */
  experienceId: string;
  companyName: string;
  /** ★true なら、いま聞いてよいとき（prompt）だけ出す。聞かなくてよければ何も出さずに onClose する（職歴を保存した直後） */
  onlyWhenPrompted?: boolean;
  onSaved?: () => void;
  onClose: () => void;
  /** ★`/dev/preview` 用。渡すとサーバーと通信しない */
  preview?: LoadedJoinDecisionView;
}) {
  const [loaded, setLoaded] = useState<LoadedJoinDecisionView | null>(preview ?? null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(preview?.reasons ?? []);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [limitHit, setLimitHit] = useState(false);
  /* ★並びは固定の順で描き、マウント後に入れ替える（初回の描画をサーバーと揃えるため） */
  const [groups, setGroups] = useState<readonly JoinDecisionGroup[]>(JOIN_DECISION_GROUPS);
  const finishedRef = useRef(false);
  const reshownSentRef = useRef(false);
  /* ⚠️ 親は onClose を毎回作り直すので、読み込みの effect の依存に入れない（入れると開くたびに読み直す） */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => { if (open) setGroups(shuffledGroups()); }, [open]);

  useEffect(() => {
    if (!open || preview) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/jobseeker/experiences/${experienceId}/decision`, { cache: "no-store" });
        const j = (await res.json().catch(() => ({}))) as LoadedJoinDecisionView & { error?: string };
        if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
        if (!alive) return;
        if (onlyWhenPrompted && !j.prompt) { finishedRef.current = true; onCloseRef.current(); return; }
        setLoaded(j);
        setSelected(j.reasons ?? []);
      } catch (e) {
        console.error("[JoinDecisionModal] load:", (e as Error).message);
        if (!alive) return;
        /* ⚠️ 職歴を保存した直後に出すときは、読めなければ黙って閉じる（職歴の保存は済んでいる） */
        if (onlyWhenPrompted) { finishedRef.current = true; onCloseRef.current(); return; }
        setLoadError("読み込みに失敗しました。時間をおいてお試しください。");
      }
    })();
    return () => { alive = false; };
  }, [open, experienceId, onlyWhenPrompted, preview]);

  /* ★スキップから30日後の再表示は1回だけ。出した時点で記録する（閉じても答えても、二度と出さない） */
  useEffect(() => {
    if (!open || preview || loaded?.prompt !== "reshow" || reshownSentRef.current) return;
    reshownSentRef.current = true;
    void put({ reshown: true }).catch((e) => console.error("[JoinDecisionModal] reshown:", (e as Error).message));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preview, loaded?.prompt]);

  async function put(body: Record<string, unknown>) {
    if (preview) return;
    const res = await fetch(`/api/jobseeker/experiences/${experienceId}/decision`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(j.message ?? "保存に失敗しました。もう一度お試しください。");
    }
  }

  function toggle(v: string) {
    setLimitHit(false);
    setSelected((cur) => {
      if (cur.includes(v)) return cur.filter((x) => x !== v);
      if (cur.length >= JOIN_DECISION_MAX) { setLimitHit(true); return cur; }
      return [...cur, v];
    });
  }

  async function save() {
    setSaving(true); setSaveError(null);
    try {
      await put({ reasons: selected });
      finishedRef.current = true;
      setDone(true);
      onSaved?.();
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  /* ★スキップ（ボタン・×・Esc）。⚠️ 答えたあと・読めなかったときは記録しない */
  async function skipAndClose() {
    if (!finishedRef.current && loaded && loaded.status !== "answered") {
      finishedRef.current = true;
      try { await put({ skip: true }); }
      catch (e) { console.error("[JoinDecisionModal] skip:", (e as Error).message); }
    }
    onClose();
  }

  const ready = !!loaded;
  if (!open || (onlyWhenPrompted && !ready && !loadError)) return null;

  return (
    <ProfileEditModal
      open={open}
      title={`${companyName}について`}
      width={560}
      dirty={false}
      saving={saving}
      justSaved={false}
      error={saveError ?? loadError}
      saveLabel={done ? "閉じる" : "保存する"}
      primaryEnabled
      primaryDisabled={!done && (!ready || selected.length === 0)}
      secondaryLabel={done ? undefined : "スキップ"}
      onSecondary={done ? undefined : () => void skipAndClose()}
      onSave={() => { if (done) onClose(); else void save(); }}
      onClose={() => { if (done) onClose(); else void skipAndClose(); }}
    >
      <style>{CSS}</style>
      {!ready && !loadError && <div style={{ fontSize: 13, color: "var(--ink-mute)" }}>読み込んでいます…</div>}

      {ready && done && (
        <p data-state="jd-done" style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: "var(--ink)" }}>
          保存しました。{JOIN_DECISION_PRIVACY_NOTE}。
        </p>
      )}

      {ready && !done && (
        <div data-state="jd-form" style={{ display: "grid", gap: 18, minWidth: 0 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: "0 0 4px", lineHeight: 1.6 }}>
              {JOIN_DECISION_QUESTION}
            </h3>
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)" }}>{JOIN_DECISION_MAX}つまで（答えなくてもかまいません）</p>
          </div>
          {groups.map((g) => (
            <section key={g.key} data-state={`jd-group-${g.key}`} style={{ minWidth: 0 }}>
              <p className="jd-group-label">{g.label}</p>
              <div className="jd-chips" role="group" aria-label={g.label}>
                {g.options.map((o) => {
                  const active = selected.includes(o.value);
                  return (
                    <button key={o.value} type="button" className="btn-fixed-size jd-choice" aria-pressed={active}
                      data-active={active ? "on" : "off"} disabled={saving} onClick={() => toggle(o.value)}>
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {limitHit && (
            <p role="status" style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}>
              {JOIN_DECISION_MAX}つまでです。ほかを外してから選んでください。
            </p>
          )}
          <p data-testid="join-decision-privacy-note" style={{ margin: 0, fontSize: 12.5, fontWeight: 600, lineHeight: 1.7, color: "var(--ink-soft)" }}>
            {JOIN_DECISION_PRIVACY_NOTE}
          </p>
        </div>
      )}
    </ProfileEditModal>
  );
}
