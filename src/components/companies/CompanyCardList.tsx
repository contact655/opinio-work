"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CompanyForCarousel } from "@/types/genre";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import type { MemberPreview } from "./CompanyCardCompact";
import { showToast } from "@/lib/toast";
import { formatEmployeeCount } from "@/lib/utils/employeeCount";
import { fetchCompanyBookmarks, invalidateCompanyBookmarks } from "@/lib/bookmarks/companyBookmarks";

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

function stripLegalSuffix(name: string): string {
  return name
    .replace(/^株式会社\s*/, "")
    .replace(/\s*株式会社$/, "")
    .replace(/^合同会社\s*/, "")
    .replace(/\s*合同会社$/, "")
    .replace(/^有限会社\s*/, "")
    .trim();
}


/** メンバーアバター（写真優先・初期文字フォールバック） */
function MemberAvatar({ name, photoUrl, size = 24 }: { name: string; photoUrl?: string | null; size?: number }) {
  const initial = name.slice(0, 1);
  const hue = Array.from(name).reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        style={{
          width: size, height: size, borderRadius: "50%", objectFit: "cover",
          border: "2px solid #fff", flexShrink: 0, marginLeft: -6,
        }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `hsl(${hue},60%,50%)`,
      border: "2px solid #fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.42, fontWeight: 700, color: "#fff",
      flexShrink: 0, marginLeft: -6,
    }}>
      {initial}
    </div>
  );
}

// ── Bookmark fetch deduplication（CompanyCardCompactと共有） ──────────────────
type Props = {
  company: CompanyForCarousel;
  members?: MemberPreview[];
  compact?: boolean;  // compact=true: 縦カード（2列グリッド）/ false: 横カード（リスト）
};

export function CompanyCardList({ company, members = [], compact }: Props) {
  const router = useRouter();
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);
  const bookmarkingRef = useRef(false);

  // 初期ブックマーク状態をロード
  useEffect(() => {
    fetchCompanyBookmarks().then((cache) => {
      setBookmarked(cache.ids.has(company.id));
    });
  }, [company.id]);


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
      // 共有キャッシュを捨てる。次に読む人が取り直す
      invalidateCompanyBookmarks();
    } catch {
      setBookmarked(prev);
    } finally {
      setBookmarking(false);
      bookmarkingRef.current = false;
    }
  };

  const enName = cleanEnName(company.name_en);
  const displayName = enName ?? stripLegalSuffix(company.name);
  const isEnName = !!enName;
  const showSubtitle = displayName !== company.name;
  // ライブ集計値を優先、なければ静的カラム（deprecated）にフォールバック
  const memberCount = company.live_current_count ?? company.current_member_count ?? (members?.length ?? 0);
  const obogCount   = company.live_obog_count   ?? company.obog_count           ?? 0;
  // company_features は現在非表示（culture tags 削除済み）
  // ⑤ 面談受付中のボーダースタイル（オレンジ枠は廃止）
  const meetingBorder = "1px solid var(--line)";
  const meetingBoxShadow = "0 1px 4px rgba(15,23,42,0.06)";

  // ① リモート表示
  const remoteLabel: Record<string, string> = {
    full_remote: "🏠 フルリモート",
    hybrid:      "🏠 ハイブリッド",
    on_site:     "🏢 出社",
  };
  const remoteText = company.remote_work_status ? remoteLabel[company.remote_work_status] ?? null : null;

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
          href={`/companies/${company.slug ?? company.id}`}
          target="_blank"
          className="clv-card"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            background: "#fff",
            borderRadius: 12,
            minHeight: 142,
            border: meetingBorder,
            boxShadow: meetingBoxShadow,
            textDecoration: "none",
            color: "inherit",
            padding: "14px 16px",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* ── ロゴ正方形（白背景・影付き） ── */}
          <CompanyLogo
            name={company.name}
            logoUrl={company.logo_url}
            logoLetter={company.logo_letter}
            logoGradient={company.logo_gradient}
            size={56}
            borderRadius={10}
            className="clv-logo"
            style={{ border: "1px solid #eef0f3", boxShadow: "0 2px 8px rgba(0,0,0,0.09)" }}
          />

          {/* ♡ブックマークボタン — カード右上に絶対配置 */}
          <button
            type="button"
            onClick={handleBookmark}
            disabled={bookmarking}
            aria-label={bookmarked ? "気になりを解除" : "気になりに追加"}
            /* ⚠️ globals.css の `button { min-height: 36px }` を外す。
                  付けないと高さだけ 36px に伸びて **縦長の楕円**になる（26×36）。 */
            className="btn-fixed-size"
            style={{
              position: "absolute", top: 10, right: 12,
              width: 26, height: 26, flexShrink: 0,
              background: bookmarked ? "#ef4444" : "transparent",
              border: `1.5px solid ${bookmarked ? "#ef4444" : "var(--line)"}`,
              borderRadius: "50%",
              cursor: "pointer", padding: 0,
              color: bookmarked ? "#fff" : "var(--ink-mute)", fontSize: 12,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
              boxShadow: bookmarked ? "0 2px 6px rgba(239,68,68,0.30)" : "none",
              zIndex: 1,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>

          {/* ── テキスト情報（3行）── */}
          <div style={{
            flex: 1, minWidth: 0,
            display: "flex", flexDirection: "column", gap: 4,
          }}>
            {/* 行1: ブランド名（大・濃）＋ 正式名称（小・薄） */}
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <span className="clv-name" style={{
                fontSize: 15, fontWeight: 800, color: "var(--ink)", lineHeight: 1.25,
                fontFamily: isEnName ? "Inter, sans-serif" : "var(--font-noto-sans)",
                letterSpacing: isEnName ? "-0.02em" : "0",
                transition: "color 0.15s",
                overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                display: "block",
              }}>{displayName}</span>
              {showSubtitle && company.name && (
                <span style={{
                  fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.3,
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
                <span style={{ fontSize: 12, color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 2, flexWrap: "nowrap" }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" style={{ flexShrink: 0 }}>
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  <span style={{ whiteSpace: "nowrap" }}>{company.location.replace(/[（(].*/, "").trim().replace(/^東京都/, "東京").replace(/^大阪府/, "大阪").replace(/^京都府/, "京都").replace(/[都道府県]$/, "")}</span>
                  {company.branch_locations && company.branch_locations.length > 0 && (
                    <span style={{ color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
                      ＋{company.branch_locations.slice(0, 2).join("・")}
                      {company.branch_locations.length > 2 && <span style={{ fontSize: 12 }}> 他</span>}
                    </span>
                  )}
                </span>
              )}
              {company.employee_count && (
                <span style={{ fontSize: 12, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>· {formatEmployeeCount(company.employee_count)}</span>
              )}
            </div>

            {/* 行5: リモート ＋ アバター ＋ 募集中 */}
            {(remoteText || members.length > 0 || memberCount > 0 || company.job_count > 0) && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {remoteText && (
                  <span style={{ fontSize: 12, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>{remoteText}</span>
                )}
                {/* アバターアイコン列（現役・OBOG） */}
                {(members.length > 0 || memberCount > 0 || obogCount > 0) && (
                  <div style={{ display: "flex", alignItems: "center", paddingLeft: members.length > 0 ? 6 : 0 }}>
                    {members.slice(0, 4).map((m) => (
                      <MemberAvatar key={m.id} name={m.name} photoUrl={m.photoUrl} size={20} />
                    ))}
                    <span style={{ fontSize: 12, color: "var(--success)", fontWeight: 700, marginLeft: members.length > 0 ? 8 : 0, whiteSpace: "nowrap" }}>
                      {memberCount > 0 ? `現役${memberCount}名` : ""}
                      {obogCount > 0 ? `・OB${obogCount}名` : ""}
                    </span>
                  </div>
                )}
                {company.job_count > 0 && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 3,
                    fontSize: 12, fontWeight: 800, padding: "3px 9px", borderRadius: 100,
                    background: "var(--royal)", color: "#fff",
                    whiteSpace: "nowrap",
                  }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                      <rect x="2" y="7" width="20" height="14" rx="2"/>
                      <path d="M16 3h-8l-2 4h12l-2-4z"/>
                    </svg>
                    募集中 {company.job_count}件
                  </span>
                )}
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
        href={`/companies/${company.slug ?? company.id}`}
        target="_blank"
        className="company-list-card"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "18px 20px",
          background: "#fff",
          borderRadius: 14,
          border: meetingBorder,
          boxShadow: meetingBoxShadow,
          textDecoration: "none",
          color: "inherit",
        }}
      >
        {/* ── ロゴ ── */}
        <CompanyLogo
          name={company.name}
          logoUrl={company.logo_url}
          logoLetter={company.logo_letter}
          logoGradient={company.logo_gradient}
          size={68}
          borderRadius={12}
        />

        {/* ── 企業情報（メイン） ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* バッジ行 */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", marginBottom: 4 }}>
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
            {showSubtitle && (
              <span style={{ fontSize: 12, color: "var(--ink-mute)", marginLeft: 6 }}>
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

          {/* リモート */}
          {remoteText && (
            <div style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{remoteText}</span>
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
                <span>{company.location.replace(/[（(].*/, "").trim().replace(/^東京都/, "東京").replace(/^大阪府/, "大阪").replace(/^京都府/, "京都").replace(/[都道府県]$/, "")}</span>
                {company.branch_locations && company.branch_locations.length > 0 && (
                  <span style={{ color: "var(--ink-mute)", fontSize: 12 }}>
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
                {/* ⚠️ 「名」の付与とカンマは formatEmployeeCount に集約（2026-08-08）。
                       ここで `約` を足さない。入っていない値に推測を足すことになる。 */}
                {formatEmployeeCount(company.employee_count)}
              </span>
            )}
            {company.job_count > 0 && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: 12, fontWeight: 800, padding: "2px 8px", borderRadius: 100,
                background: "var(--royal)", color: "#fff", whiteSpace: "nowrap",
              }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <rect x="2" y="7" width="20" height="14" rx="2"/>
                  <path d="M16 3h-8l-2 4h12l-2-4z"/>
                </svg>
                募集中 {company.job_count}件
              </span>
            )}
            {/* #7: メンバーアバター */}
            {members.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 0, paddingLeft: 6 }}>
                {members.slice(0, 4).map((m) => (
                  <MemberAvatar key={m.id} name={m.name} photoUrl={m.photoUrl} size={20} />
                ))}
                {members.length > 4 && (
                  <span style={{ fontSize: 12, color: "var(--ink-mute)", marginLeft: 8 }}>
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
          <button
            type="button"
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "9px 18px", borderRadius: 9, fontSize: 13, fontWeight: 700,
              background: company.job_count > 0
                ? "linear-gradient(135deg, var(--royal), var(--accent))"
                : "var(--royal-50)",
              color: company.job_count > 0 ? "#fff" : "var(--royal)",
              border: company.job_count > 0 ? "none" : "1px solid var(--royal-100)",
              cursor: "pointer", whiteSpace: "nowrap",
              boxShadow: company.job_count > 0 ? "0 2px 8px rgba(0,35,102,0.20)" : "none",
            }}
            onClick={e => { e.preventDefault(); e.stopPropagation(); router.push(`/companies/${company.slug ?? company.id}`); }}
          >
            詳細 →
          </button>

          {/* ② ♡ボタン — 常時ピンク */}
          <button
            type="button"
            onClick={handleBookmark}
            disabled={bookmarking}
            aria-label={bookmarked ? "気になりを解除" : "気になりに追加"}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "8px 16px", borderRadius: 999,
              background: bookmarked ? "#ef4444" : "transparent",
              border: `1.5px solid ${bookmarked ? "#ef4444" : "var(--line)"}`,
              color: bookmarked ? "#fff" : "var(--ink-mute)",
              fontSize: 12, fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
              boxShadow: bookmarked ? "0 2px 8px rgba(239,68,68,0.28)" : "none",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <span>{bookmarked ? "気になり済み" : "気になる"}</span>
          </button>

        </div>
      </Link>
    </>
  );
}

function JobCountStat({ count }: { count: number }) {
  return <StatCol label="募集中" value={count} unit="件" highlight={count > 0} />;
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
        <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{unit}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>{label}</div>
    </div>
  );
}
