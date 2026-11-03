"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RailBox } from "@/components/feed/railKit";
import { CAREER_BOX_TITLE, CAREER_BOX_BODY, careerBannerHiddenUntil, isCareerBannerHidden } from "@/lib/home/homeState";

const KEY = "opinio-home-career-banner-hidden-until";

/**
 * ★職歴が0件の人への案内を出すか（2026-11-04）。×で閉じると7日間出さない（この端末の localStorage。読めなければ出す）。
 * ⚠️ 初期値で localStorage を読まない（ハイドレーションが壊れる）。マウント後に見る
 * ⚠️ 出している間は、左の列の「職歴を追加する」を出さない（FeedClient がこの値で出し分ける）
 */
export function useCareerPrompt(enabled: boolean): [boolean, () => void] {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    try { setHidden(isCareerBannerHidden(localStorage.getItem(KEY), Date.now())); } catch { /* 読めなければ出す */ }
  }, [enabled]);
  const close = useCallback(() => {
    setHidden(true);
    try { localStorage.setItem(KEY, String(careerBannerHiddenUntil(Date.now()))); } catch { /* 覚えられなくてもこの画面では閉じる */ }
  }, []);
  return [enabled && !hidden, close];
}

/**
 * ★職歴の案内の箱（2026-11-04 に中央の帯から右の列の一番上の箱へ。スマホはページの一番上に同じ箱）。
 *   見た目は右の列のほかの箱と同じ（RailBox）。
 */
export function CareerPromptBox({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position: "relative" }} data-state="home-career-box">
      <RailBox title={CAREER_BOX_TITLE} state="home-career-prompt">
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: "var(--ink)" }}>{CAREER_BOX_BODY}</p>
        <Link href="/mypage?add=career" data-action="home-add-experience"
          style={{ display: "inline-block", marginTop: 12, padding: "7px 16px", borderRadius: 8, background: "var(--royal)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
          職歴を入れる
        </Link>
      </RailBox>
      <button type="button" onClick={onClose} aria-label="閉じる（7日間表示しません）" data-action="home-career-banner-close" className="btn-fixed-size"
        style={{ position: "absolute", top: 10, right: 10, width: 28, height: 28, border: "none", background: "none", color: "var(--ink-soft)", fontSize: 18, lineHeight: 1, cursor: "pointer", borderRadius: 6 }}>
        ×
      </button>
    </div>
  );
}
