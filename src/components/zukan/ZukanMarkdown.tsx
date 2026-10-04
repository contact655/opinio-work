import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * 社長図鑑の本文。⚠️ `components/common/Markdown.tsx`（企業説明・求人用）とは**別物**。
 *   あちらは h2 を小さい h3 に落とし、画像を出さず、リンクを nofollow にする
 *   （企業が書いた文を載せるため）。こちらは**運営が書く読み物**なので、
 *   見出しは h2 のまま、画像も出す。**片方に寄せないこと。**
 *
 * ⚠️ 本文は「見出しは h2 から」の前提。h1 を書かれてもページの h1 と重ならないよう h2 に落とす。
 * ⚠️ スタイルは `.zukan-body` 配下にだけ効かせる（`<style>` を同梱）。
 *    ⚠️ `<style>` の中に子セレクタ `>` と `"` を書かないこと（hydration mismatch。ui-conventions）。
 */
export function ZukanMarkdown({ children }: { children: string }) {
  return (
    <div className="zukan-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
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
        {children}
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
          margin: 0 0 1.4em; padding: 4px 0 4px 18px; border-left: 3px solid var(--line);
          color: var(--ink-soft);
        }
        .zukan-body blockquote p:last-child { margin-bottom: 0; }
        .zukan-body img { display: block; max-width: 100%; height: auto; border-radius: 12px; margin: 0 auto 1.4em; }
        .zukan-body hr { border: 0; border-top: 1px solid var(--line); margin: 2.4em 0; }
        @media (max-width: 767px) {
          .zukan-body h2 { font-size: 20px; }
          .zukan-body h3 { font-size: 17px; }
        }
      `}</style>
    </div>
  );
}
