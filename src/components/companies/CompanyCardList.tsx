"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import type { CompanyForCarousel } from "@/types/genre";
import type { MemberPreview } from "./CompanyCardCompact";
import { showToast } from "@/lib/toast";
import { addToCompare, removeFromCompare, isInCompareList } from "./CompareBar";

const COMPARE_EVENT = "opinio-compare-update";

// ── フェーズバッジ設定（CompanyCardCompactと統一）──────────────────────────────
const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  "pre-seed":  { label: "プレシード", color: "#78350f", bg: "#fff7ed" },
  seed:        { label: "シード",     color: "#78350f", bg: "#fff7ed" },
  "series-a":  { label: "Series A",  color: "#1e40af", bg: "#dbeafe" },
  "series-b":  { label: "Series B",  color: "#5b21b6", bg: "#ede9fe" },
  "series-c":  { label: "Series C",  color: "#065f46", bg: "#d1fae5" },
  "series_c":  { label: "Series C",  color: "#065f46", bg: "#d1fae5" },
  "series-d":  { label: "Series D+", color: "#064e3b", bg: "#ccfbf1" },
  growth:      { label: "成長期",    color: "#065f46", bg: "#d1fae5" },
  listed:      { label: "上場",      color: "#14532d", bg: "#dcfce7" },
  "上場":      { label: "上場",      color: "#14532d", bg: "#dcfce7" },
  unicorn:     { label: "ユニコーン", color: "#6d28d9", bg: "#ede9fe" },
  ipo:         { label: "IPO準備",   color: "#9a3412", bg: "#ffedd5" },
};

function getStageCfg(stage: string | null) {
  if (!stage) return null;
  const key = stage.toLowerCase().replace(/\s+/g, "-");
  return STAGE_CONFIG[key] ?? STAGE_CONFIG[stage] ?? { label: stage, color: "#4a5260", bg: "#f1f5f9" };
}

/** 法人名サフィックス除去 */
function cleanEnName(nameEn: string | null | undefined): string | null {
  if (!nameEn) return null;
  const cleaned = nameEn
    .replace(/\s+Japan\s+Co\.,?\s*Ltd\.?$/i, "")
    .replace(/\s+Co\.,?\s*Ltd\.?$/i, "")
    .replace(/\s*,\s*Inc\.?$/i, "")
    .replace(/\s+Inc\.?$/i, "")
    .replace(/\s+Corp\.?$/i, "")
    .trim();
  return cleaned || null;
}

/** 更新日を「N日前」に変換 */
function updatedAgo(updatedAt: string | null | undefined): string | null {
  if (!updatedAt) return null;
  const diff = Date.now() - new Date(updatedAt).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "今日更新";
  if (days < 30) return `${days}日前更新`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}ヶ月前更新`;
  return `${Math.floor(months / 12)}年前更新`;
}

/** メンバーアバター（初期文字ベース） */
function MemberAvatar({ name, size = 24 }: { name: string; size?: number }) {
  const initial = name.slice(0, 1);
  // 名前ハッシュでグラデーション色を決める
  const hue = Array.from(name).reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: `hsl(${hue},60%,50%)`,
      border: "2px solid #fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size * 0.42,
      fontWeight: 700,
      color: "#fff",
      flexShrink: 0,
      marginLeft: -6,
    }}>
      {initial}
    </div>
  );
}

// ── Bookmark fetch deduplication（CompanyCardCompactと共有） ──────────────────
type BookmarkCache = { ids: Set<string>; expiresAt: number };
let _listBookmarkPromise: Promise<BookmarkCache> | null = null;

function fetchListBookmarks(): Promise<BookmarkCache> {
  const now = Date.now();
  if (_listBookmarkPromise) return _listBookmarkPromise;
  _listBookmarkPromise = fetch("/api/bookmarks?target_type=company")
    .then((r) => {
      if (r.status === 401) return { ids: new Set<string>(), expiresAt: now + 60_000 };
      return r.json().then((d) => ({
        ids: new Set<string>(Array.isArray(d.ids) ? d.ids : []),
        expiresAt: now + 60_000,
      }));
    })
    .catch(() => ({ ids: new Set<string>(), expiresAt: now + 60_000 }));
  setTimeout(() => { _listBookmarkPromise = null; }, 60_000);
  return _listBookmarkPromise;
}

type Props = {
  company: CompanyForCarousel;
  members?: MemberPreview[];
  compact?: boolean;  // compact=true: 縦カード（2列グリッド）/ false: 横カード（リスト）
};

export function CompanyCardList({ company, members = [], compact }: Props) {
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);
  const bookmarkingRef = useRef(false);

  // 初期ブックマーク状態をロード
  useEffect(() => {
    fetchListBookmarks().then((cache) => {
      setBookmarked(cache.ids.has(company.id));
    });
  }, [company.id]);

  // ── 比較機能 ───────────────────────────────────────────────────────────────
  const [inCompare, setInCompare] = useState(false);
  useEffect(() => {
    setInCompare(isInCompareList(company.id));
    const onUpdate = () => setInCompare(isInCompareList(company.id));
    window.addEventListener(COMPARE_EVENT, onUpdate);
    return () => window.removeEventListener(COMPARE_EVENT, onUpdate);
  }, [company.id]);

  const handleCompare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const grad = company.logo_gradient ?? "linear-gradient(135deg, #001233 0%, #002366 60%, #1a3569 100%)";
    const init = company.logo_letter ?? company.name.slice(0, 1);
    if (inCompare) {
      removeFromCompare(company.id);
    } else {
      const added = addToCompare({ id: company.id, name: company.name, initial: init, gradient: grad });
      if (!added) showToast("比較できるのは最大3社までです", "warm");
    }
  };

  const handleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (bookmarkingRef.current) return;
    bookmarkingRef.current = true;
    setBookmarking(true);
    const prev = bookmarked;
    setBookmarked(!prev);
    try {
      const method = prev ? "DELETE" : "POST";
      const res = await fetch("/api/bookmarks", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: "company", target_id: company.id }),
      });
      if (res.status === 401) {
        setBookmarked(prev);
        window.location.href = `/auth?next=/companies`;
        return;
      }
      if (!res.ok) { setBookmarked(prev); return; }
      if (!prev) showToast(`${company.name} を気になりリストに追加しました ♥`);
      // キャッシュ更新
      _listBookmarkPromise = null;
    } catch {
      setBookmarked(prev);
    } finally {
      setBookmarking(false);
      bookmarkingRef.current = false;
    }
  };

  const initial = company.logo_letter ?? company.name.slice(0, 1);
  const stageCfg = getStageCfg(company.funding_stage);
  const displayName = cleanEnName(company.name_en) ?? company.name;
  const isEnName = !!cleanEnName(company.name_en);
  const headerGradient =
    company.logo_gradient ??
    "linear-gradient(135deg, #001233 0%, #002366 60%, #1a3569 100%)";
  const memberCount = company.current_member_count ?? (members?.length ?? 0);
  const obogCount = company.obog_count ?? 0;
  const ago = updatedAgo(company.updated_at);
  const features = Array.isArray(company.company_features) ? company.company_features : [];
  const jobTitles = Array.isArray(company.top_job_titles) ? company.top_job_titles : [];

  // ── 横型コンパクトカード（compact=true, グリッド表示） ─────────────────────────
  if (compact) {
    return (
      <>
        <style>{`
          .clv-card { transition: box-shadow 0.18s, border-color 0.18s, transform 0.18s; }
          .clv-card:hover { box-shadow: 0 6px 24px rgba(0,35,102,0.13) !important; border-color: var(--royal-100) !important; transform: translateY(-2px); }
          .clv-card:hover .clv-name { color: var(--royal) !important; }
        `}</style>
        <Link
          href={`/companies/${company.id}`}
          className="clv-card"
          style={{
            display: "flex",
            alignItems: "stretch",
            minHeight: 96,
            background: "#fff",
            borderRadius: 10,
            border: "1px solid var(--line)",
            boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
            textDecoration: "none",
            color: "inherit",
            overflow: "hidden",
          }}
        >
          {/* ── 左: グラデーション帯 + ロゴ ── */}
          <div style={{
            width: 64, flexShrink: 0,
            background: headerGradient,
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative", overflow: "hidden",
          }}>
            <span style={{
              position: "absolute", right: -4, bottom: -8,
              fontSize: 52, fontWeight: 900,
              color: "rgba(255,255,255,0.1)",
              fontFamily: "Inter, sans-serif", lineHeight: 1,
              userSelect: "none", pointerEvents: "none",
            }}>{initial}</span>
            {company.logo_url ? (
              <div style={{
                width: 40, height: 40, borderRadius: 8,
                background: "#fff", border: "1px solid rgba(255,255,255,0.9)",
                boxShadow: "0 1px 6px rgba(0,0,0,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden", position: "relative", zIndex: 1,
                flexShrink: 0,
              }}>
                <Image src={company.logo_url} alt={`${company.name}のロゴ`} fill
                  style={{ objectFit: "contain", padding: "15%" }} sizes="40px" />
              </div>
            ) : (
              <span style={{
                fontSize: 24, fontWeight: 800,
                color: "rgba(255,255,255,0.9)",
                fontFamily: "Inter, sans-serif",
                lineHeight: 1, userSelect: "none", zIndex: 1, position: "relative",
              }}>{initial}</span>
            )}
          </div>

          {/* ── 右: 情報エリア ── */}
          <div style={{ flex: 1, minWidth: 0, padding: "10px 12px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 4 }}>

            {/* 上段: 社名 + ブックマーク */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="clv-name" style={{
                  fontSize: 14, fontWeight: 800, color: "var(--ink)", lineHeight: 1.3,
                  letterSpacing: isEnName ? "-0.02em" : "0",
                  fontFamily: isEnName ? "Inter, sans-serif" : "var(--font-noto-sans)",
                  overflow: "hidden", display: "-webkit-box",
                  WebkitLineClamp: 1, WebkitBoxOrient: "vertical",
                  transition: "color 0.15s",
                }}>{displayName}</div>
                {/* バッジ */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 3 }}>
                  {stageCfg && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 100,
                      background: stageCfg.bg, color: stageCfg.color,
                    }}>{stageCfg.label}</span>
                  )}
                  {company.industry && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 100,
                      background: "var(--royal-50)", color: "var(--royal)",
                      border: "1px solid var(--royal-100)",
                    }}>{company.industry}</span>
                  )}
                  {company.accepting_casual_meetings && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 100,
                      background: "#ecfdf5", color: "var(--success)",
                      border: "1px solid #a7f3d0",
                    }}>● 面談OK</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleBookmark}
                disabled={bookmarking}
                style={{
                  width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                  background: "var(--line-soft)", border: "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", padding: 0,
                  color: bookmarked ? "#ef4444" : "var(--ink-mute)", fontSize: 13,
                }}
              >{bookmarked ? "♥" : "♡"}</button>
            </div>

            {/* 中段: タグライン */}
            {company.tagline && (
              <div style={{
                fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.4,
                overflow: "hidden", display: "-webkit-box",
                WebkitLineClamp: 1, WebkitBoxOrient: "vertical",
              }}>{company.tagline}</div>
            )}

            {/* 下段: メタ + 比較 + 求人 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 3, overflow: "hidden", flex: 1, minWidth: 0 }}>
                {company.location && (
                  <>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2.5} strokeLinecap="round" style={{ flexShrink: 0 }}>
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    <span style={{ fontSize: 10.5, color: "var(--ink-mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {company.location}
                    </span>
                  </>
                )}
                {company.employee_count && (
                  <>
                    <span style={{ color: "var(--line)", fontSize: 10, flexShrink: 0 }}>·</span>
                    <span style={{ fontSize: 10.5, color: "var(--ink-mute)", whiteSpace: "nowrap", flexShrink: 0 }}>
                      {company.employee_count}
                    </span>
                  </>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                <button onClick={handleCompare} style={{
                  padding: "2px 6px", borderRadius: 4,
                  background: inCompare ? "var(--royal-50)" : "transparent",
                  color: inCompare ? "var(--royal)" : "var(--ink-mute)",
                  border: `1px solid ${inCompare ? "var(--royal-100)" : "var(--line)"}`,
                  fontSize: 9, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                }}>{inCompare ? "✓ 比較中" : "+ 比較"}</button>
                {company.job_count > 0 && (
                  <span style={{
                    fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 100,
                    background: "var(--royal-50)", color: "var(--royal)",
                    border: "1px solid var(--royal-100)", whiteSpace: "nowrap",
                  }}>求人 {company.job_count}件</span>
                )}
              </div>
            </div>
          </div>
        </Link>
      </>
    );
  }

  // ── 横カード（compact=false, リストビュー）────────────────────────────────────
  return (
    <>
      <style>{`
        .company-list-card { transition: box-shadow 0.18s, border-color 0.18s; }
        .company-list-card:hover { box-shadow: 0 4px 24px rgba(0,35,102,0.12) !important; border-color: var(--royal-100) !important; }
        .company-list-card:hover .clc-name { color: var(--royal) !important; }
        .clc-stat-divider { width: 1px; height: 36px; background: var(--line); flex-shrink: 0; }
        .clc-bookmark-btn { transition: color 0.15s, transform 0.15s; }
        .clc-bookmark-btn:hover { transform: scale(1.15); }
        @media (max-width: 767px) {
          .clc-stats { display: none !important; }
          .clc-stat-divider { display: none !important; }
          .clc-cta { display: none !important; }
        }
      `}</style>
      <Link
        href={`/companies/${company.id}`}
        className="company-list-card"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "18px 20px",
          background: "#fff",
          borderRadius: 14,
          border: "1px solid var(--line)",
          boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
          textDecoration: "none",
          color: "inherit",
        }}
      >
        {/* ── ロゴ ── */}
        <div style={{
          width: 68,
          height: 68,
          borderRadius: 12,
          flexShrink: 0,
          background: company.logo_url ? "#f5f7fa" : headerGradient,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
        }}>
          {company.logo_url ? (
            <Image
              src={company.logo_url}
              alt={`${company.name}のロゴ`}
              fill
              style={{ objectFit: "contain", padding: "12%" }}
              sizes="68px"
            />
          ) : (
            <span style={{
              fontSize: 26, fontWeight: 800,
              color: "rgba(255,255,255,0.88)",
              fontFamily: "Inter, sans-serif",
              letterSpacing: "-0.03em",
              userSelect: "none",
            }}>
              {initial}
            </span>
          )}
        </div>

        {/* ── 企業情報（メイン） ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* バッジ行 */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", marginBottom: 4 }}>
            {company.industry && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
                background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)",
              }}>{company.industry}</span>
            )}
            {stageCfg && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
                background: stageCfg.bg, color: stageCfg.color,
              }}>{stageCfg.label}</span>
            )}
            {company.accepting_casual_meetings && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100,
                background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa",
              }}>面談OK</span>
            )}
            {/* #9: 更新日 */}
            {ago && (
              <span style={{
                fontSize: 11, padding: "2px 8px", borderRadius: 100,
                background: "var(--bg-tint)", color: "var(--ink-mute)",
                border: "1px solid var(--line)",
              }}>{ago}</span>
            )}
          </div>

          {/* 会社名 */}
          <div style={{ marginBottom: 3 }}>
            <span className="clc-name" style={{
              fontSize: 16, fontWeight: 800,
              color: "var(--ink)",
              fontFamily: isEnName ? "Inter, sans-serif" : "var(--font-noto-sans)",
              letterSpacing: isEnName ? "-0.02em" : "0",
              transition: "color 0.15s",
            }}>
              {displayName}
            </span>
            {isEnName && (
              <span style={{ fontSize: 11, color: "var(--ink-mute)", marginLeft: 6 }}>
                {company.name}
              </span>
            )}
          </div>

          {/* タグライン */}
          {company.tagline && (
            <div style={{
              fontSize: 13, color: "var(--ink-soft)", marginBottom: 6,
              overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
            }}>
              {company.tagline}
            </div>
          )}

          {/* #3: カルチャータグ + #2: 求人タイトル */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
            {features.slice(0, 3).map((f, i) => (
              <span key={i} style={{
                fontSize: 11, padding: "2px 8px", borderRadius: 100,
                background: "#f1f5f9", color: "var(--ink-soft)", border: "1px solid var(--line)",
              }}>
                #{f}
              </span>
            ))}
            {jobTitles.slice(0, 2).map((t, i) => (
              <span key={`jt-${i}`} style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: 11, padding: "2px 8px", borderRadius: 100,
                background: "var(--royal-50)", color: "var(--royal)",
                border: "1px solid var(--royal-100)",
              }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <rect x="2" y="7" width="20" height="14" rx="2"/>
                  <path d="M16 3h-8l-2 4h12l-2-4z"/>
                </svg>
                {t}
              </span>
            ))}
          </div>

          {/* 所在地 + 従業員数 + #7: メンバーアバター */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {company.location && (
              <span style={{ fontSize: 12, color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 3 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#E24B4A" strokeWidth={2} strokeLinecap="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                {company.location}
              </span>
            )}
            {company.employee_count && (
              <span style={{ fontSize: 12, color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 3 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2} strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                約{company.employee_count}名
              </span>
            )}
            {/* #7: メンバーアバター */}
            {members.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 0, paddingLeft: 6 }}>
                {members.slice(0, 4).map((m) => (
                  <MemberAvatar key={m.id} name={m.name} size={20} />
                ))}
                {members.length > 4 && (
                  <span style={{ fontSize: 10, color: "var(--ink-mute)", marginLeft: 8 }}>
                    +{members.length - 4}名
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── スタット列 ── */}
        <div className="clc-stats" style={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0 }}>
          <StatCol label="現役社員" value={memberCount} unit="名" />
          <div className="clc-stat-divider" />
          <StatCol label="OB・OG" value={obogCount} unit="名" />
          <div className="clc-stat-divider" />
          <StatCol label="求人" value={company.job_count} unit="件" highlight={company.job_count > 0} />
        </div>

        {/* ── CTA + ブックマーク ── */}
        <div className="clc-cta" style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          {company.accepting_casual_meetings ? (
            <a
              href={`/companies/${company.id}/casual-meeting`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "9px 18px", borderRadius: 9, fontSize: 13, fontWeight: 700,
                background: "linear-gradient(135deg, #F59E0B, #D97706)",
                color: "#fff", textDecoration: "none", whiteSpace: "nowrap",
                boxShadow: "0 2px 8px rgba(245,158,11,0.30)",
              }}
              onClick={e => e.stopPropagation()}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              話を聞く
            </a>
          ) : company.job_count > 0 ? (
            <a
              href={`/companies/${company.id}#jobs`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "9px 18px", borderRadius: 9, fontSize: 13, fontWeight: 700,
                background: "linear-gradient(135deg, var(--royal), var(--accent))",
                color: "#fff", textDecoration: "none", whiteSpace: "nowrap",
                boxShadow: "0 2px 8px rgba(0,35,102,0.20)",
              }}
              onClick={e => e.stopPropagation()}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <rect x="2" y="7" width="20" height="14" rx="2"/>
                <path d="M16 3h-8l-2 4h12l-2-4z"/>
              </svg>
              求人 {company.job_count}件
            </a>
          ) : (
            <a
              href={`/companies/${company.id}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "9px 18px", borderRadius: 9, fontSize: 13, fontWeight: 700,
                background: "var(--royal-50)", color: "var(--royal)",
                border: "1px solid var(--royal-100)", textDecoration: "none", whiteSpace: "nowrap",
              }}
              onClick={e => e.stopPropagation()}
            >
              詳細を見る →
            </a>
          )}

          {/* #6: ブックマーク */}
          <button
            type="button"
            className="clc-bookmark-btn"
            onClick={handleBookmark}
            disabled={bookmarking}
            title={bookmarked ? "気になりリストから削除" : "気になりリストに追加"}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: "2px 4px",
              fontSize: 18,
              color: bookmarked ? "#ef4444" : "var(--ink-mute)",
            }}
          >
            {bookmarked ? "♥" : "♡"}
          </button>

          {/* 比較ボタン */}
          <button
            type="button"
            onClick={handleCompare}
            title={inCompare ? "比較リストから削除" : "比較に追加"}
            style={{
              padding: "5px 10px", borderRadius: 100,
              background: inCompare ? "var(--royal-50)" : "transparent",
              color: inCompare ? "var(--royal)" : "var(--ink-mute)",
              border: `1px solid ${inCompare ? "var(--royal-100)" : "var(--line)"}`,
              fontSize: 11, fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 3,
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            {inCompare ? "✓ 比較中" : "+ 比較"}
          </button>
        </div>
      </Link>
    </>
  );
}

function StatCol({ label, value, unit, highlight }: { label: string; value: number; unit: string; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 18px", gap: 2 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
        <span style={{
          fontSize: 20, fontWeight: 700,
          fontFamily: "Inter, sans-serif",
          color: highlight ? "var(--royal)" : "var(--ink)",
        }}>{value}</span>
        <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>{unit}</span>
      </div>
      <div style={{ fontSize: 10, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>{label}</div>
    </div>
  );
}
