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
type StageCfgEntry = { label: string; color: string; bg: string; border: string; fontWeight?: number };
const STAGE_CONFIG: Record<string, StageCfgEntry> = {
  "pre-seed":       { label: "プレシード",      color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "プレシード":     { label: "プレシード",      color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "bootstrap":      { label: "ブートストラップ", color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  "ブートストラップ": { label: "ブートストラップ", color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  seed:             { label: "シード",          color: "#92400E", bg: "#FEF3C7", border: "#FDE68A" },
  "シード":         { label: "シード",          color: "#92400E", bg: "#FEF3C7", border: "#FDE68A" },
  "series-a":       { label: "シリーズA",       color: "#065F46", bg: "#D1FAE5", border: "#A7F3D0" },
  "series_a":       { label: "シリーズA",       color: "#065F46", bg: "#D1FAE5", border: "#A7F3D0" },
  "シリーズA":      { label: "シリーズA",       color: "#065F46", bg: "#D1FAE5", border: "#A7F3D0" },
  "series-b":       { label: "シリーズB",       color: "#1E40AF", bg: "#DBEAFE", border: "#BFDBFE" },
  "series_b":       { label: "シリーズB",       color: "#1E40AF", bg: "#DBEAFE", border: "#BFDBFE" },
  "シリーズB":      { label: "シリーズB",       color: "#1E40AF", bg: "#DBEAFE", border: "#BFDBFE" },
  "series-c":       { label: "シリーズC",       color: "#5B21B6", bg: "#EDE9FE", border: "#DDD6FE" },
  "series_c":       { label: "シリーズC",       color: "#5B21B6", bg: "#EDE9FE", border: "#DDD6FE" },
  "シリーズC":      { label: "シリーズC",       color: "#5B21B6", bg: "#EDE9FE", border: "#DDD6FE" },
  "series-d":       { label: "シリーズD+",      color: "#991B1B", bg: "#FEE2E2", border: "#FECACA" },
  "series_d":       { label: "シリーズD+",      color: "#991B1B", bg: "#FEE2E2", border: "#FECACA" },
  "シリーズD以降":  { label: "シリーズD+",      color: "#991B1B", bg: "#FEE2E2", border: "#FECACA" },
  ipo:              { label: "IPO準備中",       color: "#9A3412", bg: "#FFEDD5", border: "#FED7AA" },
  "ipo準備中":      { label: "IPO準備中",       color: "#9A3412", bg: "#FFEDD5", border: "#FED7AA" },
  "IPO準備中":      { label: "IPO準備中",       color: "#9A3412", bg: "#FFEDD5", border: "#FED7AA" },
  listed:           { label: "上場",            color: "#065F46", bg: "#ECFDF5", border: "#6EE7B7", fontWeight: 800 },
  "上場":           { label: "上場",            color: "#065F46", bg: "#ECFDF5", border: "#6EE7B7", fontWeight: 800 },
  unicorn:          { label: "ユニコーン",      color: "#6D28D9", bg: "#F3E8FF", border: "#C4B5FD" },
  "ユニコーン":     { label: "ユニコーン",      color: "#6D28D9", bg: "#F3E8FF", border: "#C4B5FD" },
  growth:           { label: "成長期",          color: "#065F46", bg: "#D1FAE5", border: "#A7F3D0" },
  "外資系":         { label: "🌐 外資系",       color: "#3730A3", bg: "#E0E7FF", border: "#C7D2FE" },
  "foreign":        { label: "🌐 外資系",       color: "#3730A3", bg: "#E0E7FF", border: "#C7D2FE" },
};

function getStageCfg(stage: string | null) {
  if (!stage) return null;
  const key = stage.toLowerCase().replace(/\s+/g, "-");
  return STAGE_CONFIG[key] ?? STAGE_CONFIG[stage] ?? { label: stage, color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" };
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
    .replace(/\s+Japan$/i, "")   // 末尾の "Japan" を除去
    .trim();
  return cleaned || null;
}

// ⑥ 業種別グラデーション（ロゴなし企業の背景色）
const INDUSTRY_LOGO_GRADIENTS: Record<string, string> = {
  "HR Tech":        "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
  "FinTech/SaaS":   "linear-gradient(135deg, #064e3b 0%, #059669 100%)",
  "CRM":            "linear-gradient(135deg, #001233 0%, #002366 60%, #1a3569 100%)",
  "CRM/SaaS":       "linear-gradient(135deg, #001233 0%, #002366 60%, #1a3569 100%)",
  "AI Tech":        "linear-gradient(135deg, #3b0764 0%, #7c3aed 100%)",
  "Sales Tech":     "linear-gradient(135deg, #134e4a 0%, #0f766e 100%)",
  "Med Tech":       "linear-gradient(135deg, #7c2d12 0%, #c2410c 100%)",
  "ConTech":        "linear-gradient(135deg, #78350f 0%, #d97706 100%)",
  "顧客コミュニケーション": "linear-gradient(135deg, #3730a3 0%, #6366f1 100%)",
};
function getLogoGradient(industry: string | null | undefined, fallback: string): string {
  if (!industry) return fallback;
  return INDUSTRY_LOGO_GRADIENTS[industry] ?? fallback;
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
  const _jobTitles = Array.isArray(company.top_job_titles) ? company.top_job_titles : [];

  // ── コンパクトカード（compact=true）— 白背景ロゴ正方形・固定高さ・2行タグライン ──
  const NAVY_GRAD = company.logo_gradient ?? "linear-gradient(135deg, #001233 0%, #002366 60%, #1a3569 100%)";
  const CARD_LOGO_GRAD = company.logo_url ? "#fff" : getLogoGradient(company.industry, NAVY_GRAD);

  if (compact) {
    return (
      <>
        <style>{`
          .clv-card { transition: transform 0.18s ease, box-shadow 0.18s ease; }
          .clv-card:hover { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(0,35,102,0.14) !important; }
          .clv-card:hover .clv-name { color: var(--royal) !important; }
          @media (max-width: 600px) {
            .clv-card { gap: 10px !important; min-height: 110px !important; }
            .clv-logo { width: 44px !important; height: 44px !important; min-width: 44px !important; }
          }
        `}</style>
        <Link
          href={`/companies/${company.id}`}
          className="clv-card"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            background: "#fff",
            borderRadius: 12,
            minHeight: 142,
            border: "1px solid var(--line)",
            boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
            textDecoration: "none",
            color: "inherit",
            padding: "14px 16px",
            overflow: "hidden",
          }}
        >
          {/* ── ロゴ正方形（白背景・影付き） ── */}
          <div className="clv-logo" style={{
            width: 56, height: 56, borderRadius: 10, flexShrink: 0,
            background: CARD_LOGO_GRAD,
            border: "1px solid #eef0f3",
            boxShadow: "0 2px 8px rgba(0,0,0,0.09)",
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden", position: "relative",
          }}>
            {company.logo_url ? (
              <Image
                src={company.logo_url}
                alt={`${company.name}のロゴ`}
                fill
                className="clv-logo-img"
                style={{ objectFit: "contain", padding: "13%" }}
                sizes="56px"
              />
            ) : (
              <span style={{
                fontSize: 22, fontWeight: 900, color: "rgba(255,255,255,0.92)",
                fontFamily: "Inter, sans-serif", lineHeight: 1, userSelect: "none",
                textShadow: "0 1px 4px rgba(0,0,0,0.2)",
              }}>{initial}</span>
            )}
          </div>

          {/* ── テキスト情報（4行）── */}
          <div style={{
            flex: 1, minWidth: 0,
            display: "flex", flexDirection: "column", gap: 4,
          }}>
            {/* 行1: バッジ2つ + ブックマーク */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {company.industry && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                  background: "var(--royal-50)", color: "var(--royal)",
                  border: "1px solid var(--royal-100)", whiteSpace: "nowrap", flexShrink: 0,
                }}>{company.industry.replace(/\/SaaS$/i, "")}</span>
              )}
              {stageCfg && (
                <span style={{
                  fontSize: 11, fontWeight: stageCfg.fontWeight ?? 700, padding: "2px 7px", borderRadius: 100,
                  background: stageCfg.bg, color: stageCfg.color, border: `1px solid ${stageCfg.border}`,
                  whiteSpace: "nowrap", flexShrink: 0,
                }}>{stageCfg.label}</span>
              )}
              {company.accepting_casual_meetings && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                  background: "#FFF7ED", color: "#C2410C", border: "1px solid #FED7AA",
                  display: "inline-flex", alignItems: "center", gap: 3,
                  whiteSpace: "nowrap", flexShrink: 0,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#EA580C", animation: "pulseDot 1.8s ease-in-out infinite", display: "inline-block" }} />
                  面談
                </span>
              )}
              <button
                type="button"
                onClick={handleBookmark}
                disabled={bookmarking}
                aria-label={bookmarked ? "気になりを解除" : "気になりに追加"}
                style={{
                  marginLeft: "auto", width: 24, height: 24, flexShrink: 0,
                  background: bookmarked ? "#fef2f2" : "var(--line-soft)",
                  border: `1px solid ${bookmarked ? "#fecaca" : "var(--line)"}`,
                  borderRadius: "50%",
                  cursor: "pointer", padding: 0,
                  color: bookmarked ? "#ef4444" : "var(--ink-mute)", fontSize: 11,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s",
                }}
              >{bookmarked ? "♥" : "♡"}</button>
            </div>

            {/* 行2: ブランド名（大・濃）＋ 正式名称（小・薄） */}
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <span className="clv-name" style={{
                fontSize: 15, fontWeight: 800, color: "var(--ink)", lineHeight: 1.25,
                fontFamily: isEnName ? "Inter, sans-serif" : "var(--font-noto-sans)",
                letterSpacing: isEnName ? "-0.02em" : "0",
                transition: "color 0.15s",
                overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                display: "block",
              }}>{displayName}</span>
              {isEnName && company.name && (
                <span style={{
                  fontSize: 10.5, color: "var(--ink-mute)", lineHeight: 1.3,
                  fontFamily: "var(--font-noto-sans)",
                  overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                  display: "block",
                }}>{company.name}</span>
              )}
            </div>

            {/* 行3: タグライン（2行まで） */}
            {company.tagline && (
              <span style={{
                fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.45,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 1,
                WebkitBoxOrient: "vertical",
              } as React.CSSProperties}>{company.tagline.replace(/^「|」$/g, "")}</span>
            )}

            {/* 行4: メタ（所在地 + 従業員数） */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {company.location && (
                <span style={{ fontSize: 11, color: "var(--ink-mute)", display: "flex", alignItems: "center", gap: 2, flexWrap: "nowrap" }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" style={{ flexShrink: 0 }}>
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  <span style={{ whiteSpace: "nowrap" }}>{company.location.replace(/^東京都/, "東京").replace(/^大阪府/, "大阪").replace(/^京都府/, "京都").replace(/[都道府県]$/, "")}</span>
                  {company.branch_locations && company.branch_locations.length > 0 && (
                    <span style={{ color: "var(--ink-mute)", opacity: 0.75, whiteSpace: "nowrap" }}>
                      ＋{company.branch_locations.slice(0, 2).join("・")}
                      {company.branch_locations.length > 2 && <span style={{ fontSize: 10 }}> 他</span>}
                    </span>
                  )}
                </span>
              )}
              {company.employee_count && (
                <span style={{ fontSize: 11, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>· {company.employee_count}</span>
              )}
              {memberCount > 0 && (
                <span style={{
                  fontSize: 10, color: "var(--success)", fontWeight: 700,
                  whiteSpace: "nowrap", flexShrink: 0,
                }}>· {memberCount}名</span>
              )}
            </div>

            {/* 行5: 求人数バッジ */}
            {company.job_count > 0 && (
              <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 100,
                  background: "var(--royal)", color: "#fff",
                  whiteSpace: "nowrap",
                }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <rect x="2" y="7" width="20" height="14" rx="2"/>
                    <path d="M16 3h-8l-2 4h12l-2-4z"/>
                  </svg>
                  求人 {company.job_count}件
                </span>
              </div>
            )}
          </div>
        </Link>
      </>
    );
  }

  // ── 横カード（compact=false, リストビュー）────────────────────────────────────
  return (
    <>
      <style>{`
        .company-list-card { transition: box-shadow 0.2s ease, transform 0.15s ease; }
        .company-list-card:hover { box-shadow: 0 6px 24px rgba(0,35,102,0.12) !important; transform: translateY(-1px); }
        .company-list-card:hover .clc-name { color: var(--royal) !important; }
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
              }}>{company.industry.replace(/\/SaaS$/i, "")}</span>
            )}
            {stageCfg && (
              <span style={{
                fontSize: 11, fontWeight: stageCfg.fontWeight ?? 700, padding: "2px 8px", borderRadius: 100,
                background: stageCfg.bg, color: stageCfg.color, border: `1px solid ${stageCfg.border}`,
              }}>{stageCfg.label}</span>
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

          {/* カルチャータグ */}
          {features.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
              {features.slice(0, 4).map((f, i) => (
                <span key={i} style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 100,
                  background: "#f1f5f9", color: "var(--ink-soft)", border: "1px solid var(--line)",
                  whiteSpace: "nowrap",
                }}>
                  #{f}
                </span>
              ))}
            </div>
          )}

          {/* 所在地 + 従業員数 + #7: メンバーアバター */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {company.location && (
              <span style={{ fontSize: 12, color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 3 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#E24B4A" strokeWidth={2} strokeLinecap="round" style={{ flexShrink: 0 }}>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                <span>{company.location.replace(/^東京都/, "東京").replace(/^大阪府/, "大阪").replace(/^京都府/, "京都").replace(/[都道府県]$/, "")}</span>
                {company.branch_locations && company.branch_locations.length > 0 && (
                  <span style={{ color: "var(--ink-mute)", fontSize: 11 }}>
                    ＋{company.branch_locations.slice(0, 3).join("・")}
                    {company.branch_locations.length > 3 && " 他"}
                  </span>
                )}
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
          <JobCountStat count={company.job_count} />
        </div>

        {/* ── CTA + ブックマーク ── */}
        <div className="clc-cta" style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          {company.job_count > 0 ? (
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
            onClick={handleBookmark}
            disabled={bookmarking}
            aria-label={bookmarked ? "気になりを解除" : "気になりに追加"}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "7px 14px", borderRadius: 999,
              background: bookmarked ? "#fef2f2" : "var(--line-soft)",
              border: `1.5px solid ${bookmarked ? "#fecaca" : "var(--line)"}`,
              color: bookmarked ? "#ef4444" : "var(--ink-soft)",
              fontSize: 12, fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: 14 }}>{bookmarked ? "♥" : "♡"}</span>
            <span>{bookmarked ? "気になり済み" : "気になる"}</span>
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

function JobCountStat({ count }: { count: number }) {
  if (count === 0) return <StatCol label="求人" value={0} unit="件" />;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 18px", gap: 4 }}>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        fontSize: 12, fontWeight: 800, padding: "5px 12px", borderRadius: 100,
        background: "var(--royal)", color: "#fff", whiteSpace: "nowrap",
      }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
          <rect x="2" y="7" width="20" height="14" rx="2"/>
          <path d="M16 3h-8l-2 4h12l-2-4z"/>
        </svg>
        求人 {count}件
      </span>
      <span style={{ fontSize: 10, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>募集中</span>
    </div>
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
