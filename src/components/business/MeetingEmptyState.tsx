import Link from "next/link";

/**
 * ★受付状態（2026-10-08）。空状態の文言を出し分けるためだけに使う。
 * ⚠️ `accepting` が null ＝ 取得できなかった。**「受け付けていない」と読まない。**
 */
export type MeetingAcceptance = {
  /** `ow_companies.accepting_casual_meetings`。取れなければ null */
  accepting: boolean | null;
  /** 企業ページが見えるか（`is_published`）。見えなければ申込フォームにも辿り着けない */
  pageVisible: boolean;
};

type Props = {
  isSearch?: boolean;
  /** "pending" タブで総件数 0 の場合: カジュアル面談の受け付け案内を表示 */
  isAllEmpty?: boolean;
  acceptance?: MeetingAcceptance | null;
};

/**
 * ★空状態の案内文（2026-10-08）。**受付状態と公開状態の2つ**で決める。
 * ⚠️★それまでは受付状態を受け取っておらず、**受付中の会社にも
 *    「『カジュアル面談を受け付ける』を有効にすると…」と出していた**（Third Box で実際に起きた）。
 * ⚠️★「受付中だがページ非公開」を必ず分けること。この組み合わせでは申込フォームが 404 で、
 *    **待っても1件も届かない。** 「待てば来ます」と読ませない。
 */
export function meetingEmptyMessage(a: MeetingAcceptance | null | undefined): string {
  if (!a || a.accepting === null) {
    return "申込が届くと、ここに表示されます。";
  }
  if (a.accepting && !a.pageVisible) {
    return "カジュアル面談は受付中ですが、企業ページが非公開のため、いまは申込が届きません。掲載が始まると、企業ページから申込が届くようになります。";
  }
  if (a.accepting) {
    return "カジュアル面談は受付中です。候補者が企業ページから申し込むと、ここに届きます。";
  }
  return "カジュアル面談の受付を一時停止しています。設定タブで「受付中」にすると、候補者からの申込が届くようになります。";
}

export function MeetingEmptyState({ isSearch, isAllEmpty, acceptance }: Props) {
  if (isSearch) {
    return (
      <div style={{
        padding: "48px 20px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/>
          <path d="M21 21l-4.3-4.3"/>
        </svg>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)" }}>
          検索結果がありません
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.6 }}>
          別のキーワードで検索してみてください
        </div>
      </div>
    );
  }

  if (isAllEmpty) {
    return (
      <div style={{
        padding: "40px 24px 48px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0,
      }}>
        <div style={{
          width: 64, height: 64,
          background: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
          borderRadius: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 18,
          boxShadow: "0 0 0 6px rgba(245,158,11,0.07)",
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--warm-ink)" strokeWidth="1.5" strokeLinecap="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <div style={{
          fontSize: 15,
          fontFamily: "var(--font-noto-serif)",
          fontWeight: 600,
          color: "var(--ink)",
          marginBottom: 10,
        }}>
          まだカジュアル面談の申込がありません
        </div>
        <div style={{
          fontSize: 12,
          color: "var(--ink-soft)",
          lineHeight: 1.8,
          maxWidth: 280,
          marginBottom: 20,
        }}>
          {meetingEmptyMessage(acceptance)}
        </div>
        <Link
          href="/biz/company"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "9px 16px",
            background: "var(--royal-50)",
            border: "1px solid var(--royal-100)",
            color: "var(--royal)",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            textDecoration: "none",
            transition: "all 0.15s",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
          </svg>
          企業設定を確認する
        </Link>
      </div>
    );
  }

  return (
    <div style={{
      padding: "48px 20px",
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 10,
    }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="1.5" strokeLinecap="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)" }}>
        該当する申込はありません
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.6 }}>
        ステータスを切り替えて確認してください
      </div>
    </div>
  );
}
