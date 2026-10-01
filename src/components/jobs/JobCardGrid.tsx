"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Job } from "@/app/jobs/mockJobData";
import type { Company } from "@/app/companies/mockCompanies";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import { showToast } from "@/lib/toast";
import { formatSalary, hasSalaryData } from "@/components/jobs/JobListItem";

/**
 * ★求人カード（**一覧＝グリッド**）の試作（2026-10-01）。
 *
 * ⚠️★★**まだ `/jobs` に繋いでいない。** 見るのは `/dev/preview/job-grid` だけ。
 *    「一覧／詳細の切り替えを `/jobs` にも付けるか」を決める前に、
 *    **実データ（公開求人2件）では踏めない形**を見るために作った。
 *    採らないと決めたら**このファイルごと消す**（半端に残さない）。
 *
 * ── ★2026-10-01 の判断: **試作のまま残す**（柴さん。B案）────────────────────
 *   **いま `/jobs` に繋がない理由は「公開求人が2件しかないこと」だけ**で、
 *   作りに問題があったからではない。実測（はみ出しは3幅とも0件）:
 *     1440px → 3列・カード287px・同じ行の高さが 241/241/241 で揃う
 *      768px → 2列・332px ／ 375px → 1列・285px（♡のタップは 44x44）
 *   ⚠️★**3列に2枚だと右3分の1が空く。** 1200px 未満なら2列でぴったり埋まる。
 *   ⚠️★**いまの1列（`JobListItem`）と情報量はほぼ同じ。** グリッドで増えるのは
 *      キャッチコピーだけで、1列のほうは「詳細を見る／保存」のボタンを持っている。
 *   → **繋ぐかどうかを考え直す目安は「公開求人が10件を超えたとき」。**
 *      それまでは出典の突き合わせ（CLAUDE.md「求人を投入するときは
 *      `source_url` を必ず埋める」）のほうが先。
 *   ⚠️ 繋ぐときは `/companies` と同じく**トグル（一覧／詳細）の実装が別に要る。**
 *      このファイルはカード1枚ぶんしか無い。
 *
 * ── `JobListItem`（いまの1列）との違い ──────────────────────────────────
 *   | | 1列（`JobListItem`） | グリッド（これ） |
 *   |---|---|---|
 *   | 並び | 横（ロゴ→テキスト→ボタン列） | **縦に積む** |
 *   | キャッチコピー | ★**出さない**（2026-09-17 に高さのため落とした） | ★**出す**（2行） |
 *   | ♡ | 分割表示のときだけ | **常に右上** |
 *   | 「詳細を見る」ボタン列 | ある | **無い**（カード全体がリンク） |
 *
 * ⚠️★**`/companies` と同じ約束に合わせてある**（2026-09-30 の判断）:
 *    「**グリッドは全画面 / 1列は分割**」。グリッドは探す画面、1列は見比べる画面。
 *    ⇒ カードを押したら `/jobs/[slug]` へ**全画面で遷移する**。
 *    ⚠️ 分割ビュー（`CompanySplitLayout`）で包み直さないこと。包むと
 *       1280px 以上でまた右ペインに戻る。
 *
 * ⚠️ 字の大きさは `JobListItem` と揃えてある（求人名 15/800・会社名 13/700・
 *    年収 13/700）。**同じ一覧の中で求人だけ太って見える**のを避けるため
 *    （2026-09-17 に 17px から下げた経緯がある）。
 *
 * ⚠️ 会社が引けない求人は**カードごと出ない**（`JobListItem` と同じ）。
 *    企業を非公開にすると起こりうる。詳細は `/dev/preview/job-cards` の注記。
 */
export function JobCardGrid({
  job, companyMap, initialBookmarked = false, isApplied = false,
}: {
  job: Job;
  companyMap: Map<string, Company>;
  initialBookmarked?: boolean;
  isApplied?: boolean;
}) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [bookmarkAnim, setBookmarkAnim] = useState(false);
  const bookmarkingRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (!bookmarkingRef.current) setBookmarked(initialBookmarked);
  }, [initialBookmarked]);

  const company = companyMap.get(job.company_id);

  /* ⚠️ 中身は `JobListItem` の `handleBookmark` と同じ。**挙動を変えないこと。**
        ⚠️ `preventDefault` ＋ `stopPropagation` を外さない（カードのリンクが発火する）。 */
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
        /* ⚠️ `.search` まで含める（絞り込みが URL にあるため）。JobListItem と同じ。 */
        router.push(`/auth?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
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

  const salaryKnown = hasSalaryData(job.salary_min, job.salary_max);
  /* ⚠️ `JobListItem` と同じ整形。括弧書きを落として先頭だけ出す */
  const locationLabel = job.location
    ? job.location.split("・")[0].replace(/[（(][^）)]*[）)]/g, "").trim()
    : "";

  return (
    <div className="job-grid-card">
      {/* ⚠️★♡は `<Link>` の**外**に置く。中に入れると `<a>` の中に `<button>` が入り、
             対話的要素の入れ子になる（`JobListItem` と同じ理由）。 */}
      <button
        type="button"
        className="job-grid-heart"
        onClick={handleBookmark}
        aria-label={bookmarked ? "ブックマーク解除" : "保存する"}
        aria-pressed={bookmarked}
        style={{
          background: bookmarked ? "var(--royal-50)" : "#fff",
          border: `1.5px solid ${bookmarked ? "var(--royal-100)" : "#E2E8F0"}`,
          transform: bookmarkAnim ? "scale(1.12)" : "scale(1)",
          transition: "all 0.2s",
        }}
      >
        <Heart size={15} strokeWidth={2} style={{ color: bookmarked ? "var(--royal)" : "var(--ink-mute)", fill: bookmarked ? "currentColor" : "none" }} />
      </button>

      <Link href={`/jobs/${job.slug ?? job.id}`} prefetch className="job-grid-link">
        {/* ── 上段: ロゴ + 会社名 ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{ flexShrink: 0, padding: company.logo_url ? 3 : 0, background: company.logo_url ? "#fff" : "transparent", borderRadius: 11, boxShadow: company.logo_url ? "0 1px 5px rgba(0,0,0,0.10)" : "none", border: company.logo_url ? "1px solid var(--line)" : "none" }}>
            <CompanyLogo
              name={company.name}
              logoUrl={company.logo_url}
              logoLetter={company.logo_letter}
              logoGradient={company.gradient}
              companyUrl={company.url}
              size={40}
              borderRadius={9}
              style={{ boxShadow: company.logo_url ? "none" : "0 2px 6px rgba(0,0,0,0.12)" }}
            />
          </div>
          {/* ⚠️ 会社名は**押せない**（カード全体が求人へのリンクなので、中にもう1つ
                 行き先を作ると押し分けられない）。1列のカードでは押せるが、
                 あちらは行が広くて余白があり、誤爆しにくい。 */}
          <span
            title={(company as unknown as { brand_name?: string }).brand_name ?? company.name}
            style={{
              fontSize: 13, color: "var(--royal)", fontWeight: 700,
              minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {(company as unknown as { brand_name?: string }).brand_name ?? company.name}
          </span>
        </div>

        {/* ── 求人名（2行クランプ） ── */}
        {/* ⚠️ クランプの定義は globals.css の `.job-title-clamp` 1箇所。
               ⚠️★`title` を外さないこと。3行目が落ちる求人は必ず出る。 */}
        <span className="job-title-clamp" title={job.role} style={{
          fontSize: 15, fontWeight: 800, color: "var(--ink)",
          lineHeight: 1.4, letterSpacing: "-0.025em", marginTop: 10,
        }}>
          {job.role}
        </span>

        {/* ── キャッチコピー（2行クランプ）──
               ⚠️★**1列のカードには無い行。** 2026-09-17 に高さを詰めるため落としている。
                  グリッドは縦に余裕があるので戻した。
               ⚠️ 無ければ**行ごと出さない**（空の区切りを残さない）。 */}
        {job.highlight && (
          <span className="job-grid-highlight" title={job.highlight}>
            {job.highlight}
          </span>
        )}

        {/* ── 年収 ── */}
        {/* ⚠️★`hasSalaryData` を通す。`formatSalary` だけだと「年収0万円〜」に化ける。
               ⚠️ 色も1列のカードと同じ（ある＝緑 / 無い＝灰）。 */}
        <span style={{
          marginTop: 10,
          fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 13, fontWeight: 700,
          color: salaryKnown ? "var(--success-ink)" : "var(--ink-mute)",
        }}>
          {formatSalary(job.salary_min, job.salary_max)}
        </span>

        {/* ── 勤務地 / 勤務形態 / 雇用形態 ── */}
        {/* ⚠️ 空の項目は出さない。区切り文字だけが残るのを避けるため、
               **ある項目だけを集めて** join する（CLAUDE.md の「`?? ""` の罠」と同じ形）。 */}
        {(locationLabel || job.work_style || job.employment_type) && (
          <div className="job-grid-meta">
            {[locationLabel, job.work_style, job.employment_type].filter(Boolean).map((t) => (
              <span key={t} className="job-grid-chip">{t}</span>
            ))}
          </div>
        )}

        {isApplied && (
          <span style={{ marginTop: 8, alignSelf: "flex-start", fontSize: 12, fontWeight: 700, padding: "1px 7px", borderRadius: 100, background: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0" }}>
            ✓ 応募済み
          </span>
        )}
      </Link>
    </div>
  );
}
