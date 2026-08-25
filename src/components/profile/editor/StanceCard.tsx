"use client";

import { useState } from "react";

/**
 * 「声をかけられてもよいか」（右カラム）。
 *
 * ── 何を持つか ─────────────────────────────────────────────────────────────
 * **`ow_profiles.scout_enabled` だけ**を読み書きする。主スイッチ用の列は作らない。
 *
 * ⚠️ **`null`（未選択）を「はい」で初期表示しない。** どちらのボタンも押されていない
 *    状態で出す。「はい」を初期表示すると、利用者が何も触らず保存した瞬間に
 *    **未選択が true に化ける**（本人が選んでいない状態で企業に開示されることになる）。
 *    `can_send_scout()` は null を false 扱いにするので、未選択のままなら届かない。
 *
 * ⚠️ **画面に「スカウト」「カジュアル面談」という言葉を出さない。**
 *    送る側の意図（まず面談から／いきなり選考）は受け手には判断できないので、
 *    軸を「内容」ではなく **「相手が誰か」** にしている。
 *
 * ⚠️ 内訳（「求職者・個人から」）は**出さない**。`can_talk_to_candidates` は
 *    書く経路も読む経路も無い死列で、`/api/dm/start` は `visibility` しか見ていない。
 *    出すと「オフにしたのに DM が届く」になる（docs/phase-a-stance-20260820.md）。
 *
 * ⚠️ 「転職について」は**表示だけ**。編集はプロフィール本文の「転職の希望」に1つだけ置く。
 *    同じ列を触る画面を2つにしない。
 */
export default function StanceCard({
  initialScoutEnabled,
  openToWorkLabel,
}: {
  /** `null` は「まだ選んでいない」。⚠️ `can_send_scout()` は null を false 扱いにする */
  initialScoutEnabled: boolean | null;
  /** 「転職について」に出す現在の文言（表示のみ） */
  openToWorkLabel: string;
}) {
  /* ★保存済みの値だけを見る（ルール⑦）。押した瞬間ではなく、保存できてから更新する */
  const [saved, setSaved] = useState<boolean | null>(initialScoutEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(next: boolean) {
    if (saving || saved === next) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/jobseeker/scout-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scout_enabled: next }),
      });
      if (!res.ok) throw new Error();
      setSaved(next);
    } catch {
      setError("保存できませんでした。もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "18px 18px 16px",
        boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", letterSpacing: "0.04em", marginBottom: 2 }}>
        企業の採用担当から
      </div>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: "0 0 10px" }}>
        声をかけられてもよいか
      </h2>

      {/* ★2026-08-25 に「はい／いいえ」の2ボタンから**トグル**に変えた（柴さんの指示）。
             2ボタンだと、どちらが選択中かが一目で読めなかった。
          ⚠️★**未選択（null）と「いいえ」はトグルでは同じ見た目になる。**
             だから下の「まだ選ばれていません」を**必ず残す**。消すと、
             選んでいない人が「いいえを選んだ」と誤解する（この画面が守ってきた条件）。
          ⚠️ 挙動は `TalkToMeCard` のトグルと同じにする（`role="switch"` ＋ `aria-checked`）。
             見た目だけで状態を伝えない。 */}
      <button
        type="button"
        role="switch"
        aria-checked={saved === true}
        aria-label="企業の採用担当から声をかけられてもよい"
        disabled={saving}
        onClick={() => void choose(saved !== true)}
        className="btn-fixed-size"
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, width: "100%", padding: 0, background: "none", border: "none",
          cursor: saving ? "wait" : "pointer", fontFamily: "inherit",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
          {saving ? "保存中…" : "声をかけられてもよい"}
        </span>
        <span aria-hidden style={{
          width: 40, height: 22, borderRadius: 999, flexShrink: 0,
          background: saved === true ? "var(--royal)" : "var(--line)",
          display: "inline-flex", alignItems: "center",
          justifyContent: saved === true ? "flex-end" : "flex-start",
          padding: 2, transition: "background 0.15s",
          opacity: saving ? 0.6 : 1,
        }}>
          <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff" }} />
        </span>
      </button>

      {/* ⚠️ 未選択であることを**画面に出す**。どちらも押されていない見た目だけだと、
             「いいえ」を選んだのと区別がつかない。 */}
      {saved === null && (
        <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.6, color: "var(--ink-mute)" }}>
          まだ選んでいません。ONにするまで声はかかりません。
        </p>
      )}
      {/* ⚠️ トグルの結果を1行で言う。`TalkToMeCard` と同じ形（下に状態を出す）。 */}
      {saved === true && (
        <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.6, color: "var(--success)" }}>
          企業から声がかかることがあります
        </p>
      )}
      {saved === false && (
        <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.6, color: "var(--ink-mute)" }}>
          いまは声をかけられません
        </p>
      )}
      {error && (
        <p style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 600, color: "var(--error)" }}>{error}</p>
      )}

      <div style={{ height: 1, background: "var(--line)", margin: "16px 0 12px" }} />

      {/* ★「転職について」は**1行**にする（2026-08-24）。
             ⚠️ 見出し・値・注記で3行を使っていたが、**表示だけの項目**にその重さは要らない。
                左に項目名・右に値の1行にして、変更先はその下に短く添える。
             ⚠️ ここは表示専用。編集は本文の「転職の希望」に1つだけ置く（ルール⑧）。 */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
          転職について
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", textAlign: "right", minWidth: 0 }}>
          {openToWorkLabel}
        </span>
      </div>
      <p style={{ margin: "4px 0 0", fontSize: 11, lineHeight: 1.6, color: "var(--ink-mute)" }}>
        変更は「転職の希望」から
      </p>
    </section>
  );
}
