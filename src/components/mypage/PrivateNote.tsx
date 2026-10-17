/**
 * ★「あなたにだけ表示されています」（2026-10-17 / LinkedIn の「この情報はご本人以外には公開されません」を参考に）。
 *
 * /mypage の、本人にしか見えないカード（届いているもの・前職の促し・会社についての質問）の見出しの下に置く。
 * 公開プロフィールの一部と見分けがつくようにするため。
 * ⚠️ 他の人や企業に見える項目には付けないこと（転職意欲は企業の候補者検索に使われるので付けていない）。
 */
export function PrivateNote() {
  return (
    <div
      data-private-note
      style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 500, color: "var(--ink-mute)", lineHeight: 1.5 }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      あなたにだけ表示されています
    </div>
  );
}
