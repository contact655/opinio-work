"use client";

import { useState, useTransition } from "react";
import { fetchOgp } from "@/lib/og/fetchOgp";
import { inferTypeFromUrl, type ContentType } from "@/lib/og/inferType";
import { createPost } from "./_actions/createPost";
import { updatePost } from "./_actions/updatePost";
import { deletePost } from "./_actions/deletePost";
import { createStory } from "./_actions/createStory";
import { updateStory } from "./_actions/updateStory";
import { deleteStory } from "./_actions/deleteStory";
import { togglePublish } from "./_actions/togglePublish";
import { Plus, Edit2, Trash2, Loader2, AlertCircle, ExternalLink, X, Eye, EyeOff, FileText, Link2 } from "lucide-react";
import type { Database } from "@/lib/supabase/types";

type ExternalLink = Database["public"]["Tables"]["ow_company_external_links"]["Row"];

// ow_company_posts doesn't have types generated yet — use a local type
type CompanyPost = {
  id: string;
  company_id: string;
  author_user_id: string | null;
  title: string;
  body: string;
  category: string;
  cover_image_url: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type Props = {
  companyId: string;
  companyName: string;
  initialPosts: ExternalLink[];
  initialStories: CompanyPost[];
};

// ─── Category maps ────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  culture:   "カルチャー",
  interview: "社員インタビュー",
  event:     "イベント",
  product:   "プロダクト",
  hiring:    "採用情報",
  other:     "その他",
};

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  culture:   { bg: "var(--royal-50)",    color: "var(--royal)" },
  interview: { bg: "var(--warm-soft)",   color: "#92400E" },
  event:     { bg: "var(--purple-soft)", color: "var(--purple)" },
  product:   { bg: "var(--success-soft)", color: "var(--success-ink)" },
  hiring:    { bg: "#FEE2E2",            color: "#DC2626" },
  other:     { bg: "var(--line-soft)",   color: "var(--ink-mute)" },
};

// ─── External link type maps ──────────────────────────────────────────────────

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
  social:  { bg: "var(--success-soft)", color: "var(--success-ink)" },
  event:   { bg: "var(--warm-soft)",   color: "var(--warm)" },
  other:   { bg: "var(--line-soft)",   color: "var(--ink-mute)" },
};

const TYPE_ICONS: Record<ContentType, string> = {
  article: "📄",
  video:   "🎬",
  audio:   "🎙️",
  social:  "💬",
  event:   "🗓️",
  other:   "🔗",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function Badge({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 8px", borderRadius: 100,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
      fontFamily: "var(--font-inter), var(--font-noto)",
      background: bg, color,
    }}>
      {children}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PostsClient({ companyId, companyName: _cn, initialPosts, initialStories }: Props) {
  const [activeTab, setActiveTab] = useState<"stories" | "links">("stories");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* ── Page header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 4 }}>
          <h1 style={{
            margin: 0, fontSize: 22, fontWeight: 700,
            color: "var(--ink)", letterSpacing: "-0.02em",
            fontFamily: "var(--font-noto-serif)",
            display: "inline",
          }}>
            発信管理
          </h1>
          <span style={{
            marginLeft: 10,
            fontSize: 13, fontWeight: 600, letterSpacing: "0.08em",
            color: "var(--ink-mute)", fontFamily: "var(--font-inter), var(--font-noto)",
            textTransform: "uppercase",
          }}>
            Posts
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.6 }}>
          ストーリーを書いて企業の魅力を伝えましょう。求職者に最も読まれるコンテンツです。
        </p>
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display: "flex", gap: 0,
        borderBottom: "2px solid var(--line)",
        marginBottom: 24,
      }}>
        {([
          { id: "stories", icon: <FileText size={14} strokeWidth={2} />, label: "ストーリー", count: initialStories.length },
          { id: "links",   icon: <Link2    size={14} strokeWidth={2} />, label: "外部リンク",  count: initialPosts.length },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 20px",
              background: "none", border: "none",
              fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? "var(--royal)" : "var(--ink-mute)",
              cursor: "pointer",
              borderBottom: `2px solid ${activeTab === tab.id ? "var(--royal)" : "transparent"}`,
              marginBottom: -2,
              transition: "color 0.15s",
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.count > 0 && (
              <span style={{
                padding: "1px 6px", borderRadius: 100,
                fontSize: 10, fontWeight: 700,
                background: activeTab === tab.id ? "var(--royal)" : "var(--line)",
                color: activeTab === tab.id ? "#fff" : "var(--ink-mute)",
                fontFamily: "var(--font-inter), var(--font-noto)",
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {activeTab === "stories" ? (
        <StoriesTab companyId={companyId} initialStories={initialStories} />
      ) : (
        <LinksTab companyId={companyId} initialPosts={initialPosts} />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .story-card:hover { background: var(--bg-tint) !important; }
        .story-card:hover .story-actions { opacity: 1 !important; }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STORIES TAB
// ═══════════════════════════════════════════════════════════════════════════════

function StoriesTab({ companyId, initialStories }: { companyId: string; initialStories: CompanyPost[] }) {
  const [stories, setStories] = useState<CompanyPost[]>(initialStories);
  const [showEditor, setShowEditor] = useState(false);
  const [editingStory, setEditingStory] = useState<CompanyPost | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 4000);
  };

  const openNew = () => { setEditingStory(null); setShowEditor(true); };
  const openEdit = (s: CompanyPost) => { setEditingStory(s); setShowEditor(true); };
  const closeEditor = () => { setShowEditor(false); setEditingStory(null); };

  const handleSaved = (story: CompanyPost) => {
    if (editingStory) {
      setStories((prev) => prev.map((s) => s.id === story.id ? story : s));
    } else {
      setStories((prev) => [story, ...prev]);
    }
    closeEditor();
  };

  const handleDelete = (id: string) => setPendingDeleteId(id);

  const confirmDelete = (id: string) => {
    setPendingDeleteId(null);
    startTransition(async () => {
      const result = await deleteStory(id);
      if (result.success) {
        setStories((prev) => prev.filter((s) => s.id !== id));
      } else {
        showError(result.error ?? "削除に失敗しました");
      }
    });
  };

  const handleTogglePublish = (id: string, currentlyPublished: boolean) => {
    startTransition(async () => {
      const result = await togglePublish(id, !currentlyPublished);
      if (result.success) {
        const updated = result.data as unknown as CompanyPost;
        setStories((prev) => prev.map((s) => s.id === id ? updated : s));
      } else {
        showError(result.error ?? "更新に失敗しました");
      }
    });
  };

  const publishedCount = stories.filter((s) => s.is_published).length;
  const draftCount = stories.filter((s) => !s.is_published).length;

  return (
    <>
      {/* エラーバナー */}
      {errorMessage && (
        <div role="alert" style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", marginBottom: 16, borderRadius: 8,
          background: "var(--error-soft)", border: "1px solid #FCA5A5",
          fontSize: 13, color: "var(--error)", fontWeight: 600,
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <AlertCircle size={14} strokeWidth={2} />
            {errorMessage}
          </span>
          <button type="button" onClick={() => setErrorMessage(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--error)" }}>
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* ヘッダー行 */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 16, gap: 12, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {stories.length > 0 && (
            <>
              <span style={{ fontSize: 13, color: "var(--ink-mute)", fontFamily: "var(--font-inter), var(--font-noto)" }}>
                合計 <strong style={{ color: "var(--ink)" }}>{stories.length}</strong> 件
              </span>
              {publishedCount > 0 && (
                <Badge bg="var(--success-soft)" color="var(--success-ink)">公開中 {publishedCount}</Badge>
              )}
              {draftCount > 0 && (
                <Badge bg="var(--line-soft)" color="var(--ink-mute)">下書き {draftCount}</Badge>
              )}
            </>
          )}
        </div>
        <button
          type="button"
          onClick={openNew}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "9px 18px",
            background: "var(--royal)", color: "#fff",
            border: "none", borderRadius: "var(--radius-md)",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
            boxShadow: "0 2px 6px rgba(0,35,102,0.2)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#001233"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--royal)"; }}
        >
          <Plus size={15} strokeWidth={2.5} />
          ストーリーを書く
        </button>
      </div>

      {/* ── 空状態 ── */}
      {stories.length === 0 ? (
        <div style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: "var(--radius-lg)",
        }}>
          <StoryEmptyState onAdd={openNew} />
        </div>
      ) : (
        <div style={{
          background: "#fff", border: "1px solid var(--line)",
          borderRadius: "var(--radius-lg)", overflow: "hidden",
        }}>
          {stories.map((story, idx) => (
            <div key={story.id}>
              <StoryCard
                story={story}
                isLast={idx === stories.length - 1 && pendingDeleteId !== story.id}
                onEdit={() => openEdit(story)}
                onDelete={() => handleDelete(story.id)}
                onTogglePublish={() => handleTogglePublish(story.id, story.is_published)}
                isPending={isPending}
              />
              {pendingDeleteId === story.id && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 20px",
                  background: "#FFF5F5", borderTop: "1px solid #FCA5A5",
                  borderBottom: idx === stories.length - 1 ? "none" : "1px solid var(--line-soft)",
                  fontSize: 13, gap: 12,
                }}>
                  <span style={{ color: "var(--error)", fontWeight: 600 }}>
                    「{story.title}」を削除しますか？この操作は取り消せません。
                  </span>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button type="button" onClick={() => setPendingDeleteId(null)}
                      style={{
                        padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                        border: "1px solid var(--line)", background: "#fff",
                        color: "var(--ink-soft)", cursor: "pointer",
                      }}>
                      キャンセル
                    </button>
                    <button type="button" onClick={() => confirmDelete(story.id)}
                      style={{
                        padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                        border: "1px solid var(--error)", background: "var(--error)",
                        color: "#fff", cursor: "pointer",
                      }}>
                      削除する
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Editor modal ── */}
      {showEditor && (
        <StoryEditor
          companyId={companyId}
          story={editingStory}
          onSaved={handleSaved}
          onClose={closeEditor}
        />
      )}
    </>
  );
}

// ─── Story Empty State ────────────────────────────────────────────────────────

function StoryEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "60px 20px", gap: 0, color: "var(--ink-mute)",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: "50%",
        background: "var(--royal-50)",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 20,
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
          stroke="var(--royal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
      </div>
      <p style={{ margin: "0 0 6px", fontSize: 15, color: "var(--ink)", fontWeight: 700 }}>
        まだストーリーがありません
      </p>
      <p style={{ margin: "0 0 28px", fontSize: 13, color: "var(--ink-mute)", textAlign: "center", lineHeight: 1.7, maxWidth: 360 }}>
        社員インタビュー・カルチャー紹介・プロダクトの話など、<br />企業の「中身」を求職者に届けましょう
      </p>
      <div style={{
        display: "flex", alignItems: "center", gap: 0,
        marginBottom: 28, flexWrap: "wrap", justifyContent: "center",
      }}>
        {[
          { icon: "✍️", label: "記事を書く" },
          { icon: "→", label: null },
          { icon: "✅", label: "公開する" },
          { icon: "→", label: null },
          { icon: "🏢", label: "企業ページに表示" },
        ].map((item, i) =>
          item.label && item.icon !== "→" ? (
            <div key={i} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              padding: "12px 16px",
              background: "#fff", border: "1px solid var(--line)",
              borderRadius: 10, minWidth: 100,
            }}>
              <span style={{ fontSize: 20, marginBottom: 6 }}>{item.icon}</span>
              <span style={{ fontSize: 11, color: "var(--ink-soft)", fontWeight: 600, whiteSpace: "nowrap" }}>{item.label}</span>
            </div>
          ) : item.icon === "→" ? (
            <div key={i} style={{ padding: "0 8px", color: "var(--ink-mute)", fontSize: 16 }}>→</div>
          ) : null
        )}
      </div>
      <button type="button" onClick={onAdd}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "10px 22px",
          background: "var(--royal)", color: "#fff",
          border: "none", borderRadius: "var(--radius-md)",
          fontSize: 13, fontWeight: 600, cursor: "pointer",
          boxShadow: "0 2px 8px rgba(0,35,102,0.25)",
        }}>
        <Plus size={15} strokeWidth={2.5} />
        最初のストーリーを書く
      </button>
    </div>
  );
}

// ─── Story Card ───────────────────────────────────────────────────────────────

function StoryCard({
  story, isLast, onEdit, onDelete, onTogglePublish, isPending,
}: {
  story: CompanyPost;
  isLast: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublish: () => void;
  isPending: boolean;
}) {
  const catColor = CATEGORY_COLORS[story.category] ?? CATEGORY_COLORS.other;
  const bodyPreview = story.body.replace(/[#*`>]/g, "").trim().slice(0, 120);

  return (
    <div
      className="story-card"
      style={{
        display: "flex", gap: 16, padding: "16px 20px",
        borderBottom: isLast ? "none" : "1px solid var(--line-soft)",
        background: "#fff", transition: "background 0.12s",
        alignItems: "flex-start",
      }}
    >
      {/* カバー画像 or カテゴリアイコン */}
      <div style={{
        width: 88, height: 60, flexShrink: 0, borderRadius: 8,
        overflow: "hidden",
        background: story.cover_image_url ? "var(--line-soft)" : catColor.bg,
        border: story.cover_image_url ? "none" : `1px solid ${catColor.color}22`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {story.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={story.cover_image_url}
            alt=""
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <span style={{ fontSize: 26 }}>
            {story.category === "culture" ? "🏢" :
             story.category === "interview" ? "🎤" :
             story.category === "event" ? "🗓️" :
             story.category === "product" ? "🚀" :
             story.category === "hiring" ? "✋" : "📝"}
          </span>
        )}
      </div>

      {/* 本文エリア */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, flexWrap: "wrap" }}>
          <Badge bg={catColor.bg} color={catColor.color}>
            {CATEGORY_LABELS[story.category] ?? story.category}
          </Badge>
          <Badge
            bg={story.is_published ? "var(--success-soft)" : "var(--line-soft)"}
            color={story.is_published ? "var(--success-ink)" : "var(--ink-mute)"}
          >
            {story.is_published ? "公開中" : "下書き"}
          </Badge>
          {story.published_at && (
            <span style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "var(--font-inter), var(--font-noto)" }}>
              {formatDate(story.published_at)}
            </span>
          )}
        </div>

        <p style={{
          margin: "0 0 4px",
          fontSize: 14, fontWeight: 700, color: "var(--ink)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {story.title}
        </p>

        {bodyPreview && (
          <p style={{
            margin: 0, fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.5,
            overflow: "hidden", textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          } as React.CSSProperties}>
            {bodyPreview}
          </p>
        )}
      </div>

      {/* アクションボタン */}
      <div
        className="story-actions"
        style={{
          display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
          opacity: 0, transition: "opacity 0.15s",
        }}
      >
        {/* 公開トグル */}
        <button
          type="button"
          onClick={onTogglePublish}
          disabled={isPending}
          title={story.is_published ? "下書きに戻す" : "公開する"}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "5px 10px", borderRadius: "var(--radius-sm)",
            background: story.is_published ? "var(--line-soft)" : "var(--success-soft)",
            border: "1px solid " + (story.is_published ? "var(--line)" : "#A7F3D0"),
            color: story.is_published ? "var(--ink-mute)" : "var(--success-ink)",
            fontSize: 11, fontWeight: 600, cursor: "pointer",
          }}
        >
          {story.is_published ? (
            <><EyeOff size={12} strokeWidth={2} /> 非公開</>
          ) : (
            <><Eye size={12} strokeWidth={2} /> 公開する</>
          )}
        </button>

        <button type="button" onClick={onEdit} disabled={isPending} title="編集"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 30, height: 30, borderRadius: "var(--radius-sm)",
            background: "transparent", border: "none", cursor: "pointer",
            color: "var(--ink-mute)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--line-soft)"; e.currentTarget.style.color = "var(--royal)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--ink-mute)"; }}
        >
          <Edit2 size={14} strokeWidth={2} />
        </button>

        <button type="button" onClick={onDelete} disabled={isPending} title="削除"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 30, height: 30, borderRadius: "var(--radius-sm)",
            background: "transparent", border: "none", cursor: "pointer",
            color: "var(--ink-mute)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--error-soft)"; e.currentTarget.style.color = "var(--error)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--ink-mute)"; }}
        >
          <Trash2 size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

// ─── Story Editor Modal ───────────────────────────────────────────────────────

function StoryEditor({
  companyId: _companyId,
  story,
  onSaved,
  onClose,
}: {
  companyId: string;
  story: CompanyPost | null;
  onSaved: (s: CompanyPost) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(story?.title ?? "");
  const [body, setBody] = useState(story?.body ?? "");
  const [category, setCategory] = useState(story?.category ?? "culture");
  const [coverImageUrl, setCoverImageUrl] = useState(story?.cover_image_url ?? "");
  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSave = (publish: boolean) => {
    if (!title.trim()) { setFormError("タイトルを入力してください"); return; }
    if (!body.trim()) { setFormError("本文を入力してください"); return; }
    setFormError("");

    startTransition(async () => {
      if (story) {
        const result = await updateStory(story.id, {
          title: title.trim(),
          body: body.trim(),
          category,
          cover_image_url: coverImageUrl.trim() || null,
        });
        if (result.success) {
          // Also toggle publish if needed
          if (publish !== story.is_published) {
            const pubResult = await togglePublish(story.id, publish);
            if (pubResult.success) {
              onSaved(pubResult.data as unknown as CompanyPost);
              return;
            }
          }
          onSaved(result.data as unknown as CompanyPost);
        } else {
          setFormError(result.error);
        }
      } else {
        const result = await createStory({
          title: title.trim(),
          body: body.trim(),
          category,
          cover_image_url: coverImageUrl.trim() || null,
          is_published: publish,
        });
        if (result.success) {
          onSaved(result.data as unknown as CompanyPost);
        } else {
          setFormError(result.error);
        }
      }
    });
  };

  const isEdit = !!story;
  const wordCount = body.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(15,23,42,0.5)",
        zIndex: 500,
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "40px 20px 20px",
        overflowY: "auto",
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !isPending) onClose(); }}
    >
      <div style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 16,
        width: "100%",
        maxWidth: 720,
        boxShadow: "0 24px 80px rgba(0,0,0,0.2)",
      }}>
        {/* Modal header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 28px",
          borderBottom: "1px solid var(--line)",
        }}>
          <div>
            <h2 style={{ margin: "0 0 2px", fontSize: 17, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-noto-serif)" }}>
              {isEdit ? "ストーリーを編集" : "新しいストーリーを書く"}
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)" }}>
              企業の魅力を自由に書いてください。下書き保存もできます。
            </p>
          </div>
          <button type="button" onClick={onClose}
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

        <div style={{ padding: "24px 28px" }}>
          {/* 上段: カテゴリ + カバー画像 */}
          <div className="biz-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px", marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
                カテゴリ
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: "100%", padding: "9px 12px", boxSizing: "border-box",
                  border: "1px solid var(--line)", borderRadius: "var(--radius-md)",
                  fontSize: 13, color: "var(--ink)", outline: "none",
                  background: "#fff", cursor: "pointer", appearance: "auto",
                }}
              >
                {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
                カバー画像 URL（任意）
              </label>
              <input
                type="url"
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                style={{
                  width: "100%", padding: "9px 12px", boxSizing: "border-box",
                  border: "1px solid var(--line)", borderRadius: "var(--radius-md)",
                  fontSize: 13, color: "var(--ink)", outline: "none",
                  fontFamily: "var(--font-inter), var(--font-noto)",
                }}
              />
            </div>
          </div>

          {/* タイトル */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
              タイトル <span style={{ color: "var(--error)" }}>*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 「なぜ私たちはこのプロダクトを作っているのか」"
              style={{
                width: "100%", padding: "10px 14px", boxSizing: "border-box",
                border: "1px solid var(--line)", borderRadius: "var(--radius-md)",
                fontSize: 15, fontWeight: 600, color: "var(--ink)", outline: "none",
                fontFamily: "var(--font-noto-serif)",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--line)"; }}
            />
          </div>

          {/* 本文 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}>
                本文 <span style={{ color: "var(--error)" }}>*</span>
              </label>
              <span style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "var(--font-inter), var(--font-noto)" }}>
                {body.length} 文字
              </span>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={"企業の魅力、カルチャー、チームの雰囲気などを自由に書いてください。\n\nMarkdownは現在非対応ですが、見出しや箇条書きは改行で表現できます。"}
              rows={14}
              style={{
                width: "100%", padding: "12px 14px", boxSizing: "border-box",
                border: "1px solid var(--line)", borderRadius: "var(--radius-md)",
                fontSize: 14, color: "var(--ink)", outline: "none",
                resize: "vertical", lineHeight: 1.8,
                fontFamily: "inherit",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--line)"; }}
            />
            {wordCount > 0 && (
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--ink-mute)" }}>
                読了時間の目安: 約{Math.max(1, Math.ceil(wordCount / 400))}分
              </p>
            )}
          </div>

          {/* カバー画像プレビュー */}
          {coverImageUrl && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: "0 0 6px", fontSize: 11, color: "var(--ink-mute)", fontWeight: 600 }}>カバー画像プレビュー</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverImageUrl}
                alt="cover preview"
                loading="lazy"
                style={{ maxWidth: "100%", height: 160, objectFit: "cover", borderRadius: "var(--radius-md)", display: "block" }}
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
            <button type="button" onClick={onClose} disabled={isPending}
              style={{
                padding: "9px 18px",
                background: "transparent", color: "var(--ink-soft)",
                border: "1px solid var(--line)", borderRadius: "var(--radius-md)",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}>
              キャンセル
            </button>
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={isPending || !title.trim()}
              style={{
                padding: "9px 18px",
                background: "var(--line-soft)", color: "var(--ink-soft)",
                border: "1px solid var(--line)", borderRadius: "var(--radius-md)",
                fontSize: 13, fontWeight: 600, cursor: isPending ? "not-allowed" : "pointer",
              }}
            >
              {isPending ? (
                <Loader2 size={13} strokeWidth={2} style={{ animation: "spin 1s linear infinite" }} />
              ) : "下書き保存"}
            </button>
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={isPending || !title.trim() || !body.trim()}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "9px 22px",
                background: isPending ? "var(--line)" : "var(--royal)", color: "#fff",
                border: "none", borderRadius: "var(--radius-md)",
                fontSize: 13, fontWeight: 600,
                cursor: isPending ? "not-allowed" : "pointer",
                boxShadow: isPending ? "none" : "0 2px 6px rgba(0,35,102,0.2)",
              }}
              onMouseEnter={(e) => { if (!isPending) e.currentTarget.style.background = "#001233"; }}
              onMouseLeave={(e) => { if (!isPending) e.currentTarget.style.background = "var(--royal)"; }}
            >
              {isPending ? (
                <><Loader2 size={13} strokeWidth={2} style={{ animation: "spin 1s linear infinite" }} />処理中</>
              ) : (
                <><Eye size={14} strokeWidth={2} />{isEdit ? "保存して公開" : "公開する"}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LINKS TAB (外部リンク — unchanged logic, refactored as sub-component)
// ═══════════════════════════════════════════════════════════════════════════════

function LinksTab({ companyId, initialPosts }: { companyId: string; initialPosts: ExternalLink[] }) {
  const [posts, setPosts] = useState<ExternalLink[]>(initialPosts);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [type, setType] = useState<ContentType>("article");

  const [ogpFetching, setOgpFetching] = useState(false);
  const [ogpMessage, setOgpMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 4000);
  };

  const resetForm = () => {
    setUrl(""); setTitle(""); setDescription(""); setThumbnailUrl("");
    setSourceName(""); setPublishedAt(""); setType("article");
    setOgpMessage(null); setFormError("");
    setEditingId(null);
  };

  const openNewForm = () => { resetForm(); setShowForm(true); };
  const closeForm = () => { resetForm(); setShowForm(false); };

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
      setUrl(result.url);
      setOgpMessage({ kind: "success", text: "OGP 情報を取得しました。" });
    } else {
      setType(inferTypeFromUrl(url));
      setOgpMessage({ kind: "error", text: `OGP の取得に失敗しました。手動で入力してください。` });
    }
    setOgpFetching(false);
  };

  const handleSave = () => {
    if (!url.trim()) { setFormError("URL を入力してください"); return; }
    if (!title.trim()) { setFormError("タイトルを入力してください"); return; }
    setFormError("");

    const data = {
      url: url.trim(), title: title.trim(),
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
          setPosts((prev) => prev.map((p) => p.id === editingId ? result.data as unknown as ExternalLink : p));
          closeForm();
        } else {
          setFormError(result.error);
        }
      } else {
        const result = await createPost({ company_id: companyId, ...data });
        if (result.success) {
          setPosts((prev) => [result.data as unknown as ExternalLink, ...prev]);
          closeForm();
        } else {
          setFormError(result.error);
        }
      }
    });
  };

  const handleEdit = (post: ExternalLink) => {
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

  const confirmDelete = (id: string) => {
    setPendingDeleteId(null);
    startTransition(async () => {
      const result = await deletePost(id);
      if (result.success) {
        setPosts((prev) => prev.filter((p) => p.id !== id));
      } else {
        showError(result.error ?? "削除に失敗しました");
      }
    });
  };

  return (
    <>
      {errorMessage && (
        <div role="alert" style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", marginBottom: 16, borderRadius: 8,
          background: "var(--error-soft)", border: "1px solid #FCA5A5",
          fontSize: 13, color: "var(--error)", fontWeight: 600,
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <AlertCircle size={14} strokeWidth={2} />{errorMessage}
          </span>
          <button type="button" onClick={() => setErrorMessage(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--error)" }}>
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12 }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>
          記事・動画・イベントなど社外に発信したコンテンツを登録して、企業ページに表示します。
        </p>
        {!showForm && (
          <button type="button" onClick={openNewForm}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
              padding: "9px 18px",
              background: "var(--royal)", color: "#fff",
              border: "none", borderRadius: "var(--radius-md)",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
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

      {/* Form modal */}
      {showForm && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(15,23,42,0.45)", zIndex: 500,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "20px",
          }}
          onClick={(e) => { if (e.target === e.currentTarget && !isPending) closeForm(); }}
        >
          <div style={{
            background: "#fff", border: "1px solid var(--line)", borderRadius: 16,
            padding: 28, width: "100%", maxWidth: 600,
            maxHeight: "90vh", overflowY: "auto",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div>
                <h2 style={{ margin: "0 0 2px", fontSize: 17, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-noto-serif)" }}>
                  {editingId ? "発信リンクを編集" : "発信コンテンツを追加"}
                </h2>
                <p style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)" }}>
                  URL を入力して OGP を自動取得するか、手動で入力してください
                </p>
              </div>
              <button type="button" onClick={closeForm}
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

            <div style={{ height: 1, background: "var(--line)", margin: "16px 0 20px" }} />

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
                    fontFamily: "var(--font-inter), var(--font-noto)",
                  }}
                />
                <button type="button" onClick={handleFetchOgp} disabled={ogpFetching || !url.trim()}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
                    padding: "9px 14px",
                    background: ogpFetching ? "var(--line)" : "var(--royal-50)",
                    color: ogpFetching ? "var(--ink-mute)" : "var(--royal)",
                    border: "1px solid var(--royal-100)",
                    borderRadius: "var(--radius-md)",
                    fontSize: 12, fontWeight: 600, cursor: ogpFetching ? "not-allowed" : "pointer",
                  }}>
                  {ogpFetching
                    ? <><Loader2 size={13} strokeWidth={2} style={{ animation: "spin 1s linear infinite" }} />取得中</>
                    : "OGP 取得"
                  }
                </button>
              </div>
              {ogpMessage && (
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 6,
                  marginTop: 8, padding: "8px 10px",
                  background: ogpMessage.kind === "success" ? "var(--success-soft)" : "var(--error-soft)",
                  borderRadius: "var(--radius-sm)", fontSize: 12,
                  color: ogpMessage.kind === "success" ? "var(--success-ink)" : "var(--error)",
                }}>
                  <AlertCircle size={13} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
                  {ogpMessage.text}
                </div>
              )}
            </div>

            <div className="biz-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px", marginBottom: 16 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
                  タイトル <span style={{ color: "var(--error)" }}>*</span>
                </label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="記事・動画のタイトル"
                  style={{
                    width: "100%", padding: "9px 12px", boxSizing: "border-box",
                    border: "1px solid var(--line)", borderRadius: "var(--radius-md)",
                    fontSize: 13, color: "var(--ink)", outline: "none",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>出典・媒体名</label>
                <input type="text" value={sourceName} onChange={(e) => setSourceName(e.target.value)}
                  placeholder="note / PR TIMES / YouTube ..."
                  style={{
                    width: "100%", padding: "9px 12px", boxSizing: "border-box",
                    border: "1px solid var(--line)", borderRadius: "var(--radius-md)",
                    fontSize: 13, color: "var(--ink)", outline: "none",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>公開日</label>
                <input type="date" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)}
                  style={{
                    width: "100%", padding: "9px 12px", boxSizing: "border-box",
                    border: "1px solid var(--line)", borderRadius: "var(--radius-md)",
                    fontSize: 13, color: "var(--ink)", outline: "none",
                    fontFamily: "var(--font-inter), var(--font-noto)",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>種別</label>
                <select value={type} onChange={(e) => setType(e.target.value as ContentType)}
                  style={{
                    width: "100%", padding: "9px 12px", boxSizing: "border-box",
                    border: "1px solid var(--line)", borderRadius: "var(--radius-md)",
                    fontSize: 13, color: "var(--ink)", outline: "none",
                    background: "#fff", cursor: "pointer", appearance: "auto",
                  }}>
                  {(Object.entries(TYPE_LABELS) as [ContentType, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>サムネイル URL</label>
                <input type="url" value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)}
                  placeholder="https://example.com/thumb.jpg"
                  style={{
                    width: "100%", padding: "9px 12px", boxSizing: "border-box",
                    border: "1px solid var(--line)", borderRadius: "var(--radius-md)",
                    fontSize: 13, color: "var(--ink)", outline: "none",
                    fontFamily: "var(--font-inter), var(--font-noto)",
                  }}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>説明</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="コンテンツの簡単な説明（OGP から自動取得）"
                  rows={3}
                  style={{
                    width: "100%", padding: "9px 12px", boxSizing: "border-box",
                    border: "1px solid var(--line)", borderRadius: "var(--radius-md)",
                    fontSize: 13, color: "var(--ink)", outline: "none",
                    resize: "vertical", lineHeight: 1.6, fontFamily: "inherit",
                  }}
                />
              </div>
            </div>

            {thumbnailUrl && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: "0 0 6px", fontSize: 11, color: "var(--ink-mute)", fontWeight: 600 }}>サムネイルプレビュー</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbnailUrl} alt="thumbnail preview" loading="lazy"
                  style={{ maxWidth: 280, height: 140, objectFit: "cover", borderRadius: "var(--radius-md)", display: "block" }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}

            {formError && (
              <div style={{
                padding: "8px 12px", marginBottom: 12,
                background: "var(--error-soft)", borderRadius: "var(--radius-sm)",
                fontSize: 12, color: "var(--error)", fontWeight: 500,
              }}>
                {formError}
              </div>
            )}

            <div style={{
              display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end",
              paddingTop: 16, borderTop: "1px solid var(--line)", marginTop: 4,
            }}>
              <button type="button" onClick={closeForm} disabled={isPending}
                style={{
                  padding: "9px 18px", background: "transparent", color: "var(--ink-soft)",
                  border: "1px solid var(--line)", borderRadius: "var(--radius-md)",
                  fontSize: 13, fontWeight: 500, cursor: "pointer",
                }}>
                キャンセル
              </button>
              <button type="button" onClick={handleSave} disabled={isPending || !url.trim() || !title.trim()}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "9px 22px",
                  background: isPending ? "var(--line)" : "var(--royal)", color: "#fff",
                  border: "none", borderRadius: "var(--radius-md)",
                  fontSize: 13, fontWeight: 600,
                  cursor: isPending ? "not-allowed" : "pointer",
                  boxShadow: isPending ? "none" : "0 2px 6px rgba(0,35,102,0.2)",
                }}
                onMouseEnter={(e) => { if (!isPending) e.currentTarget.style.background = "#001233"; }}
                onMouseLeave={(e) => { if (!isPending) e.currentTarget.style.background = "var(--royal)"; }}
              >
                {isPending
                  ? <><Loader2 size={13} strokeWidth={2} style={{ animation: "spin 1s linear infinite" }} />保存中</>
                  : editingId ? "更新する" : "保存する"
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {posts.length === 0 && !showForm ? (
        <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "var(--radius-lg)" }}>
          <LinksEmptyState onAdd={openNewForm} />
        </div>
      ) : posts.length > 0 ? (
        <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
          <div style={{
            padding: "11px 20px", borderBottom: "1px solid var(--line-soft)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontSize: 12, color: "var(--ink-mute)", fontFamily: "var(--font-inter), var(--font-noto)", fontWeight: 600 }}>
              {posts.length} 件の外部リンク
            </span>
            <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>最新順</span>
          </div>
          {posts.map((post, idx) => (
            <div key={post.id}>
              <LinkCard
                post={post}
                isLast={idx === posts.length - 1 && pendingDeleteId !== post.id}
                onEdit={() => handleEdit(post)}
                onDelete={() => setPendingDeleteId(post.id)}
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
                    <button type="button" onClick={() => setPendingDeleteId(null)}
                      style={{
                        padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                        border: "1px solid var(--line)", background: "#fff",
                        color: "var(--ink-soft)", cursor: "pointer",
                      }}>
                      キャンセル
                    </button>
                    <button type="button" onClick={() => confirmDelete(post.id)}
                      style={{
                        padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                        border: "1px solid var(--error)", background: "var(--error)",
                        color: "#fff", cursor: "pointer",
                      }}>
                      削除する
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

function LinksEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "48px 20px", gap: 0, color: "var(--ink-mute)",
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: "50%", background: "var(--royal-50)",
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
      }}>
        <Link2 size={24} strokeWidth={1.5} style={{ color: "var(--royal)" }} />
      </div>
      <p style={{ margin: "0 0 6px", fontSize: 15, color: "var(--ink)", fontWeight: 700 }}>外部リンクを登録する</p>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--ink-mute)", textAlign: "center", lineHeight: 1.7 }}>
        note、PR TIMES、YouTube など<br />社外に発信したコンテンツを追加できます
      </p>
      <button type="button" onClick={onAdd}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "9px 20px", background: "var(--royal)", color: "#fff",
          border: "none", borderRadius: "var(--radius-md)",
          fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>
        <Plus size={14} strokeWidth={2.5} />
        リンクを追加する
      </button>
    </div>
  );
}

function LinkCard({
  post, isLast, onEdit, onDelete, isPending,
}: {
  post: ExternalLink;
  isLast: boolean;
  onEdit: () => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const t = post.type as ContentType;
  const c = TYPE_COLORS[t] ?? TYPE_COLORS.other;

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
      <div style={{
        width: 80, height: 56, flexShrink: 0, borderRadius: 8,
        overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
        background: post.thumbnail_url ? "var(--line-soft)" : c.bg,
        border: post.thumbnail_url ? "none" : `1px solid ${c.color}22`,
      }}>
        {post.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.thumbnail_url} alt="" loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <span style={{ fontSize: 24, lineHeight: 1 }}>{TYPE_ICONS[t] ?? "🔗"}</span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
          <Badge bg={c.bg} color={c.color}>{TYPE_LABELS[t] ?? t}</Badge>
          {post.source_name && (
            <span style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "var(--font-inter), var(--font-noto)" }}>{post.source_name}</span>
          )}
          {post.published_at && (
            <span style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "var(--font-inter), var(--font-noto)" }}>
              {formatDate(post.published_at)}
            </span>
          )}
        </div>
        <a href={post.url} target="_blank" rel="noopener noreferrer"
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
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            lineHeight: 1.5,
          } as React.CSSProperties}>
            {post.description}
          </p>
        )}
      </div>
      <div style={{
        display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
        opacity: hovered ? 1 : 0, transition: "opacity 0.15s",
      }}>
        <a href={post.url} target="_blank" rel="noopener noreferrer" title="外部リンクを開く"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 30, height: 30, borderRadius: "var(--radius-sm)",
            color: "var(--ink-mute)", textDecoration: "none",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--line-soft)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--accent)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink-mute)"; }}
        >
          <ExternalLink size={14} strokeWidth={2} />
        </a>
        <button type="button" onClick={onEdit} disabled={isPending} title="編集"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 30, height: 30, borderRadius: "var(--radius-sm)",
            background: "transparent", border: "none", cursor: "pointer", color: "var(--ink-mute)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--line-soft)"; e.currentTarget.style.color = "var(--royal)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--ink-mute)"; }}
        >
          <Edit2 size={14} strokeWidth={2} />
        </button>
        <button type="button" onClick={onDelete} disabled={isPending} title="削除"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 30, height: 30, borderRadius: "var(--radius-sm)",
            background: "transparent", border: "none", cursor: "pointer", color: "var(--ink-mute)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--error-soft)"; e.currentTarget.style.color = "var(--error)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--ink-mute)"; }}
        >
          <Trash2 size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
