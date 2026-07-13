import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";

interface TocEntry {
  id: string;
  text: string;
  level: number;
}

function slugify(text: string): string {
  return text
    .replace(/[^\w\s　-鿿＀-￯-]/g, "")
    .trim()
    .replace(/[\s　]+/g, "-")
    .toLowerCase()
    .slice(0, 60);
}

function extractToc(content: string): TocEntry[] {
  const entries: TocEntry[] = [];
  const seen = new Map<string, number>();
  for (const line of content.split("\n")) {
    const m = line.match(/^(#{1,3})\s+(.+)/);
    if (!m) continue;
    const level = m[1].length;
    const text = m[2].replace(/\*\*/g, "").trim();
    let id = slugify(text);
    const count = seen.get(id) ?? 0;
    if (count > 0) id = `${id}-${count}`;
    seen.set(id, count + 1);
    entries.push({ id, text, level });
  }
  return entries;
}

const LEGAL_LINKS = [
  { href: "/terms", label: "利用規約" },
  { href: "/terms/business", label: "企業向け規約" },
  { href: "/privacy", label: "プライバシーポリシー" },
  { href: "/legal/agency", label: "職業安定法に基づく明示事項" },
];

interface LegalDocumentProps {
  content: string;
  showToc?: boolean;
}

export function LegalDocument({ content, showToc = false }: LegalDocumentProps) {
  const toc = showToc ? extractToc(content) : [];
  const idCounts = new Map<string, number>();

  return (
    <main style={{ maxWidth: showToc ? 1100 : 768, margin: "0 auto", padding: "48px 20px 80px" }}>
      {/* TOC + Content layout */}
      <div style={{ display: "flex", gap: 48, alignItems: "flex-start" }}>
        {/* TOC sidebar */}
        {showToc && toc.length > 0 && (
          <aside style={{
            width: 240, flexShrink: 0,
            position: "sticky", top: 80,
            background: "var(--bg-tint)",
            border: "1px solid var(--line)",
            borderRadius: 10, padding: "20px 16px",
            fontSize: 12, lineHeight: 1.7,
          }}>
            <p style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-mute)", marginBottom: 12 }}>
              目次
            </p>
            <nav>
              {toc.map((entry) => (
                <a
                  key={entry.id}
                  href={`#${entry.id}`}
                  style={{
                    display: "block",
                    paddingLeft: entry.level === 1 ? 0 : entry.level === 2 ? 12 : 20,
                    paddingTop: 4, paddingBottom: 4,
                    color: entry.level === 1 ? "var(--ink)" : "var(--ink-soft)",
                    fontWeight: entry.level === 1 ? 600 : 400,
                    textDecoration: "none",
                  }}
                >
                  {entry.text}
                </a>
              ))}
            </nav>
          </aside>
        )}

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <article>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => {
                  const text = String(children);
                  let id = slugify(text);
                  const c = idCounts.get(id) ?? 0;
                  if (c > 0) id = `${id}-${c}`;
                  idCounts.set(id, c + 1);
                  return (
                    <h1 id={id} style={{ fontSize: 28, fontWeight: 800, color: "var(--ink)", marginBottom: 8, paddingTop: 8, scrollMarginTop: 80 }}>
                      {children}
                    </h1>
                  );
                },
                h2: ({ children }) => {
                  const text = String(children);
                  let id = slugify(text);
                  const c = idCounts.get(id) ?? 0;
                  if (c > 0) id = `${id}-${c}`;
                  idCounts.set(id, c + 1);
                  return (
                    <h2 id={id} style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", marginTop: 40, marginBottom: 12, paddingTop: 8, borderBottom: "2px solid var(--line)", paddingBottom: 8, scrollMarginTop: 80 }}>
                      {children}
                    </h2>
                  );
                },
                h3: ({ children }) => {
                  const text = String(children);
                  let id = slugify(text);
                  const c = idCounts.get(id) ?? 0;
                  if (c > 0) id = `${id}-${c}`;
                  idCounts.set(id, c + 1);
                  return (
                    <h3 id={id} style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginTop: 28, marginBottom: 8, scrollMarginTop: 80 }}>
                      {children}
                    </h3>
                  );
                },
                p: ({ children }) => (
                  <p style={{ fontSize: 14, lineHeight: 1.9, color: "var(--ink-soft)", marginBottom: 16 }}>
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul style={{ paddingLeft: 20, marginBottom: 16, color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.9 }}>
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol style={{ paddingLeft: 20, marginBottom: 16, color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.9 }}>
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li style={{ marginBottom: 4 }}>{children}</li>
                ),
                blockquote: ({ children }) => (
                  <div style={{
                    background: "var(--royal-50)",
                    border: "1px solid var(--royal-100)",
                    borderLeft: "4px solid var(--royal)",
                    borderRadius: 8, padding: "16px 20px",
                    margin: "20px 0", fontSize: 14, lineHeight: 1.8,
                    color: "var(--ink)",
                  }}>
                    {children}
                  </div>
                ),
                table: ({ children }) => (
                  <div style={{ overflowX: "auto", marginBottom: 20, borderRadius: 8, border: "1px solid var(--line)" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead style={{ background: "var(--bg-tint)" }}>{children}</thead>
                ),
                th: ({ children }) => (
                  <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 12, color: "var(--ink)", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--line-soft)", verticalAlign: "top", color: "var(--ink-soft)", fontSize: 13 }}>
                    {children}
                  </td>
                ),
                hr: () => (
                  <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: "32px 0" }} />
                ),
                a: ({ href, children }) => (
                  <a href={href} style={{ color: "var(--royal)", textDecoration: "underline" }} target={href?.startsWith("http") ? "_blank" : undefined} rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}>
                    {children}
                  </a>
                ),
                strong: ({ children }) => (
                  <strong style={{ fontWeight: 700, color: "var(--ink)" }}>{children}</strong>
                ),
                code: ({ children }) => (
                  <code style={{ background: "var(--bg-tint)", padding: "2px 6px", borderRadius: 4, fontSize: 12, fontFamily: "monospace" }}>
                    {children}
                  </code>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </article>
        </div>
      </div>

      {/* 関連ページリンク */}
      <nav style={{
        marginTop: 60, paddingTop: 24,
        borderTop: "1px solid var(--line)",
        display: "flex", flexWrap: "wrap", gap: "6px 16px",
        fontSize: 13,
      }}>
        {LEGAL_LINKS.map(({ href, label }) => (
          <Link key={href} href={href} style={{ color: "var(--ink-soft)", textDecoration: "none" }}>
            {label}
          </Link>
        ))}
      </nav>
    </main>
  );
}
