"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RailBox } from "@/components/feed/railKit";
import {
  CAREER_BOX_TITLE, CAREER_BOX_BODY, careerBannerHiddenUntil, isCareerBannerHidden,
  CAREER_NUDGE_EDU_BODY, CAREER_NUDGE_EDU_HREF, CAREER_NUDGE_EDU_LABEL, CAREER_NUDGE_PAST_BODY, CAREER_NUDGE_PAST_HREF, CAREER_NUDGE_PAST_LABEL,
  careerNudgeTitle, type CareerNudge,
} from "@/lib/home/homeState";

const KEY = "opinio-home-career-banner-hidden-until";
/* ★前の会社・学歴の案内は別のキー（職歴0件の案内を閉じた記録と混ぜない） */
const NUDGE_KEY = "opinio-home-career-nudge-hidden-until";

/**
 * ★職歴が0件の人への案内を出すか（2026-11-04）。×で閉じると7日間出さない（この端末の localStorage。読めなければ出す）。
 * ⚠️ 初期値で localStorage を読まない（ハイドレーションが壊れる）。マウント後に見る
 * ⚠️ 出している間は、左の列の「職歴を追加する」を出さない（FeedClient がこの値で出し分ける）
 */
export function useCareerPrompt(enabled: boolean, storageKey: string = KEY): [boolean, () => void] {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    try { setHidden(isCareerBannerHidden(localStorage.getItem(storageKey), Date.now())); } catch { /* 読めなければ出す */ }
  }, [enabled, storageKey]);
  const close = useCallback(() => {
    setHidden(true);
    try { localStorage.setItem(storageKey, String(careerBannerHiddenUntil(Date.now()))); } catch { /* 覚えられなくてもこの画面では閉じる */ }
  }, [storageKey]);
  return [enabled && !hidden, close];
}

/** ★前の会社・学歴の案内を出すか（2026-11-12）。×で7日間出さない（職歴0件の案内とは別に覚える） */
export function useCareerNudge(nudge: CareerNudge | null | undefined): [boolean, () => void] {
  return useCareerPrompt(careerNudgeTitle(nudge) !== null, NUDGE_KEY);
}

/**
 * ★前の会社・学歴の案内の箱（2026-11-12 / 柴さんの指示）。職歴0件の案内と同じ場所・同じ見た目（RailBox）。
 *   押すと /mypage の追加画面が開く（?add=past / ?add=education）。入れたら次から出ない（ホームが条件を見直す）。
 * ⚠️ %や「あと◯項目」は出さない。入れる理由（同じ会社・学校の人が見つかる）だけを添える。
 */
export function CareerNudgeBox({ nudge, onClose }: { nudge: CareerNudge; onClose: () => void }) {
  const title = careerNudgeTitle(nudge);
  if (!title) return null;
  const linkStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", minHeight: 44, marginTop: 8, padding: "7px 16px", borderRadius: 8, background: "var(--royal)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" };
  return (
    <div style={{ position: "relative" }} data-state="home-career-nudge-box">
      <RailBox title={title} state="home-career-nudge">
        <div style={{ display: "grid", gap: 12 }}>
          {nudge.pastJob && (
            <div data-state="home-career-nudge-past">
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: "var(--ink)" }}>{CAREER_NUDGE_PAST_BODY}</p>
              <Link href={CAREER_NUDGE_PAST_HREF} data-action="home-add-past-experience" style={linkStyle}>{CAREER_NUDGE_PAST_LABEL}</Link>
            </div>
          )}
          {nudge.education && (
            <div data-state="home-career-nudge-edu">
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: "var(--ink)" }}>{CAREER_NUDGE_EDU_BODY}</p>
              <Link href={CAREER_NUDGE_EDU_HREF} data-action="home-add-education" style={linkStyle}>{CAREER_NUDGE_EDU_LABEL}</Link>
            </div>
          )}
        </div>
      </RailBox>
      <button type="button" onClick={onClose} aria-label="閉じる（7日間表示しません）" data-action="home-career-nudge-close" className="btn-fixed-size"
        style={{ position: "absolute", top: 10, right: 10, width: 28, height: 28, border: "none", background: "none", color: "var(--ink-soft)", fontSize: 18, lineHeight: 1, cursor: "pointer", borderRadius: 6 }}>
        ×
      </button>
    </div>
  );
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
