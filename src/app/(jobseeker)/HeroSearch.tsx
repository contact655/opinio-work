"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * LP ヒーローの検索。
 *
 * 2026-08-03: Intent Modes（企業を調べる / 求人を探す）を廃止し単一の検索窓にした。
 * 検索前にスコープを選ばせるのは、まだ何があるか分かっていない利用者に
 * 判断を押し付ける形だったため。企業／求人の振り分けは /search が担当する。
 *
 * プレースホルダーは短くしないこと。見出しが英語になったので、
 * 「IT・SaaS 業界の」という対象範囲を日本語で示しているのはここだけ。
 */
export function HeroSearch({ navy, line, muted }: { navy: string; line: string; muted: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  /*
    プレースホルダーは幅で出し分ける。
    375px 幅だと長いほうは「IT・SaaS業界の会社名・」で切れてしまい、
    説明としての役目を果たさない（見出しが英語なので、対象が IT・SaaS 業界だと
    書いてあるのはここだけ）。CSS だけでは文言を変えられないので matchMedia で切り替える。
    短いほうからも「IT・SaaS」は落とさないこと。
  */
  const LONG = "IT・SaaS業界の会社名・職種で探す";
  const SHORT = "IT・SaaSの会社名・職種";
  // SSR と初期描画は長いほうで揃える（hydration mismatch を避ける）
  const [placeholder, setPlaceholder] = useState(LONG);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 560px)");
    const apply = () => setPlaceholder(mq.matches ? SHORT : LONG);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    // 空送信は企業一覧へ。/search を通しても同じ結果になるが、1ホップ省ける
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/companies");
  }

  return (
    // 検索窓は Glassdoor / Indeed と同程度の 700px を上限にする。
    // 520px だとプレースホルダーの日本語が窮屈で、入力中も語尾が隠れやすかった。
    <form onSubmit={submit} style={{ width: "100%", maxWidth: 700 }}>
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          background: "#fff",
          border: `1px solid ${line}`,
          borderRadius: 12,
          boxShadow: "0 8px 28px rgba(14,33,72,.08)",
          overflow: "hidden",
        }}
      >
        <span style={{ display: "grid", placeItems: "center", padding: "0 4px 0 18px", flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true" style={{ display: "block", color: muted }}>
            <circle cx="10.6" cy="10.6" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M15.4 15.4L20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label={LONG}
          className="hero-search-input"
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            fontFamily: "inherit",
            color: "inherit",
            background: "transparent",
            // ⚠️ font-size / padding はここに書かないこと。
            //    インラインスタイルはメディアクエリより強いため、
            //    狭幅用の指定（下の @media）が一切効かなくなる。
          }}
        />
        <button
          type="submit"
          className="hero-search-submit"
          style={{
            flexShrink: 0,
            margin: 6,
            padding: "0 26px",
            borderRadius: 8,
            border: "none",
            background: navy,
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          検索
        </button>
      </div>

      <style>{`
        .hero-search-input { font-size: 16px; padding: 18px 12px; }
        /* プレースホルダーは薄くしすぎると読めない。
           日本語ゴシックは同じ色でも欧文より細く見えるため 500 を当てる。 */
        .hero-search-input::placeholder { color: ${muted}; font-weight: 500; opacity: 1; }
        @media (max-width: 560px) {
          /* 狭幅ではプレースホルダーの表示幅を稼ぐ。
             文字を詰めるだけでは足りないので、検索ボタンの左右パディングも削る。 */
          .hero-search-input { font-size: 14px; padding: 16px 6px 16px 4px; }
          .hero-search-submit { padding: 0 16px; font-size: 14px; }
        }
      `}</style>
    </form>
  );
}
