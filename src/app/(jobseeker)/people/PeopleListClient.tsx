"use client";

import { useState, useMemo, useRef } from "react";
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

type Props = {
  ambassadors: AmbassadorCard[];
};

// ── Avatar ──────────────────────────────────────────────────────────
function Avatar({ card, size }: { card: AmbassadorCard; size: number }) {
  const fontSize = size * 0.38;
  if (card.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={card.avatarUrl}
        alt={card.name}
        style={{
          width: size, height: size, borderRadius: "50%",
          objectFit: "cover",
          border: "2px solid #fff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: card.gradient,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize, fontWeight: 800, color: "#fff",
      flexShrink: 0,
      border: "2px solid #fff",
      boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
    }}>
      {card.initial}
    </div>
  );
}

function companyInitial(card: AmbassadorCard): string {
  if (card.companyLogoLetter) return card.companyLogoLetter;
  const stripped = card.companyName
    .replace(/^(株式会社|合同会社|有限会社|一般社団法人|一般財団法人|公益社団法人)\s*/, "")
    .replace(/\s*(株式会社|合同会社|有限会社)$/, "");
  return stripped.charAt(0) || card.companyName.charAt(0) || "社";
}

// ── CompanyBadge ─────────────────────────────────────────────────────
function CompanyBadge({ card }: { card: AmbassadorCard }) {
  const initial = companyInitial(card);
  const bg = card.companyLogoGradient ?? "linear-gradient(135deg, #001233, #002366)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {card.companyLogoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.companyLogoUrl} alt="" style={{ width: 18, height: 18, borderRadius: 4, objectFit: "contain", background: "#fff", border: "1px solid var(--line)" }} />
      ) : (
        <div style={{
          width: 18, height: 18, borderRadius: 4,
          background: bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9, fontWeight: 800, color: "#fff", flexShrink: 0,
        }}>
          {initial}
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
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#F97316", flexShrink: 0 }} />
      面談可
    </span>
  );
}

// ── SkillTags ─────────────────────────────────────────────────────────
function SkillTags({ tags, max = 3 }: { tags: string[]; max?: number }) {
  const show = tags.slice(0, max);
  const rest = tags.length - max;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
      {show.map((tag) => (
        <span key={tag} style={{
          fontSize: 10, fontWeight: 600,
          padding: "2px 7px", borderRadius: 100,
          background: "var(--line-soft)",
          color: "var(--ink-soft)",
          border: "1px solid var(--line)",
          whiteSpace: "nowrap",
        }}>
          {tag}
        </span>
      ))}
      {rest > 0 && (
        <span style={{ fontSize: 10, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>+{rest}</span>
      )}
    </div>
  );
}

function ExperienceBadge({ years }: { years: number }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: 10, fontWeight: 600,
      padding: "2px 7px", borderRadius: 100,
      background: "var(--success-soft)", color: "var(--success)",
      border: "1px solid #A7F3D0", whiteSpace: "nowrap",
    }}>
      {years}年
    </span>
  );
}

// ── AmbassadorGridCard ───────────────────────────────────────────────
function AmbassadorGridCard({ card }: { card: AmbassadorCard }) {
  const router = useRouter();
  const roleDisplay = card.roleTitle ?? card.department ?? "採用担当";

  return (
    <div
      onClick={() => router.push(`/u/${card.userId}`)}
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: "24px 18px 18px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0,
        transition: "box-shadow 0.15s, transform 0.15s",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 24px rgba(0,35,102,0.10)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <Avatar card={card} size={68} />
      </div>

      {/* 名前 + バッジ */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap", justifyContent: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{card.name}</span>
        <TalkBadge />
      </div>

      {/* 役職 */}
      <div style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 8, textAlign: "center", lineHeight: 1.4 }}>
        {roleDisplay}
        {card.experienceYears != null && (
          <span style={{ marginLeft: 6 }}><ExperienceBadge years={card.experienceYears} /></span>
        )}
      </div>

      {/* 会社 */}
      <div style={{ marginBottom: 10 }}>
        <CompanyBadge card={card} />
      </div>

      {/* スキルタグ */}
      {card.skillTags.length > 0 && (
        <div style={{ marginBottom: 12, width: "100%", display: "flex", justifyContent: "center" }}>
          <SkillTags tags={card.skillTags} max={3} />
        </div>
      )}

      {/* CTAボタン */}
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

// ── AmbassadorListRow ────────────────────────────────────────────────
function AmbassadorListRow({ card, isLast }: { card: AmbassadorCard; isLast: boolean }) {
  const router = useRouter();
  const roleDisplay = card.roleTitle ?? card.department ?? "採用担当";

  const btns = (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch" }}>
      <Link
        href={`/people/${card.adminId}/reserve`}
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
        href={`/u/${card.userId}`}
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

  return (
    <div
      onClick={() => router.push(`/u/${card.userId}`)}
      style={{
        display: "flex", alignItems: "flex-start", gap: 14,
        padding: "16px 20px",
        borderBottom: isLast ? "none" : "1px solid var(--line-soft)",
        background: "#fff",
        transition: "background 0.1s",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#FAFBFF"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#fff"; }}
    >
      {/* Avatar */}
      <div style={{ flexShrink: 0 }}>
        <Avatar card={card} size={52} />
      </div>

      {/* Info column */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{card.name}</span>
          <TalkBadge />
          {card.experienceYears != null && <ExperienceBadge years={card.experienceYears} />}
        </div>

        <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 5 }}>
          {roleDisplay}
          {card.currentJobType && card.currentJobType !== roleDisplay && (
            <span style={{ color: "var(--ink-mute)" }}> · {card.currentJobType}</span>
          )}
        </div>

        <div style={{ marginBottom: card.skillTags.length > 0 ? 7 : 0 }}>
          <CompanyBadge card={card} />
        </div>

        {card.skillTags.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <SkillTags tags={card.skillTags} max={4} />
          </div>
        )}

        {/* ボタン: モバイルのみ */}
        <div className="people-list-btn-mobile">{btns}</div>
      </div>

      {/* ボタン: デスクトップのみ */}
      <div className="people-list-btn-desktop" style={{ flexShrink: 0, alignSelf: "center" }}>
        {btns}
      </div>
    </div>
  );
}

// ── フィルター定数 ────────────────────────────────────────────────────
const ROLE_CATEGORIES = [
  { key: "all",   label: "すべて",     pattern: null },
  { key: "sales", label: "営業",       pattern: /営業|sales|セールス|account executive|account manager|フィールドセールス|インサイドセールス|sdr|bdr/i },
  { key: "cs",    label: "CS",         pattern: /カスタマーサクセス|customer success|csm/i },
  { key: "mkt",   label: "マーケ",     pattern: /マーケ|market/i },
  { key: "eng",   label: "エンジニア", pattern: /エンジニア|engineer|開発|dev|tech|ソフトウェア/i },
  { key: "pm",    label: "PM/PdM",     pattern: /プロダクトマネージャー|product manager|\bpm\b|pdm/i },
  { key: "hr",    label: "人事・採用", pattern: /人事|採用|hr|recruit/i },
  { key: "exec",  label: "経営・役員", pattern: /CEO|CTO|COO|CFO|VP|役員|代表|社長|事業部長/i },
] as const;
type RoleCategoryKey = typeof ROLE_CATEGORIES[number]["key"];

const EXP_FILTERS = [
  { key: "all",    label: "経験年数：すべて", min: 0,  max: 999 },
  { key: "1to3",   label: "1〜3年",           min: 1,  max: 3   },
  { key: "4to7",   label: "4〜7年",           min: 4,  max: 7   },
  { key: "8plus",  label: "8年以上",          min: 8,  max: 999 },
] as const;
type ExpKey = typeof EXP_FILTERS[number]["key"];

const WORK_STYLE_FILTERS = [
  { key: "all",    label: "働き方：すべて" },
  { key: "remote", label: "リモート" },
  { key: "hybrid", label: "ハイブリッド" },
  { key: "onsite", label: "出社" },
] as const;
type WorkStyleKey = typeof WORK_STYLE_FILTERS[number]["key"];

const SORT_OPTIONS = [
  { key: "newest", label: "新着順" },
  { key: "exp",    label: "経験年数が多い順" },
] as const;
type SortKey = typeof SORT_OPTIONS[number]["key"];

function matchesRole(card: AmbassadorCard, key: RoleCategoryKey): boolean {
  if (key === "all") return true;
  const text = `${card.roleTitle ?? ""} ${card.department ?? ""} ${card.currentJobType ?? ""}`;
  const cat = ROLE_CATEGORIES.find((c) => c.key === key);
  return cat?.pattern ? cat.pattern.test(text) : true;
}

function matchesExp(card: AmbassadorCard, key: ExpKey): boolean {
  if (key === "all") return true;
  const f = EXP_FILTERS.find((e) => e.key === key);
  if (!f) return true;
  if (card.experienceYears == null) return false;
  return card.experienceYears >= f.min && card.experienceYears <= f.max;
}

function matchesWorkStyle(card: AmbassadorCard, key: WorkStyleKey): boolean {
  if (key === "all") return true;
  const ws = (card.workStyle ?? "").toLowerCase();
  if (key === "remote") return ws.includes("remote") || ws.includes("リモート") || ws.includes("full_remote");
  if (key === "hybrid") return ws.includes("hybrid") || ws.includes("ハイブリッド");
  if (key === "onsite") return ws.includes("onsite") || ws.includes("出社") || ws.includes("office");
  return true;
}

// ── PeopleListClient ─────────────────────────────────────────────────
export function PeopleListClient({ ambassadors }: Props) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [roleCategory, setRoleCategory] = useState<RoleCategoryKey>("all");
  const [expFilter, setExpFilter] = useState<ExpKey>("all");
  const [workStyleFilter, setWorkStyleFilter] = useState<WorkStyleKey>("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [keyword, setKeyword] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return ambassadors.filter((a) => {
      if (!matchesRole(a, roleCategory)) return false;
      if (!matchesExp(a, expFilter)) return false;
      if (!matchesWorkStyle(a, workStyleFilter)) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.companyName.toLowerCase().includes(q) ||
        (a.roleTitle ?? "").toLowerCase().includes(q) ||
        (a.currentJobType ?? "").toLowerCase().includes(q) ||
        a.skillTags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [ambassadors, roleCategory, expFilter, workStyleFilter, keyword]);

  const sorted = useMemo(() => {
    if (sortKey === "exp") {
      return [...filtered].sort((a, b) => (b.experienceYears ?? 0) - (a.experienceYears ?? 0));
    }
    // newest: already ordered by created_at desc from server
    return filtered;
  }, [filtered, sortKey]);

  const isFiltered = keyword || roleCategory !== "all" || expFilter !== "all" || workStyleFilter !== "all";

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
        .people-list-btn-mobile { display: none; }
        .people-list-btn-desktop { display: flex; }
        @media (max-width: 600px) {
          .people-list-btn-mobile { display: block; }
          .people-list-btn-desktop { display: none !important; }
        }
        .people-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }
        @media (max-width: 1100px) { .people-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        @media (max-width: 768px)  { .people-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; } }
        @media (max-width: 480px)  { .people-grid { grid-template-columns: minmax(0, 1fr); gap: 10px; } }
        .ppl-filter-pill {
          padding: 5px 13px;
          border-radius: 100px;
          border: 1.5px solid var(--line);
          background: #fff;
          color: var(--ink-soft);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
          font-family: "Noto Sans JP", sans-serif;
        }
        .ppl-filter-pill:hover {
          border-color: var(--royal-100);
          background: var(--royal-50);
          color: var(--royal);
        }
        .ppl-filter-pill.active {
          background: var(--royal);
          border-color: var(--royal);
          color: #fff;
          box-shadow: 0 2px 8px rgba(0,35,102,0.25);
        }
        .ppl-sort-btn {
          padding: 5px 12px;
          border-radius: 100px;
          border: 1.5px solid var(--line);
          background: #fff;
          color: var(--ink-soft);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
          font-family: "Noto Sans JP", sans-serif;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .ppl-sort-btn.active {
          background: var(--royal);
          border-color: var(--royal);
          color: #fff;
          box-shadow: 0 2px 8px rgba(0,35,102,0.25);
        }
        .filter-scroll {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
          align-items: center;
        }
        .filter-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      <h1 className="sr-only">先輩を知る — 話せる人を探す</h1>

      {/* ── ページヘッダー ── */}
      <div style={{
        background: "linear-gradient(135deg, #001233 0%, #002366 50%, #1a3569 100%)",
        padding: "28px 24px 24px",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{
            margin: "0 0 6px",
            fontSize: "clamp(20px, 3vw, 28px)",
            fontWeight: 800,
            color: "#fff",
            fontFamily: "var(--font-noto-sans)",
          }}>
            話せる人を探す
          </h2>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 1.6 }}>
            IT/SaaS企業の現役社員・OB/OGに、はたらくリアルを直接聞いてみましょう。
          </p>
          {/* 検索バー */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#fff",
            border: "2px solid rgba(255,255,255,0.2)",
            borderRadius: 12,
            padding: "0 16px",
            maxWidth: 480,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }} aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              ref={inputRef}
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="名前・会社・役職・スキルで検索"
              style={{
                flex: 1, border: "none", outline: "none",
                fontSize: 14, color: "var(--ink)",
                background: "transparent",
                padding: "11px 0",
                fontFamily: "inherit",
              }}
            />
            {keyword && (
              <button type="button" onClick={() => { setKeyword(""); inputRef.current?.focus(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 18, lineHeight: 1, padding: "2px" }}>×</button>
            )}
          </div>
        </div>
      </div>

      {/* ── フィルター + ソートバー ── */}
      <div style={{
        position: "sticky", top: 60, zIndex: 50,
        background: "#fff",
        borderBottom: "1px solid var(--line)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "10px 24px", display: "flex", flexDirection: "column", gap: 8 }}>

          {/* 行1: 職種フィルター */}
          <div className="filter-scroll">
            <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 600, whiteSpace: "nowrap" }}>職種</span>
            {ROLE_CATEGORIES.map((cat) => {
              const count = cat.key === "all" ? ambassadors.length : ambassadors.filter((a) => matchesRole(a, cat.key)).length;
              if (cat.key !== "all" && count === 0) return null;
              const active = roleCategory === cat.key;
              return (
                <button key={cat.key} type="button" onClick={() => setRoleCategory(cat.key)} className={`ppl-filter-pill${active ? " active" : ""}`}>
                  {cat.label}
                  <span style={{ marginLeft: 5, fontSize: 10, fontFamily: "Inter, sans-serif", opacity: active ? 0.8 : 0.6 }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* 行2: 経験年数 + 働き方フィルター + ソート + ビュー + 件数 */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "nowrap", overflowX: "auto" }} className="filter-scroll">
            {/* 経験年数 */}
            {EXP_FILTERS.map((f) => {
              const active = expFilter === f.key;
              return (
                <button key={f.key} type="button" onClick={() => setExpFilter(f.key)} className={`ppl-filter-pill${active ? " active" : ""}`} style={{ fontSize: 11 }}>
                  {f.label}
                </button>
              );
            })}

            <div style={{ width: 1, height: 16, background: "var(--line)", flexShrink: 0 }} />

            {/* 働き方 */}
            {WORK_STYLE_FILTERS.map((f) => {
              const active = workStyleFilter === f.key;
              return (
                <button key={f.key} type="button" onClick={() => setWorkStyleFilter(f.key)} className={`ppl-filter-pill${active ? " active" : ""}`} style={{ fontSize: 11 }}>
                  {f.label}
                </button>
              );
            })}

            <div style={{ width: 1, height: 16, background: "var(--line)", flexShrink: 0 }} />

            {/* ソート */}
            {SORT_OPTIONS.map((s) => {
              const active = sortKey === s.key;
              return (
                <button key={s.key} type="button" onClick={() => setSortKey(s.key)} className={`ppl-sort-btn${active ? " active" : ""}`}>
                  {active && (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                  )}
                  {s.label}
                </button>
              );
            })}

            {/* スペーサー */}
            <div style={{ flex: 1 }} />

            {/* ビュー切り替え */}
            <div style={{ display: "flex", gap: 2, flexShrink: 0, background: "var(--bg-tint)", border: "1.5px solid var(--line)", borderRadius: 8, padding: 2 }}>
              {([
                { mode: "grid" as const, icon: (<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>), title: "グリッド" },
                { mode: "list" as const, icon: (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>), title: "リスト" },
              ]).map(({ mode, icon, title }) => (
                <button key={mode} type="button" onClick={() => setViewMode(mode)} title={title} style={{
                  padding: "4px 9px", borderRadius: 6, border: "none",
                  background: viewMode === mode ? "#fff" : "transparent",
                  color: viewMode === mode ? "var(--royal)" : "var(--ink-mute)",
                  cursor: "pointer", display: "flex", alignItems: "center", transition: "all 0.12s",
                }}>
                  {icon}
                </button>
              ))}
            </div>

            {/* 件数 */}
            <div style={{ flexShrink: 0, display: "flex", alignItems: "baseline", gap: 2 }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)", fontFamily: "Inter, sans-serif" }}>{sorted.length}</span>
              <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>名</span>
              {isFiltered && ambassadors.length !== sorted.length && (
                <span style={{ fontSize: 11, color: "var(--ink-mute)", marginLeft: 2 }}>/ {ambassadors.length}</span>
              )}
            </div>
          </div>

          {/* アクティブフィルター表示 */}
          {isFiltered && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                {sorted.length}名が見つかりました
              </span>
              <button
                type="button"
                onClick={() => { setKeyword(""); setRoleCategory("all"); setExpFilter("all"); setWorkStyleFilter("all"); }}
                style={{
                  fontSize: 11, fontWeight: 600,
                  padding: "2px 8px", borderRadius: 100,
                  background: "var(--bg-tint)", border: "1px solid var(--line)",
                  color: "var(--ink-mute)", cursor: "pointer",
                }}
              >
                フィルターをリセット
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── コンテンツ ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 80px" }}>

        {sorted.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-mute)", fontSize: 14 }}>
            該当する方が見つかりません
          </div>
        ) : viewMode === "list" ? (
          <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
            {sorted.map((card, i) => (
              <AmbassadorListRow key={card.userId} card={card} isLast={i === sorted.length - 1} />
            ))}
          </div>
        ) : (
          <div className="people-grid">
            {sorted.map((card) => <AmbassadorGridCard key={card.userId} card={card} />)}
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
