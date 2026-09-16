"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { HERO_SEARCH_EXAMPLES } from "@/lib/constants/landing";

/**
 * LP ヒーローの検索。
 *
 * 2026-08-03: Intent Modes（企業を調べる / 求人を探す）を廃止し単一の検索窓にした。
 * 検索前にスコープを選ばせるのは、まだ何があるか分かっていない利用者に
 * 判断を押し付ける形だったため。企業／求人の振り分けは /search が担当する。
 *
 * 2026-09-16: 検索窓の直下に例文チップ（「たとえば」）を足した。
 * 文は `lib/constants/landing.ts` の `HERO_SEARCH_EXAMPLES`。**ここに書かない。**
 *
 * ⚠️ プレースホルダーから「IT業界」を落とさないこと。
 *    対象範囲を言っているのは見出しとここだけ。
 */
export function HeroSearch({ navy, line, muted, paper2 }: { navy: string; line: string; muted: string; paper2: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  /*
    プレースホルダーは幅で出し分ける。
    説明としての役目があるので、狭幅で切れないよう matchMedia で短いほうに替える。
    CSS だけでは文言を変えられない。
    ⚠️ 短いほうからも「IT業界」は落とさないこと。落とすと対象範囲が画面から消える。

    ⚠️ 2026-09-06 に「IT/SaaS業界」→「IT業界」にしたぶん4文字短くなり、
       375px でも長いほうが**収まるようになった**（実測: 入力可能幅 191px に対し
       長いほう 181px）。それでも出し分けは残す —— 余裕が 10px しかなく、
       和文は OS でフォントが変わる（macOS ヒラギノ / Windows 游ゴシック）ため。
       ⚠️ 消すなら Windows で実測してから。
  */
  /* ⚠️ 2026-09-16: 文章でも探せることを示す。チップだけだと、
        自分で文を書いてよいと伝わらない（チップを押す以外の使い方が見えない）。
     ⚠️ 「IT業界」を落とさないこと。対象範囲を言っているのは見出しとここだけ。 */
  const LONG = "IT業界の会社名・職種、または「外資系のセキュリティ企業」のように文章で";
  const SHORT = "IT業界の会社名・職種";
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
    // ⚠️ 幅はインラインに書かないこと（CLAUDE.md「インラインstyle と CSS の優先順位」）。
    //    max-width は .hero-search-form にある。
    <form onSubmit={submit} className="hero-search-form">
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
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label="IT業界の企業・求人を検索"
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

      {/*
        ★「たとえば」＋例文チップ（2026-09-16）。

        ⚠️★**押しても遷移しない。検索窓に文が入るだけ。**
           何を書けば何が返るかを見せるのが目的で、勝手に結果へ飛ばさない。
           押したあと入力欄にフォーカスを移すので、その場で書き換えられる。
        ⚠️★**文は [lib/constants/landing.ts](../../lib/constants/landing.ts) の
           `HERO_SEARCH_EXAMPLES` にある。ここに書き足さないこと。**
           あちらに「実測日と件数」を残してある。0件の文を載せると、
           押した人が必ず空振りする（実測した反例もあちらに書いてある）。
      */}
      <div className="hero-ex">
        <span className="hero-ex-label">たとえば</span>
        {HERO_SEARCH_EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            className="hero-ex-chip"
            onClick={() => { setQ(ex); inputRef.current?.focus(); }}
          >
            {ex}
          </button>
        ))}
      </div>

      <style>{`
        /* 検索窓は FV の主役。見出しより幅が広いこと（2026-08-05）。
           700px のときは見出し（62px × 10文字 ≒ 610px）とほぼ同じ幅で、
           先に目に入るのが見出しになっていた。見出しを 44px に下げたうえで
           窓を 1000px にして、幅の主従をはっきりさせている。
           ⚠️ .lp-wrap の内側は 1064px（1120 − 28×2）なので、これ以上広げると
              左右の余白が消える。 */
        .hero-search-form { width: 100%; max-width: 1000px; }
        .hero-search-input { font-size: 16px; padding: 18px 12px; }
        /* プレースホルダーは薄くしすぎると読めない。
           日本語ゴシックは同じ色でも欧文より細く見えるため 500 を当てる。 */
        .hero-search-input::placeholder { color: ${muted}; font-weight: 500; opacity: 1; }
        /* 例文チップ。検索窓の直下に左寄せで置く（窓の左端に揃える）。
           ⚠️ 中央寄せにしないこと。親（FV）が text-align:center なので
              指定しないと真ん中に集まり、窓との関係が読めなくなる。 */
        .hero-ex { display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
                   margin-top: 14px; text-align: left; }
        .hero-ex-label { font-size: 12.5px; font-weight: 700; color: ${muted}; }
        .hero-ex-chip { font-family: inherit; font-size: 13px; font-weight: 600;
                        color: ${navy}; background: ${paper2};
                        border: 1px solid ${line}; border-radius: 999px;
                        padding: 7px 14px; cursor: pointer; line-height: 1.4; }
        .hero-ex-chip:hover { border-color: ${navy}; background: #fff; }

        @media (max-width: 560px) {
          .hero-ex { gap: 7px; margin-top: 12px; }
          .hero-ex-chip { font-size: 12.5px; padding: 6px 12px; }
          /* 狭幅ではプレースホルダーの表示幅を稼ぐ。
             文字を詰めるだけでは足りないので、検索ボタンの左右パディングも削る。 */
          .hero-search-input { font-size: 14px; padding: 16px 6px 16px 4px; }
          .hero-search-submit { padding: 0 16px; font-size: 14px; }
        }
      `}</style>
    </form>
  );
}
