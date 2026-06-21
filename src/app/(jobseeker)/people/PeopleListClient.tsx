"use client";

import { useState, useMemo } from "react";
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
  companyId: string;
  companyName: string;
  companyLogoUrl: string | null;
  companyLogoGradient: string | null;
  companyLogoLetter: string | null;
};

type Company = { id: string; name: string };

type Props = {
  ambassadors: AmbassadorCard[];
  companies: Company[];
};

// ── テーマタグ推定 ────────────────────────────────────────────────────
function deriveTopicTags(roleTitle: string | null, department: string | null): string[] {
  const text = `${roleTitle ?? ""} ${department ?? ""}`.toLowerCase();
  if (text.match(/人事|採用|hr|recruit/)) return ["採用について", "職場環境", "入社後のリアル"];
  if (text.match(/営業|sales|セールス/)) return ["営業スタイル", "顧客事例", "キャリアパス"];
  if (text.match(/エンジニア|engineer|開発|dev|tech/)) return ["技術スタック", "開発文化", "キャリア"];
  if (text.match(/マーケ|market|marketing/)) return ["マーケ戦略", "チーム文化", "働き方"];
  if (text.match(/cs|カスタマー|customer/)) return ["CS業務", "顧客対応", "キャリア"];
  return ["仕事内容", "職場環境", "会社の魅力"];
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

// ── CompanyBadge ──────────────────────────────────────────────────────
function CompanyBadge({ card }: { card: AmbassadorCard }) {
  const initial = card.companyLogoLetter ?? card.companyName.charAt(0) ?? "社";
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
  const tags = deriveTopicTags(card.roleTitle, card.department);
  const roleDisplay = card.roleTitle ?? (card.department ?? "採用担当");

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
      {/* アバター + 現職バッジ */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <Avatar card={card} size={64} />
        <span style={{
          fontSize: 10, fontWeight: 700,
          padding: "3px 8px", borderRadius: 100,
          background: "#F0FDF4", color: "#15803D",
          border: "1px solid #BBF7D0",
        }}>
          現職
        </span>
      </div>

      {/* 名前 + 話せるバッジ */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
          {card.name}
        </span>
        <TalkBadge />
      </div>

      {/* 役職 */}
      <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 10 }}>
        {roleDisplay}
        {card.department && card.roleTitle && (
          <span style={{ color: "var(--ink-mute)" }}> · {card.department}</span>
        )}
      </div>

      {/* 会社名 */}
      <div style={{ marginBottom: 14 }}>
        <CompanyBadge card={card} />
      </div>

      {/* 話せるテーマタグ */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: "var(--ink-mute)", fontWeight: 600, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          話せるテーマ
        </div>
        <TopicTags tags={tags} />
      </div>

      {/* CTAボタン */}
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
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
  const tags = deriveTopicTags(card.roleTitle, card.department);
  const roleDisplay = card.roleTitle ?? (card.department ?? "採用担当");

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

      {/* 名前・役職・タグ */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{card.name}</span>
          <TalkBadge />
          <span style={{
            fontSize: 10, fontWeight: 700,
            padding: "2px 7px", borderRadius: 100,
            background: "#F0FDF4", color: "#15803D",
            border: "1px solid #BBF7D0",
          }}>現職</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 6 }}>
          {roleDisplay}
          {card.department && card.roleTitle && (
            <span style={{ color: "var(--ink-mute)" }}> · {card.department}</span>
          )}
          <span style={{ margin: "0 6px", color: "var(--line)" }}>|</span>
          <CompanyBadge card={card} />
        </div>
        <TopicTags tags={tags} />
      </div>

      {/* CTAボタン */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
        <Link
          href={`/companies/${card.companyId}/casual-meeting`}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            padding: "8px 16px",
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
        <Link
          href={`/u/${card.userId}`}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            padding: "7px 14px",
            background: "var(--royal-50)",
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

// ── PeopleListClient ─────────────────────────────────────────────────
export function PeopleListClient({ ambassadors, companies }: Props) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!selectedCompanyId) return ambassadors;
    return ambassadors.filter((a) => a.companyId === selectedCompanyId);
  }, [ambassadors, selectedCompanyId]);

  if (ambassadors.length === 0) {
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
    <div>
      {/* ── ページヘッダー ── */}
      <div style={{
        background: "linear-gradient(135deg, #001233 0%, #002366 60%, #1a3569 100%)",
        borderRadius: 16,
        padding: "36px 40px",
        marginBottom: 32,
        color: "#fff",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.55)", marginBottom: 8, textTransform: "uppercase" }}>
          People
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 10px", lineHeight: 1.3, fontFamily: "'Noto Serif JP', serif" }}>
          企業の人に、直接話を聞こう。
        </h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 1.8, margin: "0 0 20px", maxWidth: 480 }}>
          各企業の採用担当や現役社員が「話せる人」として登録しています。<br />
          転職前提なしで、仕事のリアルを30分カジュアルに聞けます。
        </p>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 24, fontWeight: 800, fontFamily: "Inter, sans-serif", color: "#fff" }}>
              {ambassadors.length}
            </span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.60)" }}>名が話せます</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 24, fontWeight: 800, fontFamily: "Inter, sans-serif", color: "#fff" }}>
              {companies.length}
            </span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.60)" }}>社が参加中</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6,
            background: "rgba(245,158,11,0.18)", border: "1px solid rgba(245,158,11,0.35)",
            borderRadius: 100, padding: "4px 12px",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#F59E0B", flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#FCD34D" }}>完全無料・転職前提なし</span>
          </div>
        </div>
      </div>

      {/* ── コントロールバー ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 20,
        flexWrap: "wrap",
      }}>
        {/* 企業フィルター */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            企業
          </span>
          <button
            type="button"
            onClick={() => setSelectedCompanyId(null)}
            style={{
              padding: "6px 14px",
              borderRadius: 100,
              border: `1.5px solid ${!selectedCompanyId ? "var(--royal)" : "var(--line)"}`,
              background: !selectedCompanyId ? "var(--royal-50)" : "#fff",
              color: !selectedCompanyId ? "var(--royal)" : "var(--ink-mute)",
              fontSize: 12, fontWeight: 600,
              cursor: "pointer",
            }}
          >
            すべて ({ambassadors.length})
          </button>
          {companies.map((c) => {
            const count = ambassadors.filter((a) => a.companyId === c.id).length;
            const isActive = selectedCompanyId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCompanyId(isActive ? null : c.id)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 100,
                  border: `1.5px solid ${isActive ? "var(--royal)" : "var(--line)"}`,
                  background: isActive ? "var(--royal-50)" : "#fff",
                  color: isActive ? "var(--royal)" : "var(--ink-mute)",
                  fontSize: 12, fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {c.name} ({count})
              </button>
            );
          })}
        </div>

        {/* ビュー切り替え */}
        <div style={{
          display: "flex",
          gap: 2,
          background: "var(--bg-tint)",
          border: "1.5px solid var(--line)",
          borderRadius: 10,
          padding: 3,
          flexShrink: 0,
        }}>
          {([
            { mode: "list" as const, label: "リスト", icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            )},
            { mode: "grid" as const, label: "グリッド", icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
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
                padding: "6px 12px",
                borderRadius: 7,
                border: "none",
                background: viewMode === mode ? "#fff" : "transparent",
                color: viewMode === mode ? "var(--royal)" : "var(--ink-mute)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11, fontWeight: 600,
                boxShadow: viewMode === mode ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
                transition: "all 0.15s",
              }}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── リストビュー ── */}
      {viewMode === "list" && (
        <div style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 14,
          overflow: "hidden",
        }}>
          {filtered.map((card, i) => (
            <AmbassadorListRow
              key={card.userId}
              card={card}
              isLast={i === filtered.length - 1}
            />
          ))}
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
            {filtered.map((card) => (
              <AmbassadorGridCard key={card.userId} card={card} />
            ))}
          </div>
        </>
      )}

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-mute)", fontSize: 14 }}>
          該当する方が見つかりません
        </div>
      )}

      {/* ── 準備中メッセージ ── */}
      {ambassadors.length < 8 && (
        <div style={{
          marginTop: 20,
          padding: "20px 24px",
          background: "linear-gradient(135deg, var(--royal-50), #fff)",
          border: "1px dashed var(--royal-100)",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}>
          <div style={{ fontSize: 28, flexShrink: 0 }}>🤝</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--royal)", marginBottom: 3 }}>
              話せる人を順次追加中
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7 }}>
              現在{ambassadors.length}名が登録中です。各企業の採用担当者・現役社員を随時追加しています。
              気になる企業の社員に話を聞きたい場合は、企業詳細ページからカジュアル面談を申し込めます。
            </div>
          </div>
          <Link
            href="/companies"
            style={{
              flexShrink: 0,
              padding: "8px 16px",
              background: "var(--royal)",
              color: "#fff",
              borderRadius: 8,
              fontSize: 12, fontWeight: 700,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            企業を見る →
          </Link>
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
  );
}
