"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

/**
 * LP ヒーローの検索。
 *
 * 2026-08-03: Intent Modes（企業を調べる / 求人を探す）を廃止し単一の検索窓にした。
 * 検索前にスコープを選ばせるのは、まだ何があるか分かっていない利用者に
 * 判断を押し付ける形だったため。企業／求人の振り分けは /search が担当する。
 *
 * ⚠️ 2026-09-16 に足した例文チップ（「たとえば」）は **2026-09-20 に削除した**
 *    （柴さんの指示）。文は `lib/constants/landing.ts` の `HERO_SEARCH_EXAMPLES` に残っている。
 *
 * ⚠️ プレースホルダーから「IT業界」を落とさないこと。
 *    対象範囲を言っているのは見出しとここだけ。
 */
export function HeroSearch({ navy, line, muted, paper2 }: { navy: string; line: string; muted: string; paper2: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  /* ★★プレースホルダーは **2026-09-20 に柴さんの指示で削除した。** 入力欄は空のまま。
        ⚠️★**戻さないこと。** 書き戻すときは下を読んでから。

     ── 消したもの（経緯を残す）─────────────────────────────────────────────
     幅で2つを出し分けていた（`matchMedia("(max-width: 560px)")`）:
       560px 以上 … 「IT業界の会社名・職種、または『外資系のセキュリティ企業』のように文章で」
       560px 未満 … 「IT業界の会社名・職種」
     出し分けていたのは、375px の入力可能幅 191px に対し長いほうが 181px で、
     **余裕が 10px しか無かった**ため（和文は OS でフォントが変わる）。
     CSS だけでは文言を変えられないので JS で持っていた。

     ⚠️★**これで FV から「IT業界」の文字が消えた。** 対象範囲を言っていたのは
        見出しとここの2箇所だったが、見出しも同日に
        「求人票の向こうにいる現役社員」へ変わっている。
        **IT に絞っていることは、FV のどこにも書かれていない。**
     ⚠️ 「文章でも探せる」ことを伝える手段も無くなった。2026-09-16 に例文チップを
        足し、2026-09-20 にチップを消してこの placeholder に役目を移し、同日ここも消した、
        という順。**書き戻すならチップではなく placeholder 側が候補。** */

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
      {/* ⚠️★枠・背景・角丸は**インラインに書かないこと**（2026-09-20 に CSS へ移した）。
             インラインだと `:focus-within` が勝てず、**フォーカスしても殻の色が変わらない**
             （globals.css の `.search-shell` に同じ注記がある。あちらも一度そうなった）。 */}
      <div className="hero-search-shell">
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

      {/* ⚠️★「たとえば」＋例文チップ（AI・データの企業／外資系のセキュリティ企業／
             日系のHR企業）は **2026-09-20 に柴さんの指示で削除した。** 戻さないこと。
          ⚠️ 文の実体は `lib/constants/landing.ts` の `HERO_SEARCH_EXAMPLES` に**残してある**
             （実測日と件数の注記つき）。書き戻すならそこから取ること。**ここに直接書かない。**
          ⚠️ チップは押しても遷移せず、検索窓に文が入るだけの作りだった。
             「何を書けば何が返るか」を見せるのが目的だったので、
             代わりを作るなら placeholder でその役割を担うことになる
             （いまの placeholder が「…のように文章で」と書いているのはそのため）。 */}

      <style>{`
        /* 検索窓は FV の主役。見出しより幅が広いこと（2026-08-05）。
           700px のときは見出し（62px × 10文字 ≒ 610px）とほぼ同じ幅で、
           先に目に入るのが見出しになっていた。見出しを 44px に下げたうえで
           窓を 1000px にして、幅の主従をはっきりさせている。
           ⚠️ .lp-wrap の内側は 1064px（1120 − 28×2）なので、これ以上広げると
              左右の余白が消える。 */
        .hero-search-form { width: 100%; max-width: 1000px; }

        /* ★★殻（枠そのものが入力欄に見える形）。2026-09-20 にインラインから移した。
           ⚠️★**overflow: hidden を外さないこと。** 右端の「検索」ボタンの角を
              殻の角丸で切っているのはこれ。 */
        .hero-search-shell {
          display: flex; align-items: stretch; background: #fff;
          border: 1px solid ${line}; border-radius: 12px;
          box-shadow: 0 8px 28px rgba(14,33,72,.08);
          overflow: hidden;
          transition: border-color .15s, box-shadow .15s;
        }
        /* 焦点は**殻が出す**。⚠️ 消すとどこにも出なくなる（キーボード操作で行方不明になる） */
        .hero-search-shell:focus-within {
          border-color: ${navy};
          box-shadow: 0 8px 28px rgba(14,33,72,.08), 0 0 0 3px rgba(0,35,102,0.08);
        }
        /* ★★中の入力欄の焦点リングを止める（2026-09-20 / 柴さんの指摘）。
           ⚠️ globals.css の input:focus-visible が 2px の outline を出すが、
              この殻は overflow: hidden なので **outline の上下だけが切られ、
              左右が黒い縦線として残っていた。**
           ⚠️★**globals.css 側を緩めないこと。** あちらを触るとサイト中の入力欄から
              焦点表示が消える。ここは**この殻の中だけ**の上書き。
              同じ形の打ち消しが .search-shell と .search-pill にもある
              （殻の形が3つあり、これが3つ目）。 */
        .hero-search-shell input:focus-visible {
          outline: none !important;
          box-shadow: none !important;
          border-color: transparent !important;
        }
        .hero-search-input { font-size: 16px; padding: 18px 12px; }
        /* プレースホルダーは薄くしすぎると読めない。
           日本語ゴシックは同じ色でも欧文より細く見えるため 500 を当てる。 */
        /* ⚠️ placeholder は 2026-09-20 に削除したので**使い手が0**。
              書き戻すときのために残してある（上の注記を読むこと）。 */
        .hero-search-input::placeholder { color: ${muted}; font-weight: 500; opacity: 1; }
        /* 例文チップ。検索窓の直下に左寄せで置く（窓の左端に揃える）。
           ⚠️ 中央寄せにしないこと。親（FV）が text-align:center なので
              指定しないと真ん中に集まり、窓との関係が読めなくなる。 */
        /* ⚠️ .hero-ex 系は 2026-09-20 にチップごと削除したので**使い手が0**。
              書き戻すときのために残してある。⚠️ style のテンプレートリテラルの中なので、
              コメントにバッククォートと不等号を書かないこと。 */
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
