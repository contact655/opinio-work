"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { MapPin, Users } from 'lucide-react';
import type { CompanyForCarousel } from '@/types/genre';
import { showToast } from '@/lib/toast';

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

// ロゴなし企業のカードヘッダーは navy グラデーションで統一
const NAVY_PLACEHOLDER = { bg: 'linear-gradient(135deg, #001233 0%, #002366 60%, #1a3569 100%)', text: 'rgba(255,255,255,0.85)' };

function getPlaceholderColor(_name: string) {
  return NAVY_PLACEHOLDER;
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

/** ワークスタイルタグ生成
 * フルリモートのみ表示（会社全体ポリシーとして成立する項目に限定）
 * ハイブリッド → 職種・求人ごとに異なるため非表示
 * 気軽に相談  → 求人掲載企業でないと成立しないため非表示
 */
function getWorkStyleTags(remoteWorkStatus: string | null | undefined) {
  const tags: { label: string; bg: string; color: string; border: string }[] = [];

  if (remoteWorkStatus) {
    const v = remoteWorkStatus.toLowerCase();
    if (v.includes('フルリモート') || v === 'remote' || v === 'full_remote' || v === 'fullremote') {
      tags.push({ label: '🏠 フルリモート', bg: '#f0f4ff', color: '#3b5fd9', border: '#dce5f7' });
    }
  }

  return tags;
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

  const foundedYear = (company as { founded_year?: number | null }).founded_year;

  const workStyleTags = getWorkStyleTags(company.remote_work_status);

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
        {/* Casual meeting badge — jobs_public=true の企業のみ表示 */}
        {company.jobs_public === true && (
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

        {/* Bookmark (heart) button — 正円 */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleBookmark(); }}
          style={{
            position: 'absolute',
            bottom: 10,
            right: 10,
            width: 30,
            height: 30,
            minWidth: 30,
            minHeight: 30,
            aspectRatio: '1 / 1',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.9)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            overflow: 'hidden',
            boxSizing: 'border-box',
            flexShrink: 0,
            lineHeight: 0,
          }}
          aria-label={bookmarked ? 'ブックマーク解除' : 'ブックマークに追加'}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill={bookmarked ? 'var(--warm)' : 'none'} stroke={bookmarked ? 'var(--warm)' : '#94a3b8'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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
          fontFamily: cleanEnName(company.name_en) ? 'Inter, sans-serif' : undefined,
        }}>
          {cleanEnName(company.name_en) ?? company.name}
        </div>
        {cleanEnName(company.name_en) && (
          <div style={{ fontSize: 10, color: 'var(--ink-mute)', marginTop: 1, lineHeight: 1.3 }}>
            {company.name}
          </div>
        )}

        {/* タグライン — 3行まで */}
        {company.tagline && (
          <div style={{
            fontSize: 12,
            color: 'var(--ink-soft)',
            lineHeight: 1.55,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical' as const,
          }}>
            {company.tagline}
          </div>
        )}

        {/* カルチャーハイライト — fit_positives[0] */}
        {company.fit_positives && company.fit_positives.length > 0 && (
          <div style={{
            fontSize: 10.5,
            color: 'var(--success)',
            background: 'var(--success-soft)',
            border: '1px solid #A7F3D0',
            borderRadius: 6,
            padding: '3px 8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            width: 'fit-content',
            maxWidth: '100%',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            fontWeight: 600,
          }}>
            <span style={{ flexShrink: 0 }}>✓</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {company.fit_positives[0]}
            </span>
          </div>
        )}

        {/* ワークスタイルタグ行 */}
        {(workStyleTags.length > 0 || (company as { avg_salary?: string | null }).avg_salary) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
            {workStyleTags.map((tag, i) => (
              <span key={i} style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 7px',
                borderRadius: 100,
                background: tag.bg,
                color: tag.color,
                border: `1px solid ${tag.border}`,
              }}>
                {tag.label}
              </span>
            ))}
            {(company as { avg_salary?: string | null }).avg_salary && (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 100,
                background: 'var(--success-soft)',
                color: 'var(--success)',
                border: '1px solid #A7F3D0',
                fontFamily: 'Inter, sans-serif',
              }}>
                💰 {(company as { avg_salary?: string | null }).avg_salary}万
              </span>
            )}
          </div>
        )}

        {/* 所在地 — 固定行（値がなくても高さ確保） */}
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 4, minHeight: 18 }}>
          <MapPin size={13} strokeWidth={1.5} color="#E24B4A" style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {company.location ?? '—'}
          </span>
          {foundedYear && (
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-mute)', flexShrink: 0, paddingLeft: 6 }}>
              {foundedYear}年創業
            </span>
          )}
        </div>

        {/* 従業員数 — 固定行（値がなくても高さ確保） */}
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 4, minHeight: 18 }}>
          <Users size={13} strokeWidth={1.5} color="#639922" style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {company.employee_count ?? '—'}
          </span>
        </div>

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
