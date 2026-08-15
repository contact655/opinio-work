"use client";

import { visibilityLine } from "@/lib/constants/profileVisibility";

/**
 * 右カラムに常設する「公開プロフィールを見る」カード。
 *
 * ⚠️ **非公開でも隠さない。** 隠すと「自分のページが今どう見えているか」を
 *    確かめる手段が消える。代わりに**現在の公開範囲を1行で添える**。
 * ⚠️ 一文は `visibilityLine()`（= 設定画面のラジオと同じ定義）から出す。
 *    ここに文言を直書きしない。
 */
export function PublicProfileLinkCard({
  userId,
  visibility,
}: {
  /** ow_users.id。公開プロフィールは /u/[id] */
  userId: string | null | undefined;
  /** ow_users.visibility */
  visibility: string | null | undefined;
}) {
  return (
    <div style={{
      background: "var(--bg-tint)",
      border: "1px solid var(--line-soft)",
      borderRadius: 12,
      padding: "14px 16px",
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>企業からの見え方</div>
      <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", margin: "4px 0 0", lineHeight: 1.6 }}>
        {visibilityLine(visibility)}
      </p>
      {userId && (
        <a
          href={`/u/${userId}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: 10,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "8px 12px", borderRadius: 8,
            border: "1px solid var(--line)", background: "#fff",
            fontSize: 12, fontWeight: 700, color: "var(--royal)", textDecoration: "none",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          公開プロフィールを見る
        </a>
      )}
    </div>
  );
}
