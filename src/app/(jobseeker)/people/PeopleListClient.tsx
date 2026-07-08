"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { JOB_TYPE_DISPLAY_LABELS } from "@/lib/constants/jobTypes";

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
};

export type PeerCard = {
  userId: string;
  name: string;
  initial: string;
  gradient: string;
  avatarUrl: string | null;
  roleTitle: string | null;
  companyName: string | null;
  jobType: string | null;
};

type Company = { id: string; name: string };

type Props = {
  ambassadors: AmbassadorCard[];
  peers: PeerCard[];
  companies: Company[];
};

// ── テーマタグ取得（DB設定値優先、なければ役職から推定） ──────────────
function resolveTopicTags(card: AmbassadorCard): string[] {
  if (card.talkThemes && card.talkThemes.length > 0) return card.talkThemes;
  const text = `${card.roleTitle ?? ""} ${card.department ?? ""}`.toLowerCase();
  if (text.match(/人事|採用|hr|recruit/)) return ["採用について", "職場環境", "入社後のリアル"];
  if (text.match(/営業|sales|セールス/)) return ["営業スタイル", "顧客事例", "キャリアパス"];
  if (text.match(/エンジニア|engineer|開発|dev|tech/)) return ["技術スタック", "開発文化", "キャリア"];
  if (text.match(/マーケ|market|marketing/)) return ["マーケ戦略", "チーム文化", "働き方"];
  if (text.match(/cs|カスタマー|customer/)) return ["CS業務", "顧客対応", "キャリア"];
  return [];
}

// ── Avatar ────────────────────────────────────────────────────────────
function Avatar({ card, size }: { card: AmbassadorCard; size: number }) {
  const fontSize = size * 0.38;
  if (card.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={card.avatarUrl}
        alt={card.name}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
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
      width: size,
      height: size,
      borderRadius: "50%",
      background: card.gradient,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize,
      fontWeight: 800,
      color: "#fff",
      flexShrink: 0,
      border: "2px solid #fff",
      boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
    }}>
      {card.initial}
    </div>
  );
}

// 株式会社 等のプレフィックスを除いたブランド先頭文字を返す
function companyInitial(card: AmbassadorCard): string {
  if (card.companyLogoLetter) return card.companyLogoLetter;
  const stripped = card.companyName
    .replace(/^(株式会社|合同会社|有限会社|一般社団法人|一般財団法人|公益社団法人)\s*/, "")
    .replace(/\s*(株式会社|合同会社|有限会社)$/, "");
  return stripped.charAt(0) || card.companyName.charAt(0) || "社";
}

// ── CompanyBadge ──────────────────────────────────────────────────────
function CompanyBadge({ card }: { card: AmbassadorCard }) {
  const initial = companyInitial(card);
  const bg = card.companyLogoGradient ?? "linear-gradient(135deg, #001233, #002366)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {card.companyLogoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.companyLogoUrl}
          alt=""
          style={{ width: 18, height: 18, borderRadius: 4, objectFit: "contain", background: "#fff", border: "1px solid var(--line)" }}
        />
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

// ── TopicTags ─────────────────────────────────────────────────────────
function TopicTags({ tags }: { tags: string[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {tags.map((tag) => (
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
    </div>
  );
}

// ── TalkBadge ─────────────────────────────────────────────────────────
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
      話せます
    </span>
  );
}

// ── AmbassadorGridCard ───────────────────────────────────────────────
function AmbassadorGridCard({ card }: { card: AmbassadorCard }) {
  const tags = resolveTopicTags(card);
  // ②重複防止: roleTitle と department が同じ文字列なら department を省略
  const roleDisplay = card.roleTitle ?? card.department ?? "採用担当";
  const showDept = card.department && card.roleTitle && card.department !== card.roleTitle;

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: "24px 20px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        transition: "box-shadow 0.15s, transform 0.15s",
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
      {/* アバター（④現職バッジは削除） */}
      <div style={{ marginBottom: 14 }}>
        <Avatar card={card} size={64} />
      </div>

      {/* 名前 + 話せるバッジ */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
          {card.name}
        </span>
        <TalkBadge />
      </div>

      {/* 役職（②重複排除） */}
      <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 10 }}>
        {roleDisplay}
        {showDept && (
          <span style={{ color: "var(--ink-mute)" }}> · {card.department}</span>
        )}
      </div>

      {/* 会社名 */}
      <div style={{ marginBottom: 14 }}>
        <CompanyBadge card={card} />
      </div>

      {/* ⑦ 話せるテーマタグ（DB設定値優先） */}
      {tags.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "var(--ink-mute)", fontWeight: 600, marginBottom: 5 }}>
            話せるテーマ
          </div>
          <TopicTags tags={tags} />
        </div>
      )}

      {/* ⑧CTAボタン + サブテキスト */}
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <Link
            href={`/companies/${card.companyId}/casual-meeting`}
            style={{
              display: "block", textAlign: "center",
              padding: "9px 16px",
              background: "linear-gradient(135deg, #F59E0B, #F97316)",
              color: "#fff",
              borderRadius: 9,
              fontSize: 13, fontWeight: 700,
              textDecoration: "none",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.88"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
          >
            話を聞く →
          </Link>
          <div style={{ textAlign: "center", fontSize: 10, color: "var(--ink-mute)", marginTop: 4 }}>
            カジュアル面談を申し込む（無料）
          </div>
        </div>
        <Link
          href={`/u/${card.userId}`}
          style={{
            display: "block", textAlign: "center",
            padding: "8px 16px",
            background: "var(--royal-50)",
            color: "var(--royal)",
            borderRadius: 9,
            fontSize: 12, fontWeight: 600,
            textDecoration: "none",
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
  const tags = resolveTopicTags(card);
  // ②重複防止
  const roleDisplay = card.roleTitle ?? card.department ?? "採用担当";
  const showDept = card.department && card.roleTitle && card.department !== card.roleTitle;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "64px 1fr auto",
      alignItems: "center",
      gap: 16,
      padding: "18px 24px",
      borderBottom: isLast ? "none" : "1px solid var(--line-soft)",
      background: "#fff",
      transition: "background 0.1s",
    }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#FAFBFF"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#fff"; }}
    >
      {/* アバター */}
      <Avatar card={card} size={52} />

      {/* 名前・役職・タグ（④現職バッジ削除） */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{card.name}</span>
          <TalkBadge />
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 6 }}>
          {roleDisplay}
          {showDept && (
            <span style={{ color: "var(--ink-mute)" }}> · {card.department}</span>
          )}
          <span style={{ margin: "0 6px", color: "var(--line)" }}>|</span>
          <CompanyBadge card={card} />
        </div>
        {/* ⑦ DB設定タグがある場合のみ表示 */}
        {tags.length > 0 && <TopicTags tags={tags} />}
      </div>

      {/* ⑧CTAボタン + サブテキスト */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0, alignItems: "center" }}>
        <Link
          href={`/companies/${card.companyId}/casual-meeting`}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            padding: "8px 18px",
            background: "linear-gradient(135deg, #F59E0B, #F97316)",
            color: "#fff",
            borderRadius: 8,
            fontSize: 12, fontWeight: 700,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          話を聞く →
        </Link>
        <div style={{ fontSize: 10, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>
          カジュアル面談（無料）
        </div>
        <Link
          href={`/u/${card.userId}`}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            padding: "6px 14px",
            background: "transparent",
            color: "var(--royal)",
            borderRadius: 8,
            fontSize: 11, fontWeight: 600,
            textDecoration: "none",
            border: "1px solid var(--royal-100)",
            whiteSpace: "nowrap",
          }}
        >
          プロフィール
        </Link>
      </div>
    </div>
  );
}

// ── ロールカテゴリ定義 ───────────────────────────────────────────────
const ROLE_CATEGORIES = [
  { key: "all",      label: "すべて",       pattern: null },
  { key: "peers",    label: "候補者",       pattern: null },
  { key: "hr",       label: "人事・採用",   pattern: /人事|採用|hr|recruit/i },
  { key: "sales",    label: "営業・セールス", pattern: /営業|sales|セールス/i },
  { key: "mktcs",   label: "マーケ・CS",   pattern: /マーケ|market|cs|カスタマー|customer/i },
  { key: "eng",      label: "エンジニア",   pattern: /エンジニア|engineer|開発|dev|tech/i },
  { key: "exec",     label: "経営・役員",   pattern: /CEO|CTO|COO|CFO|VP|役員|代表|社長|執行|事業部長/i },
] as const;

type RoleCategoryKey = typeof ROLE_CATEGORIES[number]["key"];

function matchesRoleCategory(card: AmbassadorCard, key: RoleCategoryKey): boolean {
  if (key === "all" || key === "peers") return true;
  const text = `${card.roleTitle ?? ""} ${card.department ?? ""}`;
  const cat = ROLE_CATEGORIES.find((c) => c.key === key);
  return cat?.pattern ? cat.pattern.test(text) : true;
}

// ── 企業タイプフィルター定義 ─────────────────────────────────────────
const COMPANY_TYPE_FILTERS = [
  { key: "all",        label: "すべての企業",   phasePattern: null as RegExp | null },
  { key: "startup",    label: "スタートアップ", phasePattern: /シード|seed|シリーズ[ABC]|series[_-]?[abc]/i },
  { key: "listed",     label: "上場企業",       phasePattern: /listed|上場|IPO/i },
  { key: "unicorn",    label: "ユニコーン",     phasePattern: /unicorn|ユニコーン/i },
  { key: "enterprise", label: "大手・外資",     phasePattern: /大手|enterprise|外資/i },
] as const;

type CompanyTypeKey = typeof COMPANY_TYPE_FILTERS[number]["key"];

function matchesCompanyType(card: AmbassadorCard, key: CompanyTypeKey): boolean {
  if (key === "all") return true;
  const phase = (card.companyPhase ?? "").toLowerCase();
  const name = (card.companyName ?? "").toLowerCase();
  const cat = COMPANY_TYPE_FILTERS.find((c) => c.key === key);
  if (!cat?.phasePattern) return true;
  // 企業名に「外資」含む場合も enterprise にマッチ
  if (key === "enterprise") {
    return cat.phasePattern.test(card.companyPhase ?? "") ||
      /外資|global|インターナショナル/i.test(name);
  }
  return cat.phasePattern.test(phase);
}

// ── PeerAvatar ────────────────────────────────────────────────────────
function PeerAvatar({ card, size }: { card: PeerCard; size: number }) {
  const fontSize = size * 0.38;
  if (card.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={card.avatarUrl}
        alt={card.name}
        style={{
          width: size, height: size, borderRadius: "50%", objectFit: "cover",
          border: "2px solid #fff", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: card.gradient,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize, fontWeight: 800, color: "#fff", flexShrink: 0,
      border: "2px solid #fff", boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
    }}>
      {card.initial}
    </div>
  );
}

// ── PeerBadge ─────────────────────────────────────────────────────────
function PeerBadge() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 10, fontWeight: 700,
      padding: "2px 8px", borderRadius: 100,
      background: "var(--royal-50)", color: "var(--royal)",
      border: "1px solid var(--royal-100)", whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--royal)", flexShrink: 0 }} />
      候補者
    </span>
  );
}

// ── PeerGridCard ─────────────────────────────────────────────────────
function PeerGridCard({ card }: { card: PeerCard }) {
  const jobTypeLabel = card.jobType
    ? (JOB_TYPE_DISPLAY_LABELS[card.jobType] ?? card.jobType)
    : null;

  return (
    <div
      style={{
        background: "#fff", border: "1px solid var(--line)", borderRadius: 16,
        padding: "24px 20px 20px", display: "flex", flexDirection: "column", gap: 0,
        transition: "box-shadow 0.15s, transform 0.15s",
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
      <div style={{ marginBottom: 14 }}>
        <PeerAvatar card={card} size={64} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{card.name}</span>
        <PeerBadge />
      </div>
      {card.roleTitle && (
        <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 6 }}>{card.roleTitle}</div>
      )}
      {card.companyName && (
        <div style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 10 }}>{card.companyName}</div>
      )}
      {jobTypeLabel && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "var(--ink-mute)", fontWeight: 600, marginBottom: 5 }}>経験職種</div>
          <TopicTags tags={[jobTypeLabel]} />
        </div>
      )}
      <div style={{ marginTop: "auto" }}>
        <Link
          href={`/u/${card.userId}`}
          style={{
            display: "block", textAlign: "center", padding: "9px 16px",
            background: "var(--royal-50)", color: "var(--royal)",
            borderRadius: 9, fontSize: 13, fontWeight: 700,
            textDecoration: "none", border: "1px solid var(--royal-100)",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.80"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
        >
          プロフィールを見る →
        </Link>
      </div>
    </div>
  );
}

// ── PeerListRow ──────────────────────────────────────────────────────
function PeerListRow({ card, isLast }: { card: PeerCard; isLast: boolean }) {
  const jobTypeLabel = card.jobType
    ? (JOB_TYPE_DISPLAY_LABELS[card.jobType] ?? card.jobType)
    : null;

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "64px 1fr auto", alignItems: "center",
      gap: 16, padding: "18px 24px",
      borderBottom: isLast ? "none" : "1px solid var(--line-soft)",
      background: "#fff", transition: "background 0.1s",
    }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#FAFBFF"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#fff"; }}
    >
      <PeerAvatar card={card} size={52} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{card.name}</span>
          <PeerBadge />
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: jobTypeLabel ? 6 : 0 }}>
          {card.roleTitle ?? ""}
          {card.companyName && (
            <span style={{ color: "var(--ink-mute)" }}>
              {card.roleTitle ? " · " : ""}{card.companyName}
            </span>
          )}
        </div>
        {jobTypeLabel && <TopicTags tags={[jobTypeLabel]} />}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0, alignItems: "center" }}>
        <Link
          href={`/u/${card.userId}`}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            padding: "8px 18px", background: "var(--royal-50)", color: "var(--royal)",
            borderRadius: 8, fontSize: 12, fontWeight: 700,
            textDecoration: "none", border: "1px solid var(--royal-100)", whiteSpace: "nowrap",
          }}
        >
          プロフィールを見る →
        </Link>
      </div>
    </div>
  );
}

// ── PeopleListClient ─────────────────────────────────────────────────
export function PeopleListClient({ ambassadors, peers, companies: _companies }: Props) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [roleCategory, setRoleCategory] = useState<RoleCategoryKey>("all");
  const [companyType, setCompanyType] = useState<CompanyTypeKey>("all");
  const [keyword, setKeyword] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isPeersMode = roleCategory === "peers";

  const filteredAmbassadors = useMemo(() => {
    if (isPeersMode) return [];
    const q = keyword.trim().toLowerCase();
    return ambassadors.filter((a) => {
      if (!matchesRoleCategory(a, roleCategory)) return false;
      if (!matchesCompanyType(a, companyType)) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.companyName.toLowerCase().includes(q) ||
        (a.roleTitle ?? "").toLowerCase().includes(q) ||
        (a.department ?? "").toLowerCase().includes(q)
      );
    });
  }, [ambassadors, roleCategory, companyType, keyword, isPeersMode]);

  const filteredPeers = useMemo(() => {
    if (!isPeersMode) return [];
    const q = keyword.trim().toLowerCase();
    if (!q) return peers;
    return peers.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.companyName ?? "").toLowerCase().includes(q) ||
      (p.roleTitle ?? "").toLowerCase().includes(q)
    );
  }, [peers, isPeersMode, keyword]);


  if (ambassadors.length === 0 && peers.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "80px 24px" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>💬</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
          まだ登録がありません
        </div>
        <div style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.7 }}>
          「話せる人」として登録した社員が表示されます。
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── ページヘッダーバンド ── */}
      <div style={{
        background: "linear-gradient(135deg, #001233 0%, #002366 60%, #1a3569 100%)",
        padding: "var(--space-8) 0 var(--space-6)",
      }} className="px-5 md:px-12">
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(255,255,255,0.55)", marginBottom: "var(--space-2)", textTransform: "uppercase" }}>
            PEOPLE
          </div>
          <h1 style={{
            fontFamily: "var(--font-noto-serif)",
            fontSize: "clamp(22px, 3vw, 32px)",
            fontWeight: 700,
            color: "#fff",
            lineHeight: 1.35,
            marginBottom: "var(--space-3)",
          }}>
            話せる人を探す
          </h1>
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 600, padding: "5px 13px", borderRadius: 999, background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.88)", border: "1px solid rgba(255,255,255,0.18)", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              {ambassadors.length + peers.length}名掲載中
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, padding: "5px 13px", borderRadius: 999, background: "rgba(245,158,11,0.15)", color: "#FCD34D", border: "1px solid rgba(245,158,11,0.3)", display: "inline-flex", alignItems: "center", gap: 5 }}>
              直接話せる · 無料
            </span>
          </div>
        </div>
      </div>

      {/* ── Sticky フィルターバー（企業ページと同パターン） ── */}
      <div style={{ position: "sticky", top: 60, zIndex: 50, background: "#fff", borderBottom: "1px solid var(--line)", padding: "var(--space-2) 0", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }} className="px-5 md:px-12">
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 8 }}>

        {/* ── 行1: 検索バー + 職種チップ + ビュー切替 ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap", overflowX: "auto", scrollbarWidth: "none" } as React.CSSProperties}>

        {/* フリーワード検索 */}
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 0 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#fff", border: "1.5px solid #e6e9ef", borderRadius: 999,
            padding: "0 14px", transition: "border-color 0.15s, box-shadow 0.15s",
          }}
            onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--royal)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px rgba(0,35,102,0.08)"; }}
            onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#e6e9ef"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="#8b95a3" strokeWidth="2" strokeLinecap="round"
              style={{ flexShrink: 0 }} aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              ref={inputRef}
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="名前・会社名・役職で検索"
              style={{
                flex: 1, border: "none", outline: "none",
                fontSize: 13.5, color: "var(--ink)", background: "transparent",
                padding: "9px 0", minWidth: 0, fontFamily: "inherit",
              }}
            />
            {keyword && (
              <button
                type="button"
                onClick={() => { setKeyword(""); inputRef.current?.focus(); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#8b95a3", fontSize: 16, lineHeight: 1, padding: "2px", flexShrink: 0 }}
              >×</button>
            )}
          </div>
        </div>

        {/* ロールカテゴリ */}
        <div style={{ display: "flex", gap: 6, flexWrap: "nowrap" }}>
            {ROLE_CATEGORIES.filter((cat) => {
              if (cat.key === "all" || cat.key === "peers") return true;
              return ambassadors.filter((a) => matchesRoleCategory(a, cat.key)).length > 0;
            }).map((cat) => {
              const count = cat.key === "all"
                ? ambassadors.length
                : cat.key === "peers"
                  ? peers.length
                  : ambassadors.filter((a) => matchesRoleCategory(a, cat.key)).length;
              const isActive = roleCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setRoleCategory(cat.key)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 100,
                    border: `1.5px solid ${isActive ? "var(--royal)" : "var(--line)"}`,
                    background: isActive ? "var(--royal)" : "#fff",
                    color: isActive ? "#fff" : "var(--ink-soft)",
                    fontSize: 12, fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {cat.label}
                  <span style={{
                    marginLeft: 5,
                    fontSize: 10,
                    fontFamily: "Inter, sans-serif",
                    opacity: isActive ? 0.8 : 0.6,
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

        </div>{/* 行1 end */}

        {/* ── 行2: 企業タイプフィルター + 表示切替（overflowX auto で見切れ解消） ── */}
        <div style={{ display: "flex", gap: 6, flexWrap: "nowrap", overflowX: "auto", alignItems: "center", scrollbarWidth: "none", paddingTop: 2 } as React.CSSProperties}>
          {isPeersMode && (
            <span style={{ fontSize: 11, color: "var(--ink-mute)", fontStyle: "italic", marginRight: 8 }}>
              候補者同士で話せる人
            </span>
          )}
          {!isPeersMode && <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 600, whiteSpace: "nowrap", marginRight: 2 }}>企業タイプ</span>}
          {!isPeersMode && COMPANY_TYPE_FILTERS.map((cat) => {
            const count = cat.key === "all"
              ? ambassadors.length
              : ambassadors.filter((a) => matchesCompanyType(a, cat.key)).length;
            const isActive = companyType === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setCompanyType(cat.key)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 100,
                  border: `1.5px solid ${isActive ? "var(--purple)" : "var(--line)"}`,
                  background: isActive ? "var(--purple)" : "#fff",
                  color: isActive ? "#fff" : "var(--ink-soft)",
                  fontSize: 12, fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {cat.label}
                <span style={{
                  marginLeft: 5,
                  fontSize: 10,
                  fontFamily: "Inter, sans-serif",
                  opacity: isActive ? 0.8 : 0.6,
                }}>
                  {count}
                </span>
              </button>
            );
          })}

          {/* ビュー切り替え — 行2 右端（/companies GridSortBar と同位置） */}
          <div style={{
            display: "flex", gap: 2, marginLeft: "auto", flexShrink: 0,
            background: "var(--bg-tint)", border: "1.5px solid var(--line)",
            borderRadius: 9, padding: 3,
          }}>
            {([
              { mode: "list" as const, label: "リスト", icon: (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              )},
              { mode: "grid" as const, label: "グリッド", icon: (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
              )},
            ]).map(({ mode, label, icon }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                title={label}
                style={{
                  padding: "5px 10px",
                  borderRadius: 7, border: "none",
                  background: viewMode === mode ? "#fff" : "transparent",
                  color: viewMode === mode ? "var(--royal)" : "var(--ink-mute)",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 4,
                  fontSize: 11, fontWeight: 600,
                  boxShadow: viewMode === mode ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {icon}{label}
              </button>
            ))}
          </div>
        </div>

        {/* アクティブフィルター表示 */}
        {(keyword || roleCategory !== "all" || companyType !== "all") && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
              {isPeersMode ? filteredPeers.length : filteredAmbassadors.length}名が見つかりました
            </span>
            <button
              type="button"
              onClick={() => { setKeyword(""); setRoleCategory("all"); setCompanyType("all"); }}
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

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 80px" }}>

      {/* ── リストビュー ── */}
      {viewMode === "list" && (
        <div style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 14,
          overflow: "hidden",
        }}>
          {isPeersMode
            ? filteredPeers.map((card, i) => (
                <PeerListRow key={card.userId} card={card} isLast={i === filteredPeers.length - 1} />
              ))
            : filteredAmbassadors.map((card, i) => (
                <AmbassadorListRow key={card.userId} card={card} isLast={i === filteredAmbassadors.length - 1} />
              ))
          }
        </div>
      )}

      {/* ── グリッドビュー ── */}
      {viewMode === "grid" && (
        <>
          <style>{`
            .people-grid {
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 16px;
            }
            @media (max-width: 900px) {
              .people-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            }
            @media (max-width: 560px) {
              .people-grid { grid-template-columns: minmax(0, 1fr); }
            }
          `}</style>
          <div className="people-grid">
            {isPeersMode
              ? filteredPeers.map((card) => <PeerGridCard key={card.userId} card={card} />)
              : filteredAmbassadors.map((card) => <AmbassadorGridCard key={card.userId} card={card} />)
            }
          </div>
        </>
      )}

      {(isPeersMode ? filteredPeers : filteredAmbassadors).length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-mute)", fontSize: 14 }}>
          {isPeersMode
            ? "まだ「候補者同士で話せる」に設定している方がいません。プロフィール設定から有効にできます。"
            : "該当する方が見つかりません"}
        </div>
      )}


      {/* ── 注意書き ── */}
      <div style={{
        marginTop: 24,
        padding: "16px 20px",
        background: "var(--bg-tint)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        fontSize: 12,
        color: "var(--ink-mute)",
        lineHeight: 1.8,
      }}>
        ※ このページに掲載されている方は、各企業の採用担当から「話せる人」として承認を受けた現役社員です。<br />
        ※ カジュアルにお話を聞くことができます。転職を前提としない情報収集もお気軽にどうぞ。
      </div>
      </div>
    </>
  );
}
