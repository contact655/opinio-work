"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export type AmbassadorCard = {
  adminId: string;
  userId: string;
  name: string;
  initial: string;
  gradient: string;
  avatarUrl: string | null;
  roleTitle: string | null;
  department: string | null;
  talkThemes: string[];
  companyId: string;
  companyName: string;
  companyPhase: string | null;
  companyIndustry: string | null;
  companyLogoUrl: string | null;
  companyLogoGradient: string | null;
  companyLogoLetter: string | null;
  currentJobType: string | null;
  experienceYears: number | null;
  birthYear: number | null;
  workStyle: string | null;
  preferredLocations: string[] | null;
  skillTags: string[];
  createdAt: string | null;
};

type Props = { ambassadors: AmbassadorCard[] };

// ── フィルタ・ソート定数 ────────────────────────────────────────────
const ROLE_OPTIONS = [
  { value: "inside_sales",  label: "インサイドセールス", pattern: /インサイドセールス|inside sales|sdr|bdr|テレセールス/i },
  { value: "field_sales",   label: "フィールドセールス", pattern: /フィールドセールス|field sales|account executive|account manager|ae\b|営業/i },
  { value: "cs",    label: "カスタマーサクセス", pattern: /カスタマーサクセス|customer success|csm/i },
  { value: "mkt",   label: "マーケティング",     pattern: /マーケ|market/i },
  { value: "eng",   label: "エンジニア",         pattern: /エンジニア|engineer|開発|dev|tech|ソフトウェア/i },
  { value: "pm",    label: "PM / PdM",           pattern: /プロダクトマネージャー|product manager|\bpm\b|pdm/i },
  { value: "hr",    label: "人事・採用",          pattern: /人事|採用|hr|recruit/i },
  { value: "exec",  label: "経営・役員",          pattern: /CEO|CTO|COO|CFO|VP|役員|代表|社長|事業部長/i },
];

const COMPANY_TYPE_OPTIONS = [
  { value: "startup",    label: "スタートアップ", phasePattern: /シード|seed|シリーズ[ABC]|series[_-]?[abc]/i },
  { value: "unicorn",    label: "ユニコーン",     phasePattern: /unicorn|ユニコーン/i },
  { value: "enterprise", label: "大手企業",       phasePattern: /大手/i },
  { value: "foreign",    label: "外資系企業",     phasePattern: /外資/i },
];

const AGE_OPTIONS = [
  { value: "20s", label: "20代", min: 20, max: 29 },
  { value: "30s", label: "30代", min: 30, max: 39 },
  { value: "40s", label: "40代", min: 40, max: 49 },
  { value: "50s", label: "50代", min: 50, max: 59 },
  { value: "60s", label: "60代", min: 60, max: 69 },
];

const SORT_OPTIONS = [
  { value: "newest", label: "新着順" },
  { value: "exp",    label: "経験年数順" },
];

// ── FilterChip ────────────────────────────────────────────────────────
function FilterChip({
  label, value, options, onSelect, isOpen, onToggle,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onSelect: (v: string | null) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const activeOpt = options.find((o) => o.value === value);
  const isActive = !!value;

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={onToggle}
        className={`ppl-chip${isActive ? " active" : ""}`}
      >
        {isActive && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
        {isActive ? activeOpt?.label : label}
        {isActive ? (
          <span
            onClick={(e) => { e.stopPropagation(); onSelect(null); }}
            style={{ fontSize: 10, marginLeft: 1, opacity: 0.75 }}
            aria-label="クリア"
          >✕</span>
        ) : (
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0 }}>
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200,
          background: "#fff", border: "1.5px solid var(--royal)",
          borderRadius: 12, padding: "8px 0",
          boxShadow: "0 8px 28px rgba(0,35,102,0.14)",
          minWidth: 180, maxHeight: 320, overflowY: "auto",
        }}>
          {options.map((o) => {
            const sel = value === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onSelect(sel ? null : o.value); onToggle(); }}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "9px 16px",
                  background: sel ? "var(--royal-50)" : "none",
                  color: sel ? "var(--royal)" : "var(--ink)",
                  fontSize: 13.5, fontWeight: sel ? 700 : 400,
                  cursor: "pointer", border: "none", fontFamily: "inherit",
                }}
                onMouseEnter={(e) => { if (!sel) (e.currentTarget as HTMLElement).style.background = "var(--bg-tint)"; }}
                onMouseLeave={(e) => { if (!sel) (e.currentTarget as HTMLElement).style.background = "none"; }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────
function Avatar({ card, size }: { card: AmbassadorCard; size: number }) {
  if (card.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={card.avatarUrl} alt={card.name} style={{
        width: size, height: size, borderRadius: "50%", objectFit: "cover",
        border: "3px solid #fff", boxShadow: "0 2px 12px rgba(0,0,0,0.14)", flexShrink: 0,
      }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: card.gradient,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 800, color: "#fff",
      flexShrink: 0, border: "3px solid #fff",
      boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
    }}>
      {card.initial}
    </div>
  );
}

function companyInitial(card: AmbassadorCard): string {
  if (card.companyLogoLetter) return card.companyLogoLetter;
  return card.companyName
    .replace(/^(株式会社|合同会社|有限会社|一般社団法人|一般財団法人|公益社団法人)\s*/, "")
    .replace(/\s*(株式会社|合同会社|有限会社)$/, "")
    .charAt(0) || card.companyName.charAt(0) || "社";
}

function CompanyBadge({ card, large }: { card: AmbassadorCard; large?: boolean }) {
  const bg = card.companyLogoGradient ?? "linear-gradient(135deg, #001233, #002366)";
  const iconSize = large ? 22 : 18;
  const fontSize = large ? 13 : 12;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
      {card.companyLogoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.companyLogoUrl} alt="" style={{ width: iconSize, height: iconSize, borderRadius: 5, objectFit: "contain", background: "#fff", border: "1px solid var(--line)", flexShrink: 0 }} />
      ) : (
        <div style={{
          width: iconSize, height: iconSize, borderRadius: 5, background: bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: iconSize * 0.48, fontWeight: 800, color: "#fff", flexShrink: 0,
        }}>
          {companyInitial(card)}
        </div>
      )}
      <span style={{ fontSize, color: large ? "var(--ink)" : "var(--ink-soft)", fontWeight: large ? 600 : 500, lineHeight: 1.3 }}>
        {card.companyName}
      </span>
    </div>
  );
}


// ── グリッドカード ────────────────────────────────────────────────────
function GridCard({ card }: { card: AmbassadorCard }) {
  const router = useRouter();
  const role = card.roleTitle ?? card.department ?? card.currentJobType ?? "採用担当";
  const themes = card.talkThemes.slice(0, 2);
  const isAvailable = card.talkThemes.length > 0;

  return (
    <div
      onClick={() => router.push(`/u/${card.userId}`)}
      className="ppl-grid-card"
    >
      {/* アバター + 面談可バッジ */}
      <div style={{ position: "relative", marginBottom: isAvailable ? 14 : 10, display: "flex", justifyContent: "center" }}>
        <Avatar card={card} size={88} />
        {isAvailable && (
          <span style={{
            position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)",
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 10, fontWeight: 700,
            padding: "2px 9px", borderRadius: 100,
            background: "#FFF7ED", color: "#C2410C",
            border: "1px solid #FED7AA", whiteSpace: "nowrap",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#F97316", flexShrink: 0 }} />
            面談可
          </span>
        )}
      </div>

      {/* 名前・役職・会社 */}
      <div style={{ textAlign: "center", marginBottom: 12, marginTop: 6 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)", marginBottom: 3, lineHeight: 1.3 }}>
          {card.name}
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 10, lineHeight: 1.5, minHeight: 20 }}>
          {role}
        </div>
        <CompanyBadge card={card} large />
      </div>

      {/* 相談テーマ */}
      {themes.length > 0 && (
        <div style={{
          width: "100%", marginBottom: 12,
          background: "var(--royal-50)", borderRadius: 8,
          padding: "10px 12px",
          border: "1px solid var(--royal-100)",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--royal)", marginBottom: 6, letterSpacing: "0.06em" }}>
            話せること
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {themes.map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--royal)" strokeWidth={2.5} strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span style={{ fontSize: 11, color: "var(--royal)", lineHeight: 1.5, fontWeight: 500 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTAボタン群 */}
      <div style={{ marginTop: "auto", width: "100%", display: "flex", flexDirection: "column", gap: 7 }}>
        {isAvailable && (
          <Link
            href={`/people/${card.adminId}/reserve`}
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "block", textAlign: "center",
              padding: "10px 14px",
              background: "linear-gradient(135deg, #F59E0B, #F97316)",
              color: "#fff", borderRadius: 9,
              fontSize: 13, fontWeight: 700, textDecoration: "none",
              boxShadow: "0 2px 8px rgba(249,115,22,0.3)",
            }}
          >
            話を聞く →
          </Link>
        )}
        <Link
          href={`/u/${card.userId}`}
          onClick={(e) => e.stopPropagation()}
          style={{
            display: "block", textAlign: "center",
            padding: "8px 14px",
            background: "#fff",
            color: "var(--royal)", borderRadius: 9,
            fontSize: 12, fontWeight: 600, textDecoration: "none",
            border: "1.5px solid var(--royal-100)",
          }}
        >
          プロフィールを見る
        </Link>
      </div>
    </div>
  );
}

// ── リスト行 ──────────────────────────────────────────────────────────
function ListRow({ card, isLast }: { card: AmbassadorCard; isLast: boolean }) {
  const router = useRouter();
  const role = card.roleTitle ?? card.department ?? card.currentJobType ?? "採用担当";
  const themes = card.talkThemes.slice(0, 2);
  const isAvailable = card.talkThemes.length > 0;

  return (
    <div
      onClick={() => router.push(`/u/${card.userId}`)}
      style={{
        display: "flex", alignItems: "flex-start", gap: 16,
        padding: "20px 24px",
        borderBottom: isLast ? "none" : "1px solid var(--line-soft)",
        background: "#fff", cursor: "pointer", transition: "background 0.1s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#FAFBFF"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#fff"; }}
    >
      <div style={{ flexShrink: 0 }}>
        <Avatar card={card} size={58} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 名前行 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>{card.name}</span>
          {isAvailable && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 10, fontWeight: 700,
              padding: "2px 8px", borderRadius: 100,
              background: "#FFF7ED", color: "#C2410C",
              border: "1px solid #FED7AA",
            }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#F97316", flexShrink: 0 }} />
              面談可
            </span>
          )}
          {card.experienceYears != null && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              padding: "2px 8px", borderRadius: 100,
              background: "var(--success-soft)", color: "var(--success)",
              border: "1px solid #A7F3D0",
            }}>
              IT業界 {card.experienceYears}年
            </span>
          )}
        </div>

        {/* 役職 */}
        <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 6 }}>{role}</div>

        {/* 会社バッジ */}
        <div style={{ marginBottom: 8 }}>
          <CompanyBadge card={card} />
        </div>

        {/* 相談テーマ */}
        {themes.length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 7 }}>
            {themes.map((t, i) => (
              <span key={i} style={{
                fontSize: 11, fontWeight: 500,
                padding: "3px 10px", borderRadius: 100,
                background: "var(--royal-50)", color: "var(--royal)",
                border: "1px solid var(--royal-100)",
              }}>
                {t}
              </span>
            ))}
          </div>
        )}

        {/* モバイル CTA */}
        <div className="ppl-row-btn-mobile">
          <div style={{ display: "flex", gap: 8 }}>
            {isAvailable && (
              <Link
                href={`/people/${card.adminId}/reserve`}
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: "inline-flex", alignItems: "center", padding: "8px 16px",
                  background: "linear-gradient(135deg, #F59E0B, #F97316)",
                  color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: "none",
                }}
              >話を聞く →</Link>
            )}
            <Link
              href={`/u/${card.userId}`}
              onClick={(e) => e.stopPropagation()}
              style={{
                display: "inline-flex", alignItems: "center", padding: "8px 14px",
                background: "var(--royal-50)", border: "1px solid var(--royal-100)",
                color: "var(--royal)", borderRadius: 8, fontSize: 11, fontWeight: 600, textDecoration: "none",
              }}
            >プロフィール</Link>
          </div>
        </div>
      </div>

      {/* デスクトップ CTA */}
      <div className="ppl-row-btn-desktop" style={{ flexShrink: 0, alignSelf: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {isAvailable && (
            <Link
              href={`/people/${card.adminId}/reserve`}
              onClick={(e) => e.stopPropagation()}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                padding: "9px 20px",
                background: "linear-gradient(135deg, #F59E0B, #F97316)",
                color: "#fff", borderRadius: 8,
                fontSize: 13, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap",
                boxShadow: "0 2px 8px rgba(249,115,22,0.25)",
              }}
            >
              話を聞く →
            </Link>
          )}
          <Link
            href={`/u/${card.userId}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              padding: "7px 14px",
              background: "#fff", border: "1.5px solid var(--royal-100)",
              color: "var(--royal)", borderRadius: 8,
              fontSize: 11, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap",
            }}
          >
            プロフィール
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── フィルタ判定 ─────────────────────────────────────────────────────
function matchRole(card: AmbassadorCard, v: string): boolean {
  if (!v) return true;
  const text = `${card.roleTitle ?? ""} ${card.department ?? ""} ${card.currentJobType ?? ""}`;
  const opt = ROLE_OPTIONS.find((o) => o.value === v);
  return opt ? opt.pattern.test(text) : true;
}
function matchAge(card: AmbassadorCard, v: string): boolean {
  if (!v) return true;
  if (card.birthYear == null) return false;
  const age = 2026 - card.birthYear;
  const opt = AGE_OPTIONS.find((o) => o.value === v);
  return opt ? age >= opt.min && age <= opt.max : true;
}
function matchCompanyType(card: AmbassadorCard, v: string): boolean {
  if (!v) return true;
  const phase = card.companyPhase ?? "";
  const name = card.companyName ?? "";
  const opt = COMPANY_TYPE_OPTIONS.find((o) => o.value === v);
  if (!opt) return true;
  if (v === "foreign") return /外資|global|インターナショナル/i.test(name) || opt.phasePattern.test(phase);
  return opt.phasePattern.test(phase);
}

// ── PeopleListClient ─────────────────────────────────────────────────
export function PeopleListClient({ ambassadors }: Props) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [role, setRole] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [age, setAge] = useState("");
  const [sort, setSort] = useState("newest");
  const [keyword, setKeyword] = useState("");
  const [openChip, setOpenChip] = useState<string | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpenChip(null);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  function toggleChip(name: string) {
    setOpenChip(openChip === name ? null : name);
  }

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return ambassadors.filter((a) => {
      if (!matchRole(a, role)) return false;
      if (!matchAge(a, age)) return false;
      if (!matchCompanyType(a, companyType)) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.companyName.toLowerCase().includes(q) ||
        (a.roleTitle ?? "").toLowerCase().includes(q) ||
        (a.currentJobType ?? "").toLowerCase().includes(q) ||
        a.skillTags.some((t) => t.toLowerCase().includes(q)) ||
        a.talkThemes.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [ambassadors, role, age, companyType, keyword]);

  const sorted = useMemo(() => {
    if (sort === "exp") return [...filtered].sort((a, b) => (b.experienceYears ?? 0) - (a.experienceYears ?? 0));
    return filtered;
  }, [filtered, sort]);

  const hasFilter = !!(keyword || role || age || companyType);

  function clearAll() {
    setKeyword(""); setRole(""); setAge(""); setCompanyType("");
  }

  if (ambassadors.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "80px 24px" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>💬</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>まだ登録がありません</div>
        <div style={{ fontSize: 14, color: "var(--ink-soft)" }}>登録ユーザーが表示されます。</div>
      </div>
    );
  }

  return (
    <>
      <style suppressHydrationWarning>{`
        .ppl-row-btn-mobile { display: none; }
        .ppl-row-btn-desktop { display: flex; }
        @media (max-width: 600px) {
          .ppl-row-btn-mobile { display: block; }
          .ppl-row-btn-desktop { display: none !important; }
        }

        /* グリッド: 3列 → 2列 → 1列 */
        .ppl-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
        @media (max-width: 900px)  { .ppl-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; } }
        @media (max-width: 520px)  { .ppl-grid { grid-template-columns: minmax(0, 1fr); gap: 12px; } }

        /* グリッドカード */
        .ppl-grid-card {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 28px 20px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          transition: box-shadow 0.18s, transform 0.18s, border-color 0.18s;
        }
        .ppl-grid-card:hover {
          box-shadow: 0 8px 32px rgba(0,35,102,0.12);
          transform: translateY(-3px);
          border-color: var(--royal-100);
        }

        /* FilterChip */
        .ppl-chip {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 7px 14px; border-radius: 999px;
          border: 1.5px solid #e2e8f0; background: #fff;
          color: var(--ink); font-size: 13px; font-weight: 500;
          cursor: pointer; white-space: nowrap;
          transition: all 0.12s; font-family: inherit; flex-shrink: 0;
        }
        .ppl-chip:hover { border-color: var(--royal-100); background: var(--royal-50); color: var(--royal); }
        .ppl-chip.active {
          border-color: var(--royal); background: var(--royal);
          color: #fff; font-weight: 700;
          box-shadow: 0 2px 10px rgba(0,35,102,0.25);
        }

        /* モバイル: フィルタ折りたたみ */
        .ppl-filter-chips { display: contents; }
        .ppl-filter-toggle { display: none; }
        @media (max-width: 767px) {
          .ppl-filter-toggle {
            display: inline-flex; align-items: center; gap: 5px;
            font-size: 12.5px; color: var(--ink-soft); cursor: pointer;
            white-space: nowrap; border: 1.5px solid #e2e8f0;
            border-radius: 999px; padding: 6px 12px;
            background: #fff; font-family: inherit; font-weight: 500;
            transition: border-color 0.15s, background 0.15s; flex-shrink: 0;
          }
          .ppl-filter-toggle.active { border-color: var(--royal); background: var(--royal-50); color: var(--royal); font-weight: 700; }
          .ppl-filter-chips { display: none; flex-wrap: wrap; gap: 6px; padding: 4px 0; width: 100%; }
          .ppl-filter-chips.expanded { display: flex; }
        }
      `}</style>

      <h1 className="sr-only">ユーザーを探す — 話せる人を探す</h1>


      {/* ── 検索 + フィルタバー ── */}
      <div
        ref={wrapRef}
        style={{
          position: "sticky", top: 60, zIndex: 50,
          background: "#fff",
          borderBottom: "1px solid var(--line)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 24px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* 検索インプット */}
            <div style={{
              position: "relative", flex: "1 1 220px", minWidth: 0,
              display: "flex", alignItems: "center", gap: 8,
              background: "#fff", border: "1.5px solid #e6e9ef", borderRadius: 999,
              padding: "0 14px", transition: "border-color 0.15s, box-shadow 0.15s",
            }}
              onFocusCapture={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--royal)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px rgba(0,35,102,0.08)"; }}
              onBlurCapture={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#e6e9ef"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8b95a3" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }} aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                ref={inputRef}
                type="search"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="名前・会社・役職・スキルで検索"
                style={{ flex: 1, border: "none", outline: "none", fontSize: 13.5, color: "var(--ink)", background: "transparent", padding: "9px 0", minWidth: 0, fontFamily: "inherit" }}
                aria-label="ユーザーを検索"
              />
              {keyword && (
                <button type="button" onClick={() => { setKeyword(""); inputRef.current?.focus(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#8b95a3", fontSize: 16, padding: "2px" }} aria-label="クリア">✕</button>
              )}
            </div>

            {/* モバイル: フィルタトグル */}
            <button
              type="button"
              className={`ppl-filter-toggle${(role || age || companyType) ? " active" : ""}`}
              onClick={() => setFiltersExpanded(!filtersExpanded)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
              </svg>
              絞り込む{filtersExpanded ? " ▴" : " ▾"}
            </button>

            {/* フィルタチップ */}
            <div className={`ppl-filter-chips${filtersExpanded ? " expanded" : ""}`}>
              <FilterChip label="職種" value={role} options={ROLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} onSelect={(v) => { setRole(v ?? ""); setOpenChip(null); }} isOpen={openChip === "role"} onToggle={() => toggleChip("role")} />
              <FilterChip label="年齢" value={age} options={AGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} onSelect={(v) => { setAge(v ?? ""); setOpenChip(null); }} isOpen={openChip === "age"} onToggle={() => toggleChip("age")} />
              <FilterChip label="企業タイプ" value={companyType} options={COMPANY_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} onSelect={(v) => { setCompanyType(v ?? ""); setOpenChip(null); }} isOpen={openChip === "companyType"} onToggle={() => toggleChip("companyType")} />
              {hasFilter && (
                <button type="button" onClick={clearAll} style={{ fontSize: 12.5, color: "var(--ink-mute)", background: "none", border: "none", cursor: "pointer", padding: "5px 4px", whiteSpace: "nowrap", fontFamily: "inherit" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--ink)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--ink-mute)"; }}
                >
                  ✕ すべてクリア
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 並び替えバー ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 24px 0" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          background: "#fff", borderRadius: 12, border: "1px solid var(--line)",
          padding: "10px 16px", boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
        }}>
          {/* 並び替え */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 600, flexShrink: 0 }}>並び替え</span>
            <div style={{ width: 1, height: 18, background: "var(--line)" }} />
            <div style={{ display: "flex", gap: 6 }}>
              {SORT_OPTIONS.map((o) => {
                const active = sort === o.value;
                return (
                  <button key={o.value} type="button" onClick={() => setSort(o.value)} style={{
                    padding: "5px 13px", borderRadius: 100, fontSize: 12, fontWeight: active ? 700 : 500,
                    cursor: "pointer", border: active ? "none" : "1.5px solid var(--line)",
                    background: active ? "var(--royal)" : "#fff",
                    color: active ? "#fff" : "var(--ink-soft)",
                    transition: "all 0.15s", fontFamily: "inherit",
                    boxShadow: active ? "0 2px 8px rgba(0,35,102,0.25)" : "none",
                  }}>
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ビュートグル + 件数 */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 2, background: "var(--line-soft)", borderRadius: 8, padding: 2 }}>
              {([
                { mode: "grid" as const, label: "一覧", icon: (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>) },
                { mode: "list" as const, label: "詳細", icon: (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="3" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>) },
              ]).map(({ mode, label, icon }) => (
                <button key={mode} type="button" onClick={() => setViewMode(mode)} style={{
                  background: viewMode === mode ? "var(--royal)" : "transparent",
                  color: viewMode === mode ? "#fff" : "var(--ink-mute)",
                  border: "none", cursor: "pointer", borderRadius: 6,
                  padding: "5px 10px", display: "flex", alignItems: "center", gap: 5,
                  fontSize: 12, fontWeight: 600, transition: "all 0.15s", whiteSpace: "nowrap",
                }}>
                  {icon}{label}
                </button>
              ))}
            </div>
            <div style={{ width: 1, height: 18, background: "var(--line)" }} />
            <span style={{ fontSize: 13, color: "var(--ink-mute)", fontWeight: 500 }}>
              <strong style={{ color: "var(--ink)", fontWeight: 800, fontFamily: "Inter, sans-serif", fontSize: 16 }}>
                {sorted.length}
              </strong> 名
            </span>
          </div>
        </div>
      </div>

      {/* ── コンテンツ ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 24px 80px" }}>
        {sorted.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-mute)", fontSize: 14 }}>
            該当する方が見つかりません
          </div>
        ) : viewMode === "list" ? (
          <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
            {sorted.map((card, i) => (
              <ListRow key={card.userId} card={card} isLast={i === sorted.length - 1} />
            ))}
          </div>
        ) : (
          <div className="ppl-grid">
            {sorted.map((card) => <GridCard key={card.userId} card={card} />)}
          </div>
        )}

        <div style={{
          marginTop: 24, padding: "14px 18px",
          background: "var(--bg-tint)", border: "1px solid var(--line)",
          borderRadius: 10, fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.8,
        }}>
          ※ 「話せる人」は各企業の採用担当が承認した現役社員です。カジュアル面談（無料）でお話を聞けます。
        </div>
      </div>
    </>
  );
}
