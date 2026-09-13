"use client";

import Link from "next/link";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import {
  CASUAL_MEETING_STATUS_LABEL,
  CASUAL_MEETING_STATUS_TO_STEP,
  CASUAL_MEETING_STEPS,
  isCasualMeetingStatus,
} from "@/lib/constants/casualMeetingStatus";

/**
 * 「応募・面談」1件のカード（`/mypage/applications`）。
 *
 * ⚠️★**求人応募とカジュアル面談を1つの型で扱う。** 本人にとっては
 *    「どの会社に何を申し込んだか」が1つの関心で、時系列も混ざる。
 *    2026-09-13 まで**面談は求職者側のどの画面にも出ていなかった**。
 *
 * ⚠️★**`page.tsx` のローカル関数にしない。** `/dev/preview` から import できず、
 *    実データ0件の状態（本番の `ow_casual_meetings` / `ow_job_applications` は
 *    2026-09-13 時点でどちらも0行）では**一度も描画を確かめられない**。
 */
export type Entry = {
  kind: "job" | "meeting";
  id: string;
  status: string;
  createdAt: string;
  company: { id: string; slug: string | null; name: string; logoUrl: string | null; url: string | null } | null;
  job: { id: string; slug: string | null; title: string } | null;
  /** 面談から生まれた対話。⚠️ 無ければリンクごと出さない */
  conversationId: string | null;
};

// ─── 求人応募（ow_job_applications.status）──────────────────────────────────
const JOB_STATUS_LABEL: Record<string, string> = {
  applied: "応募済み",
  doc_review: "書類選考中",
  interview1: "1次面接",
  interview_final: "最終面接",
  offered: "内定",
  accepted: "内定承諾",
  rejected: "不合格",
};

const JOB_STEPS = ["応募", "書類選考", "1次面接", "最終面接", "内定"];

const JOB_STATUS_TO_STEP: Record<string, number> = {
  applied: 0, doc_review: 1, interview1: 2, interview_final: 3,
  offered: 4, accepted: 4, rejected: -1,
};

export function ApplicationEntryCard({ entry }: { entry: Entry }) {
  const isMeeting = entry.kind === "meeting";

  /* ⚠️ 未知の状態を既定値に倒さない。ラベルが引けなければ**素の値をそのまま出す**
        （CLAUDE.md「値が無いことを、ある値に置き換えない」）。DB の CHECK には
        アプリが知らない値（`scheduling`）が実際に残っている。 */
  const label = isMeeting
    ? (isCasualMeetingStatus(entry.status) ? CASUAL_MEETING_STATUS_LABEL[entry.status] : entry.status)
    : (JOB_STATUS_LABEL[entry.status] ?? entry.status);

  const steps: readonly string[] = isMeeting ? CASUAL_MEETING_STEPS : JOB_STEPS;
  const currentStep = isMeeting
    ? (isCasualMeetingStatus(entry.status) ? CASUAL_MEETING_STATUS_TO_STEP[entry.status] : -1)
    : (JOB_STATUS_TO_STEP[entry.status] ?? -1);

  const company = entry.company;
  const companyHref = company ? `/companies/${company.slug ?? company.id}` : null;

  /* 行き先。⚠️ **面談には求職者向けの詳細ページが無い**ので企業ページへ送る。
        求人応募は応募したその求人へ。 */
  const titleText = isMeeting ? (company?.name ?? "企業") : (entry.job?.title ?? "募集");
  const titleHref = isMeeting
    ? companyHref
    : (entry.job ? `/jobs/${entry.job.slug ?? entry.job.id}` : companyHref);

  return (
    <div className="bg-white rounded-card border border-card-border overflow-hidden">
      <div className="flex gap-3 p-4">
        <div className="flex-shrink-0">
          <CompanyLogo
            name={company?.name ?? ""}
            logoUrl={company?.logoUrl ?? null}
            companyUrl={company?.url ?? null}
            size="md"
          />
        </div>

        {/* ⚠️★`min-w-0` を外さないこと。flex item の既定は `min-width: auto` で
               中身の min-content より小さくならず、長い社名・求人名が枠を押し広げる。 */}
        <div className="flex-1 min-w-0">
          {/* ★種別と状態は**同じ行**に並べて折り返させる（2026-09-13）。
                 ⚠️★状態を「右上に固定」にしないこと。375px で
                    **左のブロックが 86px まで潰れ、種別バッジ（90px・nowrap）が
                    親を押し広げていた**（実測 6件のはみ出し）。
                    状態ピルは `flex-shrink: 0` なので、詰まると必ず左が犠牲になる。
                 ⚠️ `flexWrap: "wrap"` を外さないこと。狭幅では2行に落ちて収まる。 */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 3 }}>
            {/* ⚠️ 色で区別しない（凡例が無いので文字で言う）。
                   `lib/utils/chipVariant.ts`「凡例なしで意味が伝わらないなら neutral」 */}
            <span style={{
              fontSize: 11, fontWeight: 700, color: "var(--ink-mute)",
              border: "1px solid var(--line)", borderRadius: 4, padding: "1px 6px",
              whiteSpace: "nowrap",
            }}>
              {isMeeting ? "カジュアル面談" : "求人応募"}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 600, color: "var(--ink-soft)",
              background: "var(--royal-50)", borderRadius: 999, padding: "2px 10px",
              whiteSpace: "nowrap",
            }}>
              {label}
            </span>
          </div>

          {titleHref ? (
            <Link href={titleHref} className="font-medium hover:text-primary transition-colors block truncate">
              {titleText}
            </Link>
          ) : (
            <span className="font-medium block truncate">{titleText}</span>
          )}
          {/* ⚠️ 面談は見出しが社名なので社名を2度出さない。求人を指定していたらその求人名。
                 ⚠️ どちらも無ければ行ごと出さない（「—」で埋めない）。 */}
          {isMeeting
            ? entry.job && <p className="text-xs text-gray-600 mt-0.5 truncate">{entry.job.title} について</p>
            : company && <p className="text-xs text-gray-600 mt-0.5 truncate">{company.name}</p>}

          {/* ⚠️ 段は種別ごとに別（面談3段 / 応募5段）。選考の段を面談に当てはめない。
                 ⚠️ `-1`（見送り・不合格）はバーごと出さない。 */}
          {currentStep >= 0 && (
            <div className="flex items-center gap-1 my-3">
              {steps.map((step, i) => (
                <div key={step} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div className={`w-full h-1 rounded-full ${i <= currentStep ? "bg-primary" : "bg-gray-200"}`} />
                    <span className={`text-[10px] mt-1 ${i <= currentStep ? "text-primary font-medium" : "text-gray-600"}`}>
                      {step}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 text-xs text-gray-600">
            <span>
              {isMeeting ? "申込日" : "応募日"}: {new Date(entry.createdAt).toLocaleDateString("ja-JP")}
            </span>
            <span className="flex items-center gap-3">
              {/* ⚠️ 対話が無ければリンクごと出さない（「メッセージはありません」とは書かない） */}
              {entry.conversationId && (
                <Link
                  href={`/mypage/conversations/${entry.conversationId}`}
                  className="font-medium"
                  style={{ color: "var(--royal)", whiteSpace: "nowrap" }}
                >
                  メッセージを見る →
                </Link>
              )}
              {entry.status === "offered" && <span className="text-red-500 font-medium">要返答</span>}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
