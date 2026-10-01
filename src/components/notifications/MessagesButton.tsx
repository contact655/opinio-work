"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageSquare } from "lucide-react";
import Link from "next/link";

/**
 * ★ヘッダーのメッセージ（2026-10-01 / 柴さんの指示。ベルの左）。
 *
 * ── 2026-09-15 に一度外したものを戻した ────────────────────────────────────
 * あのときの判断は「**戻すなら未読バッジを一緒に作ること**」で、理由は3つだった:
 *   ・`ow_conversation_messages` が 0件
 *   ・**バッジが無く、届いたことを伝えられない**
 *   ・**メッセージ受信で通知も作っていない** ＝ ベルでも気づけない
 * ⇒ 2026-09-16 に受信通知（ベル）が入り、今回**未読バッジ**を付けたので条件は満たした。
 *
 * ⚠️★**バッジを外さないこと。** 外すと「空のページへ行く、文字のない二つ目の入口」に戻る。
 *    外すくらいならアイコンごと外す。
 *
 * ⚠️★**数え方は `/api/jobseeker/conversations/unread` → `lib/conversations/unread` の1箇所。**
 *    ここで別の数え方を書かないこと（`/mypage` のサイドバーと一覧のドットが同じ式）。
 * ⚠️ 数えるのは**会話数**（通数ではない）。一覧のドットと粒度を揃えてある。
 *
 * ⚠️ 既読にするのは**会話を開いたとき**（`/mypage/conversations/[id]` が `last_read_at` を書く）。
 *    ベルのように「開いたら全部既読」にしないこと —— 読んでいないものが消える。
 *
 * ⚠️★**1通も無いうちはアイコンごと出さない**（2026-10-01 / 柴さんの指示）。
 *    本番の `ow_conversation_messages` は 2026-10-01 時点で **0件**で、
 *    出しても「まだ対話がありません」に着くだけだった（2026-09-15 に外した3つ目の理由）。
 *    ⚠️ 判定は `hasMessages`（**未読ではない**。自分が送った1通でも出る）。
 *    ⚠️★**取得前も出さない。** 一瞬出てから消えるより、出ないまま増えるほうがよい。
 *    ⚠️ 1通入れば次にページへ戻った時点で出る（`focus` で取り直す）。
 *       それまでに届いたことは**ベルの通知**が伝える（2026-09-16）。
 */
export function MessagesButton() {
  const [unread, setUnread] = useState(0);
  /** 会話に1通でもあるか。⚠️ 取得前は false ＝ 出さない */
  const [hasMessages, setHasMessages] = useState(false);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/jobseeker/conversations/unread");
      if (!res.ok) return;
      const data = await res.json();
      setUnread(data.conversations ?? 0);
      setHasMessages(data.hasMessages === true);
    } catch {
      /* ⚠️ 握り潰してよい唯一の理由: バッジは主役ではなく、出なくても入口は押せる。
            ⚠️ 数え方の失敗はサーバー側（lib/conversations/unread）がログに出す。 */
    }
  }, []);

  /* マウント時 + ページに戻ってきたときに取り直す（ベルと同じ）。
     ⚠️ ポーリングしない。常設のヘッダーなので、全ページで定期的に叩くことになる。 */
  useEffect(() => {
    fetchUnread();
    const onFocus = () => fetchUnread();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchUnread]);

  /* ⚠️★ここで `unread > 0` を条件にしないこと。読み終えた会話へ戻れなくなる。 */
  if (!hasMessages) return null;

  return (
    <Link
      href="/mypage/conversations"
      aria-label={unread > 0 ? `メッセージ（未読 ${unread} 件）` : "メッセージ"}
      title="メッセージ"
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: "transparent",
        color: "var(--ink-soft)",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tint)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <MessageSquare size={18} />
      {/* ⚠️ 見た目はベルのバッジと**同じ**にしてある。隣り合うので、
             片方だけ色や大きさを変えないこと。 */}
      {unread > 0 && (
        <span
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            minWidth: 16,
            height: 16,
            borderRadius: 100,
            background: "#DC2626",
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "var(--font-inter), var(--font-noto)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 3px",
            lineHeight: 1,
            border: "1.5px solid #fff",
          }}
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
