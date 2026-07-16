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
  workStyle: string | null;
  preferredLocations: string[] | null;
  skillTags: string[];
  createdAt: string | null;
};

type Props = { ambassadors: AmbassadorCard[] };

// ── フィルタ・ソート定数 ────────────────────────────────────────────
const ROLE_OPTIONS = [
  { value: "sales", label: "営業", pattern: /営業|sales|セールス|account executive|account manager|フィールドセールス|インサイドセールス|sdr|bdr/i },
  { value: "cs",    label: "カスタマーサクセス", pattern: /カスタマーサクセス|customer success|csm/i },
  { value: "mkt",   label: "マーケティング",     pattern: /マーケ|market/i },
  { value: "eng",   label: "エンジニア",         pattern: /エンジニア|engineer|開発|dev|tech|ソフトウェア/i },
  { value: "pm",    label: "PM / PdM",           pattern: /プロダクトマネージャー|product manager|\bpm\b|pdm/i },
  { value: "hr",    label: "人事・採用",          pattern: /人事|採用|hr|recruit/i },
  { value: "exec",  label: "経営・役員",          pattern: /CEO|CTO|COO|CFO|VP|役員|代表|社長|事業部長/i },
];

const EXP_OPTIONS = [
  { value: "1to3", label: "1〜3年",  min: 1, max: 3   },
  { value: "4to7", label: "4〜7年",  min: 4, max: 7   },
  { value: "8plus", label: "8年以上", min: 8, max: 999 },
];

const WORK_OPTIONS = [
  { value: "remote",  label: "🏡 フルリモート" },
  { value: "hybrid",  label: "🔀 ハイブリッド" },
  { value: "onsite",  label: "🏢 出社のみ"    },
];

const SORT_OPTIONS = [
  {
    value: "newest",
    label: "新着順",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
        <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
      </svg>
    ),
  },
  {
    value: "exp",
    label: "経験年数順",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
      </svg>
    ),
  },
];

// ── 汎用 FilterChip（/companies の FilterChip に準拠） ───────────────
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
          background: "#fff",
          border: "1.5px solid var(--royal)",
          borderRadius: 12,
          padding: "8px 0",
          boxShadow: "0 8px 28px rgba(0,35,102,0.14)",
          minWidth: 180,
          maxHeight: 320,
          overflowY: "auto",
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
                  cursor: "pointer", border: "none",
                  fontFamily: "inherit",
                  transition: "background 0.08s",
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
        border: "2px solid #fff", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", flexShrink: 0,
      }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: card.gradient,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 800, color: "#fff",
      flexShrink: 0, border: "2px solid #fff",
      boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
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

function CompanyBadge({ card }: { card: AmbassadorCard }) {
  const bg = card.companyLogoGradient ?? "linear-gradient(135deg, #001233, #002366)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {card.companyLogoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.companyLogoUrl} alt="" style={{ width: 18, height: 18, borderRadius: 4, objectFit: "contain", background: "#fff", border: "1px solid var(--line)" }} />
      ) : (
        <div style={{
          width: 18, height: 18, borderRadius: 4, background: bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9, fontWeight: 800, color: "#fff", flexShrink: 0,
        }}>
          {companyInitial(card)}
        </div>
      )}
      <span style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 500 }}>
        {card.companyName}
      </span>
    </div>
  );
}

function TalkBadge() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 10, fontWeight: 700,
      padding: "2px 8px", borderRadius: 100,
      background: "#FFF7ED", color: "#C2410C",
      border: "1px solid #FED7AA", whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#F97316" }} />
      面談可
    </span>
  );
}

// SkillTags: /companies のトピックタグと同じ royal-50 / royal カラー
function SkillTags({ tags, max = 3 }: { tags: string[]; max?: number }) {
  const show = tags.slice(0, max);
  const rest = tags.length - max;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
      {show.map((tag) => (
        <span key={tag} style={{
          fontSize: 10, fontWeight: 600,
          padding: "2px 8px", borderRadius: 100,
          background: "var(--royal-50)",
          color: "var(--royal)",
          border: "1px solid var(--royal-100)",
          whiteSpace: "nowrap",
        }}>
          {tag}
        </span>
      ))}
      {rest > 0 && <span style={{ fontSize: 10, color: "var(--ink-mute)" }}>+{rest}</span>}
    </div>
  );
}

function ExpBadge({ years }: { years: number }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600,
      padding: "2px 7px", borderRadius: 100,
      background: "var(--success-soft)", color: "var(--success)",
      border: "1px solid #A7F3D0", whiteSpace: "nowrap",
    }}>
      {years}年
    </span>
  );
}

// ── CTA ボタン（orange: companies と差別化する people の個性） ──────
function TalkBtn({ adminId, userId }: { adminId: string; userId: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Link
        href={`/people/${adminId}/reserve`}
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          padding: "8px 18px",
          background: "linear-gradient(135deg, #F59E0B, #F97316)",
          color: "#fff", borderRadius: 8,
          fontSize: 12, fontWeight: 700,
          textDecoration: "none", whiteSpace: "nowrap",
        }}
      >
        話を聞く →
      </Link>
      <Link
        href={`/u/${userId}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          padding: "6px 14px",
          background: "var(--royal-50)", border: "1px solid var(--royal-100)",
          color: "var(--royal)", borderRadius: 8,
          fontSize: 11, fontWeight: 600,
          textDecoration: "none", whiteSpace: "nowrap",
        }}
      >
        プロフィール
      </Link>
    </div>
  );
}

// ── グリッドカード ────────────────────────────────────────────────────
function GridCard({ card }: { card: AmbassadorCard }) {
  const router = useRouter();
  const role = card.roleTitle ?? card.department ?? "採用担当";
  return (
    <div
      onClick={() => router.push(`/u/${card.userId}`)}
      className="ppl-grid-card"
    >
      <div style={{ marginBottom: 12 }}>
        <Avatar card={card} size={68} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap", justifyContent: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{card.name}</span>
        <TalkBadge />
      </div>

      <div style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 6, textAlign: "center", lineHeight: 1.5 }}>
        {role}
      </div>

      <div style={{ marginBottom: 10 }}>
        <CompanyBadge card={card} />
      </div>


      <div style={{ marginTop: "auto", width: "100%", display: "flex", flexDirection: "column", gap: 6 }}>
        <Link
          href={`/people/${card.adminId}/reserve`}
          onClick={(e) => e.stopPropagation()}
          style={{
            display: "block", textAlign: "center",
            padding: "9px 14px",
            background: "linear-gradient(135deg, #F59E0B, #F97316)",
            color: "#fff", borderRadius: 9,
            fontSize: 12, fontWeight: 700, textDecoration: "none",
          }}
        >
          話を聞く →
        </Link>
        <Link
          href={`/u/${card.userId}`}
          onClick={(e) => e.stopPropagation()}
          style={{
            display: "block", textAlign: "center",
            padding: "7px 14px",
            background: "var(--royal-50)",
            color: "var(--royal)", borderRadius: 9,
            fontSize: 11, fontWeight: 600, textDecoration: "none",
            border: "1px solid var(--royal-100)",
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
  const role = card.roleTitle ?? card.department ?? "採用担当";
  return (
    <div
      onClick={() => router.push(`/u/${card.userId}`)}
      style={{
        display: "flex", alignItems: "flex-start", gap: 14,
        padding: "16px 20px",
        borderBottom: isLast ? "none" : "1px solid var(--line-soft)",
        background: "#fff", cursor: "pointer", transition: "background 0.1s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#FAFBFF"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#fff"; }}
    >
      <div style={{ flexShrink: 0 }}>
        <Avatar card={card} size={52} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{card.name}</span>
          <TalkBadge />
          {card.experienceYears != null && <ExpBadge years={card.experienceYears} />}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 5 }}>{role}</div>
        <div style={{ marginBottom: card.skillTags.length > 0 ? 7 : 0 }}>
          <CompanyBadge card={card} />
        </div>
        {card.skillTags.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <SkillTags tags={card.skillTags} max={4} />
          </div>
        )}
        <div className="ppl-row-btn-mobile">
          <TalkBtn adminId={card.adminId} userId={card.userId} />
        </div>
      </div>

      <div className="ppl-row-btn-desktop" style={{ flexShrink: 0, alignSelf: "center" }}>
        <TalkBtn adminId={card.adminId} userId={card.userId} />
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
function matchExp(card: AmbassadorCard, v: string): boolean {
  if (!v) return true;
  const opt = EXP_OPTIONS.find((o) => o.value === v);
  if (!opt || card.experienceYears == null) return false;
  return card.experienceYears >= opt.min && card.experienceYears <= opt.max;
}
function matchWork(card: AmbassadorCard, v: string): boolean {
  if (!v) return true;
  const ws = (card.workStyle ?? "").toLowerCase();
  if (v === "remote") return ws.includes("remote") || ws.includes("リモート") || ws.includes("full_remote");
  if (v === "hybrid") return ws.includes("hybrid") || ws.includes("ハイブリッド");
  if (v === "onsite") return ws.includes("onsite") || ws.includes("出社") || ws.includes("office");
  return true;
}

// ── PeopleListClient ─────────────────────────────────────────────────
export function PeopleListClient({ ambassadors }: Props) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [role, setRole] = useState("");
  const [exp, setExp] = useState("");
  const [work, setWork] = useState("");
  const [sort, setSort] = useState("newest");
  const [keyword, setKeyword] = useState("");
  const [openChip, setOpenChip] = useState<string | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // クリック外でドロップダウンを閉じる
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
      if (!matchExp(a, exp)) return false;
      if (!matchWork(a, work)) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.companyName.toLowerCase().includes(q) ||
        (a.roleTitle ?? "").toLowerCase().includes(q) ||
        (a.currentJobType ?? "").toLowerCase().includes(q) ||
        a.skillTags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [ambassadors, role, exp, work, keyword]);

  const sorted = useMemo(() => {
    if (sort === "exp") return [...filtered].sort((a, b) => (b.experienceYears ?? 0) - (a.experienceYears ?? 0));
    return filtered; // newest: server order (created_at desc)
  }, [filtered, sort]);

  const hasFilter = !!(keyword || role || exp || work);

  function clearAll() {
    setKeyword(""); setRole(""); setExp(""); setWork("");
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
        /* ── モバイルボタン ── */
        .ppl-row-btn-mobile { display: none; }
        .ppl-row-btn-desktop { display: flex; }
        @media (max-width: 600px) {
          .ppl-row-btn-mobile { display: block; }
          .ppl-row-btn-desktop { display: none !important; }
        }

        /* ── グリッド ── */
        .ppl-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
        @media (max-width: 1100px) { .ppl-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        @media (max-width: 768px)  { .ppl-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; } }
        @media (max-width: 480px)  { .ppl-grid { grid-template-columns: minmax(0, 1fr); gap: 10px; } }

        /* ── グリッドカード ── */
        .ppl-grid-card {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 24px 18px 18px;
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          transition: box-shadow 0.15s, transform 0.15s;
        }
        .ppl-grid-card:hover {
          box-shadow: 0 6px 24px rgba(0,35,102,0.10);
          transform: translateY(-2px);
        }

        /* ── FilterChip ピルボタン（/companies の csb-filter-pill 準拠） ── */
        .ppl-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 7px 14px;
          border-radius: 999px;
          border: 1.5px solid #e2e8f0;
          background: #fff;
          color: var(--ink);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.12s;
          font-family: inherit;
          flex-shrink: 0;
        }
        .ppl-chip:hover { border-color: var(--royal-100); background: var(--royal-50); color: var(--royal); }
        .ppl-chip.active {
          border-color: var(--royal);
          background: var(--royal);
          color: #fff;
          font-weight: 700;
          box-shadow: 0 2px 10px rgba(0,35,102,0.25);
        }

        /* ── 並び替えボタン（GridSortBar 準拠） ── */
        .ppl-sort-btn {
          padding: 6px 14px;
          border-radius: 100px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border: 1.5px solid var(--line);
          background: #fff;
          color: var(--ink-soft);
          transition: all 0.15s;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
          font-family: "Noto Sans JP", sans-serif;
        }
        .ppl-sort-btn:hover { border-color: var(--royal-100); background: var(--royal-50); color: var(--royal); }
        .ppl-sort-btn.active {
          background: var(--royal);
          border-color: var(--royal);
          color: #fff;
          font-weight: 700;
          box-shadow: 0 3px 12px rgba(0,35,102,0.35);
          transform: scale(1.03);
        }
        .ppl-sort-scroll {
          display: flex; gap: 6px; align-items: center;
          overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch;
        }
        .ppl-sort-scroll::-webkit-scrollbar { display: none; }

        /* ── モバイル: フィルタ折りたたみ ── */
        .ppl-filter-chips { display: contents; }
        .ppl-filter-toggle { display: none; }
        @media (max-width: 767px) {
          .ppl-filter-toggle {
            display: inline-flex; align-items: center; gap: 5px;
            font-size: 12.5px; color: var(--ink-soft); cursor: pointer;
            white-space: nowrap; border: 1.5px solid #e2e8f0;
            border-radius: 999px; padding: 6px 12px;
            background: #fff; font-family: inherit; font-weight: 500;
            transition: border-color 0.15s, background 0.15s;
            flex-shrink: 0;
          }
          .ppl-filter-toggle.active { border-color: var(--royal); background: var(--royal-50); color: var(--royal); font-weight: 700; }
          .ppl-filter-chips { display: none; flex-wrap: wrap; gap: 6px; padding: 4px 0; width: 100%; }
          .ppl-filter-chips.expanded { display: flex; }
        }
      `}</style>

      <h1 className="sr-only">先輩を知る — 話せる人を探す</h1>

      {/* ── 検索 + フィルタバー（/companies の CompanySearchBar 準拠） ── */}
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

          {/* 行1: 検索バー + フィルタチップ群 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>

            {/* 検索インプット（csb-search-wrap スタイル） */}
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
                aria-label="話せる人を検索"
              />
              {keyword && (
                <button type="button" onClick={() => { setKeyword(""); inputRef.current?.focus(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#8b95a3", fontSize: 16, padding: "2px" }} aria-label="クリア">✕</button>
              )}
            </div>

            {/* モバイル: フィルタトグルボタン */}
            <button
              type="button"
              className={`ppl-filter-toggle${(role || exp || work) ? " active" : ""}`}
              onClick={() => setFiltersExpanded(!filtersExpanded)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
              </svg>
              絞り込む{filtersExpanded ? " ▴" : " ▾"}
            </button>

            {/* フィルタチップ（デスクトップ常時表示 / モバイル折りたたみ） */}
            <div className={`ppl-filter-chips${filtersExpanded ? " expanded" : ""}`}>

              {/* 職種 */}
              <FilterChip
                label="職種▾"
                value={role}
                options={ROLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                onSelect={(v) => { setRole(v ?? ""); setOpenChip(null); }}
                isOpen={openChip === "role"}
                onToggle={() => toggleChip("role")}
              />

              {/* 経験年数 */}
              <FilterChip
                label="経験年数▾"
                value={exp}
                options={EXP_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                onSelect={(v) => { setExp(v ?? ""); setOpenChip(null); }}
                isOpen={openChip === "exp"}
                onToggle={() => toggleChip("exp")}
              />

              {/* 働き方 */}
              <FilterChip
                label="働き方▾"
                value={work}
                options={WORK_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                onSelect={(v) => { setWork(v ?? ""); setOpenChip(null); }}
                isOpen={openChip === "work"}
                onToggle={() => toggleChip("work")}
              />

              {hasFilter && (
                <button
                  type="button"
                  onClick={clearAll}
                  style={{
                    fontSize: 12.5, color: "var(--ink-mute)",
                    background: "none", border: "none", cursor: "pointer",
                    padding: "5px 4px", whiteSpace: "nowrap",
                    fontFamily: "inherit", transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--ink)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--ink-mute)"; }}
                >
                  ✕ すべてクリア
                </button>
              )}
            </div>
          </div>

          {/* アクティブフィルター サマリー行（/companies の activeFilters 準拠） */}
          {hasFilter && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 12px 9px",
              overflowX: "auto", scrollbarWidth: "none" as React.CSSProperties["scrollbarWidth"],
              background: "var(--royal-50)",
              borderRadius: 8, borderLeft: "3px solid var(--royal)",
              marginTop: 8, marginBottom: 0,
            }}>
              <span style={{ fontSize: 11, color: "var(--royal)", whiteSpace: "nowrap", flexShrink: 0, fontWeight: 700 }}>絞り込み中:</span>
              {keyword && (
                <button type="button" onClick={() => setKeyword("")} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 999, background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" }}>
                  「{keyword}」<span style={{ fontSize: 10, opacity: 0.7 }}>✕</span>
                </button>
              )}
              {role && (
                <button type="button" onClick={() => setRole("")} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 999, background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" }}>
                  {ROLE_OPTIONS.find((o) => o.value === role)?.label}<span style={{ fontSize: 10, opacity: 0.7 }}>✕</span>
                </button>
              )}
              {exp && (
                <button type="button" onClick={() => setExp("")} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 999, background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" }}>
                  {EXP_OPTIONS.find((o) => o.value === exp)?.label}<span style={{ fontSize: 10, opacity: 0.7 }}>✕</span>
                </button>
              )}
              {work && (
                <button type="button" onClick={() => setWork("")} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 999, background: "var(--royal-50)", color: "var(--royal)", border: "1px solid var(--royal-100)", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" }}>
                  {WORK_OPTIONS.find((o) => o.value === work)?.label}<span style={{ fontSize: 10, opacity: 0.7 }}>✕</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 並び替えバー（GridSortBar 準拠） ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 24px 0" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          background: "#fff", borderRadius: 12, border: "1px solid var(--line)",
          padding: "10px 16px",
          boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
        }}>
          {/* 左: 並び替え */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--ink-soft)", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M3 6h18M7 12h10M11 18h2"/>
              </svg>
              <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>並び替え</span>
            </div>
            <div style={{ width: 1, height: 20, background: "var(--line)", flexShrink: 0 }} />
            <div className="ppl-sort-scroll">
              {SORT_OPTIONS.map((o) => {
                const active = sort === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setSort(o.value)}
                    className={`ppl-sort-btn${active ? " active" : ""}`}
                  >
                    {active ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                    ) : o.icon}
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 右: ビュートグル + 件数 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 2, background: "var(--line-soft)", borderRadius: 8, padding: 2 }}>
              {([
                { mode: "grid" as const, title: "グリッド", icon: (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>) },
                { mode: "list" as const, title: "リスト",   icon: (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="3" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>) },
              ]).map(({ mode, title, icon }) => (
                <button key={mode} type="button" onClick={() => setViewMode(mode)} title={title} style={{
                  background: viewMode === mode ? "var(--royal)" : "transparent",
                  color: viewMode === mode ? "#fff" : "var(--ink-mute)",
                  border: "none", cursor: "pointer", borderRadius: 6,
                  padding: "5px 10px", display: "flex", alignItems: "center", gap: 5,
                  fontSize: 12, fontWeight: 600, transition: "all 0.15s",
                  whiteSpace: "nowrap", fontFamily: "Noto Sans JP, sans-serif",
                }}>
                  {icon}
                  {mode === "grid" ? "一覧" : "詳細"}
                </button>
              ))}
            </div>

            <div style={{ width: 1, height: 20, background: "var(--line)" }} />

            <span style={{ fontSize: 13, color: "var(--ink-mute)", fontWeight: 500 }}>
              <strong style={{ color: "var(--ink)", fontWeight: 800, fontFamily: "Inter, sans-serif", fontSize: 16 }}>
                {sorted.length}
              </strong>
              <span style={{ marginLeft: 2 }}>名</span>
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
