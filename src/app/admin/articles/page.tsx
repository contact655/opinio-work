"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Article = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  type: string | null;
  company_name_text: string | null;
  eyecatch_gradient: string | null;
  read_min: number | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
};

const TYPE_LABELS: Record<string, string> = {
  employee: "社員インタビュー",
  mentor: "メンターインタビュー",
  ceo: "CEOインタビュー",
  report: "レポート",
};

export default function AdminArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const supabase = createClient();

  const showFlash = useCallback((msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 3000);
  }, []);

  useEffect(() => {
    supabase
      .from("ow_articles")
      .select("id, slug, title, subtitle, type, company_name_text, eyecatch_gradient, read_min, is_published, published_at, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setArticles(data || []);
        setLoading(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePublished = async (articleId: string, current: boolean) => {
    setToggling(articleId);
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("ow_articles")
      .update({
        is_published: !current,
        published_at: !current ? nowIso : null,
        updated_at: nowIso,
      })
      .eq("id", articleId);
    setToggling(null);

    if (!error) {
      setArticles((prev) =>
        prev.map((a) =>
          a.id === articleId
            ? { ...a, is_published: !current, published_at: !current ? nowIso : null }
            : a
        )
      );
      showFlash(!current ? "公開しました" : "非公開にしました");
    } else {
      showFlash("更新に失敗しました");
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div className="skeleton-shimmer" style={{ height: 32, borderRadius: 8, maxWidth: 300, marginBottom: 24 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1,2,3,4,5].map((i) => (
            <div key={i} className="skeleton-shimmer" style={{ height: 60, borderRadius: 8 }} />
          ))}
        </div>
      </div>
    );
  }

  const publishedCount = articles.filter((a) => a.is_published).length;

  const filtered = articles.filter((a) => {
    if (typeFilter && a.type !== typeFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.title.toLowerCase().includes(q) ||
      (a.company_name_text ?? "").toLowerCase().includes(q) ||
      (TYPE_LABELS[a.type ?? ""] ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">記事管理</h1>
          <p className="text-sm text-gray-500 mt-1">記事の公開・非公開を切り替えます</p>
        </div>
        <div className="text-right">
          <span className="text-sm text-gray-500">{articles.length}件</span>
          <span className="ml-3 px-2.5 py-1 bg-green-100 text-green-700 text-xs rounded-full">
            公開中 {publishedCount}件
          </span>
        </div>
      </div>

      {/* Search + Type filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="search"
            placeholder="タイトル・企業名で検索"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="記事を検索"
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "9px 12px 9px 36px",
              border: "1px solid var(--line, #E2E8F0)", borderRadius: 8,
              fontSize: 13, color: "var(--ink, #0F172A)",
              background: "#fff", outline: "none",
              fontFamily: "inherit",
            }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} aria-label="検索をクリア" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--ink-mute, #94A3B8)", fontSize: 16, lineHeight: 1, padding: "0 2px" }}>×</button>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[null, "employee", "mentor", "ceo", "report"].map((type) => (
            <button
              key={type ?? "all"}
              onClick={() => setTypeFilter(type)}
              style={{
                padding: "7px 13px", borderRadius: 100, fontSize: 12, fontWeight: 600,
                border: `1.5px solid ${typeFilter === type ? "var(--royal, #002366)" : "var(--line, #E2E8F0)"}`,
                background: typeFilter === type ? "var(--royal, #002366)" : "#fff",
                color: typeFilter === type ? "#fff" : "var(--ink-soft, #475569)",
                cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              {type === null ? "すべて" : TYPE_LABELS[type]}
            </button>
          ))}
        </div>
        {(searchQuery || typeFilter) && (
          <span style={{ fontSize: 12, color: "var(--ink-mute, #94A3B8)" }}>
            {filtered.length}件
          </span>
        )}
      </div>

      {/* Flash */}
      {flash && (
        <div style={{
          position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)",
          background: "#065F46", color: "#fff", padding: "12px 28px",
          borderRadius: 12, fontSize: 14, fontWeight: 500, zIndex: 9999,
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        }}>
          {flash}
        </div>
      )}

      <div className="bg-white rounded-card border border-card-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">タイトル</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">種類</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">企業</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">読了</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">ステータス</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">公開日</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">
                  {searchQuery || typeFilter ? "該当する記事が見つかりません" : "記事が見つかりません"}
                </td>
              </tr>
            ) : (
              filtered.map((article) => (
                <tr key={article.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {/* Eyecatch swatch */}
                      <div
                        style={{
                          width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                          background: article.eyecatch_gradient || "#e5e7eb",
                        }}
                      />
                      <div>
                        <p className="font-medium text-gray-900 line-clamp-1">{article.title}</p>
                        <p className="text-xs text-gray-400 font-mono">{article.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                      {TYPE_LABELS[article.type || ""] || article.type || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{article.company_name_text || "-"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {article.read_min ? `${article.read_min}分` : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      article.is_published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {article.is_published ? "公開中" : "非公開"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {article.published_at
                      ? new Date(article.published_at).toLocaleDateString("ja-JP")
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => togglePublished(article.id, article.is_published)}
                      disabled={toggling === article.id}
                      className={`px-3 py-1 text-xs rounded border transition-colors disabled:opacity-50 ${
                        article.is_published
                          ? "border-gray-300 text-gray-500 hover:bg-gray-50"
                          : "border-primary text-primary hover:bg-primary-light"
                      }`}
                    >
                      {toggling === article.id
                        ? "..."
                        : article.is_published
                        ? "非公開にする"
                        : "公開する"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
