"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * ユーザーのフォローボタン。
 * 企業フォロー（CompanyDetailClient の FollowButton）と同じ挙動に揃えてある。
 *
 * ⚠️ オーナー本人には出さない。呼び出し側で viewerIsOwner を見て出し分けること。
 *    API 側でも自分自身は 400 で弾いているが、押せるボタンを出さないのが先。
 */
/** いちばん長い「フォロー中」が収まる幅（実測で決めた。2026-10-21） */
const FOLLOW_BTN_MIN_WIDTH_COMPACT = 96;
const FOLLOW_BTN_MIN_WIDTH = 116;

export function FollowUserButton({
  targetUserId,
  initialFollowed,
  isAuthenticated,
  compact = false,
  refreshOnChange = false,
  followsMe = false,
  iconOnly = false,
}: {
  /**
   * ★アイコンだけの丸いボタン（2026-10-23 / 柴さんの指示。ユーザー一覧のカード）。
   *   フォロー前 … 人＋ ／ フォロー中 … 人✓（濃紺の地） ／ つながり … 2人（濃紺の地）。状態はマウスを重ねたときの文字と読み上げで伝える
   */
  iconOnly?: boolean;
  /**
   * ★相手が自分をフォローしているか（2026-10-21）。
   *   自分もフォロー済み → 「つながり」（相互フォロー。返事待ちなしでメッセージを始められる関係）
   *   自分はまだ        → ボタンは「フォロー」のまま。マウスを乗せると「あなたをフォローしています」
   * ⚠️★「フォローし返す」と書かないこと（柴さんの判断。言葉として不自然で、幅も広がって隣のボタンがずれた）
   * ⚠️ 押したときの動き（フォローする／外す）は変えない。分からないときは渡さない（false＝従来どおり）
   */
  followsMe?: boolean;
  targetUserId: string;
  initialFollowed: boolean;
  isAuthenticated: boolean;
  /** 一覧のカードや右レールなど、行の高さが限られる場所で使う小さい版。
   *  ⚠️ 12px を下回らせないこと（LP以外の12px未満を潰す方針）。 */
  compact?: boolean;
  /**
   * ★押したあとサーバーのデータを取り直す（2026-09-20）。
   *
   * ⚠️★**同じ画面にフォロー数やフォロー関係の絞り込みがあるなら true にすること。**
   *    このボタンが持っているのは自分の見た目（`followed`）だけなので、
   *    渡さないと**数字と絞り込みがサーバーの値のまま取り残される。**
   *    実際 `/people` で「3人フォローしたのにサイドバーは 0人」が起きていた
   *    （`?rel=following` で絞っても出てこない、という形でも出る）。
   *
   * ⚠️★**既定を true にしないこと。** フィードの右レールで真にすると、
   *    フォローするたびに**投稿一覧ごと取り直される**（並びが変わりうる）。
   *    あの画面にはフォロー数も関係の絞り込みも無いので、取り直す理由が無い。
   */
  refreshOnChange?: boolean;
}) {
  const [followed, setFollowed] = useState(initialFollowed);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const toggle = async () => {
    if (!isAuthenticated) {
      router.push(`/auth?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    // 楽観更新 → 失敗したら戻す
    const next = !followed;
    setFollowed(next);
    setLoading(true);
    try {
      const res = await fetch(`/api/jobseeker/users/${targetUserId}/follow`, {
        method: next ? "POST" : "DELETE",
      });
      if (!res.ok) setFollowed(!next);
      /* ⚠️ 楽観更新した `followed` は消えない（再マウントではなく再描画なので
            `useState` の初期値は読み直されない）。取り直すのはサーバー側の
            数字と一覧だけ。 */
      else if (refreshOnChange) router.refresh();
    } catch {
      setFollowed(!next);
    } finally {
      setLoading(false);
    }
  };

  const stateLabel = followed && followsMe ? "つながり（お互いにフォローしています。押すとフォローを外します）"
    : followed ? "フォロー中（押すとフォローを外します）"
    : followsMe ? "フォロー（あなたをフォローしています）" : "フォロー";
  if (iconOnly) {
    return (
      <button type="button" onClick={toggle} disabled={loading} aria-pressed={followed} aria-label={stateLabel} title={stateLabel}
        data-state={followed && followsMe ? "connected" : followed ? "following" : followsMe ? "follow-back" : "not-following"}
        className="btn-fixed-size"
        style={{ width: 34, height: 34, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", padding: 0,
          border: `1.5px solid ${followed ? "var(--royal)" : "var(--royal-100)"}`, background: followed ? "var(--royal)" : "#fff",
          color: followed ? "#fff" : "var(--royal)", cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1, transition: "all 0.2s" }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {followed && followsMe ? (
            <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" /><circle cx="17" cy="9" r="2.8" /><path d="M16 13.6c3.1.3 5.5 2.9 5.5 6.4" /></>
          ) : (
            <><circle cx="10" cy="8" r="3.8" /><path d="M3 20c0-3.9 3.1-7 7-7 1.4 0 2.7.4 3.8 1.1" />
              {followed ? <polyline points="15.5 18 17.8 20.3 22 16" /> : <><line x1="19" y1="14.5" x2="19" y2="21.5" /><line x1="15.5" y1="18" x2="22.5" y2="18" /></>}</>
          )}
        </svg>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      aria-pressed={followed}
      data-state={followed && followsMe ? "connected" : followed ? "following" : followsMe ? "follow-back" : "not-following"}
      title={followed && followsMe ? "お互いにフォローしています（押すとフォローを外します）" : followsMe ? "あなたをフォローしています" : undefined}
      style={{
        /* ★幅を固定する（2026-10-21）。「フォロー」「フォロー中」「つながり」で幅が変わると、
              隣のメッセージボタンが行ごとにずれる。⚠️ 文言を長くするときはこの値を測り直すこと */
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: compact ? 3 : 5,
        minWidth: compact ? FOLLOW_BTN_MIN_WIDTH_COMPACT : FOLLOW_BTN_MIN_WIDTH, boxSizing: "border-box",
        padding: compact ? "5px 11px" : "8px 16px", borderRadius: 100,
        fontSize: compact ? 12 : 13, fontWeight: 700,
        flexShrink: 0, whiteSpace: "nowrap",
        border: `1.5px solid ${followed ? "var(--royal)" : "var(--line)"}`,
        background: followed ? "var(--royal-50)" : "#fff",
        color: followed ? "var(--royal)" : "var(--ink-soft)",
        cursor: loading ? "default" : "pointer",
        transition: "all 0.2s",
        opacity: loading ? 0.7 : 1,
        fontFamily: "inherit",
      }}
    >
      {followed ? (
        <>
          <svg width={compact ? 11 : 13} height={compact ? 11 : 13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {followsMe ? "つながり" : "フォロー中"}
        </>
      ) : (
        <>
          <svg width={compact ? 11 : 13} height={compact ? 11 : 13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          フォロー
        </>
      )}
    </button>
  );
}
