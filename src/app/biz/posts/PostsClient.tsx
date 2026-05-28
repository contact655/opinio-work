"use client";

import { useState, useTransition } from "react";
import { fetchOgp } from "@/lib/og/fetchOgp";
import { inferTypeFromUrl, type ContentType } from "@/lib/og/inferType";
import { createPost } from "./_actions/createPost";
import { updatePost } from "./_actions/updatePost";
import { deletePost } from "./_actions/deletePost";
import { Plus, Edit2, Trash2, Loader2, AlertCircle, ExternalLink, X } from "lucide-react";
import type { Database } from "@/lib/supabase/types";

type Post = Database["public"]["Tables"]["ow_company_external_links"]["Row"];

type Props = {
  companyId: string;
  companyName: string;
  initialPosts: Post[];
};

// ─── Type label / color map ─────────────────────────────────────────────────

const TYPE_LABELS: Record<ContentType, string> = {
  article: "記事",
  video:   "動画",
  audio:   "音声",
  social:  "SNS",
  event:   "イベント",
  other:   "その他",
};

const TYPE_COLORS: Record<ContentType, { bg: string; color: string }> = {
  article: { bg: "var(--royal-50)",    color: "var(--royal)" },
  video:   { bg: "var(--error-soft)",  color: "var(--error)" },
  audio:   { bg: "var(--purple-soft)", color: "var(--purple)" },
  social:  { bg: "var(--success-soft)", color: "var(--success)" },
  event:   { bg: "var(--warm-soft)",   color: "var(--warm)" },
  other:   { bg: "var(--line-soft)",   color: "var(--ink-mute)" },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const t = type as ContentType;
  const c = TYPE_COLORS[t] ?? TYPE_COLORS.other;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 8px", borderRadius: 100,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
      fontFamily: "'Inter', sans-serif",
      background: c.bg, color: c.color,
    }}>
      {TYPE_LABELS[t] ?? type}
    </span>
  );
}

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("ja-JP", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch {
    return iso.split("T")[0];
  }
}

// ─── Type icon emoji map ──────────────────────────────────────────────────────

const TYPE_ICONS: Record<ContentType, string> = {
  article: "📄",
  video:   "🎬",
  audio:   "🎙️",
  social:  "💬",
  event:   "🗓️",
  other:   "🔗",
};

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "60px 20px", gap: 0,
      color: "var(--ink-mute)",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: "50%",
        background: "var(--royal-50)",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 20,
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
          stroke="var(--royal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <line x1="10" y1="9" x2="8" y2="9"/>
        </svg>
      </div>
      <p style={{ margin: "0 0 6px", fontSize: 15, color: "var(--ink)", fontWeight: 700 }}>
        まだ発信コンテンツがありません
      </p>
      <p style={{ margin: "0 0 28px", fontSize: 13, color: "var(--ink-mute)", textAlign: "center", lineHeight: 1.7 }}>
        記事・動画・イベントなど、自社の外部発信を登録して<br/>企業ページをリッチにしましょう
      </p>

      {/* 3-step guide */}
      <div style={{
        display: "flex", alignItems: "center", gap: 0,
        marginBottom: 28, flexWrap: "wrap", justifyContent: "center",
      }}>
        {[
          { step: "1", icon: "🔗", label: "リンクを貼る" },
          { step: "→", icon: null, label: null },
          { step: "2", icon: "✨", label: "OGP 自動取得" },
          { step: "→", icon: null, label: null },
          { step: "3", icon: "🏢", label: "企業ページに反映" },
        ].map((item, i) =>
          item.label ? (
            <div key={i} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              padding: "12px 16px",
              background: "#fff",
              border: "1px solid var(--line)",
              borderRadius: 10,
              minWidth: 100,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "var(--royal-50)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: "var(--royal)",
                fontFamily: "'Inter', sans-serif",
                marginBottom: 6,
              }}>
                {item.step}
              </div>
              <span style={{ fontSize: 13 }}>{item.icon}</span>
              <span style={{ fontSize: 11, color: "var(--ink-soft)", fontWeight: 600, marginTop: 4, whiteSpace: "nowrap" }}>{item.label}</span>
            </div>
          ) : (
            <div key={i} style={{ padding: "0 8px", color: "var(--ink-mute)", fontSize: 16 }}>→</div>
          )
        )}
      </div>

      <button
        type="button"
        onClick={onAdd}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "10px 22px",
          background: "var(--royal)", color: "#fff",
          border: "none", borderRadius: "var(--radius-md)",
          fontSize: 13, fontWeight: 600, cursor: "pointer",
          boxShadow: "0 2px 8px rgba(0,35,102,0.25)",
        }}
      >
        <Plus size={15} strokeWidth={2.5} />
        最初の発信を登録する
      </button>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function PostsClient({ companyId, companyName: _companyName, initialPosts }: Props) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // フォーム state
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [type, setType] = useState<ContentType>("article");

  // OGP 取得状態
  const [ogpFetching, setOgpFetching] = useState(false);
  const [ogpMessage, setOgpMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  // 保存状態
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 4000);
  };

  // ─── Form helpers ──

  const resetForm = () => {
    setUrl(""); setTitle(""); setDescription(""); setThumbnailUrl("");
    setSourceName(""); setPublishedAt(""); setType("article");
    setOgpMessage(null); setFormError("");
    setEditingId(null);
  };

  const openNewForm = () => {
    resetForm();
    setShowForm(true);
  };

  const closeForm = () => {
    resetForm();
    setShowForm(false);
  };

  // ─── OGP 取得 ──

  const handleFetchOgp = async () => {
    if (!url.trim()) return;
    setOgpFetching(true);
    setOgpMessage(null);

    const result = await fetchOgp(url.trim());

    if (result.success) {
      setTitle(result.title);
      setDescription(result.description ?? "");
      setThumbnailUrl(result.thumbnailUrl ?? "");
      setSourceName(result.siteName ?? "");
      setPublishedAt(result.publishedAt ? result.publishedAt.split("T")[0] : "");
      setType(inferTypeFromUrl(url));
      setUrl(result.url); // canonical URL に更新
      setOgpMessage({ kind: "success", text: "OGP 情報を取得しました。必要に応じて編集してください。" });
    } else {
      setType(inferTypeFromUrl(url));
      setOgpMessage({
        kind: "error",
        text:
          result.errorCode === "NO_TITLE"
            ? "タイトルが取得できませんでした。手動で入力してください。"
            : result.errorCode === "TIMEOUT"
            ? "タイムアウトしました。手動で入力してください。"
            : `OGP の取得に失敗しました (${result.errorCode})。手動で入力してください。`,
      });
    }
    setOgpFetching(false);
  };

  // ─── 保存 ──

  const handleSave = () => {
    if (!url.trim()) { setFormError("URL を入力してください"); return; }
    if (!title.trim()) { setFormError("タイトルを入力してください"); return; }
    setFormError("");

    const data = {
      url: url.trim(),
      title: title.trim(),
      description: description.trim() || null,
      thumbnail_url: thumbnailUrl.trim() || null,
      source_name: sourceName.trim() || null,
      published_at: publishedAt || null,
      type,
    };

    startTransition(async () => {
      if (editingId) {
        const result = await updatePost(editingId, data);
        if (result.success) {
          setPosts((prev) => prev.map((p) => p.id === editingId ? result.data as unknown as Post : p));
          closeForm();
        } else {
          setFormError(result.error);
        }
      } else {
        const result = await createPost({ company_id: companyId, ...data });
        if (result.success) {
          setPosts((prev) => [result.data as unknown as Post, ...prev]);
          closeForm();
        } else {
          setFormError(result.error);
        }
      }
    });
  };

  // ─── 編集 ──

  const handleEdit = (post: Post) => {
    resetForm();
    setEditingId(post.id);
    setUrl(post.url);
    setTitle(post.title);
    setDescription(post.description ?? "");
    setThumbnailUrl(post.thumbnail_url ?? "");
    setSourceName(post.source_name ?? "");
    setPublishedAt(post.published_at ? post.published_at.split("T")[0] : "");
    setType(post.type as ContentType);
    setShowForm(true);
  };

  // ─── 削除 ──

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
  };

  const confirmDelete = (id: string) => {
    setPendingDeleteId(null);
    startTransition(async () => {
      const result = await deletePost(id);
      if (result.success) {
        setPosts((prev) => prev.filter((p) => p.id !== id));
      } else {
        showError(result.error ?? "削除に失敗しました。再度お試しください。");
      }
    });
  };

  // ─── Render ──

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* ── エラーバナー ── */}
      {errorMessage && (
        <div role="alert" aria-live="polite" style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", marginBottom: 16, borderRadius: 8,
          background: "var(--error-soft)", border: "1px solid #FCA5A5",
          fontSize: 13, color: "var(--error)", fontWeight: 600,
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} aria-label="エラーを閉じる" style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--error)", fontSize: 16, padding: "0 4px",
          }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      )}
      {/* ── ヘッダー ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
              <h1 style={{
                margin: 0, fontSize: 22, fontWeight: 700,
                color: "var(--ink)", letterSpacing: "-0.02em",
                fontFamily: "'Noto Serif JP', serif",
              }}>
                外部発信
              </h1>
              <span style={{
                fontSize: 13, fontWeight: 600, letterSpacing: "0.08em",
                color: "var(--ink-mute)", fontFamily: "'Inter', sans-serif",
                textTransform: "uppercase",
              }}>
                Posts
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.6 }}>
              記事・動画・イベントなど自社の発信コンテンツを登録して、企業ページをリッチにしましょう
            </p>
          </div>
          {!showForm && (
            <button
              type="button"
              onClick={openNewForm}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
                padding: "9px 18px",
                background: "var(--royal)", color: "#fff",
                border: "none", borderRadius: "var(--radius-md)",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                transition: "background 0.15s",
                boxShadow: "0 2px 6px rgba(0,35,102,0.2)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#001233"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--royal)"; }}
            >
              <Plus size={15} strokeWidth={2.5} />
              追加する
            </button>
          )}
        </div>

        {/* Stats row */}
        {posts.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
            padding: "10px 14px",
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-md)",
          }}>
            <span style={{
              fontSize: 13, fontWeight: 600, color: "var(--ink-soft)",
              fontFamily: "'Inter', sans-serif",
              paddingRight: 10,
              borderRight: "1px solid var(--line)",
              marginRight: 2,
            }}>
              合計 {posts.length} 件
            </span>
            {(Object.entries(TYPE_LABELS) as [ContentType, string][]).map(([t, label]) => {
              const count = posts.filter((p) => p.type === t).length;
              if (count === 0) return null;
              const c = TYPE_COLORS[t];
              return (
                <span key={t} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 9px", borderRadius: 100,
                  fontSize: 11, fontWeight: 700,
                  background: c.bg, color: c.color,
                  fontFamily: "'Inter', sans-serif",
                }}>
                  {TYPE_ICONS[t]} {label} {count}件
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 新規追加 / 編集フォーム（モーダル） ── */}
      {showForm && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(15,23,42,0.45)",
            zIndex: 500,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "20px",
          }}
          onClick={(e) => { if (e.target === e.currentTarget && !isPending) closeForm(); }}
        >
        <div style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 16,
          padding: 28,
          width: "100%",
          maxWidth: 600,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div>
              <h2 style={{ margin: "0 0 2px", fontSize: 17, fontWeight: 700, color: "var(--ink)", fontFamily: "'Noto Serif JP', serif" }}>
                {editingId ? "発信リンクを編集" : "発信コンテンツを追加"}
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)" }}>
                URL を入力して OGP を自動取得するか、手動で入力してください
              </p>
            </div>
            <button
              type="button"
              onClick={closeForm}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 32, height: 32, borderRadius: "50%",
                background: "var(--line-soft)", border: "none", cursor: "pointer",
                color: "var(--ink-mute)", flexShrink: 0, marginLeft: 12,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--line)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--line-soft)"; }}
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>

          <div style={{
            height: 1, background: "var(--line)", margin: "16px 0 20px",
          }} />

          {/* URL + OGP 取得 */}
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="post-url" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
              URL <span style={{ color: "var(--error)" }}>*</span>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                id="post-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleFetchOgp(); } }}
                placeholder="https://note.com/your-company/n/..."
                style={{
                  flex: 1, padding: "9px 12px",
                  border: "1px solid var(--line)", borderRadius: "var(--radius-md)",
                  fontSize: 13, color: "var(--ink)", outline: "none",
                  fontFamily: "'Inter', sans-serif",
                }}
              />
              <button
                type="button"
                onClick={handleFetchOgp}
                disabled={ogpFetching || !url.trim()}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
                  padding: "9px 14px",
                  background: ogpFetching ? "var(--line)" : "var(--royal-50)",
                  color: ogpFetching ? "var(--ink-mute)" : "var(--royal)",
                  border: "1px solid var(--royal-100)",
                  borderRadius: "var(--radius-md)",
                  fontSize: 12, fontWeight: 600, cursor: ogpFetching ? "not-allowed" : "pointer",
                }}
              >
                {ogpFetching ? (
                  <><Loader2 size={13} strokeWidth={2} style={{ animation: "spin 1s linear infinite" }} />取得中</>
                ) : (
                  "OGP 取得"
                )}
              </button>
            </div>
            {ogpMessage && (
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 6,
                marginTop: 8, padding: "8px 10px",
                background: ogpMessage.kind === "success" ? "var(--success-soft)" : "var(--error-soft)",
                borderRadius: "var(--radius-sm)",
                fontSize: 12,
                color: ogpMessage.kind === "success" ? "var(--success)" : "var(--error)",
              }}>
                <AlertCircle size={13} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
                {ogpMessage.text}
              </div>
            )}
          </div>

          {/* 2カラムグリッド */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px", marginBottom: 16 }}>
            {/* タイトル */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="post-title" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
                タイトル <span style={{ color: "var(--error)" }}>*</span>
              </label>
              <input
                id="post-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="記事・動画のタイトル"
                style={{
                  width: "100%", padding: "9px 12px", boxSizing: "border-box",
                  border: "1px solid var(--line)", borderRadius: "var(--radius-md)",
                  fontSize: 13, color: "var(--ink)", outline: "none",
                }}
              />
            </div>

            {/* 出典名 */}
            <div>
              <label htmlFor="post-source-name" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
                出典・媒体名
              </label>
              <input
                id="post-source-name"
                type="text"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="note / PR TIMES / YouTube ..."
                style={{
                  width: "100%", padding: "9px 12px", boxSizing: "border-box",
                  border: "1px solid var(--line)", borderRadius: "var(--radius-md)",
                  fontSize: 13, color: "var(--ink)", outline: "none",
                }}
              />
            </div>

            {/* 公開日 */}
            <div>
              <label htmlFor="post-published-at" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
                公開日
              </label>
              <input
                id="post-published-at"
                type="date"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                style={{
                  width: "100%", padding: "9px 12px", boxSizing: "border-box",
                  border: "1px solid var(--line)", borderRadius: "var(--radius-md)",
                  fontSize: 13, color: "var(--ink)", outline: "none",
                  fontFamily: "'Inter', sans-serif",
                }}
              />
            </div>

            {/* type */}
            <div>
              <label htmlFor="post-type" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
                種別
              </label>
              <select
                id="post-type"
                value={type}
                onChange={(e) => setType(e.target.value as ContentType)}
                style={{
                  width: "100%", padding: "9px 12px", boxSizing: "border-box",
                  border: "1px solid var(--line)", borderRadius: "var(--radius-md)",
                  fontSize: 13, color: "var(--ink)", outline: "none",
                  background: "#fff", cursor: "pointer",
                  appearance: "auto",
                }}
              >
                {(Object.entries(TYPE_LABELS) as [ContentType, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            {/* サムネ URL */}
            <div>
              <label htmlFor="post-thumbnail-url" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
                サムネイル URL
              </label>
              <input
                id="post-thumbnail-url"
                type="url"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="https://example.com/thumb.jpg"
                style={{
                  width: "100%", padding: "9px 12px", boxSizing: "border-box",
                  border: "1px solid var(--line)", borderRadius: "var(--radius-md)",
                  fontSize: 13, color: "var(--ink)", outline: "none",
                  fontFamily: "'Inter', sans-serif",
                }}
              />
            </div>

            {/* 説明 */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="post-description" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
                説明
              </label>
              <textarea
                id="post-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="コンテンツの簡単な説明（OGP から自動取得）"
                rows={3}
                style={{
                  width: "100%", padding: "9px 12px", boxSizing: "border-box",
                  border: "1px solid var(--line)", borderRadius: "var(--radius-md)",
                  fontSize: 13, color: "var(--ink)", outline: "none",
                  resize: "vertical", lineHeight: 1.6,
                  fontFamily: "inherit",
                }}
              />
            </div>
          </div>

          {/* サムネプレビュー */}
          {thumbnailUrl && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: "0 0 6px", fontSize: 11, color: "var(--ink-mute)", fontWeight: 600 }}>
                サムネイルプレビュー
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbnailUrl}
                alt="thumbnail preview"
                loading="lazy"
                style={{ maxWidth: 280, height: 140, objectFit: "cover", borderRadius: "var(--radius-md)", display: "block" }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}

          {/* エラー */}
          {formError && (
            <div style={{
              padding: "8px 12px", marginBottom: 12,
              background: "var(--error-soft)", borderRadius: "var(--radius-sm)",
              fontSize: 12, color: "var(--error)", fontWeight: 500,
            }}>
              {formError}
            </div>
          )}

          {/* アクションボタン */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end",
            paddingTop: 16, borderTop: "1px solid var(--line)", marginTop: 4,
          }}>
            <button
              type="button"
              onClick={closeForm}
              disabled={isPending}
              style={{
                padding: "9px 18px",
                background: "transparent", color: "var(--ink-soft)",
                border: "1px solid var(--line)", borderRadius: "var(--radius-md)",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || !url.trim() || !title.trim()}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "9px 22px",
                background: isPending ? "var(--line)" : "var(--royal)", color: "#fff",
                border: "none", borderRadius: "var(--radius-md)",
                fontSize: 13, fontWeight: 600,
                cursor: isPending ? "not-allowed" : "pointer",
                transition: "background 0.15s",
                boxShadow: isPending ? "none" : "0 2px 6px rgba(0,35,102,0.2)",
              }}
              onMouseEnter={(e) => { if (!isPending) e.currentTarget.style.background = "#001233"; }}
              onMouseLeave={(e) => { if (!isPending) e.currentTarget.style.background = "var(--royal)"; }}
            >
              {isPending ? (
                <><Loader2 size={13} strokeWidth={2} style={{ animation: "spin 1s linear infinite" }} />保存中</>
              ) : (
                editingId ? "更新する" : "保存する"
              )}
            </button>
          </div>
        </div>
        </div>
      )}

      {/* ── 一覧 ── */}
      {posts.length === 0 && !showForm ? (
        <div style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: "var(--radius-lg)",
        }}>
          <EmptyState onAdd={openNewForm} />
        </div>
      ) : posts.length > 0 ? (
        <div style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: "var(--radius-lg)", overflow: "hidden",
        }}>
          {/* 件数ヘッダー */}
          <div style={{
            padding: "11px 20px",
            borderBottom: "1px solid var(--line-soft)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontSize: 12, color: "var(--ink-mute)", fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>
              {posts.length} 件の発信コンテンツ
            </span>
            <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>
              最新順
            </span>
          </div>

          {/* カード一覧 */}
          {posts.map((post, idx) => (
            <div key={post.id}>
              <PostCard
                post={post}
                isLast={idx === posts.length - 1 && pendingDeleteId !== post.id}
                onEdit={() => handleEdit(post)}
                onDelete={() => handleDelete(post.id)}
                isPending={isPending}
              />
              {pendingDeleteId === post.id && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 20px",
                  background: "#FFF5F5", borderTop: "1px solid #FCA5A5",
                  borderBottom: idx === posts.length - 1 ? "none" : "1px solid var(--line-soft)",
                  fontSize: 13,
                }}>
                  <span style={{ color: "var(--error)", fontWeight: 600 }}>
                    この発信リンクを削除しますか？この操作は取り消せません。
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(null)}
                      style={{
                        padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                        border: "1px solid var(--line)", background: "#fff",
                        color: "var(--ink-soft)", cursor: "pointer",
                      }}
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmDelete(post.id)}
                      style={{
                        padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                        border: "1px solid var(--error)", background: "var(--error)",
                        color: "#fff", cursor: "pointer",
                      }}
                    >
                      削除する
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {/* spin keyframes */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── PostCard ────────────────────────────────────────────────────────────────

function PostCard({
  post, isLast, onEdit, onDelete, isPending,
}: {
  post: Post;
  isLast: boolean;
  onEdit: () => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "flex-start", gap: 14,
        padding: "16px 20px",
        borderBottom: isLast ? "none" : "1px solid var(--line-soft)",
        background: hovered ? "var(--bg-tint)" : "#fff",
        transition: "background 0.12s",
      }}
    >
      {/* サムネイル / タイプアイコン */}
      {(() => {
        const t = post.type as ContentType;
        const c = TYPE_COLORS[t] ?? TYPE_COLORS.other;
        return (
          <div style={{
            width: 80, height: 56, flexShrink: 0, borderRadius: 8,
            overflow: "hidden",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: post.thumbnail_url ? "var(--line-soft)" : c.bg,
            border: post.thumbnail_url ? "none" : `1px solid ${c.color}22`,
          }}>
            {post.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.thumbnail_url}
                alt=""
                loading="lazy"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <span style={{ fontSize: 24, lineHeight: 1 }}>
                {TYPE_ICONS[t] ?? "🔗"}
              </span>
            )}
          </div>
        );
      })()}

      {/* 本文 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
          <TypeBadge type={post.type} />
          {post.source_name && (
            <span style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "'Inter', sans-serif" }}>
              {post.source_name}
            </span>
          )}
          {post.published_at && (
            <span style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "'Inter', sans-serif" }}>
              {formatDate(post.published_at)}
            </span>
          )}
        </div>

        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block", marginBottom: 4,
            fontSize: 14, fontWeight: 600, color: "var(--ink)",
            textDecoration: "none",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--accent)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink)"; }}
        >
          {post.title}
        </a>

        {post.description && (
          <p style={{
            margin: 0, fontSize: 12, color: "var(--ink-mute)",
            overflow: "hidden", textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            lineHeight: 1.5,
          }}>
            {post.description}
          </p>
        )}
      </div>

      {/* アクション */}
      <div style={{
        display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
        opacity: hovered ? 1 : 0, transition: "opacity 0.15s",
      }}>
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          title="外部リンクを開く"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 30, height: 30, borderRadius: "var(--radius-sm)",
            color: "var(--ink-mute)",
            textDecoration: "none",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "var(--line-soft)";
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink-mute)";
          }}
        >
          <ExternalLink size={14} strokeWidth={2} />
        </a>
        <button
          type="button"
          onClick={onEdit}
          disabled={isPending}
          title="編集"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 30, height: 30, borderRadius: "var(--radius-sm)",
            background: "transparent", border: "none", cursor: "pointer",
            color: "var(--ink-mute)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--line-soft)";
            e.currentTarget.style.color = "var(--royal)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--ink-mute)";
          }}
        >
          <Edit2 size={14} strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isPending}
          title="削除"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 30, height: 30, borderRadius: "var(--radius-sm)",
            background: "transparent", border: "none", cursor: "pointer",
            color: "var(--ink-mute)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--error-soft)";
            e.currentTarget.style.color = "var(--error)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--ink-mute)";
          }}
        >
          <Trash2 size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
