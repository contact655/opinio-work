"use client";

import { useState } from "react";
import Link from "next/link";
import CompanyLogoImg from "@/components/profile/CompanyLogoImg";

export type FollowedCompany = {
  id: string; slug: string | null; name: string; brand_name: string | null;
  industry: string | null; logo_url: string | null; logo_letter: string | null; logo_gradient: string | null;
};
export type FollowedUser = {
  id: string; name: string; avatar_url: string | null; avatar_color: string | null; visibility: string | null;
};

type Tab = "company" | "user";

/**
 * フォロー中の一覧。
 *
 * ⚠️ 0件のときは「まだありません」で終わらせず、探しに行く導線を置く。
 *    /feed のフォロー中タブの空状態と同じ考え方。
 */
export function FollowsClient({ companies, users }: { companies: FollowedCompany[]; users: FollowedUser[] }) {
  // 片方だけある場合はそちらを開いておく（空タブを最初に見せない）
  const [tab, setTab] = useState<Tab>(companies.length === 0 && users.length > 0 ? "user" : "company");
  const items: { key: Tab; label: string; count: number }[] = [
    { key: "company", label: "企業", count: companies.length },
    { key: "user", label: "人", count: users.length },
  ];

  /* ⚠️ 中央寄せにしない（2026-08-25）。器はレイアウトが持つ */
  return (
    <div style={{ maxWidth: 720, paddingBottom: 64 }}>
      <h1 style={{ fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 22, fontWeight: 800, color: "var(--ink)", margin: "0 0 18px" }}>
        フォロー中
      </h1>

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--line)", marginBottom: 18 }}>
        {items.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: "10px 16px", marginBottom: -1,
                borderBottom: `2px solid ${active ? "var(--royal)" : "transparent"}`,
                color: active ? "var(--royal)" : "var(--ink-soft)",
                fontFamily: "var(--font-inter), var(--font-noto)",
                fontSize: 14, fontWeight: 700,
              }}
            >
              {t.label}
              {/* ⚠️ 0件のときは数字を出さない（いいね・コメントと同じ方針） */}
              {t.count > 0 && (
                <span style={{ marginLeft: 6, fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 13, fontWeight: 600 }}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "company" ? (
        companies.length === 0 ? (
          <Empty
            title="フォローした企業がここに表示されます"
            body="気になる企業をフォローすると、募集や掲載の動きをまとめて追えます。"
            href="/companies"
            cta="企業を探す"
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {companies.map((c) => (
              <Link key={c.id} href={`/companies/${c.slug ?? c.id}`} style={ROW}>
                <CompanyLogoImg
                  logoUrl={c.logo_url} logoLetter={c.logo_letter} logoGradient={c.logo_gradient}
                  name={c.brand_name ?? c.name} size={40} borderRadius={8}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={NAME}>{c.brand_name ?? c.name}</div>
                  {c.industry && <div style={SUB}>{c.industry}</div>}
                </div>
              </Link>
            ))}
          </div>
        )
      ) : users.length === 0 ? (
        <Empty
          title="フォローした人がここに表示されます"
          body="気になる人をフォローすると、その人の投稿を追えます。"
          href="/people"
          cta="人を探す"
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {users.map((u) => (
            <Link key={u.id} href={`/u/${u.id}`} style={ROW}>
              {u.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{
                  width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                  background: u.avatar_color ?? "linear-gradient(135deg, var(--royal), var(--accent))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: 700, fontSize: 16, fontFamily: "var(--font-inter), var(--font-noto)",
                }}>
                  {(u.name ?? "?").charAt(0)}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={NAME}>{u.name}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const ROW: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 12, textDecoration: "none",
  background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "12px 14px",
};
const NAME: React.CSSProperties = {
  fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 14, fontWeight: 700,
  color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};
const SUB: React.CSSProperties = {
  fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 12, fontWeight: 500,
  color: "var(--ink-soft)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};

function Empty({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 20px", fontFamily: "var(--font-inter), var(--font-noto)" }}>
      <p style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--ink)" }}>{title}</p>
      <p style={{ fontSize: 13, margin: "8px 0 0", color: "var(--ink-soft)", lineHeight: 1.8 }}>{body}</p>
      <Link
        href={href}
        style={{
          display: "inline-block", marginTop: 18, padding: "9px 18px", borderRadius: 100,
          background: "var(--royal)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none",
        }}
      >
        {cta}
      </Link>
    </div>
  );
}
