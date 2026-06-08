"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MapPin } from 'lucide-react';
import type { CompanyForCarousel } from '@/types/genre';
import { showToast } from '@/lib/toast';

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

export function CompanyCardCompact({ company, compact, members }: Props) {
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
  const hasMembers = (company.current_member_count || 0) + (company.obog_count || 0) > 0;
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={`/companies/${company.id}`}
      className="genre-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >

      {/* ─── ロゴエリア ─────────────────────────────────────── */}
      <div style={{
        aspectRatio: compact ? '3 / 2' : '16 / 9',
        background: headerGradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12%',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}>
        {company.logo_url && !logoError ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={company.logo_url}
            alt={`${company.name}のロゴ`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              objectPosition: 'center',
              display: 'block',
            }}
            onError={() => setLogoError(true)}
          />
        ) : (
          /* ロゴなし → イニシャル文字 */
          <span style={{
            fontSize: compact ? 36 : 52,
            fontWeight: 800,
            color: 'rgba(255,255,255,0.92)',
            letterSpacing: '-0.03em',
            fontFamily: 'Inter, "Noto Sans JP", sans-serif',
            textShadow: '0 2px 12px rgba(0,0,0,0.18)',
            lineHeight: 1,
            userSelect: 'none',
          }}>
            {initial}
          </span>
        )}

        {/* 取材済みバッジ（左上） */}
        {articleCount > 0 && (
          <span style={{
            position: 'absolute', top: 8, left: 8,
            fontSize: 9.5, fontWeight: 700,
            padding: '2px 7px', borderRadius: 100,
            background: 'rgba(255,255,255,0.92)',
            color: '#92400e',
            border: '1px solid rgba(251,191,36,0.5)',
            whiteSpace: 'nowrap',
            backdropFilter: 'blur(4px)',
          }}>
            ✍️ 取材済み
          </span>
        )}

        {/* 面談OKバッジ（右上） */}
        {company.accepting_casual_meetings && (
          <span style={{
            position: 'absolute', top: 8, right: 8,
            fontSize: 9.5, fontWeight: 700,
            padding: '2px 7px', borderRadius: 100,
            background: 'rgba(255,255,255,0.92)',
            color: 'var(--success)',
            border: '1px solid rgba(16,185,129,0.4)',
            whiteSpace: 'nowrap',
            backdropFilter: 'blur(4px)',
          }}>
            ● 面談受付中
          </span>
        )}

        {/* ホバーオーバーレイ CTA */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(0,18,50,0.55) 0%, rgba(0,18,50,0.78) 100%)',
          backdropFilter: 'blur(2px)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 10,
          padding: '12px',
          opacity: hovered ? 1 : 0,
          pointerEvents: hovered ? 'auto' : 'none',
          transition: 'opacity 0.22s ease',
          zIndex: 2,
        }}>
          {/* タグライン（ホバー時に表示） */}
          {company.tagline && (
            <div style={{
              fontSize: 10.5, color: 'rgba(255,255,255,0.85)',
              textAlign: 'center', lineHeight: 1.5,
              maxWidth: '90%',
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
            }}>
              {company.tagline}
            </div>
          )}
          {/* 主CTA: 面談受付中 → orange、求人あり → royal、なければ ghost */}
          {company.accepting_casual_meetings ? (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/companies/${company.id}/casual-meeting`); }}
              style={{
                background: 'linear-gradient(135deg, #F59E0B 0%, #FB923C 100%)',
                color: '#fff', border: 'none', borderRadius: 8,
                fontSize: 12, fontWeight: 700,
                padding: '8px 18px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(245,158,11,0.45)',
                whiteSpace: 'nowrap',
                letterSpacing: '0.01em',
              }}
            >
              話を聞く →
            </button>
          ) : company.job_count > 0 ? (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/companies/${company.id}#jobs`); }}
              style={{
                background: 'linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)',
                color: '#fff', border: 'none', borderRadius: 8,
                fontSize: 12, fontWeight: 700,
                padding: '8px 18px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,35,102,0.35)',
                whiteSpace: 'nowrap',
              }}
            >
              求人 {company.job_count}件を見る →
            </button>
          ) : (
            <div style={{
              background: 'rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.92)',
              border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: 8,
              fontSize: 11.5, fontWeight: 600,
              padding: '7px 18px',
              whiteSpace: 'nowrap',
            }}>
              詳細を見る →
            </div>
          )}
        </div>

        {/* ブックマークボタン（右下） */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleBookmark(); }}
          style={{
            position: 'absolute', bottom: 8, right: 8,
            width: 28, height: 28,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.9)',
            border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 0,
            backdropFilter: 'blur(4px)',
            zIndex: 3,
          }}
          aria-label={bookmarked ? 'ブックマーク解除' : 'ブックマークに追加'}
        >
          <svg width="16" height="14" viewBox="0 0 24 24"
            fill={bookmarked ? 'var(--warm)' : 'none'}
            stroke={bookmarked ? 'var(--warm)' : '#94a3b8'}
            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      {/* ─── カード本体 ─────────────────────────────────────── */}
      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>

        {/* 業種 + フェーズ バッジ行 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, minHeight: 20 }}>
          {company.industry && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              padding: '2px 8px', borderRadius: 100,
              background: industryStyle.bg, color: industryStyle.color,
            }}>
              {company.industry}
            </span>
          )}
          {stageCfg && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              padding: '2px 8px', borderRadius: 100,
              background: stageCfg.bg, color: stageCfg.color,
            }}>
              {stageCfg.label}
            </span>
          )}
        </div>

        {/* 社名 */}
        <div>
          <div style={{
            fontSize: 18,
            fontWeight: 800,
            color: 'var(--ink)',
            lineHeight: 1.2,
            letterSpacing: isEnName ? '-0.02em' : '0',
            fontFamily: isEnName ? 'Inter, sans-serif' : 'var(--font-noto-sans)',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
          }}>
            {displayName}
          </div>
          {isEnName && (
            <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', marginTop: 3 }}>
              {company.name}
            </div>
          )}
        </div>

        {/* タグライン */}
        {company.tagline && (
          <div style={{
            fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.7,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
            flex: 1,
          }}>
            {company.tagline}
          </div>
        )}

        {/* fit_positive（カルチャーハイライト） */}
        {company.fit_positives && company.fit_positives.length > 0 && (
          <div style={{
            fontSize: 10.5, fontWeight: 600,
            color: 'var(--success)', background: 'var(--success-soft)',
            border: '1px solid #A7F3D0', borderRadius: 6,
            padding: '3px 8px',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            width: 'fit-content', maxWidth: '100%',
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
          }}>
            <span style={{ flexShrink: 0 }}>✓</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {company.fit_positives[0]}
            </span>
          </div>
        )}

        {/* ─── 下部メタ行 ──────────────────────────────────── */}
        <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--line-soft)', display: 'flex', flexDirection: 'column', gap: 6 }}>

          {/* 在籍メンバー（いる場合のみ） */}
          {hasMembers && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {members && members.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {members.slice(0, 3).map((m, i) => {
                    const colors = [
                      { bg: '#d8e6ff', text: '#1e63d8' },
                      { bg: '#e8dcf5', text: '#6b3b9e' },
                      { bg: '#d4f0e3', text: '#1f7a48' },
                    ];
                    const c = colors[i % colors.length];
                    return (
                      <div key={m.id} style={{
                        width: 20, height: 20, borderRadius: '50%',
                        background: c.bg, color: c.text,
                        fontSize: 8.5, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '2px solid #fff',
                        marginLeft: i > 0 ? -5 : 0,
                        zIndex: 3 - i, position: 'relative', flexShrink: 0,
                      }}>
                        {m.name.charAt(0)}
                      </div>
                    );
                  })}
                </div>
              )}
              <span style={{ fontSize: 10.5, color: 'var(--ink-soft)', fontWeight: 500 }}>
                {(company.current_member_count || 0) > 0 && `社員 ${company.current_member_count}名`}
                {(company.current_member_count || 0) > 0 && (company.obog_count || 0) > 0 && ' · '}
                {(company.obog_count || 0) > 0 && `OB/OG ${company.obog_count}名`}
                {' 登録中'}
              </span>
            </div>
          )}

          {/* 所在地 · 従業員数 · 募集中 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', flex: 1, minWidth: 0 }}>
              <MapPin size={12} color="#6B7280" style={{ flexShrink: 0 }} />
              <span style={{
                fontSize: 11, color: 'var(--ink-soft)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1,
              }}>
                {company.location ?? '—'}
              </span>
              {company.employee_count && (
                <>
                  <span style={{ color: 'var(--line)', fontSize: 11, flexShrink: 0 }}>·</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-soft)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {company.employee_count}
                  </span>
                </>
              )}
            </div>

            {/* 募集中バッジ */}
            {company.job_count > 0 && (
              <span style={{
                fontSize: 10.5, fontWeight: 700,
                padding: '2px 8px', borderRadius: 100,
                background: 'var(--royal-50)', color: 'var(--royal)',
                border: '1px solid var(--royal-100)',
                whiteSpace: 'nowrap', flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', gap: 3,
              }}>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--royal)', display: 'inline-block' }} />
                募集中 {company.job_count}件
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
