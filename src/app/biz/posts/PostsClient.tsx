"use client";

import { useState, useTransition } from "react";
import { createStory } from "./_actions/createStory";
import { updateStory } from "./_actions/updateStory";
import { deleteStory } from "./_actions/deleteStory";
import { togglePublish } from "./_actions/togglePublish";
import { Plus, Edit2, Trash2, Loader2, AlertCircle, X, Eye, EyeOff, ExternalLink } from "lucide-react";
import { useBizShell } from "@/components/business/BizShellContext";

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

type StatusTab = "all" | "published" | "draft";

function StoriesTab({ companyId, initialStories }: { companyId: string; initialStories: CompanyPost[] }) {
  const [stories, setStories] = useState<CompanyPost[]>(initialStories);
  const [tab, setTab] = useState<StatusTab>("all");
  const [showEditor, setShowEditor] = useState(false);
  const [editingStory, setEditingStory] = useState<CompanyPost | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const shell = useBizShell();

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
  const draftCount = stories.length - publishedCount;
  const visible = stories.filter((s) =>
    tab === "all" ? true : tab === "published" ? s.is_published : !s.is_published);

  /* ★企業ページへのリンク。⚠️ ページが公開されていないと 404 になるので出さない
        （判定はサイドバーの「公開ページを見る」と同じ `hasPublicPage`） */
  const publicHref = shell.hasPublicPage && shell.tenantId ? `/companies/${shell.tenantId}#posts` : null;

  const TABS: { key: StatusTab; label: string; count: number }[] = [
    { key: "all", label: "すべて", count: stories.length },
    { key: "published", label: "公開中", count: publishedCount },
    { key: "draft", label: "下書き", count: draftCount },
  ];

  return (
    <>
      <style>{`
        .story-row:hover { background: var(--bg-tint); }
        .story-icon-btn:hover:not(:disabled) { background: var(--line-soft); color: var(--royal); }
        .story-icon-btn.danger:hover:not(:disabled) { background: var(--error-soft); color: var(--error-ink); }
        .story-tab:hover { color: var(--ink); }
        @media (max-width: 640px) {
          .story-row { flex-wrap: wrap; }
          .story-row-actions { width: 100%; justify-content: flex-end; }
        }
      `}</style>

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
          <button type="button" onClick={() => setErrorMessage(null)} aria-label="閉じる"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--error)" }}>
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* ★企業ページが非公開のあいだは、公開したストーリーも求職者には見えない。黙らずに書く */}
      {!shell.hasPublicPage && publishedCount > 0 && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "var(--bg-tint)", border: "1px solid var(--line)", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
          企業ページがまだ公開されていないため、公開中のストーリーも求職者には表示されていません。
        </div>
      )}

      <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
        {/* 見出し：タブと「書く」 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 20px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
          <div role="tablist" aria-label="状態で絞り込む" style={{ display: "flex", gap: 20, flex: 1, minWidth: 0 }}>
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-state={active ? "active" : "inactive"}
                  onClick={() => setTab(t.key)}
                  className="story-tab"
                  style={{
                    padding: "14px 0 12px", border: "none", background: "none", cursor: "pointer",
                    fontFamily: "inherit", fontSize: 13, fontWeight: active ? 700 : 500,
                    color: active ? "var(--royal)" : "var(--ink-mute)",
                    borderBottom: active ? "2px solid var(--royal)" : "2px solid transparent",
                    marginBottom: -1,
                  }}
                >
                  {t.label}
                  <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 600, color: active ? "var(--royal)" : "var(--ink-mute)" }}>{t.count}</span>
                </button>
              );
            })}
          </div>
          {stories.length > 0 && (
            <button type="button" onClick={openNew}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, margin: "8px 0",
                padding: "8px 16px", background: "var(--royal)", color: "#fff",
                border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}>
              <Plus size={15} strokeWidth={2.5} />
              ストーリーを書く
            </button>
          )}
        </div>

        {stories.length === 0 ? (
          <StoryEmptyState onAdd={openNew} />
        ) : visible.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", fontSize: 13, color: "var(--ink-mute)" }}>
            {tab === "published" ? "公開中のストーリーはありません。" : "下書きはありません。"}
          </div>
        ) : (
          visible.map((story, idx) => (
            <div key={story.id} style={{ borderTop: idx === 0 ? "none" : "1px solid var(--line-soft)" }}>
              <StoryCard
                story={story}
                publicHref={story.is_published ? publicHref : null}
                onEdit={() => openEdit(story)}
                onDelete={() => setPendingDeleteId(story.id)}
                onTogglePublish={() => handleTogglePublish(story.id, story.is_published)}
                isPending={isPending}
              />
              {pendingDeleteId === story.id && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap",
                  padding: "12px 20px", background: "var(--error-soft)", borderTop: "1px solid #FCA5A5",
                  fontSize: 13, gap: 12,
                }}>
                  <span style={{ color: "var(--error-ink)", fontWeight: 600 }}>
                    「{story.title}」を削除しますか？この操作は取り消せません。
                  </span>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button type="button" onClick={() => setPendingDeleteId(null)}
                      style={{ padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)", cursor: "pointer", fontFamily: "inherit" }}>
                      キャンセル
                    </button>
                    <button type="button" onClick={() => confirmDelete(story.id)}
                      style={{ padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, border: "none", background: "var(--error)", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
                      削除する
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

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

/* ⚠️ 絵文字の3段図（書く → 公開する → 企業ページに表示）は外した（2026-09-22）。
      言っていることは下の一文と同じで、場所を取るだけだった。 */
function StoryEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 20px", textAlign: "center" }}>
      <p style={{ margin: "0 0 6px", fontSize: 15, color: "var(--ink)", fontWeight: 700 }}>
        まだストーリーがありません
      </p>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.7, maxWidth: 420 }}>
        社員インタビュー・カルチャー・プロダクトの話など、求人票には書ききれない会社の中身を書いてみましょう。
        公開すると企業ページに表示されます。
      </p>
      <button type="button" onClick={onAdd}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 22px",
          background: "var(--royal)", color: "#fff", border: "none", borderRadius: 8,
          fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        }}>
        <Plus size={15} strokeWidth={2.5} />
        最初のストーリーを書く
      </button>
    </div>
  );
}

// ─── Story Card ───────────────────────────────────────────────────────────────

/**
 * ⚠️★操作（公開・編集・削除）は**常に出す**（2026-09-22）。
 *    それまで `opacity: 0` で、hover で出す CSS がどこにも無く、**一度も見えていなかった**
 *    （押せはするが、見えないので誰も押せない）。
 */
function StoryCard({
  story, publicHref, onEdit, onDelete, onTogglePublish, isPending,
}: {
  story: CompanyPost;
  publicHref: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublish: () => void;
  isPending: boolean;
}) {
  const catColor = CATEGORY_COLORS[story.category] ?? CATEGORY_COLORS.other;
  const bodyPreview = story.body.replace(/[#*`>]/g, "").trim().slice(0, 120);

  return (
    <div className="story-row" style={{ display: "flex", gap: 16, padding: "16px 20px", alignItems: "flex-start" }}>
      {/* カバー画像。⚠️ 無いときはカテゴリの絵文字で埋めない（2026-09-22）。枠ごと出さない */}
      {story.cover_image_url && (
        <div style={{ width: 88, height: 60, flexShrink: 0, borderRadius: 8, overflow: "hidden", background: "var(--line-soft)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={story.cover_image_url}
            alt=""
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
          <Badge
            bg={story.is_published ? "var(--success-soft)" : "var(--line-soft)"}
            color={story.is_published ? "var(--success-ink)" : "var(--ink-mute)"}
          >
            {story.is_published ? "公開中" : "下書き"}
          </Badge>
          <Badge bg={catColor.bg} color={catColor.color}>
            {CATEGORY_LABELS[story.category] ?? story.category}
          </Badge>
          <span style={{ fontSize: 12, color: "var(--ink-mute)", fontFamily: "var(--font-inter), var(--font-noto)" }}>
            {story.is_published && story.published_at
              ? `${formatDate(story.published_at)} 公開`
              : `${formatDate(story.updated_at)} 更新`}
          </span>
        </div>

        <button type="button" onClick={onEdit} title="編集する"
          style={{
            display: "block", width: "100%", textAlign: "left", padding: 0, border: "none", background: "none",
            cursor: "pointer", fontFamily: "inherit", margin: "0 0 4px",
            fontSize: 15, fontWeight: 700, color: "var(--ink)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
          {story.title}
        </button>

        {bodyPreview && (
          <p style={{
            margin: 0, fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.6,
            overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          } as React.CSSProperties}>
            {bodyPreview}
          </p>
        )}

        {publicHref && (
          <a href={publicHref} target="_blank" rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: 12, fontWeight: 600, color: "var(--royal)", textDecoration: "none" }}>
            企業ページで見る
            <ExternalLink size={12} strokeWidth={2} />
          </a>
        )}
      </div>

      <div className="story-row-actions" style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onTogglePublish}
          disabled={isPending}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "6px 12px", borderRadius: 8, fontFamily: "inherit",
            background: story.is_published ? "#fff" : "var(--royal)",
            border: story.is_published ? "1px solid var(--line)" : "1px solid var(--royal)",
            color: story.is_published ? "var(--ink-soft)" : "#fff",
            fontSize: 12, fontWeight: 700, cursor: isPending ? "default" : "pointer",
            opacity: isPending ? 0.5 : 1,
          }}
        >
          {story.is_published ? (
            <><EyeOff size={13} strokeWidth={2} /> 下書きに戻す</>
          ) : (
            <><Eye size={13} strokeWidth={2} /> 公開する</>
          )}
        </button>

        <button type="button" onClick={onEdit} disabled={isPending} aria-label={`「${story.title}」を編集`} title="編集"
          className="story-icon-btn btn-fixed-size"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 32, height: 32, borderRadius: 8, background: "transparent", border: "none",
            cursor: "pointer", color: "var(--ink-mute)",
          }}>
          <Edit2 size={15} strokeWidth={2} />
        </button>

        <button type="button" onClick={onDelete} disabled={isPending} aria-label={`「${story.title}」を削除`} title="削除"
          className="story-icon-btn danger btn-fixed-size"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 32, height: 32, borderRadius: 8, background: "transparent", border: "none",
            cursor: "pointer", color: "var(--ink-mute)",
          }}>
          <Trash2 size={15} strokeWidth={2} />
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
            /* ⚠️ 本文は保存できたが公開に失敗した。黙って閉じると「公開した」と思わせるので、
                  欄を閉じずに理由を出す（2026-09-22。それまでは失敗を捨てて閉じていた） */
            setFormError(`本文は保存しましたが、公開できませんでした：${pubResult.error ?? "不明なエラー"}`);
            return;
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
  /* ★読了時間は**文字数**で出す（2026-09-22）。それまでは空白で区切って「単語」を数えており、
        空白の無い日本語はほぼ常に1語＝「約1分」になっていた。目安は1分あたり500字 */
  const charCount = body.trim().length;

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
            <h2 style={{ margin: "0 0 2px", fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
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
                fontFamily: "inherit",
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
              placeholder={"企業の魅力、カルチャー、チームの雰囲気などを自由に書いてください。"}
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
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7 }}>
              {/* ⚠️ 企業ページは本文を Markdown として描く（2026-09-22〜）。書ける記法をここで伝える */}
              空行で段落が分かれます。「## 見出し」「- 箇条書き」「**太字**」が使えます。
              {charCount > 0 && <>　読了時間の目安: 約{Math.max(1, Math.ceil(charCount / 500))}分</>}
            </p>
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

