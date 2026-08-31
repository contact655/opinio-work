"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Job } from "@/app/jobs/mockJobData";
import type { Company } from "@/app/companies/mockCompanies";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import { showToast } from "@/lib/toast";
import { fmtMan } from "@/lib/utils/salary";

/**
 * `/jobs` の求人カード（2026-08-31 に `JobsClient` から切り出した）。
 *
 * ⚠️ ページ内のローカル関数だと `/dev/preview` から import できない。
 *    公開求人は **2件だけ**（2026-08-30 実測）なので、年収なし・
 *    キャッチコピーなし・長い社名といった形を実データでは踏めない。
 *
 * ⚠️ 切り出しただけで**中身は1文字も変えていない**（実HTMLの一致で確認済み）。
 */

/* ⚠️ カンマ区切りは fmtMan に寄せる。toLocaleString を直書きしない（2026-08-08） */
export function formatSalary(min: number | null, max: number | null): string {
  if (!min && !max) return "給与非公開";
  if (min && max) return `年収${fmtMan(min)}万円〜${fmtMan(max)}万円`;
  if (max) return `年収〜${fmtMan(max)}万円`;
  return `年収${fmtMan(min)}万円〜`;
}

export function hasSalaryData(min: number | null, max: number | null): boolean {
  return !!(min || max);
}

export function JobListItem({
  job, companyMap, initialBookmarked = false, isApplied = false,
  matchReason: _matchReason,
}: {
  job: Job;
  companyMap: Map<string, Company>;
  initialBookmarked?: boolean;
  isApplied?: boolean;
  matchReason?: string | null;
}) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [bookmarkAnim, setBookmarkAnim] = useState(false);
  const bookmarkingRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (!bookmarkingRef.current) setBookmarked(initialBookmarked);
  }, [initialBookmarked]);

  const company = companyMap.get(job.company_id);

  const handleBookmark = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (bookmarkingRef.current) return;
    bookmarkingRef.current = true;
    const next = !bookmarked;
    setBookmarked(next);
    setBookmarkAnim(true);
    setTimeout(() => setBookmarkAnim(false), 400);
    try {
      const res = await fetch("/api/bookmarks", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: "job", target_id: job.id }),
      });
      if (res.status === 401) {
        setBookmarked(!next);
        /* ⚠️ **`.search` まで含める。** `/jobs` は絞り込みを URL に持つので
              （category / work_style / salary / industry / prefecture / emp_type /
               sort / company / page …）、pathname だけだとログイン後に
              絞り込みが全部消えた `/jobs` に戻る。 */
        router.push(
          `/auth?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
        );
      } else if (!res.ok) {
        setBookmarked(!next);
      } else {
        if (next) showToast(`${job.role} を保存しました`, "warm");
        else showToast("保存を解除しました");
      }
    } catch {
      setBookmarked(!next);
    } finally {
      bookmarkingRef.current = false;
    }
  }, [bookmarked, job.id, job.role, router]);

  if (!company) return null;

  return (
    <div
      className="job-list-card"
      style={{
        borderRadius: 10,
        border: "1.5px solid var(--line)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        overflow: "hidden",
        transition: "border-color 0.15s, box-shadow 0.15s",
        display: "flex",
        background: "#fff",
      }}
    >
      <Link
        href={`/jobs/${job.slug ?? job.id}`}
        target="_blank"
        prefetch
        className="job-list-item-link"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "16px 16px",
          flex: 1,
          minWidth: 0,
          minHeight: 80,
          background: "transparent",
          textDecoration: "none",
          transition: "background 0.15s",
        }}
      >
        {/* ── 左端: 企業ロゴ ── */}
        <div style={{ flexShrink: 0, padding: company.logo_url ? 3 : 0, background: company.logo_url ? "#fff" : "transparent", borderRadius: 13, boxShadow: company.logo_url ? "0 1px 5px rgba(0,0,0,0.10)" : "none", border: company.logo_url ? "1px solid var(--line)" : "none" }}>
          <CompanyLogo
            name={company.name}
            logoUrl={company.logo_url}
            logoLetter={company.logo_letter}
            logoGradient={company.gradient}
            companyUrl={company.url}
            size={54}
            borderRadius={10}
            style={{ boxShadow: company.logo_url ? "none" : "0 2px 6px rgba(0,0,0,0.12)" }}
          />
        </div>

        {/* ── 中央: テキスト情報 ── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* マッチ理由（フィルター文脈 / 先輩在籍 など） */}

          {/* 行1: 求人タイトル + 面談受付中バッジ */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
            <span className="job-title-clamp" style={{
              fontSize: 17, fontWeight: 800, color: "var(--ink)",
              lineHeight: 1.4, letterSpacing: "-0.025em",
              maxWidth: "calc(100% - 110px)",
            }}>
              {job.role}
            </span>
          </div>

          {/* 行2: 会社名のみ */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
            <span
              role="link" tabIndex={0}
              // ⚠️ 非公開企業には飛ばさない（本番で404）。dev では getCompanies が
              //    is_published で絞らないので、ここで見る必要がある
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (company.is_published) router.push(`/companies/${company.slug ?? company.id}`); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); if (company.is_published) router.push(`/companies/${company.slug ?? company.id}`); } }}
              className="company-name-link"
              /* ⚠️ flexShrink: 0 を外した（2026-08-08）。企業名は可変長で、
                    「Notion Labs Japan合同会社」等が 375px で親（120px）を
                    はみ出して切れていた。固定幅にしてよいのはアイコンやバッジだけ。
                    ⚠️ ellipsis を効かせるには minWidth: 0 が要る（既定の auto では縮まない）。 */
              title={(company as any).brand_name ?? company.name}
              style={{
                fontSize: 14, color: "var(--royal)", fontWeight: 700, cursor: "pointer",
                minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
            >
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(company as any).brand_name ?? company.name}
            </span>
            {isApplied && (
              <span style={{ fontSize: 12, fontWeight: 700, padding: "1px 7px", borderRadius: 100, background: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0", flexShrink: 0 }}>
                ✓ 応募済み
              </span>
            )}
          </div>

          {/* キャッチコピー1行 — LinkedIn の job summary 相当 */}
          {job.highlight && (
            <div style={{
              fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", lineHeight: 1.5,
              marginBottom: 5,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {job.highlight}
            </div>
          )}


          {/* 行4: 勤務地 · 勤務形態 · 年収 */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {job.location && (
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 2 }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                {job.location.split("・")[0].replace(/[（(][^）)]*[）)]/g, "").trim()}
              </span>
            )}
            {job.work_style && job.location && (
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--line)", userSelect: "none" }}>·</span>
            )}
            {job.work_style && (
              <span style={{
                fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 3,
                color: job.work_style.includes("リモート") || job.work_style.includes("フルリモート") ? "var(--success-ink)" : "var(--ink-soft)",
              }}>
                {job.work_style.includes("リモート") || job.work_style.includes("フルリモート") ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                ) : job.work_style.includes("ハイブリッド") ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                  </svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                  </svg>
                )}
                {job.work_style}
              </span>
            )}
            {hasSalaryData(job.salary_min, job.salary_max) && (
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--line)", userSelect: "none" }}>·</span>
            )}
            <span style={{
              fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 13, fontWeight: 700,
              color: hasSalaryData(job.salary_min, job.salary_max) ? "var(--success-ink)" : "var(--ink-mute)",
            }}>
              {formatSalary(job.salary_min, job.salary_max)}
            </span>
          </div>
        </div>

      </Link>

      {/* ── 右端: アクションパネル ── */}
      <div style={{
        flexShrink: 0,
        width: 104,
        borderLeft: "1px solid var(--line-soft)",
        background: "var(--bg-tint)",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "flex-start",
        gap: 5,
        padding: "12px 8px",
      }}>
        {/* 詳細を見る */}
        <a
          href={`/jobs/${job.slug ?? job.id}`}
          target="_blank"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
            padding: "8px 6px", borderRadius: 7,
            backgroundColor: "#002366", color: "#fff",
            fontSize: 12, fontWeight: 700, textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          詳細
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </a>

        {/*
          応募する。
          ⚠️ 2026-08-05 に、ここにあった面談ボタンと入れ替えた。位置と意匠は引き継いでいる。

          ── なぜ一覧に応募を置くか ────────────────────────────────────────
          OPINIO は「転職を前提にしない / 応募する前に調べる」を掲げているので、
          一覧をスキャンした段階で応募を促すのは姿勢と少しずれる。
          それでも置くのは、求人があるのに応募できないほうが不親切だからで、
          「調べてから決める」は応募を隠すことではなく急かさないこと、と整理した。
          詳細ページ（/jobs/[id]）は面談を主・応募を従のままにしてある。
          一覧＝行動 / 詳細＝検討 で住み分ける。

          ── なぜ面談を外したか ────────────────────────────────────────────
          ① 4つ縦積みにすると 104px のパネルが +38px 伸び、カードの主役が
             ボタンになる（18件で +684px）
          ② ここの面談ボタンは company.is_published しか見ておらず、
             accepting_casual_meetings = false の企業でも表示していた。
             押すと申込ページで「現在受付していません」に着地する
             （2026-08-05 時点で該当0社だが、企業が1社でも false にした瞬間に破綻する）
          面談の導線は /jobs/[id] と /companies/[id] に残してある。

          ⚠️ **「published なら応募先は必ず存在する」は誤りだった（2026-08-11 訂正）。**
             status は掲載の可否でしかなく、応募が届く先があるかは別の事実。
             実際、公開求人を持つ7社のうち6社は宛先0件で、応募しても誰にも届かなかった。
             `company.application_open`（lib/jobs/application.ts が解決）で出し分ける。
          ⚠️ 応募済みかどうかでは出し分けない。一覧で引くとクエリが重くなる。
             既に応募していれば、押した先で「すでに応募しています」が出る
             （API が 409 を返し、ApplicationForm が文言を出す）。
        */}
        {company?.application_open && (
        <a
          href={`/jobs/${job.slug ?? job.id}/apply`}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
            padding: "8px 6px", borderRadius: 7,
            /* ⚠️★オレンジにしない（2026-08-29）。**#FFF7ED / #C2410C は
                  「面談可」バッジの色**（`components/profile/view/TalkableBadge.tsx`）で、
                  `.claude/skills/ui-conventions`「色の役割」でも
                  **オレンジ＝カジュアル面談だけ**と定めている。
                  応募に使うと、同じ一覧の中で同じ色が2つの意味を持つ。
               ⚠️ 隣の「詳細」は濃紺の塗り（主要な遷移）、「保存」は中立。
                  応募はその中間なので**濃紺の輪郭**にして、面談の色と混ざらないようにする。 */
            backgroundColor: "var(--royal-50)", color: "var(--royal)",
            border: "1.5px solid var(--royal-100)",
            fontSize: 12, fontWeight: 700, textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
          応募
        </a>
        )}

        {/* 保存をする */}
        <button
          type="button"
          onClick={handleBookmark}
          aria-label={bookmarked ? "ブックマーク解除" : "保存する"}
          aria-pressed={bookmarked}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
            padding: "8px 6px", borderRadius: 7,
            /* ⚠️ 保存済みは royal（2026-08-30）。赤にしない——他3箇所と色が違っていた。
                  ⚠️ アイコンは Heart のまま残してある。**色だけ揃えた。**
                     しおり型に統一するかは別の判断（4箇所でアイコンも割れている）。 */
            backgroundColor: bookmarked ? "var(--royal-50)" : "#fff",
            color: bookmarked ? "var(--royal)" : "#475569",
            border: `1.5px solid ${bookmarked ? "var(--royal-100)" : "#E2E8F0"}`,
            fontSize: 12, fontWeight: 700, cursor: "pointer",
            whiteSpace: "nowrap",
            transform: bookmarkAnim ? "scale(1.05)" : "scale(1)",
            transition: "all 0.2s",
          }}
        >
          <Heart size={11} strokeWidth={2} style={{ color: bookmarked ? "var(--royal)" : "var(--ink-mute)", fill: bookmarked ? "currentColor" : "none", flexShrink: 0 }} />
          {bookmarked ? "保存済" : "保存"}
        </button>
      </div>
    </div>
  );
}
