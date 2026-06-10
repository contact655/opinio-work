"use client";

import { useState } from "react";
import Link from "next/link";
import { Briefcase } from "lucide-react";
import FutureSectionEditor from "./FutureSectionEditor";
import CompanyLogoImg, { LetterCircle } from "./CompanyLogoImg";
import SchoolLogoImg from "./SchoolLogoImg";

// ─── 会社名を短縮: "株式会社LayerX" → "LayerX" ────────────────────────────────
function shortCompanyName(name: string): string {
  return name
    .replace(/^株式会社\s*/, "")
    .replace(/\s*株式会社$/, "")
    .replace(/^有限会社\s*/, "")
    .replace(/\s*有限会社$/, "")
    .replace(/\s+Japan\s+Co\.,?\s*Ltd\.?$/i, "")
    .replace(/\s+Co\.,?\s*Ltd\.?$/i, "")
    .replace(/\s*,\s*Inc\.?$/i, "")
    .replace(/\s+Inc\.?$/i, "")
    .replace(/\s+Japan$/i, "")
    .trim() || name;
}

// ─── ExpandableDesc: 長い説明文を150字で折りたたみ ───────────────────────────
const DESC_THRESHOLD = 150;
function ExpandableDesc({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = text.length > DESC_THRESHOLD;
  const display = needsTruncation && !expanded ? text.slice(0, DESC_THRESHOLD) + "…" : text;
  return (
    <>
      <p style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.65, margin: 0, whiteSpace: "pre-wrap" }}>
        {display}
      </p>
      {needsTruncation && (
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--royal)", fontSize: 12, fontWeight: 600,
            padding: "4px 0 0", fontFamily: "inherit",
            display: "inline-flex", alignItems: "center", gap: 3,
          }}
        >
          {expanded ? "折りたたむ ▲" : "続きを読む ▼"}
        </button>
      )}
    </>
  );
}

// ─── Public types (re-exported for use in Commit C) ───────────────────────────

export interface CareerEntry {
  id: string;
  /** 企業マスタID（master 企業の場合のみ存在、custom/anon は null） */
  company_id?: string | null;
  /** 表示用企業名（匿名化済みの場合は "非公開" 等） */
  company_name: string;
  /** 企業ロゴ画像 URL（ow_companies.logo_url）。null = 未登録 */
  logo_url?: string | null;
  /** 企業ロゴイニシャル文字（ow_companies.logo_letter）。フォールバック表示に使用 */
  logo_letter?: string | null;
  /** 企業ロゴ背景グラデーション（ow_companies.logo_gradient）。フォールバック表示に使用 */
  logo_gradient?: string | null;
  /** ロールカテゴリのラベル（例: "プロダクトマネージャー"） */
  role_label: string;
  /** 自由記述の役職名（例: "Bakuraku事業 PdM"） */
  role_title?: string | null;
  started_at: string;       // "YYYY-MM-DD"
  ended_at: string | null;  // "YYYY-MM-DD" | null when is_current
  is_current: boolean;
  description?: string | null;
  /** なぜこの会社を選んだか（任意） */
  join_reason?: string | null;
  employment_type?: string | null;
}

export interface EducationSchoolMaster {
  id: string;
  name: string;
  logo_letter: string | null;
  logo_gradient: string | null;
  logo_url: string | null;
}

export interface EducationEntry {
  id: string;
  school: string;
  school_id?: string | null;                    // Phase 3: FK to ow_schools (nullable)
  school_master?: EducationSchoolMaster | null; // Phase 3: JOIN result for logo display
  faculty?: string | null;
  degree?: string | null;
  enrolled_at: string;         // "YYYY-MM-DD"
  graduated_at: string | null; // "YYYY-MM-DD" | null when is_current
  is_current: boolean;
}

export interface FutureData {
  /** ow_users.future_aspirations テキスト */
  text: string | null;
  /** ow_users.avatar_color（CSS gradient 文字列）。NULL の場合は親側でフォールバック値を渡す */
  avatarColor: string;
  /** アバターイニシャル（例: "田"）。通常は name[0] */
  initial: string;
}

export interface MergedTimelineProps {
  careers: CareerEntry[];
  educations: EducationEntry[];
  /** future_aspirations + アバター情報。null の場合はセクション非表示 */
  future?: FutureData | null;
  /** プロフィールオーナー本人が閲覧中かどうか（CTA 表示制御） */
  viewerIsOwner?: boolean;
  /** ログイン済みかどうか（false の場合、経歴の詳細説明をゲート） */
  isAuthenticated?: boolean;
  /** この件数を超えた経歴を折りたたむ（未指定の場合は折りたたみなし） */
  collapseAfter?: number;
}

// ─── Internal discriminated union ─────────────────────────────────────────────

/** buildTimeline が返す中間型（並行グループ化前） */
type TimelineEntry =
  | { kind: "future" }
  | { kind: "career";    data: CareerEntry;    isParallel: boolean }
  | { kind: "education"; data: EducationEntry };

/**
 * レンダリング用エントリ型。
 * groupParallelEntries() が TimelineEntry[] から変換して生成する。
 * 同一開始月の並行職歴 2件以上は "career-group" にバンドルされる。
 */
type RenderEntry =
  | { kind: "future" }
  | { kind: "career";              data: CareerEntry;    isParallel: boolean }
  | { kind: "career-group";        items: CareerEntry[] }
  | { kind: "career-same-company"; items: CareerEntry[]; companyKey: string }
  | { kind: "education";           data: EducationEntry };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** "YYYY-MM-DD" → "YYYY年M月" */
function formatYM(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length < 2) return dateStr;
  const month = parseInt(parts[1], 10); // "07" → 7（ゼロ除去）
  return `${parts[0]}年${month}月`;
}

/** 期間文字列を生成: "2年3ヶ月" */
function formatDuration(start: string, end: string | null): string {
  const startDate = new Date(start);
  // "YYYY-MM" 形式の終了日は月末まで在籍を意味するため +1ヶ月して計算
  // 例: 2013-04 〜 2017-03 → 4年ちょうど（47ヶ月+1=48ヶ月）
  const endDate = end ? new Date(end) : new Date();
  const endAdjusted = end ? new Date(endDate.getFullYear(), endDate.getMonth() + 1, 1) : endDate;

  const totalMonths =
    (endAdjusted.getFullYear() - startDate.getFullYear()) * 12 +
    (endAdjusted.getMonth() - startDate.getMonth());

  if (totalMonths <= 0) return "";

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  if (years === 0) return `${months}ヶ月`;
  if (months === 0) return `${years}年`;
  return `${years}年${months}ヶ月`;
}

/** 同一開始月の職歴 ID を収集して Set で返す */
function buildParallelMap(careers: CareerEntry[]): Set<string> {
  const byMonth = new Map<string, string[]>();
  for (const c of careers) {
    const month = c.started_at.slice(0, 7); // "YYYY-MM"
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month)!.push(c.id);
  }
  const parallelIds = new Set<string>();
  Array.from(byMonth.values()).forEach((ids) => {
    if (ids.length > 1) ids.forEach((id: string) => parallelIds.add(id));
  });
  return parallelIds;
}

/**
 * 職歴・学歴をマージしてソート済み配列を返す。
 * 順序: future（常に先頭）→ is_current DESC → start_date DESC → career first（同一日時）
 */
function buildTimeline(
  careers: CareerEntry[],
  educations: EducationEntry[],
  hasFuture: boolean,
  parallelIds: Set<string>
): TimelineEntry[] {
  const careerEntries: TimelineEntry[] = careers.map((c) => ({
    kind: "career",
    data: c,
    isParallel: parallelIds.has(c.id),
  }));

  const educationEntries: TimelineEntry[] = educations.map((e) => ({
    kind: "education",
    data: e,
  }));

  const combined = [...careerEntries, ...educationEntries];

  combined.sort((a, b) => {
    const aIsCurrent =
      a.kind === "career" ? (a.data.is_current ? 1 : 0) :
      a.kind === "education" ? (a.data.is_current ? 1 : 0) : 0;
    const bIsCurrent =
      b.kind === "career" ? (b.data.is_current ? 1 : 0) :
      b.kind === "education" ? (b.data.is_current ? 1 : 0) : 0;

    // is_current DESC
    if (bIsCurrent !== aIsCurrent) return bIsCurrent - aIsCurrent;

    // start_date DESC
    const aKey =
      a.kind === "career" ? a.data.started_at :
      a.kind === "education" ? a.data.enrolled_at : "";
    const bKey =
      b.kind === "career" ? b.data.started_at :
      b.kind === "education" ? b.data.enrolled_at : "";
    if (bKey !== aKey) return bKey.localeCompare(aKey);

    // career before education tiebreak
    const kindOrder = (e: TimelineEntry) => (e.kind === "career" ? 0 : 1);
    return kindOrder(a) - kindOrder(b);
  });

  const result: TimelineEntry[] = [];
  if (hasFuture) result.push({ kind: "future" });
  return [...result, ...combined];
}

/**
 * TimelineEntry[] を走査し、連続する isParallel=true かつ同一開始月の
 * career エントリを "career-group" にまとめた RenderEntry[] を返す。
 *
 * - 2件以上が連続する場合のみグループ化（1件のみの isParallel はフォールバックで career のまま）
 * - グループ化はソート後の配列をそのまま走査するため、ソート順を変えない
 */
function groupParallelEntries(entries: TimelineEntry[]): RenderEntry[] {
  const result: RenderEntry[] = [];
  let i = 0;
  while (i < entries.length) {
    const entry = entries[i];
    if (entry.kind === "career" && entry.isParallel) {
      const month = entry.data.started_at.slice(0, 7);
      const group: CareerEntry[] = [entry.data];
      let j = i + 1;
      while (j < entries.length) {
        const next = entries[j];
        if (
          next.kind === "career" &&
          next.isParallel &&
          next.data.started_at.slice(0, 7) === month
        ) {
          group.push(next.data);
          j++;
        } else {
          break;
        }
      }
      if (group.length >= 2) {
        result.push({ kind: "career-group", items: group });
      } else {
        // isParallel=true だが連続仲間なし（防衛的フォールバック）→ 通常カード
        result.push(entry);
      }
      i = j;
    } else {
      result.push(entry as RenderEntry);
      i++;
    }
  }
  return result;
}

/**
 * 同社グループ化のためのキー生成。
 *
 * - master 企業（company_id あり）: `m:${company_id}` で確実に同一企業を識別
 * - custom 企業（company_id なし、company_text あり）: `c:${company_name}` で文字列一致
 * - anon 企業（company_anonymized）: `a:${id}` で個別扱い（"非公開企業"の誤統合を防ぐ）
 *
 * CareerHistoryEditor の groupStints と同じ規約。
 */
function getCompanyKey(c: CareerEntry): string {
  if (c.company_id) return `m:${c.company_id}`;
  // company_id なし & "非公開企業" 表記 = 匿名企業（XOR 制約により company_anonymized が NOT NULL）
  if (c.company_name === "非公開企業") return `a:${c.id}`;
  return `c:${c.company_name}`;
}

/**
 * RenderEntry[] を走査し、連続する同一会社の単独 career エントリを
 * "career-same-company" バリアントにまとめた RenderEntry[] を返す。
 *
 * 設計:
 * - 入力は groupParallelEntries の出力（並行グループ化済み）
 * - "career-group" バリアント（並行職）はそのまま通過（同社グループ化の対象外）
 * - 単独 "career" エントリのうち、ソート順で連続する同社のものをグループ化
 * - 2件以上が連続する場合のみ "career-same-company" に集約、1件のみは "career" のまま
 * - 出戻りパターン（連続しない同社）は自然に別グループになる（意図通り）
 *
 * 注意: ソート順を変えない走査のため、is_current DESC → started_at DESC が維持される。
 */
function groupSameCompanyEntries(entries: RenderEntry[]): RenderEntry[] {
  const result: RenderEntry[] = [];
  let i = 0;
  while (i < entries.length) {
    const entry = entries[i];

    // career-group / education / future は対象外、そのまま通過
    if (entry.kind !== "career") {
      result.push(entry);
      i++;
      continue;
    }

    const key = getCompanyKey(entry.data);
    const group: CareerEntry[] = [entry.data];
    let j = i + 1;
    while (j < entries.length) {
      const next = entries[j];
      if (next.kind === "career" && getCompanyKey(next.data) === key) {
        group.push(next.data);
        j++;
      } else {
        break;
      }
    }

    if (group.length >= 2) {
      result.push({ kind: "career-same-company", items: group, companyKey: key });
    } else {
      result.push(entry);
    }
    i = j;
  }
  return result;
}

// ─── Badge sub-components ─────────────────────────────────────────────────────

function CurrentBadge() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.04em",
        color: "var(--success)",
        background: "var(--success-soft)",
        border: "1px solid #6ee7b7",
        borderRadius: 4,
        padding: "1px 6px",
        verticalAlign: "middle",
        marginLeft: 6,
        lineHeight: 1.6,
      }}
    >
      <span className="tl-pulse-dot" />
      在籍中
    </span>
  );
}

function EnrolledBadge() {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.04em",
        color: "var(--purple)",
        background: "var(--purple-soft)",
        border: "1px solid #ddd6fe",
        borderRadius: 4,
        padding: "1px 6px",
        verticalAlign: "middle",
        marginLeft: 6,
        lineHeight: 1.6,
      }}
    >
      在学中
    </span>
  );
}

function ParallelBadge() {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.04em",
        color: "var(--warm)",
        background: "var(--warm-soft)",
        border: "1px solid #fde68a",
        borderRadius: 4,
        padding: "1px 6px",
        verticalAlign: "middle",
        marginLeft: 6,
        lineHeight: 1.6,
      }}
    >
      並行
    </span>
  );
}

// ─── Icon circle sub-components ───────────────────────────────────────────────

/**
 * タイムラインのアイコン列（64px date col の右）に表示するアイコン円。
 *
 * 3 段階フォールバック（A-1 判断 C/D）:
 *   1. logo_url あり → CompanyLogoImg（画像 + onError fallback は Client Component）
 *   2. logo_url なし かつ logo_letter + logo_gradient あり → LetterCircle
 *   3. どちらもなし → Briefcase アイコン（段階6-3-2 と同一）
 *
 * 並行勤務グループ（A-2）のアイコン列は `isCurrent` ベースで色を決め、
 * ロゴは各 ParallelCareerCard 内の小ロゴで表示する（H-iii 方針）。
 */
function CompanyLogoIcon({
  isCurrent,
  logo_url,
  logo_letter,
  logo_gradient,
  company_name,
}: {
  isCurrent: boolean;
  logo_url?: string | null;
  logo_letter?: string | null;
  logo_gradient?: string | null;
  company_name?: string;
}) {
  const wrapStyle: React.CSSProperties = {
    width: 64,
    height: 64,
    borderRadius: 11,
    flexShrink: 0,
    margin: "0 auto",
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  // ステップ 0: 非公開企業 → 鍵アイコン（logo_letter/gradient より先に判定）
  // timeline.ts が anon 企業に logo_letter="非" を設定するため、先に isAnonymous をチェックする
  const isAnonymous = company_name === "非公開企業" || company_name === "非公開" || company_name === "不明な企業";
  if (isAnonymous) {
    return (
      <div style={{ ...wrapStyle, background: "linear-gradient(135deg, #64748B 0%, #94A3B8 100%)" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
    );
  }

  // ステップ 1: logo_url あり → 画像ロゴ（onError は CompanyLogoImg が担当）
  if (logo_url) {
    return (
      <div style={wrapStyle}>
        <CompanyLogoImg
          logoUrl={logo_url}
          logoLetter={logo_letter ?? null}
          logoGradient={logo_gradient ?? null}
          size={64}
        />
      </div>
    );
  }

  // ステップ 2: logo_letter + logo_gradient あり → ブランド円
  if (logo_letter && logo_gradient) {
    return (
      <div style={wrapStyle}>
        <LetterCircle letter={logo_letter} gradient={logo_gradient} size={64} />
      </div>
    );
  }

  // ステップ 3: それ以外 → 会社名イニシャル円
  const fallbackLetter = company_name ? company_name.charAt(0) : "?";
  const fallbackGrad = isCurrent
    ? "linear-gradient(135deg, var(--royal) 0%, var(--accent) 100%)"
    : "linear-gradient(135deg, #64748B 0%, #94A3B8 100%)";
  return (
    <div style={{ ...wrapStyle, background: fallbackGrad }}>
      <span style={{ color: "#fff", fontSize: 18, fontWeight: 700, fontFamily: "Inter, sans-serif", lineHeight: 1 }}>
        {fallbackLetter}
      </span>
    </div>
  );
}

/** 並行勤務グループのアイコン列用（H-iii: グループ全体を is_current で色分け、ロゴはカード内）*/
function CareerIcon({ isCurrent }: { isCurrent: boolean }) {
  return (
    <div
      style={{
        width: 64,
        height: 64,
        borderRadius: 11,
        background: isCurrent ? "var(--royal)" : "var(--ink-mute)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        margin: "0 auto",
        position: "relative",
        zIndex: 1,
      }}
    >
      <Briefcase size={20} color="#fff" strokeWidth={2} />
    </div>
  );
}

// EducationIcon は段階6-6 Phase 4 で SchoolLogoImg に完全置換（判断点 #9 案 a）

function FutureIcon({ avatarColor, initial }: { avatarColor: string; initial: string }) {
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: avatarColor,
        border: "2px solid #fff",
        boxShadow: "0 0 0 1px var(--royal-100)",
        color: "#fff",
        fontSize: 16,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        margin: "0 auto",
        position: "relative",
        zIndex: 1,
      }}
    >
      {initial}
    </div>
  );
}

// ─── Description gate (未ログイン時) ─────────────────────────────────────────

function DescriptionGate() {
  return (
    <div style={{ position: "relative", marginTop: 8, borderRadius: 8, overflow: "hidden" }}>
      {/* Blurred dummy text */}
      <p style={{
        fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.75, margin: 0,
        filter: "blur(4px)", userSelect: "none", pointerEvents: "none",
        whiteSpace: "pre-wrap",
      }}>
        {"業務内容の詳細は登録後にご覧いただけます。\nこの経歴での具体的な職務内容・成果・担当領域について確認できます。"}
      </p>
      {/* Overlay CTA */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(248,250,252,0.7)", backdropFilter: "blur(1px)",
      }}>
        <a href="/auth" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 16px", borderRadius: 100,
          background: "var(--royal)", color: "#fff",
          fontSize: 12, fontWeight: 600, textDecoration: "none",
          boxShadow: "0 2px 8px rgba(0,35,102,0.25)",
          whiteSpace: "nowrap",
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          登録して続きを読む
        </a>
      </div>
    </div>
  );
}

// ─── Content sub-components ───────────────────────────────────────────────────

function CareerContent({
  data,
  isParallel,
  isAuthenticated = true,
}: {
  data: CareerEntry;
  isParallel: boolean;
  isAuthenticated?: boolean;
}) {
  const duration = formatDuration(data.started_at, data.ended_at);
  const startLabel = formatYM(data.started_at);
  const endLabel = data.is_current ? "現在" : data.ended_at ? formatYM(data.ended_at) : "";
  const hasDesc = !!data.description;

  return (
    <div style={{ paddingTop: 10, paddingBottom: 22, paddingLeft: 8 }}>
      {/* Company + employment type + badges */}
      <div style={{ marginBottom: 4, lineHeight: 1.35 }}>
        {data.company_id ? (
          <Link
            href={`/companies/${data.company_id}`}
            className="company-name-link"
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#111",
              textDecoration: "none",
            }}
          >
            {shortCompanyName(data.company_name)}
          </Link>
        ) : (
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#111",
            }}
          >
            {shortCompanyName(data.company_name)}
          </span>
        )}
        {data.employment_type && (
          <span style={{ fontSize: 15, fontWeight: 400, color: "var(--ink-soft)" }}>
            {" · "}{data.employment_type}
          </span>
        )}
        {data.is_current && <CurrentBadge />}
        {isParallel && <ParallelBadge />}
      </div>

      {/* Role — merged to single line */}
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 5, lineHeight: 1.45 }}>
        {data.role_label}{data.role_title && ` · ${data.role_title}`}
      </div>

      {/* Date + duration — always inline */}
      <div style={{
        fontFamily: "Inter, sans-serif", fontSize: 12,
        color: "var(--ink-mute)", marginBottom: hasDesc ? 12 : 0, lineHeight: 1.4,
      }}>
        {startLabel} – {endLabel}{duration && ` · ${duration}`}
      </div>

      {/* Description */}
      {data.description && (
        isAuthenticated ? (
          <div style={{ maxWidth: 560 }}>
            <ExpandableDesc text={data.description} />
          </div>
        ) : (
          <DescriptionGate />
        )
      )}

      {/* Join reason — "なぜこの会社を選んだか" */}
      {data.join_reason && (
        <div style={{
          marginTop: 12,
          padding: "10px 12px",
          borderRadius: 8,
          background: "linear-gradient(135deg, #f8f4ff 0%, #eff6ff 100%)",
          border: "1px solid #e8e0ff",
          maxWidth: 560,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
            </svg>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--purple)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Why I joined
            </span>
          </div>
          <p style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.65, margin: 0, whiteSpace: "pre-wrap" }}>
            {data.join_reason}
          </p>
        </div>
      )}
    </div>
  );
}

function EducationContent({ data }: { data: EducationEntry }) {
  const duration = formatDuration(data.enrolled_at, data.graduated_at);
  const startLabel = formatYM(data.enrolled_at);
  const endLabel = data.is_current ? "現在" : data.graduated_at ? formatYM(data.graduated_at) : "";

  return (
    <div style={{ paddingTop: 8, paddingBottom: 18, paddingLeft: 14 }}>
      {/* School + badge */}
      <div style={{ marginBottom: 3, lineHeight: 1.3 }}>
        <span
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#111",
          }}
        >
          {data.school}
        </span>
        {data.is_current && <EnrolledBadge />}
      </div>

      {/* Faculty / Degree */}
      {(data.faculty || data.degree) && (
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-soft)", marginBottom: 4, lineHeight: 1.4 }}>
          {[data.faculty, data.degree].filter(Boolean).join(" · ")}
        </div>
      )}

      {/* Date + duration — always inline */}
      <div style={{
        fontFamily: "Inter, sans-serif", fontSize: 12,
        color: "var(--ink-mute)", lineHeight: 1.4,
      }}>
        {startLabel} – {endLabel}{duration && ` · ${duration}`}
      </div>
    </div>
  );
}

/**
 * 並行グループ内の個別カード（d-2 スタイル）。
 * CareerContent と同内容だが、padding 規則と border-left は CSS クラスで制御する。
 * H-iii: グループアイコン列はそのまま維持し、各カードの会社名左に 24px 小ロゴを表示する。
 */
function ParallelCareerCard({ data, isAuthenticated = true }: { data: CareerEntry; isAuthenticated?: boolean }) {
  const duration = formatDuration(data.started_at, data.ended_at);

  // 小ロゴ 24px（H-iii 方針: 各カード固有の企業アイコン）
  const SmallLogo = () => {
    // 非公開企業 → 小さなロックアイコン（"非" 文字を抑制）
    const isAnonEntry = data.company_name === "非公開企業" || data.company_name === "非公開" || data.company_name === "不明な企業";
    if (isAnonEntry) {
      return (
        <div style={{
          width: 24, height: 24, borderRadius: 5, flexShrink: 0,
          background: "linear-gradient(135deg, #64748B, #94A3B8)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2.5" strokeLinecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
      );
    }
    if (data.logo_url) {
      return (
        <CompanyLogoImg
          logoUrl={data.logo_url}
          logoLetter={data.logo_letter ?? null}
          logoGradient={data.logo_gradient ?? null}
          size={24}
        />
      );
    }
    if (data.logo_letter && data.logo_gradient) {
      return (
        <LetterCircle
          letter={data.logo_letter}
          gradient={data.logo_gradient}
          size={24}
        />
      );
    }
    return null; // フォールバックなし = 小ロゴ非表示
  };

  const startLabel = formatYM(data.started_at);
  const endLabel = data.is_current ? "現在" : data.ended_at ? formatYM(data.ended_at) : "";

  return (
    <div
      className="d2-parallel-card"
      style={{ flex: 1, padding: "12px 14px 16px", minWidth: 0 }}
    >
      {/* Company 名行: 小ロゴ + 会社名 + 雇用形態 + badges */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
        <SmallLogo />
        {data.company_id ? (
          <Link
            href={`/companies/${data.company_id}`}
            className="company-name-link"
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#111",
              textDecoration: "none",
            }}
          >
            {shortCompanyName(data.company_name)}
          </Link>
        ) : (
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#111",
            }}
          >
            {shortCompanyName(data.company_name)}
          </span>
        )}
        {data.employment_type && (
          <span style={{ fontSize: 13, fontWeight: 400, color: "var(--ink-soft)" }}>
            · {data.employment_type}
          </span>
        )}
        {data.is_current && <CurrentBadge />}
        <ParallelBadge />
      </div>

      {/* Role — merged to single line */}
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-soft)", marginBottom: 4, lineHeight: 1.4 }}>
        {data.role_label}{data.role_title && ` · ${data.role_title}`}
      </div>

      {/* Date + duration — always inline */}
      <div style={{
        fontFamily: "Inter, sans-serif", fontSize: 12,
        color: "var(--ink-mute)", marginBottom: data.description ? 8 : 0, lineHeight: 1.4,
      }}>
        {startLabel} – {endLabel}{duration && ` · ${duration}`}
      </div>

      {/* Description */}
      {data.description && (
        isAuthenticated ? (
          <div style={{ maxWidth: 480 }}>
            <ExpandableDesc text={data.description} />
          </div>
        ) : (
          <DescriptionGate />
        )
      )}
    </div>
  );
}

// FutureContent は FutureSectionEditor に移行（Commit D）

// ─── Main component ───────────────────────────────────────────────────────────

export default function MergedTimeline({
  careers,
  educations,
  future,
  viewerIsOwner = false,
  isAuthenticated = true,
  collapseAfter,
}: MergedTimelineProps) {
  const hasFuture = future != null && (!!(future.text?.trim()) || viewerIsOwner);
  const parallelIds = buildParallelMap(careers);
  const entries = buildTimeline(careers, educations, hasFuture, parallelIds);
  const renderEntries = groupSameCompanyEntries(groupParallelEntries(entries));

  const [isExpanded, setIsExpanded] = useState(false);
  // education + future entries are always visible; only career entries count toward the collapse limit
  const alwaysVisibleEntries = renderEntries.filter(
    (e) => e.kind === "education" || e.kind === "future"
  );
  const collapsibleEntries = renderEntries.filter(
    (e) => e.kind !== "education" && e.kind !== "future"
  );
  const hasMore = collapseAfter !== undefined && collapsibleEntries.length > collapseAfter;
  const hiddenCount = hasMore ? collapsibleEntries.length - collapseAfter : 0;
  const visibleCollapsible = hasMore && !isExpanded
    ? collapsibleEntries.slice(0, collapseAfter)
    : collapsibleEntries;
  const visibleSet = new Set([...alwaysVisibleEntries, ...visibleCollapsible]);
  const visibleEntries = hasMore && !isExpanded
    ? renderEntries.filter((e) => visibleSet.has(e))
    : renderEntries;

  if (renderEntries.length === 0) return null;

  return (
    <>
      {/* Scoped responsive styles */}
      <style>{`
        .merged-timeline {
          position: relative;
          padding: 0;
        }

        /* Vertical connecting line */
        .merged-timeline::before {
          content: "";
          position: absolute;
          top: 40px;
          bottom: 40px;
          left: 40px; /* center of 80px icon column */
          width: 2px;
          background: #CBD5E1;
          z-index: 0;
        }

        .tl-row {
          display: grid;
          grid-template-columns: 80px 1fr;
          align-items: start;
          min-height: 60px;
        }

        /* エントリ間セパレーター */
        .tl-row + .tl-row {
          border-top: 1px solid var(--line-soft);
          padding-top: 8px;
          margin-top: 4px;
        }

        /* d-2: 並行勤務グループ — 横並びカード */
        .d2-parallel-inner {
          display: flex;
          flex-direction: row;
          background: var(--bg-tint);
          border: 1px solid var(--line);
          border-radius: 8px;
          overflow: hidden;
        }

        /* 2枚目以降のカードに縦区切り線 */
        .d2-parallel-card + .d2-parallel-card {
          border-left: 2px solid var(--line);
        }

        @media (max-width: 639px) {
          /* モバイル: カードを縦積みに切り替え */
          .d2-parallel-inner {
            flex-direction: column;
          }

          /* 縦積み時は横線に切り替え */
          .d2-parallel-card + .d2-parallel-card {
            border-left: none;
            border-top: 2px solid var(--line);
          }
        }

        /* Company name hover link */
        .company-name-link {
          transition: color 0.15s, text-decoration 0.15s;
        }
        .company-name-link:hover {
          color: var(--royal) !important;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        /* 在籍中バッジのパルスドット */
        .tl-pulse-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--success);
          animation: pulseDot 1.5s ease-in-out infinite;
          flex-shrink: 0;
        }

        /* ② 現職エントリー背景: 緑のグラデーションティント */
        .tl-row-current {
          background: linear-gradient(90deg, rgba(5,150,105,0.06) 0%, transparent 60%);
          border-radius: 8px;
        }
      `}</style>

      <div className="merged-timeline">
        {visibleEntries.map((entry, _idx) => {
          if (entry.kind === "future") {
            return (
              <div key="future" className="tl-row">
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    paddingTop: 8,
                  }}
                >
                  <FutureIcon
                    avatarColor={future!.avatarColor}
                    initial={future!.initial}
                  />
                </div>
                <FutureSectionEditor
                  initialText={future!.text}
                  viewerIsOwner={viewerIsOwner}
                />
              </div>
            );
          }

          if (entry.kind === "career") {
            const c = entry.data;

            return (
              <div key={`career-${c.id}`} className={["tl-row", c.is_current && "tl-row-current"].filter(Boolean).join(" ")}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    paddingTop: 8,
                  }}
                >
                  <CompanyLogoIcon
                    isCurrent={c.is_current}
                    logo_url={c.logo_url}
                    logo_letter={c.logo_letter}
                    logo_gradient={c.logo_gradient}
                    company_name={c.company_name}
                  />
                </div>
                <CareerContent data={c} isParallel={entry.isParallel} isAuthenticated={isAuthenticated} />
              </div>
            );
          }

          if (entry.kind === "career-group") {
            const items = entry.items;
            const anyIsCurrent = items.some((c) => c.is_current);
            // グループ共通の開始月（全件同一）
            const groupStart = items[0].started_at;
            // グループ終了: any is_current なら null（「現在」）、なければ最遅 ended_at
            const groupEnd = anyIsCurrent
              ? null
              : items.reduce<string | null>((latest, c) => {
                  if (!c.ended_at) return latest;
                  return !latest || c.ended_at > latest ? c.ended_at : latest;
                }, null);
            const startLabel = formatYM(groupStart);
            const endLabel = anyIsCurrent ? "現在" : groupEnd ? formatYM(groupEnd) : "";
            const duration = formatDuration(groupStart, groupEnd);

            return (
              <div key={`group-${groupStart.slice(0, 7)}`} className={`tl-row${anyIsCurrent ? " tl-row-current" : ""}`}>
                {/* アイコン: グループ内に is_current があれば royal, なければ muted（暫定 A-1 pending） */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    paddingTop: 8,
                  }}
                >
                  <CareerIcon isCurrent={anyIsCurrent} />
                </div>
                {/* d-2: bg-tint 背景 + border-left 区切り */}
                <div style={{ paddingTop: 8, paddingBottom: 28, paddingLeft: 14 }}>
                  {/* グループ期間インライン表示 */}
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "var(--ink-mute)", marginBottom: 10, lineHeight: 1.4 }}>
                    {startLabel} – {endLabel}{duration && ` · ${duration}`}
                  </div>
                  <div className="d2-parallel-inner">
                    {items.map((c) => (
                      <ParallelCareerCard key={c.id} data={c} isAuthenticated={isAuthenticated} />
                    ))}
                  </div>
                </div>
              </div>
            );
          }

          if (entry.kind === "career-same-company") {
            const items = entry.items;
            // ソートは is_current DESC → started_at DESC で来ているため、items[0] が「最新ポジション」
            // グループ全体の代表として items[0] の会社情報を使う
            const head = items[0];
            const anyIsCurrent = items.some((c) => c.is_current);

            // グループ全体の期間: 最古 started_at 〜 最新 ended_at（any is_current なら null）
            const earliestStart = items.reduce((earliest, c) =>
              c.started_at < earliest ? c.started_at : earliest, items[0].started_at);
            const latestEnd = anyIsCurrent
              ? null
              : items.reduce<string | null>((latest, c) => {
                  if (!c.ended_at) return latest;
                  return !latest || c.ended_at > latest ? c.ended_at : latest;
                }, null);

            const duration = formatDuration(earliestStart, latestEnd);

            return (
              <div key={`same-company-${entry.companyKey}`} className={`tl-row${anyIsCurrent ? " tl-row-current" : ""}`}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    paddingTop: 8,
                  }}
                >
                  <CompanyLogoIcon
                    isCurrent={anyIsCurrent}
                    logo_url={head.logo_url}
                    logo_letter={head.logo_letter}
                    logo_gradient={head.logo_gradient}
                    company_name={head.company_name}
                  />
                </div>
                <div style={{ paddingTop: 8, paddingBottom: 28, paddingLeft: 14 }}>
                  <div>
                    {/* 会社名ヘッダー */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, flexWrap: "wrap", lineHeight: 1.3 }}>
                      {head.company_id ? (
                        <Link href={`/companies/${head.company_id}`} className="company-name-link"
                          style={{ fontSize: 18, fontWeight: 700, color: "#111", textDecoration: "none" }}>
                          {shortCompanyName(head.company_name)}
                        </Link>
                      ) : (
                        <span style={{ fontSize: 18, fontWeight: 700, color: "#111" }}>
                          {shortCompanyName(head.company_name)}
                        </span>
                      )}
                      <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "var(--ink-mute)", fontWeight: 400 }}>
                        {duration}
                      </span>
                      {anyIsCurrent && <CurrentBadge />}
                    </div>

                    {/* ポジションリスト — 左ボーダースタイル */}
                    <div style={{ paddingLeft: 14, borderLeft: "2px solid var(--line)" }}>
                      {items.map((c, idx) => {
                        const posDuration = formatDuration(c.started_at, c.ended_at);
                        const isLast = idx === items.length - 1;
                        return (
                          <div key={c.id} style={{ paddingBottom: isLast ? 0 : 16 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 3, lineHeight: 1.4 }}>
                              {c.role_label}{c.role_title && ` · ${c.role_title}`}
                            </div>
                            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "var(--ink-mute)", marginBottom: c.description ? 8 : 0, lineHeight: 1.4 }}>
                              {formatYM(c.started_at)} – {c.is_current ? "現在" : c.ended_at ? formatYM(c.ended_at) : ""}
                              {posDuration && ` · ${posDuration}`}
                            </div>
                            {c.description && (
                              isAuthenticated ? (
                                <div style={{ maxWidth: 520 }}>
                                  <ExpandableDesc text={c.description} />
                                </div>
                              ) : (
                                <DescriptionGate />
                              )
                            )}
                            {c.join_reason && (
                              <div style={{
                                marginTop: 8,
                                padding: "8px 10px",
                                borderRadius: 7,
                                background: "linear-gradient(135deg, #f8f4ff 0%, #eff6ff 100%)",
                                border: "1px solid #e8e0ff",
                                maxWidth: 520,
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2.5" strokeLinecap="round">
                                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                                  </svg>
                                  <span style={{ fontSize: 9, fontWeight: 700, color: "var(--purple)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Why I joined</span>
                                </div>
                                <p style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.65, margin: 0, whiteSpace: "pre-wrap" }}>
                                  {c.join_reason}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          if (entry.kind === "education") {
            const e = entry.data;

            return (
              <div key={`edu-${e.id}`} className="tl-row">
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    paddingTop: 8,
                  }}
                >
                  <SchoolLogoImg schoolMaster={e.school_master ?? null} size={64} />
                </div>
                <EducationContent data={e} />
              </div>
            );
          }

          return null;
        })}
      </div>
      {hasMore && !isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            marginTop: 4, padding: "8px 0",
            background: "none", border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 600, color: "var(--royal)",
            textDecoration: "none",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
          すべての経歴を見る ({hiddenCount}件)
        </button>
      )}
      {isExpanded && hasMore && (
        <button
          onClick={() => setIsExpanded(false)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            marginTop: 4, padding: "8px 0",
            background: "none", border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 600, color: "var(--ink-mute)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
          折りたたむ
        </button>
      )}
    </>
  );
}
