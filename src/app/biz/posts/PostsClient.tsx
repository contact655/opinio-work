"use client";

import { useState, useTransition } from "react";
import { createStory } from "./_actions/createStory";
import { updateStory } from "./_actions/updateStory";
import { deleteStory } from "./_actions/deleteStory";
import { togglePublish } from "./_actions/togglePublish";
import { Plus, Edit2, Trash2, Loader2, AlertCircle, X, Eye, EyeOff } from "lucide-react";

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

/* ⚠️ **カテゴリごとに色を変えない**（2026-09-02 に6色 → 1色）。
      チップの**中身がラベルそのもの**（528行目 `{CATEGORY_LABELS[...]}`）なので、
      色は意味を足していない。足していないのに
      「採用情報」を赤（＝エラー・危険）、「インタビュー」を黄（＝注意・未完了）で
      塗っていた。凡例の無い色分けは増やさない（ui-conventions）。 */
const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  culture:   { bg: "var(--line-soft)", color: "var(--ink-mute)" },
  interview: { bg: "var(--line-soft)", color: "var(--ink-mute)" },
  event:     { bg: "var(--line-soft)", color: "var(--ink-mute)" },
  product:   { bg: "var(--line-soft)", color: "var(--ink-mute)" },
  hiring:    { bg: "var(--line-soft)", color: "var(--ink-mute)" },
  other:     { bg: "var(--line-soft)", color: "var(--ink-mute)" },
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

/**
 * ★企業ストーリー（2026-09-21 に「投稿・発信」から改名し、外部リンクのタブを外した）。
 *
 * ⚠️★**「外部リンク」タブを戻さないこと。** 「企業ページに表示します」と書いてあったが、
 *    求職者向けのどの画面も `ow_company_external_links` を読んでいなかった
 *    （企業ページの「企業の発信」欄は `405d54e0` で意図して外されている）。
 *    実測（2026-09-21）: 公開済みの外部リンク5件が**1件も表示されていなかった。**
 *    テーブルとデータは残してある。表示する欄を作り直すなら、入力欄と**同時に**戻すこと。
 * ⚠️ 名前はダッシュボードの「まだ入れていない項目」のリンク名（企業ストーリー）と揃えてある。
 */
export function PostsClient({ companyId, initialStories }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
          企業ストーリー
        </h1>
        {/* ⚠️ 「最も読まれる」などの根拠の無い言葉を書かない（読まれた数は測っていない） */}
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
          公開したストーリーは、求職者向けの企業ページに表示されます。
        </p>
      </div>
      <StoriesTab companyId={companyId} initialStories={initialStories} />
    </div>
  );
}

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
          fontSize: 13, color: "var(--error-ink)", fontWeight: 600,
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
        /* ⚠️★`${...}22` で16進アルファを足す書き方をやめた（2026-09-02）。
                `catColor.color` は `var(--purple)` などの**CSS変数の参照**なので
                `var(--purple)22` になり、**CSS として不正 → 枠線ごと破棄**されていた。
             ⚠️ 12種のうち**リテラルの16進は `interview` の1つだけ**で、
                そこだけ枠線が出て**残り11種は出ていなかった**（偶然の不揃い）。
             → 標準の `--line` に揃える。`/biz/analytics` の KpiCard と同じ根。 */
        border: story.cover_image_url ? "none" : "1px solid var(--line)",
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
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--error-soft)"; e.currentTarget.style.color = "var(--error-ink)"; }}
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
              fontSize: 12, color: "var(--error-ink)", fontWeight: 500,
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

