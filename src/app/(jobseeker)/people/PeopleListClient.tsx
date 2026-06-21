"use client";

import { useState, useMemo, useRef } from "react";
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

// ── ロールカテゴリ定義 ───────────────────────────────────────────────
const ROLE_CATEGORIES = [
  { key: "all",      label: "すべて",       pattern: null },
  { key: "hr",       label: "人事・採用",   pattern: /人事|採用|hr|recruit/i },
  { key: "sales",    label: "営業・セールス", pattern: /営業|sales|セールス/i },
  { key: "mktcs",   label: "マーケ・CS",   pattern: /マーケ|market|cs|カスタマー|customer/i },
  { key: "eng",      label: "エンジニア",   pattern: /エンジニア|engineer|開発|dev|tech/i },
] as const;

type RoleCategoryKey = typeof ROLE_CATEGORIES[number]["key"];

function matchesRoleCategory(card: AmbassadorCard, key: RoleCategoryKey): boolean {
  if (key === "all") return true;
  const text = `${card.roleTitle ?? ""} ${card.department ?? ""}`;
  const cat = ROLE_CATEGORIES.find((c) => c.key === key);
  return cat?.pattern ? cat.pattern.test(text) : true;
}

// ── PeopleListClient ─────────────────────────────────────────────────
export function PeopleListClient({ ambassadors, companies: _companies }: Props) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [roleCategory, setRoleCategory] = useState<RoleCategoryKey>("all");
  const [keyword, setKeyword] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return ambassadors.filter((a) => {
      if (!matchesRoleCategory(a, roleCategory)) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.companyName.toLowerCase().includes(q) ||
        (a.roleTitle ?? "").toLowerCase().includes(q) ||
        (a.department ?? "").toLowerCase().includes(q)
      );
    });
  }, [ambassadors, roleCategory, keyword]);

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
      {/* ── ページタイトル ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", margin: "0 0 6px", fontFamily: "'Noto Serif JP', serif" }}>
          話せる人
        </h1>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.7 }}>
          各企業の採用担当・現役社員に直接話を聞けます。転職前提なし・完全無料。
          <span style={{
            marginLeft: 10, fontSize: 11, fontWeight: 700,
            padding: "2px 8px", borderRadius: 100,
            background: "#FFF7ED", color: "#C2410C", border: "1px solid #FED7AA",
          }}>
            {ambassadors.length}名が話せます
          </span>
        </p>
      </div>

      {/* ── 検索 + フィルター ── */}
      <div style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "16px 20px",
        marginBottom: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}>
        {/* フリーワード検索 */}
        <div style={{ position: "relative" }}>
          <svg
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="var(--ink-mute)" strokeWidth="2.5" strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="名前・会社名・役職で検索..."
            style={{
              width: "100%",
              padding: "9px 16px 9px 36px",
              border: "1.5px solid var(--line)",
              borderRadius: 9,
              fontSize: 13,
              color: "var(--ink)",
              background: "var(--bg-tint)",
              outline: "none",
              boxSizing: "border-box",
              fontFamily: "inherit",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--royal)"; e.currentTarget.style.background = "#fff"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--line)"; e.currentTarget.style.background = "var(--bg-tint)"; }}
          />
          {keyword && (
            <button
              type="button"
              onClick={() => { setKeyword(""); inputRef.current?.focus(); }}
              style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                color: "var(--ink-mute)", fontSize: 16, lineHeight: 1, padding: 2,
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* ロールカテゴリ + ビュー切り替え */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {ROLE_CATEGORIES.map((cat) => {
              const count = cat.key === "all"
                ? ambassadors.length
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

          {/* ビュー切り替え */}
          <div style={{
            display: "flex", gap: 2,
            background: "var(--bg-tint)", border: "1.5px solid var(--line)",
            borderRadius: 9, padding: 3, flexShrink: 0,
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
        {(keyword || roleCategory !== "all") && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
              {filtered.length}名が見つかりました
            </span>
            <button
              type="button"
              onClick={() => { setKeyword(""); setRoleCategory("all"); }}
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
