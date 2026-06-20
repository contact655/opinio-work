"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

export type AmbassadorCard = {
  adminId: string;
  userId: string;
  name: string;
  initial: string;
  gradient: string;
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

// ── CompanyLogo ──────────────────────────────────────────────────────
function CompanyLogo({
  logoUrl,
  gradient,
  letter,
  size,
}: {
  logoUrl: string | null;
  gradient: string | null;
  letter: string | null;
  size: number;
}) {
  const fallbackGradient = gradient ?? "linear-gradient(135deg, #001233, #002366)";
  const fallbackLetter = letter ?? "?";

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: 6,
          objectFit: "contain",
          background: "#fff",
          border: "1px solid var(--line)",
        }}
      />
    );
  }
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: 6,
      background: fallbackGradient,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size * 0.4,
      fontWeight: 800,
      color: "#fff",
      flexShrink: 0,
    }}>
      {fallbackLetter}
    </div>
  );
}

// ── AmbassadorGridCard ───────────────────────────────────────────────
function AmbassadorGridCard({ card }: { card: AmbassadorCard }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid var(--line)",
      borderRadius: 14,
      padding: "24px 20px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 0,
      transition: "box-shadow 0.15s, transform 0.15s",
    }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.08)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      }}
    >
      {/* 企業ロゴ（右上） */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <CompanyLogo
          logoUrl={card.companyLogoUrl}
          gradient={card.companyLogoGradient}
          letter={card.companyLogoLetter}
          size={28}
        />
      </div>

      {/* アバター */}
      <div style={{
        width: 64,
        height: 64,
        borderRadius: "50%",
        background: card.gradient,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 24,
        fontWeight: 800,
        color: "#fff",
        marginBottom: 14,
        flexShrink: 0,
      }}>
        {card.initial}
      </div>

      {/* 名前 + 話せるバッジ */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
          {card.name}
        </span>
        <span style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 10,
          fontWeight: 700,
          padding: "2px 8px",
          borderRadius: 100,
          background: "#FFF7ED",
          color: "#C2410C",
          border: "1px solid #FED7AA",
          whiteSpace: "nowrap",
        }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#F97316", flexShrink: 0 }} />
          話せます
        </span>
      </div>

      {/* 役職 */}
      {card.roleTitle && (
        <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 4 }}>
          {card.roleTitle}
          {card.department && <span style={{ color: "var(--ink-mute)" }}> · {card.department}</span>}
        </div>
      )}

      {/* 会社名 */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        color: "var(--ink-mute)",
        marginBottom: 16,
      }}>
        <CompanyLogo
          logoUrl={card.companyLogoUrl}
          gradient={card.companyLogoGradient}
          letter={card.companyLogoLetter}
          size={14}
        />
        {card.companyName}
      </div>

      {/* CTA */}
      <div style={{ marginTop: "auto" }}>
        <Link
          href={`/u/${card.userId}`}
          style={{
            display: "block",
            textAlign: "center",
            padding: "9px 16px",
            background: "var(--royal-50)",
            color: "var(--royal)",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
            border: "1px solid var(--royal-100)",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#dce5f7"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--royal-50)"; }}
        >
          プロフィールを見る →
        </Link>
      </div>
    </div>
  );
}

// ── AmbassadorListRow ────────────────────────────────────────────────
function AmbassadorListRow({ card, isLast }: { card: AmbassadorCard; isLast: boolean }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "56px 1fr auto",
      alignItems: "center",
      gap: 16,
      padding: "16px 20px",
      borderBottom: isLast ? "none" : "1px solid var(--line-soft)",
      background: "#fff",
    }}>
      {/* アバター */}
      <div style={{
        width: 52,
        height: 52,
        borderRadius: "50%",
        background: card.gradient,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 20,
        fontWeight: 800,
        color: "#fff",
        flexShrink: 0,
      }}>
        {card.initial}
      </div>

      {/* 名前・役職・会社 */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{card.name}</span>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 100,
            background: "#FFF7ED",
            color: "#C2410C",
            border: "1px solid #FED7AA",
            whiteSpace: "nowrap",
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#F97316", flexShrink: 0 }} />
            話せます
          </span>
        </div>
        {card.roleTitle && (
          <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 3 }}>
            {card.roleTitle}
            {card.department && <span style={{ color: "var(--ink-mute)" }}> · {card.department}</span>}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-mute)" }}>
          <CompanyLogo
            logoUrl={card.companyLogoUrl}
            gradient={card.companyLogoGradient}
            letter={card.companyLogoLetter}
            size={14}
          />
          {card.companyName}
        </div>
      </div>

      {/* CTA */}
      <Link
        href={`/u/${card.userId}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "8px 14px",
          background: "var(--royal-50)",
          color: "var(--royal)",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 700,
          textDecoration: "none",
          border: "1px solid var(--royal-100)",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        プロフィール →
      </Link>
    </div>
  );
}

// ── PeopleListClient ─────────────────────────────────────────────────
export function PeopleListClient({ ambassadors, companies }: Props) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
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
      {/* コントロールバー */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 20,
        flexWrap: "wrap",
      }}>
        {/* 企業フィルター */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setSelectedCompanyId(null)}
            style={{
              padding: "6px 14px",
              borderRadius: 100,
              border: `1px solid ${!selectedCompanyId ? "var(--royal)" : "var(--line)"}`,
              background: !selectedCompanyId ? "var(--royal-50)" : "#fff",
              color: !selectedCompanyId ? "var(--royal)" : "var(--ink-mute)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
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
                  border: `1px solid ${isActive ? "var(--royal)" : "var(--line)"}`,
                  background: isActive ? "var(--royal-50)" : "#fff",
                  color: isActive ? "var(--royal)" : "var(--ink-mute)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
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
          gap: 4,
          background: "var(--bg-tint)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          padding: 3,
          flexShrink: 0,
        }}>
          {(["grid", "list"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              title={mode === "grid" ? "グリッド表示" : "リスト表示"}
              style={{
                width: 30,
                height: 30,
                borderRadius: 6,
                border: "none",
                background: viewMode === mode ? "#fff" : "transparent",
                color: viewMode === mode ? "var(--ink)" : "var(--ink-mute)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: viewMode === mode ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s",
              }}
            >
              {mode === "grid" ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* グリッドビュー */}
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

      {/* リストビュー */}
      {viewMode === "list" && (
        <div style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 12,
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

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-mute)", fontSize: 14 }}>
          該当する方が見つかりません
        </div>
      )}

      {/* 注意書き */}
      <div style={{
        marginTop: 36,
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
