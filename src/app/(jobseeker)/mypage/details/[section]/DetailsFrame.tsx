"use client";

import Link from "next/link";
import { sectionAddBtn, PlusIcon } from "@/components/profile/view/RowActions";

/**
 * 1セクションの一覧ページの枠（2026-08-17 / フェーズ3）。
 *
 * 中身は **戻る矢印 / 見出し / ＋ / 全行** だけ。
 * ⚠️ ここに説明文・プロモ・右カラムを足さないこと。**行を触るためだけのページ**にする。
 */
export function DetailsFrame({ title, onAdd, addLabel, children, hideOwnHeading = false }: {
  title: string;
  onAdd: () => void;
  addLabel: string;
  children: React.ReactNode;
  /** ★中の部品が自分で枠と見出しと「追加」を描くとき true（2026-08-17）。
      ⚠️ 数値実績・受賞・メディア掲載・発信コンテンツは公開部品が枠ごと持っている。
         ここでも描くと**枠が二重・見出しが二重・「追加」が2つ**になる（ルール⑧）。 */
  hideOwnHeading?: boolean;
}) {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 64px" }}>
      <Link
        href="/mypage"
        className="tap-target"
        aria-label="プロフィールに戻る"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16,
          fontSize: 13, fontWeight: 600, color: "var(--ink-soft)", textDecoration: "none",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        プロフィール
      </Link>

      {hideOwnHeading ? children : (
        <section style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: 14, padding: "24px 28px",
          boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: 0, whiteSpace: "nowrap" }}>
              {title}
            </h1>
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            <button type="button" className="tap-target tap-target-end" onClick={onAdd}
                    aria-label={addLabel} title={addLabel} style={sectionAddBtn}>
              <PlusIcon />
            </button>
          </div>
          {children}
        </section>
      )}
    </div>
  );
}

/** 0件のときの1行。⚠️ 「まだありません」で終わらせず、その場で足せるようにする */
export function DetailsEmpty({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.8 }}>
      まだ{label}を登録していません。
      <button
        type="button"
        onClick={onAdd}
        style={{
          background: "none", border: "none", padding: 0, marginLeft: 6, cursor: "pointer",
          fontSize: 13, fontWeight: 600, color: "var(--royal)", fontFamily: "inherit",
          textDecoration: "underline", textUnderlineOffset: 2,
        }}
      >
        {label}を追加する
      </button>
    </p>
  );
}
