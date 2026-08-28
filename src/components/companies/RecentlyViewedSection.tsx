"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRecentlyViewed } from "@/lib/hooks/useRecentlyViewed";
import type { CompanyForCarousel } from "@/types/genre";
import { usableLogoUrl } from "@/lib/utils/companyLogo";

/* ⚠️★ここにあった「資金調達ステージ」のバッジは 2026-08-29 に削除した。**戻さないこと。**

   ── 何が起きていたか ──────────────────────────────────────────────────────
   `{c.funding_stage}` を**変換せずそのまま**出していたため、画面に **`listed`**
   （英語の内部値）が出ていた。

   ⚠️★**色分けは一度も機能していなかった。** `STAGE_COLORS` のキーは日本語
      （"上場" "ユニコーン" "シリーズA" …）だが、DB の実値は **`listed` / `seed`** の
      2種類だけ。8キーとも**一度も一致せず**、`?? グレー` に落ちていた。

   ── なぜ翻訳ではなく削除にしたか ──────────────────────────────────────────
   ⚠️ `ow_companies.funding_stage` は **`/admin` の自由入力テキスト**
      （`placeholder="例: Series A"`・CHECK 無し）。値の集合が決まっていないので、
      翻訳表を作っても**未知の値は結局そのまま英語で出る。**
   ⚠️ 値がある企業は掲載79社中 **6社**、種類は **2つ**（listed 3 / seed 3）だけ。
      `/companies` から「募集中あり優先」「年収高い順」を外したのと同じ理由
      （動くデータが無い）。
   ⚠️ このバッジは**この部品にしか無かった**。本体のカードには元から出ておらず、
      同じ企業が場所によって違って見える状態だった。

   ⚠️ **列とデータは残してある。** 運営が入力した値なので消していない。
      再び出すなら、先に **UI / API / DB の CHECK を3つ揃える**こと（CLAUDE.md）。
*/

export function RecentlyViewedSection() {
  const { items, clearItems } = useRecentlyViewed();
  const companyItems = items.filter((i) => i.type === "company");

  const [companies, setCompanies] = useState<CompanyForCarousel[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (companyItems.length === 0) { setLoaded(true); return; }
    const ids = companyItems.map((c) => c.id).join(",");
    fetch(`/api/companies/batch?ids=${ids}`)
      .then((r) => r.json())
      .then(({ companies: data }: { companies: CompanyForCarousel[] }) => {
        setCompanies(data ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => i.id).join(",")]);

  if (!loaded || companyItems.length === 0 || companies.length === 0) return null;

  return (
    <div style={{
      background: "#fff",
      borderRadius: 14,
      border: "1px solid var(--line)",
      padding: "16px 0 4px",
      overflow: "hidden",
    }}>
      <style>{`
        .rv-scroll {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          scrollbar-width: none;
          padding: 4px 20px 16px;
          -webkit-overflow-scrolling: touch;
        }
        .rv-scroll::-webkit-scrollbar { display: none; }
        .rv-mini-card {
          display: flex;
          flex-direction: column;
          width: 148px;
          min-width: 148px;
          border-radius: 10px;
          border: 1px solid var(--line);
          background: #fff;
          text-decoration: none;
          color: inherit;
          overflow: hidden;
          scroll-snap-align: start;
          transition: box-shadow 0.2s, transform 0.2s, border-color 0.2s;
          flex-shrink: 0;
        }
        .rv-mini-card:hover {
          box-shadow: 0 6px 20px rgba(0,35,102,0.14);
          transform: translateY(-3px);
          border-color: var(--royal-100);
        }
        .rv-mini-card:hover .rv-name { color: var(--royal); }
      `}</style>

      {/* ヘッダー */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>最近見た企業</span>
          <span style={{
            fontSize: 12, fontWeight: 700, padding: "1px 7px", borderRadius: 999,
            background: "var(--royal-50)", color: "var(--royal)",
          }}>{companies.length}</span>
        </div>
        <button
          type="button"
          onClick={clearItems}
          style={{
            fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", background: "none", border: "none",
            cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 3,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
          クリア
        </button>
      </div>

      {/* 横スクロールカルーセル */}
      <div className="rv-scroll">
        {companies.map((c) => {
          const initial = c.logo_letter ?? c.name.slice(0, 1);
          const gradient = c.logo_gradient ?? "linear-gradient(135deg, #001233 0%, #002366 60%, #1a3569 100%)";

          return (
            <Link key={c.id} href={`/companies/${c.slug ?? c.id}`} className="rv-mini-card">
              {/* 上段: ロゴ帯 */}
              <div style={{
                height: 52, background: gradient,
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative", overflow: "hidden", flexShrink: 0,
              }}>
                {/* 装飾イニシャル */}
                <span style={{
                  position: "absolute", right: -4, bottom: -8,
                  fontSize: 38, fontWeight: 900,
                  color: "rgba(255,255,255,0.1)",
                  fontFamily: "Inter, sans-serif", lineHeight: 1,
                  userSelect: "none", pointerEvents: "none",
                }}>{initial}</span>
                {usableLogoUrl(c.logo_url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={usableLogoUrl(c.logo_url)!} alt={c.name}
                    style={{
                      width: 32, height: 32, objectFit: "contain",
                      background: "#fff", borderRadius: 6, padding: 4, boxSizing: "border-box",
                      position: "relative", zIndex: 1,
                    }}
                  />
                ) : (
                  <span style={{
                    fontSize: 20, fontWeight: 800,
                    color: "rgba(255,255,255,0.9)",
                    fontFamily: "Inter, sans-serif",
                    position: "relative", zIndex: 1,
                  }}>{initial}</span>
                )}
              </div>

              {/* 下段: 情報 */}
              <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                {/* 社名 */}
                <div
                  className="rv-name"
                  style={{
                    fontSize: 12, fontWeight: 700, color: "var(--ink)", lineHeight: 1.3,
                    overflow: "hidden", display: "-webkit-box",
                    WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
                    transition: "color 0.15s",
                  }}
                >
                  {c.name}
                </div>

                {/* バッジ */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                  {c.accepting_casual_meetings && (
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: "1px 5px", borderRadius: 999,
                      background: "#FFF7ED", color: "#C2410C",
                      display: "inline-flex", alignItems: "center", gap: 3,
                    }}>
                      <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#EA580C", animation: "pulseDot 1.8s ease-in-out infinite" }} />
                      面談
                    </span>
                  )}
                  {c.job_count != null && c.job_count > 0 && (
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: "1px 5px", borderRadius: 999,
                      background: "var(--royal-50)", color: "var(--royal)",
                    }}>求人{c.job_count}</span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
