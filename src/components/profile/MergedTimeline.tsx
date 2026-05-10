import { Briefcase, GraduationCap, Star } from "lucide-react";

// ─── Public types (re-exported for use in Commit C) ───────────────────────────

export interface CareerEntry {
  id: string;
  /** 表示用企業名（匿名化済みの場合は "非公開" 等） */
  company_name: string;
  /** ロールカテゴリのラベル（例: "プロダクトマネージャー"） */
  role_label: string;
  /** 自由記述の役職名（例: "Bakuraku事業 PdM"） */
  role_title?: string | null;
  started_at: string;       // "YYYY-MM-DD"
  ended_at: string | null;  // "YYYY-MM-DD" | null when is_current
  is_current: boolean;
  description?: string | null;
}

export interface EducationEntry {
  id: string;
  school: string;
  faculty?: string | null;
  degree?: string | null;
  enrolled_at: string;         // "YYYY-MM-DD"
  graduated_at: string | null; // "YYYY-MM-DD" | null when is_current
  is_current: boolean;
}

export interface MergedTimelineProps {
  careers: CareerEntry[];
  educations: EducationEntry[];
  /** ow_users.future_aspirations テキスト */
  future?: string | null;
  /** プロフィールオーナー本人が閲覧中かどうか（CTA 表示制御） */
  viewerIsOwner?: boolean;
}

// ─── Internal discriminated union ─────────────────────────────────────────────

type TimelineEntry =
  | { kind: "future" }
  | { kind: "career";    data: CareerEntry;    isParallel: boolean }
  | { kind: "education"; data: EducationEntry };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** "YYYY-MM-DD" → "YYYY.MM" */
function formatYM(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length < 2) return dateStr;
  return `${parts[0]}.${parts[1]}`;
}

/** 期間文字列を生成: "2年3ヶ月" */
function formatDuration(start: string, end: string | null): string {
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date();

  const totalMonths =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth());

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

// ─── Badge sub-components ─────────────────────────────────────────────────────

function CurrentBadge() {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.04em",
        color: "var(--royal)",
        background: "var(--royal-50)",
        border: "1px solid var(--royal-100)",
        borderRadius: 4,
        padding: "1px 6px",
        verticalAlign: "middle",
        marginLeft: 6,
        lineHeight: 1.6,
      }}
    >
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

function CareerIcon({ isCurrent }: { isCurrent: boolean }) {
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
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
      <Briefcase size={16} color="#fff" strokeWidth={2} />
    </div>
  );
}

function EducationIcon({ isCurrent }: { isCurrent: boolean }) {
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: isCurrent ? "var(--purple)" : "var(--ink-mute)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        margin: "0 auto",
        position: "relative",
        zIndex: 1,
      }}
    >
      <GraduationCap size={16} color="#fff" strokeWidth={2} />
    </div>
  );
}

function FutureIcon() {
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: "var(--warm)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        margin: "0 auto",
        position: "relative",
        zIndex: 1,
      }}
    >
      <Star size={16} color="#fff" strokeWidth={2} fill="#fff" />
    </div>
  );
}

// ─── Date column sub-component ────────────────────────────────────────────────

function DateCol({
  startLabel,
  endLabel,
  duration,
}: {
  startLabel: string;
  endLabel: string;
  duration: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 2,
        paddingTop: 8,
        paddingRight: 8,
      }}
    >
      <span
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--ink-soft)",
          whiteSpace: "nowrap",
        }}
      >
        {startLabel}
      </span>
      {endLabel && (
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 11,
            color: "var(--ink-mute)",
            whiteSpace: "nowrap",
          }}
        >
          {endLabel}
        </span>
      )}
      {duration && (
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 10,
            color: "var(--ink-mute)",
            whiteSpace: "nowrap",
          }}
        >
          {duration}
        </span>
      )}
    </div>
  );
}

// ─── Content sub-components ───────────────────────────────────────────────────

function CareerContent({
  data,
  isParallel,
}: {
  data: CareerEntry;
  isParallel: boolean;
}) {
  const duration = formatDuration(data.started_at, data.ended_at);

  return (
    <div style={{ paddingTop: 8, paddingBottom: 20, paddingLeft: 12 }}>
      {/* Company + badges */}
      <div style={{ marginBottom: 2 }}>
        <span
          style={{
            fontFamily: "'Noto Serif JP', serif",
            fontSize: 14,
            fontWeight: 700,
            color: "var(--ink)",
          }}
        >
          {data.company_name}
        </span>
        {data.is_current && <CurrentBadge />}
        {isParallel && <ParallelBadge />}
      </div>

      {/* Role label */}
      <div
        style={{
          fontSize: 13,
          color: "var(--ink-soft)",
          marginBottom: data.role_title ? 2 : 0,
        }}
      >
        {data.role_label}
      </div>

      {/* Role title (free text) */}
      {data.role_title && (
        <div
          style={{
            fontSize: 12,
            color: "var(--ink-mute)",
            marginBottom: 4,
          }}
        >
          {data.role_title}
        </div>
      )}

      {/* Duration (mobile only — desktop shows in DateCol) */}
      {duration && (
        <div
          className="tl-duration-mobile"
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 11,
            color: "var(--ink-mute)",
            marginBottom: 4,
          }}
        >
          {formatYM(data.started_at)}
          {" — "}
          {data.is_current ? "現在" : data.ended_at ? formatYM(data.ended_at) : ""}
          {" "}（{duration}）
        </div>
      )}

      {/* Description */}
      {data.description && (
        <p
          style={{
            fontSize: 13,
            color: "var(--ink-soft)",
            lineHeight: 1.75,
            margin: "6px 0 0",
            whiteSpace: "pre-wrap",
          }}
        >
          {data.description}
        </p>
      )}
    </div>
  );
}

function EducationContent({ data }: { data: EducationEntry }) {
  const duration = formatDuration(data.enrolled_at, data.graduated_at);

  return (
    <div style={{ paddingTop: 8, paddingBottom: 20, paddingLeft: 12 }}>
      {/* School + badge */}
      <div style={{ marginBottom: 2 }}>
        <span
          style={{
            fontFamily: "'Noto Serif JP', serif",
            fontSize: 14,
            fontWeight: 700,
            color: "var(--ink)",
          }}
        >
          {data.school}
        </span>
        {data.is_current && <EnrolledBadge />}
      </div>

      {/* Faculty / Degree */}
      {(data.faculty || data.degree) && (
        <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 4 }}>
          {[data.faculty, data.degree].filter(Boolean).join(" · ")}
        </div>
      )}

      {/* Duration (mobile) */}
      {duration && (
        <div
          className="tl-duration-mobile"
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 11,
            color: "var(--ink-mute)",
          }}
        >
          {formatYM(data.enrolled_at)}
          {" — "}
          {data.is_current ? "現在" : data.graduated_at ? formatYM(data.graduated_at) : ""}
          {" "}（{duration}）
        </div>
      )}
    </div>
  );
}

function FutureContent({
  text,
  viewerIsOwner,
}: {
  text: string | null | undefined;
  viewerIsOwner: boolean;
}) {
  const hasText = !!text?.trim();

  return (
    <div style={{ paddingTop: 8, paddingBottom: 24, paddingLeft: 12 }}>
      <div
        style={{
          fontFamily: "'Noto Serif JP', serif",
          fontSize: 14,
          fontWeight: 700,
          color: "var(--warm)",
          marginBottom: 8,
        }}
      >
        目指す姿・ありたい未来
      </div>

      {hasText ? (
        <p
          style={{
            fontSize: 13,
            color: "var(--ink-soft)",
            lineHeight: 1.85,
            margin: 0,
            whiteSpace: "pre-wrap",
          }}
        >
          {text}
        </p>
      ) : viewerIsOwner ? (
        /* CTA placeholder — onClick は Commit D で追加 */
        <button
          type="button"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "var(--warm)",
            background: "var(--warm-soft)",
            border: "1px dashed #fde68a",
            borderRadius: 8,
            padding: "8px 16px",
            cursor: "pointer",
            fontFamily: "'Noto Sans JP', sans-serif",
          }}
        >
          <Star size={14} strokeWidth={2} />
          目指す姿を書いてみる
        </button>
      ) : null}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MergedTimeline({
  careers,
  educations,
  future,
  viewerIsOwner = false,
}: MergedTimelineProps) {
  const hasFuture = !!(future?.trim()) || viewerIsOwner;
  const parallelIds = buildParallelMap(careers);
  const entries = buildTimeline(careers, educations, hasFuture, parallelIds);

  if (entries.length === 0) return null;

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
          top: 18px;
          bottom: 18px;
          left: 86px; /* 64px date col + center of 44px icon col */
          width: 2px;
          background: var(--line);
          z-index: 0;
        }

        .tl-row {
          display: grid;
          grid-template-columns: 64px 44px 1fr;
          align-items: start;
          min-height: 60px;
        }

        .tl-date-col {
          /* visible on desktop */
        }

        .tl-duration-mobile {
          display: none;
        }

        @media (max-width: 639px) {
          .merged-timeline::before {
            left: 22px; /* center of 44px icon col */
          }

          .tl-row {
            grid-template-columns: 44px 1fr;
          }

          .tl-date-col {
            display: none;
          }

          .tl-duration-mobile {
            display: block;
          }
        }
      `}</style>

      <div className="merged-timeline">
        {entries.map((entry, idx) => {
          if (entry.kind === "future") {
            return (
              <div key="future" className="tl-row">
                <div className="tl-date-col" />
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    paddingTop: 8,
                  }}
                >
                  <FutureIcon />
                </div>
                <FutureContent text={future} viewerIsOwner={viewerIsOwner} />
              </div>
            );
          }

          if (entry.kind === "career") {
            const c = entry.data;
            const startLabel = formatYM(c.started_at);
            const endLabel = c.is_current ? "現在" : c.ended_at ? formatYM(c.ended_at) : "";
            const duration = formatDuration(c.started_at, c.ended_at);

            return (
              <div key={`career-${c.id}`} className="tl-row">
                <div className="tl-date-col">
                  <DateCol
                    startLabel={startLabel}
                    endLabel={endLabel}
                    duration={duration}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    paddingTop: 8,
                  }}
                >
                  <CareerIcon isCurrent={c.is_current} />
                </div>
                <CareerContent data={c} isParallel={entry.isParallel} />
              </div>
            );
          }

          if (entry.kind === "education") {
            const e = entry.data;
            const startLabel = formatYM(e.enrolled_at);
            const endLabel = e.is_current ? "現在" : e.graduated_at ? formatYM(e.graduated_at) : "";
            const duration = formatDuration(e.enrolled_at, e.graduated_at);

            return (
              <div key={`edu-${e.id}`} className="tl-row">
                <div className="tl-date-col">
                  <DateCol
                    startLabel={startLabel}
                    endLabel={endLabel}
                    duration={duration}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    paddingTop: 8,
                  }}
                >
                  <EducationIcon isCurrent={e.is_current} />
                </div>
                <EducationContent data={e} />
              </div>
            );
          }

          return null;
        })}
      </div>
    </>
  );
}
