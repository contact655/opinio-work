"use client";

import { useEffect, useState } from "react";
import {
  CANDIDATE_LIST_NUDGE_BODY, CANDIDATE_LIST_NUDGE_SNOOZE_DAYS, CANDIDATE_LIST_NUDGE_STALE_NOTE,
  CANDIDATE_LIST_NUDGE_TITLE, type CandidateListNudge as Nudge,
} from "@/lib/profile/candidateListFields";

/**
 * ★「企業の候補者一覧に表示される項目」の案内（2026-11-27 / 柴さんの指示）。/mypage の上部に出す。
 *   出すかどうか・並べる項目・文言は lib/profile/candidateListFields.ts の1か所。ここは描くだけ。
 *
 * ⚠️ 閉じたら30日出さない。端末の localStorage に閉じた日時を持つ（読めないときは出す）。
 * ⚠️ 絵文字・グラデーション・影を使わない（カードは角丸14px・線1px・影なし）。
 * ⚠️ リンクは <a>（ページごと読み込む）。同じ /mypage への移動なので、Link だと開く処理が動かないことがある。
 */

const KEY = "opinio:candidate-list-nudge:dismissed-at";

export default function CandidateListNudge({ nudge }: { nudge: Nudge | null }) {
  /* ⚠️ 最初は出さず、localStorage を読んでから出す（サーバーの描画と食い違わないように） */
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!nudge) return;
    let snoozed = false;
    try {
      const v = window.localStorage.getItem(KEY);
      const t = v ? Number(v) : NaN;
      snoozed = !Number.isNaN(t) && Date.now() - t < CANDIDATE_LIST_NUDGE_SNOOZE_DAYS * 24 * 60 * 60 * 1000;
    } catch { /* 読めなければ出す */ }
    setShow(!snoozed);
  }, [nudge]);

  if (!nudge || !show) return null;

  const close = () => {
    try { window.localStorage.setItem(KEY, String(Date.now())); } catch { /* 書けなくても閉じる */ }
    setShow(false);
  };

  return (
    <section
      aria-labelledby="candidate-list-nudge-title"
      data-state="candidate-list-nudge"
      style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "18px 20px", marginBottom: 20 }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <h2 id="candidate-list-nudge-title" style={{ flex: 1, margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ink)", lineHeight: 1.5 }}>
          {CANDIDATE_LIST_NUDGE_TITLE}
        </h2>
        <button
          type="button"
          onClick={close}
          aria-label="閉じる"
          title="閉じる（30日間表示しません）"
          className="tap-target"
          style={{
            width: 32, height: 32, flexShrink: 0, border: "none", background: "var(--line-soft)", borderRadius: 8,
            cursor: "pointer", fontSize: 17, lineHeight: 1, color: "var(--ink-soft)", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >×</button>
      </div>
      <p style={{ margin: "6px 0 12px", fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)" }}>
        {CANDIDATE_LIST_NUDGE_BODY}
      </p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, borderTop: "1px solid var(--line)" }}>
        {nudge.missing.map((m) => (
          <li key={m.key} data-field={m.key} style={{ borderBottom: "1px solid var(--line)" }}>
            <a
              href={m.href}
              className="tap-min-h"
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                padding: "11px 2px", textDecoration: "none", color: "var(--ink)", fontSize: 14, fontWeight: 600,
              }}
            >
              <span>{m.label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--royal)", whiteSpace: "nowrap" }}>入力する →</span>
            </a>
          </li>
        ))}
      </ul>
      {nudge.stanceStale && (
        <p data-state="candidate-list-nudge-stale" style={{ margin: "12px 0 0", fontSize: 12, lineHeight: 1.8, color: "var(--ink-mute)" }}>
          {CANDIDATE_LIST_NUDGE_STALE_NOTE}
        </p>
      )}
    </section>
  );
}
