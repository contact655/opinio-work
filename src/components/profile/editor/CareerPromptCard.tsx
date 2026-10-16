"use client";

import { useState } from "react";

/**
 * ★職歴の促しカード（2026-10-16 / 柴さんの判断）。/mypage の職歴欄にだけ出す。
 *
 * 表示条件は呼び出し側（`ProfileTab`）が持つ:
 *   職歴がちょうど1件・在籍中 ／ `career_history_complete_at` が NULL。
 * ⚠️ `/u/[id]` など他人から見える面には置かない（`ProfileTab` は本人の編集画面）。
 *
 * ⚠️ 新しい入力画面は作らない。2つのボタンは**既存のモーダルを開くだけ**:
 *    「{会社名}での異動・昇進を追加」→ 会社の行の下の「＋ この会社での異動・昇進を追加」と同じ
 *    「前職を追加」→ セクション下の「＋ 職歴を追加」と同じ
 * ⚠️ 文言はボタン側の語（異動・昇進）に揃える。モーダルの見出し「この会社に役割を追加」は変えない
 *    （兼務なども含むため）。
 * ⚠️ 2つのボタンは塗らない（白地に濃紺の枠と文字）。開くのはその場のモーダルで、ページの遷移ではない
 *    （ui-conventions「濃紺の塗りは主要な遷移」）。セクション下の「＋ 職歴を追加」も塗っていない。
 * ⚠️ 見出しは「経歴」（2026-10-16 / 柴さんの指示）。同じ会社の中の役割（異動・昇進）も含むため。
 *    「職歴」は会社をまたぐ語として使っているので、見出しを「職歴」にしないこと。
 * ⚠️ %や「あと◯項目」は出さない。
 * ⚠️ このカードが出ているあいだ「N件の職歴が未回答です」の帯は出さない（呼び出し側）。
 *    2つを同時に並べない。
 */
export default function CareerPromptCard({
  companyName,
  onAddRole,
  onAddPast,
  onComplete,
}: {
  /** 現職の会社名。伏せ字・不明のときは null（ボタンは「この会社での…」になる） */
  companyName: string | null;
  onAddRole: () => void;
  onAddPast: () => void;
  /** 「これ以上の経歴はない」。保存に失敗したら reject する */
  onComplete: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = async () => {
    setSaving(true);
    setError(null);
    try {
      await onComplete();
    } catch {
      setError("保存に失敗しました。もう一度お試しください。");
      setSaving(false);
    }
  };

  const btnBase: React.CSSProperties = {
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 700,
    borderRadius: 999,
    fontFamily: "inherit",
    cursor: "pointer",
    maxWidth: "100%",
    whiteSpace: "normal",
    textAlign: "left",
    lineHeight: 1.5,
  };

  return (
    <div
      data-career-prompt
      style={{
        minWidth: 0,
        padding: "12px 14px",
        marginBottom: 14,
        borderRadius: 10,
        background: "var(--royal-50)",
        border: "1px solid var(--line)",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", lineHeight: 1.6, marginBottom: 10 }}>
        ほかにも経歴があれば追加してください
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", minWidth: 0 }}>
        <button
          type="button"
          onClick={onAddRole}
          className="tap-min-h"
          style={{ ...btnBase, color: "var(--royal)", background: "#fff", border: "1px solid var(--royal)" }}
        >
          {companyName ? `${companyName}での異動・昇進を追加` : "この会社での異動・昇進を追加"}
        </button>
        <button
          type="button"
          onClick={onAddPast}
          className="tap-min-h"
          style={{ ...btnBase, color: "var(--royal)", background: "#fff", border: "1px solid var(--royal)" }}
        >
          前職を追加
        </button>
        <button
          type="button"
          onClick={handleComplete}
          disabled={saving}
          className="tap-min-h"
          style={{
            ...btnBase,
            fontWeight: 600,
            color: "var(--ink-mute)",
            background: "none",
            border: "none",
            textDecoration: "underline",
            textUnderlineOffset: 3,
            cursor: saving ? "default" : "pointer",
          }}
        >
          {saving ? "保存中..." : "これ以上の経歴はない"}
        </button>
      </div>
      {error && (
        <div role="alert" style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>
          {error}
        </div>
      )}
    </div>
  );
}
