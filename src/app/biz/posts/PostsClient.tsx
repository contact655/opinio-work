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
  event:   { bg: "var(--warm-soft)",   color: "var(--gold)" },
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

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "80px 20px", gap: 16,
      color: "var(--ink-mute)",
    }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
        style={{ opacity: 0.35 }}>
        <path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>
      <div style={{ textAlign: "center" }}>
        <p style={{ margin: "0 0 4px", fontSize: 14, color: "var(--ink-soft)", fontWeight: 600 }}>
          発信リンクがありません
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>
          記事・動画・イベントなど、自社の外部発信を登録しましょう
        </p>
      </div>
      <button
        onClick={onAdd}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 18px",
          background: "var(--royal)", color: "#fff",
          border: "none", borderRadius: "var(--radius-md)",
          fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}
      >
        <Plus size={15} strokeWidth={2.5} />
        最初の発信を登録
      </button>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function PostsClient({ companyId, companyName, initialPosts }: Props) {
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ─── 削除 ──

  const handleDelete = (id: string) => {
    if (!confirm("この発信リンクを削除しますか？")) return;
    startTransition(async () => {
      const result = await deletePost(id);
      if (result.success) {
        setPosts((prev) => prev.filter((p) => p.id !== id));
      } else {
        alert(result.error);
      }
    });
  };

  // ─── Render ──

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* ── ヘッダー ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 style={{
              margin: 0, fontSize: "var(--text-h3)", fontWeight: 700,
              color: "var(--ink)", letterSpacing: "var(--tracking-tight)",
              fontFamily: "'Noto Serif JP', serif",
            }}>
              発信リンク管理
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.5 }}>
              {companyName} の外部発信コンテンツを管理します。記事・動画・イベントなどを登録してください。
            </p>
          </div>
          {!showForm && (
            <button
              onClick={openNewForm}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
                padding: "8px 16px",
                background: "var(--royal)", color: "#fff",
                border: "none", borderRadius: "var(--radius-md)",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--royal-deep)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--royal)"; }}
            >
              <Plus size={15} strokeWidth={2.5} />
              新規追加
            </button>
          )}
        </div>
      </div>

      {/* ── 新規追加 / 編集フォーム ── */}
      {showForm && (
        <div style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-lg)",
          padding: 24,
          marginBottom: 24,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
              {editingId ? "発信リンクを編集" : "新しい発信リンクを追加"}
            </h2>
            <button
              onClick={closeForm}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 28, height: 28, borderRadius: "50%",
                background: "transparent", border: "none", cursor: "pointer",
                color: "var(--ink-mute)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--line-soft)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>

          {/* URL + OGP 取得 */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
              URL <span style={{ color: "var(--error)" }}>*</span>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
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
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
                タイトル <span style={{ color: "var(--error)" }}>*</span>
              </label>
              <input
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
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
                出典・媒体名
              </label>
              <input
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
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
                公開日
              </label>
              <input
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
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
                種別
              </label>
              <select
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
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
                サムネイル URL
              </label>
              <input
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
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
                説明
              </label>
              <textarea
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
            <button
              onClick={closeForm}
              disabled={isPending}
              style={{
                padding: "8px 16px",
                background: "transparent", color: "var(--ink-soft)",
                border: "1px solid var(--line)", borderRadius: "var(--radius-md)",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              disabled={isPending || !url.trim() || !title.trim()}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 20px",
                background: isPending ? "var(--line)" : "var(--royal)", color: "#fff",
                border: "none", borderRadius: "var(--radius-md)",
                fontSize: 13, fontWeight: 600,
                cursor: isPending ? "not-allowed" : "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { if (!isPending) e.currentTarget.style.background = "var(--royal-deep)"; }}
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
            padding: "12px 20px",
            borderBottom: "1px solid var(--line-soft)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 12, color: "var(--ink-mute)", fontFamily: "'Inter', sans-serif", fontWeight: 500 }}>
              {posts.length} 件
            </span>
          </div>

          {/* カード一覧 */}
          {posts.map((post, idx) => (
            <PostCard
              key={post.id}
              post={post}
              isLast={idx === posts.length - 1}
              onEdit={() => handleEdit(post)}
              onDelete={() => handleDelete(post.id)}
              isPending={isPending}
            />
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
      {/* サムネイル */}
      <div style={{
        width: 96, height: 64, flexShrink: 0, borderRadius: "var(--radius-sm)",
        background: "var(--line-soft)", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {post.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.thumbnail_url}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="var(--ink-mute)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ opacity: 0.5 }}>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        )}
      </div>

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
