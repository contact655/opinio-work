"use client";

import Link from "next/link";

function renderMarkdown(text: string): string {
  // Simple markdown-like rendering
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:17px;font-weight:600;color:#0f172a;margin:28px 0 12px">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:19px;font-weight:600;color:#0f172a;margin:32px 0 14px">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:22px;font-weight:600;color:#0f172a;margin:36px 0 16px">$1</h1>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:600">$1</strong>');

  // Line breaks → paragraphs
  html = html
    .split(/\n\n+/)
    .map((p) => {
      if (p.startsWith("<h")) return p;
      return `<p style="margin-bottom:16px">${p.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("");

  return html;
}

export default function ArticleDetailClient({
  article,
  company,
  companyId,
}: {
  article: any;
  company: any;
  companyId: string;
}) {
  return (
    <div style={{ maxWidth: "680px", margin: "0 auto", padding: "32px 24px" }}>
      {/* 戻るリンク */}
      <Link
        href={`/companies/${companyId}`}
        style={{ fontSize: "13px", color: "#1D9E75", textDecoration: "none", marginBottom: "20px", display: "inline-block" }}
      >
        &larr; {company.name} に戻る
      </Link>

      {/* タグ */}
      {article.tag && (
        <span style={{
          display: "inline-block", fontSize: "11px", padding: "2px 10px",
          borderRadius: "999px", background: "#E1F5EE", color: "#0F6E56", marginBottom: "10px",
        }}>
          {article.tag}
        </span>
      )}

      {/* タイトル */}
      <h1 style={{ fontSize: "22px", fontWeight: 500, color: "#0f172a", lineHeight: 1.4, marginBottom: "14px" }}>
        {article.title}
      </h1>

      {/* 著者情報 */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px" }}>
        {article.author_name && (
          <>
            <div style={{
              width: "32px", height: "32px", borderRadius: "10px",
              background: "#E1F5EE", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: "12px", fontWeight: 500, color: "#0F6E56",
            }}>
              {article.author_name[0]}
            </div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 500, color: "#0f172a" }}>{article.author_name}</div>
              {article.author_label && (
                <div style={{ fontSize: "12px", color: "#64748b" }}>{article.author_label}</div>
              )}
            </div>
          </>
        )}
        {article.published_at && (
          <span style={{ fontSize: "12px", color: "#94a3b8", marginLeft: "auto" }}>
            {new Date(article.published_at).toLocaleDateString("ja-JP")}
          </span>
        )}
      </div>

      {/* サムネイル */}
      {article.thumbnail_url && (
        <img
          src={article.thumbnail_url}
          alt=""
          style={{ width: "100%", borderRadius: "12px", marginBottom: "28px", objectFit: "cover", maxHeight: "320px" }}
        />
      )}

      {/* 本文 */}
      <div
        dangerouslySetInnerHTML={{ __html: renderMarkdown(article.body) }}
        style={{ fontSize: "15px", color: "#1e293b", lineHeight: 1.9 }}
      />

      <hr style={{ border: "none", borderTop: "0.5px solid #e2e8f0", margin: "36px 0" }} />

      {/* CTA */}
      <div style={{
        background: "#F0FDF9", border: "1px solid #C6EAD9",
        borderRadius: "12px", padding: "28px", textAlign: "center",
      }}>
        <div style={{ fontSize: "15px", fontWeight: 500, color: "#0f172a", marginBottom: "6px" }}>
          この企業が気になったら
        </div>
        <div style={{ fontSize: "13px", color: "#475569", marginBottom: "18px" }}>
          求人を見る・メンターに話を聞いてみる
        </div>
        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <Link
            href={`/companies/${companyId}`}
            style={{ fontSize: "13px", padding: "10px 24px", borderRadius: "8px", background: "#1D9E75", color: "#fff", textDecoration: "none" }}
          >
            求人を見る
          </Link>
          <Link
            href="/career-consultation"
            style={{ fontSize: "13px", padding: "10px 24px", borderRadius: "8px", background: "#fff", color: "#0f172a", border: "0.5px solid #d1d5db", textDecoration: "none" }}
          >
            メンターに相談する
          </Link>
        </div>
      </div>
    </div>
  );
}
