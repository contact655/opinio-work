import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkCjkFriendly from "remark-cjk-friendly";
import remarkBreaks from "remark-breaks";
import { rehypeZukanFigure } from "@/lib/zukan/rehypeFigure";

/**
 * 社長図鑑の本文。⚠️ `components/common/Markdown.tsx`（企業説明・求人用）とは**別物**。
 *   あちらは h2 を小さい h3 に落とし、画像を出さず、リンクを nofollow にする
 *   （企業が書いた文を載せるため）。こちらは**運営が書く読み物**なので、
 *   見出しは h2 のまま、画像も出す。**片方に寄せないこと。**
 *
 * ⚠️ 本文は「見出しは h2 から」の前提。h1 を書かれてもページの h1 と重ならないよう h2 に落とす。
 * ⚠️ スタイルは `.zukan-body` 配下にだけ効かせる（`<style>` を同梱）。
 *    ⚠️ `<style>` の中に子セレクタ `>` と `"` を書かないこと（hydration mismatch。ui-conventions）。
 *
 * ★記事は note と同じ書き方を想定している（2026-10-04 / 柴さんの指示）。そのための処理が4つある。
 *   **書き手に回避させず、描画側で吸収する。外さないこと。**
 *
 *   ① `remark-cjk-friendly` … `**「仕掛ける力」**だ` のように太字の記号が括弧・句読点と
 *      隣り合うと、素の Markdown（CommonMark）では太字にならず `**` がそのまま出る。日本語向けに直す
 *   ② `remark-breaks` … 1文ごとの改行をそのまま改行として出す（素の Markdown では
 *      改行1つは空白扱いになり、文が1行につながる）。段落は従来どおり空行で区切る
 *   ③ `rehypeZukanFigure` … 写真の直後の斜体1行（`*キャプション*`）をキャプションにする
 *   ④ `normalizeThematicBreaks` … 文の直後の行に `---` を書くと見出し（setext）に化けるので、
 *      前に空行を補って区切り線として扱う
 *
 * ⚠️ ①②は企業説明・求人用の `Markdown.tsx` には入れていない（あちらは企業が書く文で、
 *    改行の扱いを変えると既存の表示が変わる）。
 */

/** 文の直後の `---` / `***` / `* * *` の前に空行を補う（見出しに化けないように） */
function normalizeThematicBreaks(md: string): string {
  return md.replace(/([^\n])\n((?:-{3,}|\*{3,}|(?:\* ){2,}\*)[ \t]*)(?=\n|$)/g, "$1\n\n$2");
}

export function ZukanMarkdown({ children }: { children: string }) {
  return (
    <div className="zukan-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkCjkFriendly, remarkBreaks]}
        rehypePlugins={[rehypeZukanFigure]}
        components={{
          h1: ({ children }) => <h2>{children}</h2>,
          a: ({ href, children }) => {
            const internal = typeof href === "string" && href.startsWith("/");
            return internal ? (
              <a href={href}>{children}</a>
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
            );
          },
          // eslint-disable-next-line @next/next/no-img-element
          img: ({ src, alt }) => <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} loading="lazy" />,
        }}
      >
        {normalizeThematicBreaks(children)}
      </ReactMarkdown>
      <style>{`
        .zukan-body { font-size: var(--text-md); line-height: 2; color: var(--ink); overflow-wrap: anywhere; }
        .zukan-body h2:first-child { margin-top: 0; }
        .zukan-body p { margin: 0 0 1.4em; }
        .zukan-body h2 {
          font-family: var(--font-noto-serif); font-weight: 700; font-size: 22px; line-height: 1.6;
          color: var(--ink); margin: 2.6em 0 0.9em; padding-bottom: 0.45em;
          border-bottom: 1px solid var(--line); letter-spacing: 0.02em;
        }
        .zukan-body h3 {
          font-weight: 700; font-size: 18px; line-height: 1.6; color: var(--ink);
          margin: 2em 0 0.6em;
        }
        .zukan-body h4 { font-weight: 700; font-size: 16px; margin: 1.6em 0 0.4em; }
        .zukan-body ul, .zukan-body ol { margin: 0 0 1.4em; padding-left: 1.4em; }
        .zukan-body ul { list-style: disc; }
        .zukan-body ol { list-style: decimal; }
        .zukan-body li { margin-bottom: 0.3em; }
        .zukan-body strong { font-weight: 700; }
        .zukan-body a { color: var(--royal); text-decoration: underline; text-underline-offset: 3px; }
        .zukan-body blockquote {
          margin: 1.8em 0; padding: 16px 20px; border-left: 3px solid var(--royal);
          background: var(--bg-tint); border-radius: 0 10px 10px 0;
          color: var(--ink); font-weight: 600; line-height: 1.9;
        }
        .zukan-body blockquote p { margin: 0 0 0.8em; }
        .zukan-body blockquote p:last-child { margin-bottom: 0; }
        .zukan-body img { display: block; max-width: 100%; height: auto; border-radius: 12px; margin: 0 auto 1.4em; }
        .zukan-body figure { margin: 2.2em 0; }
        .zukan-body figure img { margin: 0 auto; }
        .zukan-body figcaption {
          margin-top: 10px; font-size: 13px; line-height: 1.7; color: var(--ink-mute); text-align: center;
        }
        .zukan-body hr {
          border: 0; width: 54px; height: 6px; margin: 2.8em auto; opacity: 0.6;
          background: radial-gradient(circle, var(--ink-mute) 2px, transparent 2.5px) 0 0 / 18px 6px repeat-x;
        }
        @media (max-width: 767px) {
          .zukan-body h2 { font-size: 20px; }
          .zukan-body h3 { font-size: 17px; }
        }
      `}</style>
    </div>
  );
}
