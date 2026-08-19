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

      <div style={{ display: "flex", gap: 8 }}>
        {[
          { value: true, label: "はい" },
          { value: false, label: "いいえ" },
        ].map((o) => {
          const active = saved === o.value;
          return (
            <button
              key={o.label}
              type="button"
              onClick={() => void choose(o.value)}
              disabled={saving}
              aria-pressed={active}
              className="btn-fixed-size"
              style={{
                flex: 1,
                height: 40,
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                fontFamily: "inherit",
                cursor: saving ? "wait" : "pointer",
                border: active ? "1.5px solid var(--royal)" : "1px solid var(--line)",
                background: active ? "var(--royal)" : "#fff",
                color: active ? "#fff" : "var(--ink-soft)",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {/* ⚠️ 未選択であることを**画面に出す**。どちらも押されていない見た目だけだと、
             「いいえ」を選んだのと区別がつかない。 */}
      {saved === null && (
        <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.6, color: "var(--ink-mute)" }}>
          まだ選ばれていません。選ぶまでは声をかけられません。
        </p>
      )}
      {error && (
        <p style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 600, color: "var(--error)" }}>{error}</p>
      )}

      <div style={{ height: 1, background: "var(--line)", margin: "16px 0 12px" }} />

      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", letterSpacing: "0.04em", marginBottom: 4 }}>
        転職について
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{openToWorkLabel}</div>
      <p style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.6, color: "var(--ink-mute)" }}>
        変更はプロフィールの「転職の希望」から。
      </p>
    </section>
  );
}
