"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CompanyForCarousel } from '@/types/genre';
import { showToast } from '@/lib/toast';
import { getLogoLetter } from '@/lib/utils/companyLogo';
import { usableLogoUrl } from "@/lib/utils/companyLogo";

// フェーズバッジ設定
type StageCfgEntry = { label: string; color: string; bg: string; border: string; fontWeight?: number };
const STAGE_CONFIG: Record<string, StageCfgEntry> = {
  "pre-seed":       { label: "プレシード",   color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "プレシード":     { label: "プレシード",   color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "bootstrap":      { label: "ブートストラップ", color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "ブートストラップ": { label: "ブートストラップ", color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  seed:             { label: "シード",       color: "#92400E", bg: "#FEF3C7", border: "#FDE68A" },
  "シード":         { label: "シード",       color: "#92400E", bg: "#FEF3C7", border: "#FDE68A" },
  "series-a":       { label: "シリーズA",    color: "#065F46", bg: "#D1FAE5", border: "#A7F3D0" },
  "series_a":       { label: "シリーズA",    color: "#065F46", bg: "#D1FAE5", border: "#A7F3D0" },
  "シリーズA":      { label: "シリーズA",    color: "#065F46", bg: "#D1FAE5", border: "#A7F3D0" },
  "series-b":       { label: "シリーズB",    color: "#1E40AF", bg: "#DBEAFE", border: "#BFDBFE" },
  "series_b":       { label: "シリーズB",    color: "#1E40AF", bg: "#DBEAFE", border: "#BFDBFE" },
  "シリーズB":      { label: "シリーズB",    color: "#1E40AF", bg: "#DBEAFE", border: "#BFDBFE" },
  "series-c":       { label: "シリーズC",    color: "#5B21B6", bg: "#EDE9FE", border: "#DDD6FE" },
  "series_c":       { label: "シリーズC",    color: "#5B21B6", bg: "#EDE9FE", border: "#DDD6FE" },
  "シリーズC":      { label: "シリーズC",    color: "#5B21B6", bg: "#EDE9FE", border: "#DDD6FE" },
  "series-d":       { label: "シリーズD+",   color: "#991B1B", bg: "#FEE2E2", border: "#FECACA" },
  "series_d":       { label: "シリーズD+",   color: "#991B1B", bg: "#FEE2E2", border: "#FECACA" },
  "シリーズD以降":  { label: "シリーズD+",   color: "#991B1B", bg: "#FEE2E2", border: "#FECACA" },
  ipo:              { label: "IPO準備中",    color: "#991B1B", bg: "#FEE2E2", border: "#FECACA" },
  "ipo準備中":      { label: "IPO準備中",    color: "#991B1B", bg: "#FEE2E2", border: "#FECACA" },
  "IPO準備中":      { label: "IPO準備中",    color: "#991B1B", bg: "#FEE2E2", border: "#FECACA" },
  listed:           { label: "上場",         color: "#065F46", bg: "#ECFDF5", border: "#6EE7B7", fontWeight: 800 },
  "上場":           { label: "上場",         color: "#065F46", bg: "#ECFDF5", border: "#6EE7B7", fontWeight: 800 },
  unicorn:          { label: "ユニコーン",   color: "#6D28D9", bg: "#F3E8FF", border: "#C4B5FD" },
  "ユニコーン":     { label: "ユニコーン",   color: "#6D28D9", bg: "#F3E8FF", border: "#C4B5FD" },
  growth:           { label: "成長期",       color: "#065F46", bg: "#D1FAE5", border: "#A7F3D0" },
  "外資系":         { label: "🌐 外資系",    color: "#3730A3", bg: "#E0E7FF", border: "#C7D2FE" },
  "foreign":        { label: "🌐 外資系",    color: "#3730A3", bg: "#E0E7FF", border: "#C7D2FE" },
};

function getStageCfg(stage: string | null) {
  if (!stage) return null;
  const key = stage.toLowerCase().replace(/\s+/g, "-");
  return STAGE_CONFIG[key] ?? STAGE_CONFIG[stage] ?? { label: stage, color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" };
}


export type MemberPreview = { id: string; name: string; photoUrl?: string | null };

type Props = {
  company: CompanyForCarousel;
  compact?: boolean;
  members?: MemberPreview[];
};

// ── Bookmark fetch deduplication ─────────────────────────────────────────────
type BookmarkCache = { ids: Set<string>; expiresAt: number };
let _bookmarkPromise: Promise<BookmarkCache> | null = null;

function fetchCompanyBookmarks(): Promise<BookmarkCache> {
  const now = Date.now();
  if (_bookmarkPromise) return _bookmarkPromise;
  _bookmarkPromise = fetch('/api/bookmarks?target_type=company')
    .then((r) => {
      if (r.status === 401) return { ids: new Set<string>(), expiresAt: now + 60_000 };
      return r.json().then((d) => ({
        ids: new Set<string>(Array.isArray(d.ids) ? d.ids : []),
        expiresAt: now + 60_000,
      }));
    })
    .catch(() => ({ ids: new Set<string>(), expiresAt: now + 60_000 }));
  setTimeout(() => { _bookmarkPromise = null; }, 60_000);
  return _bookmarkPromise;
}

/** 法人名サフィックス除去 */
function cleanEnName(nameEn: string | null | undefined): string | null {
  if (!nameEn) return null;
  const cleaned = nameEn
    .replace(/\s+Japan\s+Co\.,?\s*Ltd\.?$/i, '')
    .replace(/\s+Co\.,?\s*Ltd\.?$/i, '')
    .replace(/\s*,\s*Inc\.?$/i, '')
    .replace(/\s+Inc\.?$/i, '')
    .replace(/\s+Corp\.?$/i, '')
    .trim();
  return cleaned || null;
}

/*
  ⚠️ 2026-08-06 に compact / members を受け取るのをやめた。どちらも使っていなかった。
     /companies の一覧は CompanyCardList に移っており、このカードの呼び出し元は
     GenreCarousel だけ。そこでは members も compact も渡していない。
     MemberPreview 型はここで export しているので型自体は残す（CompanyCardList が使う）。
*/
export function CompanyCardCompact({ company }: Props) {
  // ロゴエリアのグラデーション — DB の logo_gradient を優先使用
  const headerGradient = company.logo_gradient
    ?? 'linear-gradient(135deg, #001233 0%, var(--royal) 60%, #1a3569 100%)';

  const initial = getLogoLetter(company.logo_letter, company.name);
  const displayName = cleanEnName(company.name_en) ?? company.name;
  const isEnName = !!cleanEnName(company.name_en);
  const router = useRouter();
  const [bookmarked, setBookmarked] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const bookmarkingRef = useRef(false);

  useEffect(() => {
    fetchCompanyBookmarks().then((cache) => {
      setBookmarked(cache.ids.has(company.id));
    });
  }, [company.id]);

  const handleBookmark = useCallback(async () => {
    if (bookmarkingRef.current) return;
    bookmarkingRef.current = true;
    const prev = bookmarked;
    setBookmarked(!prev);
    try {
      const method = prev ? 'DELETE' : 'POST';
      const res = await fetch('/api/bookmarks', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: 'company', target_id: company.id }),
      });
      if (res.status === 401) {
        setBookmarked(prev);
        router.push(`/auth?next=/companies/${company.slug ?? company.id}`);
      } else if (!res.ok) {
        setBookmarked(prev);
      } else {
        if (!prev) {
          showToast(`${company.name} を気になりリストに追加しました`, 'warm');
        } else {
          showToast('気になりリストから削除しました');
        }
      }
    } catch {
      setBookmarked(prev);
    } finally {
      bookmarkingRef.current = false;
    }
  }, [bookmarked, company.id, company.name, router]);

  const stageCfg = getStageCfg(company.funding_stage);
  const articleCount = company.article_count ?? 0;


  return (
    <Link
      href={`/companies/${company.slug ?? company.id}`}
      target="_blank"
      className="genre-card"
    >

      {/* ─── 横型コンパクトカード ──────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'stretch', minHeight: 106,
        background: '#fff', borderRadius: 10, overflow: 'hidden',
      }}>

        {/* 左: ブランドカラー帯 + ロゴ */}
        <div style={{
          width: 72, flexShrink: 0,
          background: headerGradient,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* 装飾イニシャル */}
          <span style={{
            position: 'absolute', right: -4, bottom: -8,
            fontSize: 52, fontWeight: 900,
            color: 'rgba(255,255,255,0.1)',
            fontFamily: 'Inter, sans-serif', lineHeight: 1,
            userSelect: 'none', pointerEvents: 'none',
          }}>
            {initial}
          </span>
          {usableLogoUrl(company.logo_url) && !logoError ? (
            <div style={{
              width: 40, height: 40, borderRadius: 8,
              background: '#fff', border: '1px solid rgba(255,255,255,0.9)',
              boxShadow: '0 1px 6px rgba(0,0,0,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', position: 'relative', zIndex: 1,
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={usableLogoUrl(company.logo_url)!} alt={`${company.name}のロゴ`}
                style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6, boxSizing: 'border-box' }}
                onError={() => setLogoError(true)}
              />
            </div>
          ) : (
            <span style={{
              fontSize: 24, fontWeight: 800,
              color: 'rgba(255,255,255,0.9)',
              fontFamily: 'Inter, var(--font-noto), "Noto Sans JP", sans-serif',
              lineHeight: 1, userSelect: 'none', zIndex: 1, position: 'relative',
            }}>
              {initial}
            </span>
          )}
        </div>

        {/* 右: 情報エリア */}
        <div style={{ flex: 1, minWidth: 0, padding: '10px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>

          {/* 上段: 社名 + バッジ + ブックマーク */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 15, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.3,
                letterSpacing: isEnName ? '-0.02em' : '0',
                fontFamily: isEnName ? 'Inter, sans-serif' : 'var(--font-noto-sans)',
                overflow: 'hidden', display: '-webkit-box',
                WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' as const,
              }}>
                {displayName}
              </div>
              {/* バッジ行 + 比較 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4, alignItems: 'center' }}>
                {stageCfg && (
                  <span style={{
                    fontSize: 12, fontWeight: stageCfg.fontWeight ?? 700, padding: '2px 6px', borderRadius: 100,
                    background: stageCfg.bg, color: stageCfg.color, border: `1px solid ${stageCfg.border}`,
                  }}>
                    {stageCfg.label}
                  </span>
                )}
                {articleCount > 0 && (
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: '2px 6px', borderRadius: 100,
                    background: '#fef3c7', color: '#92400e',
                    border: '1px solid #fde68a',
                  }}>
                    ✍ 取材済
                  </span>
                )}
              </div>
            </div>
            {/* ブックマーク */}
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleBookmark(); }}
              style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: 'var(--line-soft)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0,
              }}
              aria-label={bookmarked ? 'ブックマーク解除' : 'ブックマークに追加'}
            >
              <svg width="13" height="12" viewBox="0 0 24 24"
                fill={bookmarked ? 'var(--warm)' : 'none'}
                stroke={bookmarked ? 'var(--warm)' : '#94a3b8'}
                strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          </div>

          {/* 中段: タグライン */}
          {company.tagline && (
            <div style={{
              fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.4,
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' as const,
            }}>
              {company.tagline}
            </div>
          )}

          {/* 下段: 面談受付中バッジ（募集中あり = 求人数 > 0） */}
          {company.job_count != null && company.job_count > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                background: 'linear-gradient(135deg, #FFF7ED, #FEF3C7)',
                color: '#C2410C', border: '1.5px solid #FDBA74',
                boxShadow: '0 1px 3px rgba(234,88,12,0.15)',
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%', background: '#EA580C',
                  animation: 'pulseDot 1.8s ease-in-out infinite', flexShrink: 0,
                }} />
                面談受付中
              </span>
              <span style={{
                fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                background: 'var(--royal-50)', color: 'var(--royal)',
                border: '1px solid var(--royal-100)',
              }}>
                求人 {company.job_count}件
              </span>
            </div>
          )}

        </div>
      </div>
    </Link>
  );
}
