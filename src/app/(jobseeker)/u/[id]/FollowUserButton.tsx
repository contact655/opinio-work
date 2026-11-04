"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { followCardView, FOLLOW_SAVE_ERROR } from "@/lib/people/followButton";

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
/** ★右の列の行の操作（rail）。「フォローする」（12px・アイコン付き・左右の余白4px）が収まる固定幅（2026-11-04 に実測。中身は93px）。
 *   押して「フォロー中」に変わっても幅が変わらず、隣の「×」がずれない */
const FOLLOW_BTN_WIDTH_RAIL = 94;

export function FollowUserButton({
  targetUserId,
  initialFollowed,
  isAuthenticated,
  compact = false,
  refreshOnChange = false,
  followsMe = false,
  card = false,
  rail = false,
}: {
  /**
   * ★ホームの右の列の行の操作（2026-11-04 / 柴さんの指示。フォロー中のユーザーは行の右端、おすすめのユーザーは3行目）。見た目は card と同じ（枠線「フォローする」／グレー「フォロー中」・アイコン付き）で、
   *   高さ 28px・幅は「フォローする」が収まる固定幅（押して文言が変わっても行がずれない）。
   *   押すと確認なしで切り替え、保存に失敗したら元に戻して下にエラーを出す（card と同じ）。
   * ⚠️ 行はその場では消さない。次に読み込んだときに一覧の中身が変わる
   */
  rail?: boolean;
  /**
   * ★ユーザー一覧（/people）のカード用。アイコン＋文字（2026-11-03 / 柴さんの指示。それまでは iconOnly）。
   *   フォロー前 … 枠線「フォローする」 ／ フォロー後 … グレー「フォロー中」（押すと確認なしで外す）。
   *   保存に失敗したら元に戻し、ボタンの下にエラーを出す。文言は lib/people/followButton.ts
   * ⚠️ 幅は親に合わせて伸びる（width: 100%）。カードの幅（スマホで 117px）で折り返さないよう 12px・余白は小さめ
   */
  card?: boolean;
  /* ⚠️ アイコンだけの丸いボタン（iconOnly。2026-10-23）は 2026-11-03 に外した。つながり申請と見分けがつかなかったため。card を使う */
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
  const [saveError, setSaveError] = useState(false);
  const router = useRouter();

  const toggle = async () => {
    if (!isAuthenticated) {
      router.push(`/auth?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    // 楽観更新 → 失敗したら戻す
    const next = !followed;
    setFollowed(next);
    setSaveError(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/jobseeker/users/${targetUserId}/follow`, {
        method: next ? "POST" : "DELETE",
      });
      if (!res.ok) {
        setFollowed(!next);
        setSaveError(true);
      }
      /* ⚠️ 楽観更新した `followed` は消えない（再マウントではなく再描画なので
            `useState` の初期値は読み直されない）。取り直すのはサーバー側の
            数字と一覧だけ。 */
      else if (refreshOnChange) router.refresh();
    } catch {
      setFollowed(!next);
      setSaveError(true);
    } finally {
      setLoading(false);
    }
  };

  if (card || rail) {
    const v = followCardView(followed, followsMe);
    return (
      <span style={{ display: "flex", flexDirection: "column", alignItems: "stretch", width: rail ? FOLLOW_BTN_WIDTH_RAIL : "100%", minWidth: 0, flexShrink: rail ? 0 : undefined }}>
        <button type="button" onClick={toggle} disabled={loading} aria-pressed={followed} title={v.title} aria-label={v.title}
          data-state={followed ? "card-following" : "card-not-following"}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
            width: "100%", minWidth: 0, boxSizing: "border-box", height: rail ? 28 : 34, ...(rail ? { minHeight: 0 } : {}), padding: rail ? "0 4px" : "0 8px", borderRadius: 100,
            fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", fontFamily: "inherit",
            border: `1.5px solid ${v.tone === "outline" ? "var(--royal)" : "var(--line)"}`,
            background: v.tone === "outline" ? "#fff" : "var(--line-soft)",
            color: v.tone === "outline" ? "var(--royal)" : "var(--ink-soft)",
            cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1, transition: "all 0.15s",
          }}>
          <svg width={rail ? 11 : 12} height={rail ? 11 : 12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
            {followed ? <polyline points="20 6 9 17 4 12" /> : <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>}
          </svg>
          {v.label}
        </button>
        {saveError && (
          <span role="alert" data-state="follow-save-error" style={{ marginTop: 4, fontSize: 11.5, lineHeight: 1.4, color: "var(--error, #b91c1c)", textAlign: "center" }}>
            {FOLLOW_SAVE_ERROR}
          </span>
        )}
      </span>
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
