"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CAREER_BANNER_TEXT, careerBannerHiddenUntil, isCareerBannerHidden } from "@/lib/home/homeState";

const KEY = "opinio-home-career-banner-hidden-until";

/**
 * ★職歴が0件の人に出す1行の帯（2026-11-04 / 柴さんの指示。それまでは大きな箱）。×で閉じると7日間出さない。
 * ⚠️ 閉じた記録はこの端末の localStorage だけ（読めなければ出す）。サーバーには残さない
 * ⚠️ サーバーの描画では出しておき、マウント後に閉じた記録を見て消す（初期値で localStorage を読むとハイドレーションが壊れる）
 */
export default function HomeCareerBanner() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try { setHidden(isCareerBannerHidden(localStorage.getItem(KEY), Date.now())); } catch { /* 読めなければ出す */ }
  }, []);
  if (hidden) return null;
  const close = () => {
    setHidden(true);
    try { localStorage.setItem(KEY, String(careerBannerHiddenUntil(Date.now()))); } catch { /* 覚えられなくてもこの画面では閉じる */ }
  };
  return (
    <div data-state="home-career-banner" className="home-career-banner">
      <span className="home-career-banner-text">{CAREER_BANNER_TEXT}</span>
      <Link href="/mypage?add=career" data-action="home-add-experience" className="home-career-banner-btn">職歴を入れる</Link>
      <button type="button" onClick={close} aria-label="閉じる（7日間表示しません）" data-action="home-career-banner-close" className="home-career-banner-close btn-fixed-size">×</button>
      <style>{`
        .home-career-banner { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 10px 12px; border: 1px solid var(--royal-100); border-radius: 12px; background: var(--royal-50); }
        .home-career-banner-text { flex: 1 1 auto; min-width: 0; font-size: 13px; line-height: 1.5; color: var(--ink); }
        .home-career-banner-btn { flex: 0 0 auto; padding: 7px 14px; border-radius: 8px; background: var(--royal); color: #fff; font-size: 13px; font-weight: 700; text-decoration: none; white-space: nowrap; }
        .home-career-banner-close { flex: 0 0 auto; width: 28px; height: 28px; border: none; background: none; color: var(--ink-soft); font-size: 18px; line-height: 1; cursor: pointer; border-radius: 6px; }
        @media (max-width: 767px) { .home-career-banner { flex-wrap: wrap; } .home-career-banner-text { flex-basis: calc(100% - 40px); } }
      `}</style>
    </div>
  );
}
