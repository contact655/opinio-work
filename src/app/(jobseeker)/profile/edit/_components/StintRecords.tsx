"use client";

import { useState } from "react";
import { AchievementEditor, AwardEditor } from "./RecordEditors";
import type { Achievement, Award } from "./recordTypes";

/**
 * 職歴カードの各行の下に出す「実績・受賞」（フェーズ4-2）。
 *
 * ⚠️ **独立したカードに戻さない。** 実績は「どの職歴での話か」が分かって初めて読める。
 *    カードを分けていた頃は、職歴と実績が別の場所にあり、対応が読み取れなかった。
 *
 * ⚠️ 追加・編集・削除は既存の `AchievementEditor` / `AwardEditor` をそのまま使う
 *    （`experienceId` で範囲を絞るだけ）。フォームと検証を二重に書かない。
 */
export function StintRecords({
  experienceId,
  achievements, setAchievements,
  awards, setAwards,
}: {
  /** この職歴の id。`null` は「その他の実績・受賞」 */
  experienceId: string | null;
  achievements: Achievement[];
  setAchievements: React.Dispatch<React.SetStateAction<Achievement[]>>;
  awards: Award[];
  setAwards: React.Dispatch<React.SetStateAction<Award[]>>;
}) {
  const [open, setOpen] = useState(false);

  const myAch = achievements.filter((a) => (a.experience_id ?? null) === experienceId);
  const myAwd = awards.filter((a) => (a.experience_id ?? null) === experienceId);

  return (
    <div style={{ marginTop: 8 }}>
      {/* 閉じているときはチップで並べる（モックの .chip） */}
      {!open && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          {myAch.map((a) => (
            <Chip key={a.id} label={`実績：${a.title}`} />
          ))}
          {myAwd.map((a) => (
            <Chip key={a.id} label={`受賞：${a.title}`} />
          ))}
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{
              display: "inline-block", border: "none", cursor: "pointer",
              background: "var(--royal-50)", color: "var(--royal)",
              borderRadius: 14, padding: "3px 11px", fontSize: 12.5, fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            {myAch.length + myAwd.length > 0
              ? "＋ 実績・受賞を編集"
              /* ⚠️ 「その他」（experienceId が null）では「この職歴に」と書かない。
                    職歴の話ではないので、読んだ人が対応を取り違える。 */
              : experienceId === null ? "＋ 実績・受賞を追加" : "＋ この職歴に実績・受賞を追加"}
          </button>
        </div>
      )}

      {open && (
        <div style={{
          marginTop: 6, padding: "14px 16px", borderRadius: 10,
          border: "1px solid var(--line)", background: "var(--bg-tint)",
        }}>
          <AchievementEditor
            achievements={achievements}
            setAchievements={setAchievements}
            experienceId={experienceId}
            showHeading={false}
          />
          <div style={{ height: 1, background: "var(--line-soft)", margin: "16px 0" }} />
          <AwardEditor
            awards={awards}
            setAwards={setAwards}
            experienceId={experienceId}
            showHeading={false}
          />
          <div style={{ marginTop: 12, textAlign: "right" }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                padding: "6px 14px", fontSize: 12, fontWeight: 600,
                background: "#fff", color: "var(--ink-soft)",
                border: "1px solid var(--line)", borderRadius: 8,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span style={{
      display: "inline-block", background: "var(--line-soft)", color: "var(--ink-soft)",
      borderRadius: 14, padding: "3px 11px", fontSize: 12.5, lineHeight: 1.6,
      maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    }} title={label}>
      {label}
    </span>
  );
}
