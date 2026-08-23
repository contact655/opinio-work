"use client";

import { useState, type ReactNode } from "react";

/**
 * `/u/[id]` の上位タブ（2026-08-23）。
 *
 * ── なぜ ────────────────────────────────────────────────────────────────────
 * それまでは全セクションを1ページに縦積みし、スクロール連動のアンカーナビ
 * （`ProfileNavClient`）で移動する作りだった。投稿（アクティビティ）も
 * その最後に積まれており、**0件のときはセクションごと消えていた**ため、
 * 「その人の投稿がこのページのどこにあるのか」が分からなかった。
 *
 * 上位を2つに割り、**投稿の置き場所を常に見える形にする**。
 *
 *   プロフィール … 自己紹介 / 職歴 / 学歴 / 実績 / 発信 / 在籍企業の求人
 *   フィード     … その人の投稿
 *
 * ⚠️ **フィードのタブは0件でも出す。** 「まだ無い」と「どこにあるか分からない」は
 *    別のこと。タブごと消すと後者になる（それが今回の出発点）。
 *
 * ⚠️ 中身はサーバー側で組み立てて ReactNode で渡す。
 *    ここが持つのは「どちらを見せるか」だけ。
 *    `CollapsibleList` と同じ切り分けで、描画ヘルパーをクライアントへ持ち出さない。
 *
 * ⚠️ 選択状態は**下線のみ**。塗りを併用しないこと
 *    （`.claude/skills/ui-conventions/SKILL.md` の「タブ」。企業詳細で
 *     下線と塗りが同時に出て「どちらが選択中か分からない」を起こした）。
 *    件数はラベル右のニュートラルなバッジで示す。
 */
export function ProfileTabsClient({
  profile,
  feed,
  feedCount,
}: {
  profile: ReactNode;
  feed: ReactNode;
  /** フィードの件数。0 のときはバッジを出さない（「0」を見せない） */
  feedCount: number;
}) {
  const [tab, setTab] = useState<"profile" | "feed">("profile");

  const tabs = [
    { id: "profile" as const, label: "プロフィール", count: 0 },
    { id: "feed" as const, label: "フィード", count: feedCount },
  ];

  return (
    <>
      <div
        role="tablist"
        aria-label="プロフィールの表示切り替え"
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 20,
          borderBottom: "1px solid var(--line)",
        }}
      >
        {tabs.map(({ id, label, count }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 16px",
                fontSize: 14,
                fontWeight: active ? 700 : 500,
                color: active ? "var(--royal)" : "var(--ink-mute)",
                background: "none",
                border: "none",
                borderBottom: active ? "2px solid var(--royal)" : "2px solid transparent",
                marginBottom: -1,
                cursor: "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
                transition: "color 0.18s, border-color 0.18s",
              }}
            >
              {label}
              {count > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    lineHeight: 1,
                    padding: "3px 6px",
                    borderRadius: 999,
                    background: "var(--line-soft)",
                    color: "var(--ink-mute)",
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ⚠️ 出していない側を DOM に残さない。`ProfileNavClient` は
             `document.getElementById` でセクションを探すので、隠したまま
             残すと「見えていないセクション」に飛ぼうとする。 */}
      <div role="tabpanel">{tab === "profile" ? profile : feed}</div>
    </>
  );
}
