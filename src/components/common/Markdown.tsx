import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * 企業説明・求人本文を markdown として描画する。
 *
 * ⚠️ **入力欄と必ずセットで扱うこと（2026-08-26）。**
 *    以前は企業側に markdown エディタ（H2/H3 ボタン付き）があるのに
 *    描画は plain text で、`##` が記号のまま出る状態だった。
 *    片方だけ変えると同じことが起きる。
 *
 * ⚠️ **既存データは空行区切りに正規化済み**（migration 20260826200000）。
 *    改行1つで段落を区切った文が9社あり、markdown ではそれが1段落に潰れるため、
 *    `\n` → `\n\n` に直してある。**単一改行を段落として扱う独自処理は入れない**
 *    （`remark-breaks` も入れていない）。素の markdown として扱う。
 *
 * ⚠️ 見出しは h3 相当から始める。ページ側に h1/h2 があるので、
 *    本文がそれより大きく見えないようにする。
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="opinio-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p style={{ margin: "0 0 14px", fontSize: 15, color: "var(--ink)", lineHeight: 1.85, fontFamily: "var(--font-noto-sans)" }}>{children}</p>
          ),
          h1: ({ children }) => <h3 style={H}>{children}</h3>,
          h2: ({ children }) => <h3 style={H}>{children}</h3>,
          h3: ({ children }) => <h4 style={{ ...H, fontSize: 15 }}>{children}</h4>,
          ul: ({ children }) => <ul style={LIST}>{children}</ul>,
          ol: ({ children }) => <ol style={LIST}>{children}</ol>,
          li: ({ children }) => (
            <li style={{ fontSize: 15, color: "var(--ink)", lineHeight: 1.85, marginBottom: 4, fontFamily: "var(--font-noto-sans)" }}>{children}</li>
          ),
          strong: ({ children }) => <strong style={{ fontWeight: 700, color: "var(--ink)" }}>{children}</strong>,
          /* ⚠️ 企業が書いたリンクは新規タブ＋ noopener。rel を外さないこと。 */
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow"
               style={{ color: "var(--royal)", textDecoration: "underline" }}>{children}</a>
          ),
          /* 画像は出さない（外部URLの読み込みと崩れを避ける）。代替テキストだけ残す。 */
          img: ({ alt }) => <span style={{ color: "var(--ink-mute)", fontSize: 13 }}>{alt ?? ""}</span>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

const H = {
  margin: "20px 0 8px", fontSize: 16, fontWeight: 700,
  color: "var(--ink)", lineHeight: 1.6, fontFamily: "var(--font-noto-sans)",
} as const;

const LIST = { margin: "0 0 14px", paddingLeft: "1.4em" } as const;
