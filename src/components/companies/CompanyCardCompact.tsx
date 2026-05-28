"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { MapPin, Users } from 'lucide-react';
import type { CompanyForCarousel } from '@/types/genre';

// Funding stage → display label + color
const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  "pre-seed":  { label: "Pre-Seed",   color: "#6b5b2e", bg: "#fef9e7" },
  seed:        { label: "Seed",       color: "#6b5b2e", bg: "#fef9e7" },
  "series-a":  { label: "Series A",   color: "#1e63d8", bg: "#dbeafe" },
  "series-b":  { label: "Series B",   color: "#6b3b9e", bg: "#ede9fe" },
  "series-c":  { label: "Series C",   color: "#0f766e", bg: "#d1fae5" },
  "series-d":  { label: "Series D+",  color: "#0f766e", bg: "#d1fae5" },
  growth:      { label: "成長期",     color: "#0f766e", bg: "#d1fae5" },
  listed:      { label: "上場",       color: "#1f7a48", bg: "#d4f0e3" },
  ipo:         { label: "IPO準備",    color: "#b45309", bg: "#fef3c7" },
};

function getStageCfg(stage: string | null) {
  if (!stage) return null;
  const key = stage.toLowerCase().replace(/\s+/g, "-");
  return STAGE_CONFIG[key] ?? { label: stage, color: "#4a5260", bg: "#f1f5f9" };
}

export type MemberPreview = { id: string; name: string };

type Props = {
  company: CompanyForCarousel;
  compact?: boolean;
  members?: MemberPreview[];
};

// ── Bookmark fetch deduplication ─────────────────────────────────────────────
// 同一ページの複数カードが同じAPIを叩かないように、module-level Promise キャッシュを使う
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
  // 60秒後にキャッシュをクリア
  setTimeout(() => { _bookmarkPromise = null; }, 60_000);
  return _bookmarkPromise;
}

// モックと同じ6色パステル（企業名のハッシュで決定論的に選択）
const PLACEHOLDER_COLORS = [
  { bg: '#d4f0e3', text: '#1f7a48' }, // green
  { bg: '#fce8b8', text: '#8b5e0f' }, // yellow
  { bg: '#fcd5dc', text: '#a8324a' }, // pink
  { bg: '#d8e6ff', text: '#1e63d8' }, // blue
  { bg: '#e8dcf5', text: '#6b3b9e' }, // purple
  { bg: '#f5f7fa', text: '#5b6471' }, // gray
];

function getPlaceholderColor(name: string) {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PLACEHOLDER_COLORS[hash % PLACEHOLDER_COLORS.length];
}


export function CompanyCardCompact({ company, compact, members }: Props) {
  const ph = getPlaceholderColor(company.name);
  const initial = company.logo_letter ?? company.name.slice(0, 1);
  const router = useRouter();
  const [bookmarked, setBookmarked] = useState(false);
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
      }
    } catch {
      setBookmarked(prev);
    } finally {
      bookmarkingRef.current = false;
    }
  }, [bookmarked, company.id, router]);

  // メタ: 所在地 ・ 従業員数
  type MetaItem = { icon?: React.ReactNode; label: string };
  const metaItems: MetaItem[] = [];
  if (company.location)
    metaItems.push({ icon: <MapPin size={14} strokeWidth={1.5} color="#E24B4A" />, label: company.location });
  if (company.employee_count)
    metaItems.push({ icon: <Users size={14} strokeWidth={1.5} color="#639922" />, label: company.employee_count });

  return (
    <Link href={`/companies/${company.id}`} className="genre-card">
      {/* ロゴエリア — 16:10 アスペクト比（compact時は 2:1） */}
      <div style={{
        aspectRatio: compact ? '2 / 1' : '16 / 10',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: company.logo_url ? '#f5f7fa' : ph.bg,
        overflow: 'hidden',
        position: 'relative',
      }}>
        {company.logo_url ? (
          <Image
            src={company.logo_url}
            alt={`${company.name}のロゴ`}
            fill
            style={{ objectFit: 'contain', padding: '12%' }}
            sizes="(max-width: 640px) 80vw, (max-width: 1024px) 40vw, (max-width: 1280px) 33vw, 20vw"
          />
        ) : (
          <span style={{
            fontSize: compact ? 32 : 44,
            fontWeight: 700,
            color: ph.text,
            letterSpacing: '-0.02em',
            opacity: 0.8,
          }}>
            {initial}
          </span>
        )}
        {/* Casual meeting badge */}
        {company.accepting_casual_meetings && (
          <span style={{
            position: 'absolute',
            top: 8,
            right: 8,
            fontSize: 9.5,
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: 100,
            background: 'rgba(255,255,255,0.9)',
            color: '#d97706',
            border: '1px solid rgba(217,119,6,0.3)',
            whiteSpace: 'nowrap',
          }}>
            面談OK
          </span>
        )}
        {/* Bookmark (heart) button */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleBookmark(); }}
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.9)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
          }}
          aria-label={bookmarked ? 'ブックマーク解除' : 'ブックマークに追加'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={bookmarked ? 'var(--warm)' : 'none'} stroke={bookmarked ? 'var(--warm)' : '#94a3b8'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      {/* カード本体 */}
      <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* 業種 + フェーズ バッジ行 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {company.industry && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              padding: '2px 8px', borderRadius: 100,
              background: 'var(--royal-50)', color: 'var(--royal)',
              border: '1px solid var(--royal-100)',
            }}>
              {company.industry}
            </span>
          )}
          {(() => {
            const cfg = getStageCfg(company.funding_stage);
            if (!cfg) return null;
            return (
              <span style={{
                fontSize: 10, fontWeight: 700,
                padding: '2px 8px', borderRadius: 100,
                background: cfg.bg, color: cfg.color,
              }}>
                {cfg.label}
              </span>
            );
          })()}
        </div>

        {/* 社名 */}
        <div style={{
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--ink)',
          lineHeight: 1.35,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
        }}>
          {company.name}
        </div>

        {/* タグライン */}
        {company.tagline && (
          <div style={{
            fontSize: 12,
            color: 'var(--ink-soft)',
            lineHeight: 1.55,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
          }}>
            {company.tagline}
          </div>
        )}

        {/* メタ情報 */}
        {metaItems.length > 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0 }}>
            {metaItems.map((item, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {i > 0 && <span style={{ color: 'var(--ink-mute)', margin: '0 5px' }}>·</span>}
                {item.icon}
                {item.label}
              </span>
            ))}
          </div>
        )}

        {/* Member avatar strip */}
        {members && members.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", marginBottom: 2 }}>
            {members.slice(0, 4).map((m, i) => {
              const avatarColors = [
                { bg: "#d8e6ff", text: "#1e63d8" },
                { bg: "#e8dcf5", text: "#6b3b9e" },
                { bg: "#d4f0e3", text: "#1f7a48" },
                { bg: "#fce8b8", text: "#8b5e0f" },
              ];
              const c = avatarColors[i % avatarColors.length];
              return (
                <div key={m.id} style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: c.bg, color: c.text,
                  fontSize: 9, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "2px solid #fff",
                  marginLeft: i > 0 ? -6 : 0,
                  zIndex: members.length - i,
                  position: "relative",
                  flexShrink: 0,
                }}>
                  {m.name.charAt(0)}
                </div>
              );
            })}
            {members.length > 4 && (
              <div style={{
                width: 22, height: 22, borderRadius: "50%",
                background: "var(--line)", color: "var(--ink-mute)",
                fontSize: 8, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "2px solid #fff",
                marginLeft: -6, zIndex: 0, position: "relative", flexShrink: 0,
              }}>
                +{members.length - 4}
              </div>
            )}
            <span style={{ marginLeft: 6, fontSize: 10, color: "var(--ink-mute)" }}>
              在籍
            </span>
          </div>
        )}

        {/* Opinio 登録者数 + 募集中バッジ */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 2 }}>
          {(company.current_member_count > 0 || company.obog_count > 0) ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11, fontWeight: 600,
              padding: '3px 8px', borderRadius: 6,
              background: '#f0fdf4', border: '1px solid #bbf7d0',
            }}>
              <Users size={11} strokeWidth={2} color="#16a34a" />
              <span style={{ color: '#15803d' }}>
                社員 {company.current_member_count}名
                {company.obog_count > 0 && <span style={{ color: '#16a34a', fontWeight: 500 }}> + OB {company.obog_count}名</span>}
              </span>
            </div>
          ) : (
            <div />
          )}
          {company.job_count > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 700,
              padding: '2px 8px', borderRadius: 100,
              background: 'var(--royal-50)', color: 'var(--royal)',
              border: '1px solid var(--royal-100)',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--royal)', display: 'inline-block' }} />
              募集中 {company.job_count}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
