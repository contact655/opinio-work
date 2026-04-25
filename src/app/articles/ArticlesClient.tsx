"use client";

import { useState } from "react";
import Link from "next/link";

const TAGS = ["すべて", "インタビュー", "カルチャー", "働き方", "制度紹介", "キャリア", "転職ノウハウ"];

export default function ArticlesClient({ articles }: { articles: any[] }) {
  const [activeTag, setActiveTag] = useState("すべて");

  const filtered = activeTag === "すべて"
    ? articles
    : articles.filter((a) => a.tag === activeTag);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div style={{ marginBottom: 20, borderLeft: "3px solid #059669", paddingLeft: 12 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
          記事
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280" }}>
          IT・SaaS企業の社員インタビューやカルチャー紹介
        </p>
      </div>

      {/* Tag filter */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "24px" }}>
        {TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => setActiveTag(tag)}
            style={{
              fontSize: "13px", padding: "6px 16px", borderRadius: "999px",
              border: "0.5px solid",
              borderColor: activeTag === tag ? "#1D9E75" : "#d1d5db",
              background: activeTag === tag ? "#1D9E75" : "white",
              color: activeTag === tag ? "#fff" : "#475569",
              cursor: "pointer",
            }}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px" }}>
          {filtered.map((article) => {
            const company = article.ow_companies;
            return (
              <Link
                key={article.id}
                href={article._type === "ow_article" ? `/articles/${article.slug}` : `/companies/${article.company_id}/articles/${article.id}`}
                style={{
                  background: "white", border: "0.5px solid #e2e8f0",
                  borderRadius: "12px", overflow: "hidden", textDecoration: "none",
                  display: "block", transition: "box-shadow .15s, transform .15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.1)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {article.thumbnail_url ? (
                  <img src={article.thumbnail_url} alt="" style={{ width: "100%", height: "160px", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: "160px", background: "#E1F5EE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#0F6E56" }}>
                    {article.tag || "記事"}
                  </div>
                )}
                <div style={{ padding: "16px" }}>
                  <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
                    {article.tag && (
                      <span style={{
                        fontSize: "11px", padding: "2px 8px",
                        borderRadius: "999px", background: "#E1F5EE", color: "#0F6E56",
                      }}>
                        {article.tag}
                      </span>
                    )}
                    {company?.name && (
                      <span style={{
                        fontSize: "11px", padding: "2px 8px",
                        borderRadius: "999px", background: "#f1f5f9", color: "#475569",
                      }}>
                        {company.name}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "15px", fontWeight: 500, color: "#0f172a", lineHeight: 1.5, marginBottom: "10px" }}>
                    {article.title}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {article.author_name && (
                      <>
                        <div style={{
                          width: "22px", height: "22px", borderRadius: "6px",
                          background: "#E1F5EE", display: "flex", alignItems: "center",
                          justifyContent: "center", fontSize: "10px", fontWeight: 500, color: "#0F6E56",
                        }}>
                          {article.author_name[0]}
                        </div>
                        <span style={{ fontSize: "12px", color: "#64748b" }}>
                          {article.author_name}
                        </span>
                      </>
                    )}
                    {article.published_at && (
                      <span style={{ fontSize: "12px", color: "#94a3b8", marginLeft: "auto" }}>
                        {new Date(article.published_at).toLocaleDateString("ja-JP")}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8", fontSize: "14px" }}>
          まだ記事がありません
        </div>
      )}
    </div>
  );
}
