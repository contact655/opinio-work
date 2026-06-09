"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MapPin } from 'lucide-react';
import type { CompanyForCarousel } from '@/types/genre';
import { showToast } from '@/lib/toast';
import { addToCompare, removeFromCompare, isInCompareList } from './CompareBar';

const COMPARE_EVENT = 'opinio-compare-update';

// フェーズバッジ設定
const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  "pre-seed":   { label: "プレシード", color: "#78350f", bg: "#fff7ed" },
  seed:         { label: "シード",     color: "#78350f", bg: "#fff7ed" },
  "series-a":   { label: "Series A",  color: "#1e40af", bg: "#dbeafe" },
  "series-b":   { label: "Series B",  color: "#5b21b6", bg: "#ede9fe" },
  "series-c":   { label: "Series C",  color: "#065f46", bg: "#d1fae5" },
  "series_c":   { label: "Series C",  color: "#065f46", bg: "#d1fae5" },
  "series-d":   { label: "Series D+", color: "#064e3b", bg: "#ccfbf1" },
  growth:       { label: "成長期",    color: "#065f46", bg: "#d1fae5" },
  listed:       { label: "上場",      color: "#14532d", bg: "#dcfce7" },
  "上場":       { label: "上場",      color: "#14532d", bg: "#dcfce7" },
  unicorn:      { label: "ユニコーン", color: "#6d28d9", bg: "#ede9fe" },
  ipo:          { label: "IPO準備",   color: "#9a3412", bg: "#ffedd5" },
};

function getStageCfg(stage: string | null) {
  if (!stage) return null;
  const key = stage.toLowerCase().replace(/\s+/g, "-");
  return STAGE_CONFIG[key] ?? STAGE_CONFIG[stage] ?? { label: stage, color: "#4a5260", bg: "#f1f5f9" };
}

// 業種カラー
const INDUSTRY_COLORS: Record<string, { color: string; bg: string }> = {
  "HR Tech":       { color: "#1e40af", bg: "#dbeafe" },
  "FinTech/SaaS":  { color: "#065f46", bg: "#d1fae5" },
  "CRM":           { color: "var(--royal)", bg: "#eff3fc" },
  "CRM/SaaS":      { color: "var(--royal)", bg: "#eff3fc" },
  "AI Tech":       { color: "#6d28d9", bg: "#ede9fe" },
  "Sales Tech":    { color: "#0f766e", bg: "#ccfbf1" },
  "Med Tech":      { color: "#9a3412", bg: "#ffedd5" },
  "ConTech":       { color: "#b45309", bg: "#fef3c7" },
  "顧客コミュニケーション": { color: "#5b21b6", bg: "#ede9fe" },
};

function getIndustryStyle(industry: string | null) {
  if (!industry) return { color: "#4a5260", bg: "#f1f5f9" };
  return INDUSTRY_COLORS[industry] ?? { color: "#4a5260", bg: "#f1f5f9" };
}

export type MemberPreview = { id: string; name: string };

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

export function CompanyCardCompact({ company, compact: _compact, members: _members }: Props) {
  // ロゴエリアのグラデーション — DB の logo_gradient を優先使用
  const headerGradient = company.logo_gradient
    ?? 'linear-gradient(135deg, #001233 0%, var(--royal) 60%, #1a3569 100%)';

  const initial = company.logo_letter ?? company.name.slice(0, 1);
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
        router.push(`/auth?next=/companies/${company.id}`);
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

  const industryStyle = getIndustryStyle(company.industry);
  const stageCfg = getStageCfg(company.funding_stage);
  const articleCount = company.article_count ?? 0;

  // ── 比較機能 ─────────────────────────────────────────────────────────────────
  const [inCompare, setInCompare] = useState(false);
  useEffect(() => {
    setInCompare(isInCompareList(company.id));
    const onUpdate = () => setInCompare(isInCompareList(company.id));
    window.addEventListener(COMPARE_EVENT, onUpdate);
    return () => window.removeEventListener(COMPARE_EVENT, onUpdate);
  }, [company.id]);

  const handleCompare = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const headerGrad = company.logo_gradient ?? 'linear-gradient(135deg, #001233 0%, var(--royal) 60%, #1a3569 100%)';
    const initChar = company.logo_letter ?? company.name.slice(0, 1);
    if (inCompare) {
      removeFromCompare(company.id);
    } else {
      const added = addToCompare({ id: company.id, name: company.name, initial: initChar, gradient: headerGrad });
      if (!added) showToast('比較できるのは最大3社までです', 'warm');
    }
  }, [inCompare, company.id, company.name, company.logo_gradient, company.logo_letter]);

  return (
    <Link
      href={`/companies/${company.id}`}
      className="genre-card"
    >

      {/* ─── 横型コンパクトカード ──────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'stretch', minHeight: 96,
        background: '#fff', borderRadius: 10, overflow: 'hidden',
      }}>

        {/* 左: ブランドカラー帯 + ロゴ */}
        <div style={{
          width: 64, flexShrink: 0,
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
          {company.logo_url && !logoError ? (
            <div style={{
              width: 40, height: 40, borderRadius: 8,
              background: '#fff', border: '1px solid rgba(255,255,255,0.9)',
              boxShadow: '0 1px 6px rgba(0,0,0,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', position: 'relative', zIndex: 1,
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={company.logo_url} alt={`${company.name}のロゴ`}
                style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6, boxSizing: 'border-box' }}
                onError={() => setLogoError(true)}
              />
            </div>
          ) : (
            <span style={{
              fontSize: 24, fontWeight: 800,
              color: 'rgba(255,255,255,0.9)',
              fontFamily: 'Inter, "Noto Sans JP", sans-serif',
              lineHeight: 1, userSelect: 'none', zIndex: 1, position: 'relative',
            }}>
              {initial}
            </span>
          )}
        </div>

        {/* 右: 情報エリア */}
        <div style={{ flex: 1, minWidth: 0, padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 4 }}>

          {/* 上段: 社名 + バッジ + ブックマーク */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 14, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.3,
                letterSpacing: isEnName ? '-0.02em' : '0',
                fontFamily: isEnName ? 'Inter, sans-serif' : 'var(--font-noto-sans)',
                overflow: 'hidden', display: '-webkit-box',
                WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' as const,
              }}>
                {displayName}
              </div>
              {/* バッジ行 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
                {stageCfg && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 100,
                    background: stageCfg.bg, color: stageCfg.color,
                  }}>
                    {stageCfg.label}
                  </span>
                )}
                {company.industry && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 100,
                    background: industryStyle.bg, color: industryStyle.color,
                  }}>
                    {company.industry}
                  </span>
                )}
                {company.accepting_casual_meetings && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 100,
                    background: '#ecfdf5', color: 'var(--success)',
                    border: '1px solid #a7f3d0',
                  }}>
                    ● 面談OK
                  </span>
                )}
                {articleCount > 0 && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 100,
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
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                background: 'var(--line-soft)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0,
              }}
              aria-label={bookmarked ? 'ブックマーク解除' : 'ブックマークに追加'}
            >
              <svg width="12" height="11" viewBox="0 0 24 24"
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
              fontSize: 11, color: 'var(--ink-soft)', lineHeight: 1.4,
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' as const,
            }}>
              {company.tagline}
            </div>
          )}

          {/* 下段: メタ情報 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, overflow: 'hidden', flex: 1, minWidth: 0 }}>
              <MapPin size={10} color="#9ca3af" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 10.5, color: 'var(--ink-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {company.location ?? '—'}
              </span>
              {company.employee_count && (
                <>
                  <span style={{ color: 'var(--line)', fontSize: 10, flexShrink: 0 }}>·</span>
                  <span style={{ fontSize: 10.5, color: 'var(--ink-mute)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {company.employee_count}
                  </span>
                </>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              {/* 比較 */}
              <button onClick={handleCompare} style={{
                padding: '2px 6px', borderRadius: 4,
                background: inCompare ? 'var(--royal-50)' : 'transparent',
                color: inCompare ? 'var(--royal)' : 'var(--ink-mute)',
                border: `1px solid ${inCompare ? 'var(--royal-100)' : 'var(--line)'}`,
                fontSize: 9, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
                {inCompare ? '✓ 比較中' : '+ 比較'}
              </button>
              {/* 求人バッジ */}
              {company.job_count > 0 && (
                <span style={{
                  fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 100,
                  background: 'var(--royal-50)', color: 'var(--royal)',
                  border: '1px solid var(--royal-100)', whiteSpace: 'nowrap',
                }}>
                  求人 {company.job_count}件
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
