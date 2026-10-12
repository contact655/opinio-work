"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useBizShell } from "@/components/business/BizShellContext";
import { storyCategoryDef, storyExcerpt, storyMetaLine } from "@/lib/companyStories/shared";
import type { StoryWithDraft } from "@/lib/companyStories/server";
import { deleteStoryAction, unpublishStoryAction } from "./_actions/stories";

/**
 * ★企業ストーリー（2026-10-12 にカードの一覧にした / 柴さんの指示）。
 *
 *   1280px で3列。先頭に「＋ 新しいストーリー」。カードを押すと編集画面（/biz/posts/[id]）。
 *   カード: 表紙写真（無ければ種類ごとの単色＋種類名）／種類（灰色・小）／タイトル（太字・2行まで）／
 *          本文の最初の1行／灰色の1行（公開中・7月27日・閲覧 120 ／ 下書き・10月12日更新）
 *   ⋯ メニュー: 企業ページで見る ／ 下書きに戻す ／ 削除
 *
 * ⚠️★状態を色のバッジで出さないこと（灰色の文字だけ）。
 * ⚠️★「外部リンク」タブを戻さないこと（2026-09-21。表示する欄がどこにも無かった）。
 * ⚠️ ⋯ メニューはカードの overflow: hidden の外に置く（中に置くと切れる）。
 */

type StatusTab = "all" | "published" | "draft";

export function PostsClient({ initialStories, views }: {
  /** null は読み込めなかった（「まだ無い」と区別する） */
  initialStories: StoryWithDraft[] | null;
  /** ストーリーごとの閲覧数。null は取れなかった（閲覧を出さない） */
  views: Record<string, number> | null;
}) {
  const shell = useBizShell();
  const router = useRouter();
  const [stories, setStories] = useState<StoryWithDraft[]>(initialStories ?? []);
  const [tab, setTab] = useState<StatusTab>("all");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const publishedCount = stories.filter((s) => s.isPublished).length;
  const draftCount = stories.length - publishedCount;
  const visible = stories.filter((s) => (tab === "all" ? true : tab === "published" ? s.isPublished : !s.isPublished));
  /* ★「企業ページで見る」は担当者用のプレビュー（/preview/company）へ。公開ページの URL にすると、
        企業ページが非公開・検証用の会社では 404 になる（2026-10-12）。プレビューは状態の帯を出す */
  const publicHref = shell.tenantId ? "/preview/company#posts" : null;

  const TABS: { key: StatusTab; label: string; count: number }[] = [
    { key: "all", label: "すべて", count: stories.length },
    { key: "published", label: "公開中", count: publishedCount },
    { key: "draft", label: "下書き", count: draftCount },
  ];

  const unpublish = async (id: string) => {
    setBusyId(id); setError(null);
    const r = await unpublishStoryAction(id).catch(() => undefined);
    setBusyId(null);
    if (!r) { setError("通信に失敗しました。もう一度お試しください。"); return; }
    if (!r.ok) { setError(r.error); return; }
    setStories((prev) => prev.map((s) => (s.id === id ? r.value : s)));
    router.refresh();
  };
  const remove = async (id: string) => {
    setBusyId(id); setError(null);
    const r = await deleteStoryAction(id).catch(() => undefined);
    setBusyId(null);
    if (!r) { setError("通信に失敗しました。もう一度お試しください。"); return; }
    if (!r.ok) { setError(r.error); return; }
    setStories((prev) => prev.filter((s) => s.id !== id));
    router.refresh();
  };

  return (
    <div>
      <style>{`
        .sl-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
        @media (max-width: 1100px) { .sl-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 640px) { .sl-grid { grid-template-columns: minmax(0, 1fr); } }
        .sl-card { position: relative; min-width: 0; }
        .sl-link { display: flex; flex-direction: column; height: 100%; background: #fff; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; text-decoration: none; color: inherit; transition: box-shadow .15s, border-color .15s; }
        .sl-link:hover { border-color: var(--royal); box-shadow: 0 4px 16px rgba(15,23,42,0.08); }
        .sl-new { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; min-height: 260px; border: 1.5px dashed var(--line); border-radius: 12px; background: #fff; color: var(--royal); font-size: 14px; font-weight: 700; text-decoration: none; }
        .sl-new:hover { border-color: var(--royal); background: var(--royal-50); }
        .sl-tab:hover { color: var(--ink); }
        .sl-menu-item { display: block; width: 100%; text-align: left; padding: 9px 14px; border: none; background: none; font-size: 13px; color: var(--ink); cursor: pointer; font-family: inherit; text-decoration: none; }
        .sl-menu-item:hover { background: var(--bg-tint); }
      `}</style>

      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>企業ストーリー</h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
          公開したストーリーは、求職者向けの企業ページに表示されます。
          {views && <span style={{ color: "var(--ink-mute)" }}>　閲覧数は2026年10月12日から数えています。</span>}
        </p>
      </div>

      {initialStories === null && (
        <div role="alert" style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "var(--error-soft)", fontSize: 13, color: "var(--error-ink)" }}>
          ストーリーを読み込めませんでした。時間をおいて開き直してください。
        </div>
      )}
      {error && (
        <div role="alert" style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "var(--error-soft)", fontSize: 13, color: "var(--error-ink)" }}>{error}</div>
      )}
      {!shell.hasPublicPage && publishedCount > 0 && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "var(--bg-tint)", border: "1px solid var(--line)", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
          企業ページがまだ公開されていないため、公開中のストーリーも求職者には表示されていません。
        </div>
      )}

      <div role="tablist" aria-label="状態で絞り込む" style={{ display: "flex", gap: 20, borderBottom: "1px solid var(--line)", marginBottom: 16 }}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button key={t.key} type="button" role="tab" aria-selected={active} data-state={active ? "active" : "inactive"}
              onClick={() => setTab(t.key)} className="sl-tab"
              style={{
                padding: "10px 0", border: "none", background: "none", cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, fontWeight: active ? 700 : 500, color: active ? "var(--royal)" : "var(--ink-mute)",
                borderBottom: active ? "2px solid var(--royal)" : "2px solid transparent", marginBottom: -1,
              }}>
              {t.label}
              {t.count > 0 && <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 600, padding: "1px 7px", borderRadius: 100, background: "var(--line-soft)", color: "var(--ink-mute)" }}>{t.count}</span>}
            </button>
          );
        })}
      </div>

      <div className="sl-grid" data-state="story-grid">
        <Link href="/biz/posts/new" className="sl-new" data-state="story-new">
          <span style={{ fontSize: 26, lineHeight: 1 }}>＋</span>
          新しいストーリー
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>社員インタビュー・カルチャーなど</span>
        </Link>
        {visible.map((s) => (
          <StoryTile
            key={s.id}
            story={s}
            views={views ? views[s.id] ?? 0 : null}
            publicHref={s.isPublished ? publicHref : null}
            busy={busyId === s.id}
            onUnpublish={() => unpublish(s.id)}
            onDelete={() => remove(s.id)}
          />
        ))}
      </div>

      {stories.length > 0 && visible.length === 0 && (
        <p style={{ margin: "16px 0 0", fontSize: 13, color: "var(--ink-mute)" }}>
          {tab === "published" ? "公開中のストーリーはありません。" : "下書きはありません。"}
        </p>
      )}
    </div>
  );
}

function StoryTile({ story, views, publicHref, busy, onUnpublish, onDelete }: {
  story: StoryWithDraft;
  views: number | null;
  publicHref: string | null;
  busy: boolean;
  onUnpublish: () => void;
  onDelete: () => void;
}) {
  const cat = storyCategoryDef(story.category);
  const excerpt = storyExcerpt(story.body);
  const meta = storyMetaLine({
    isPublished: story.isPublished, publishedAt: story.publishedAt, updatedAt: story.updatedAt,
    views, hasDraft: !!story.draft,
  });

  return (
    <div className="sl-card" data-state="story-card" data-story-status={story.isPublished ? "published" : "draft"}>
      <Link href={`/biz/posts/${story.id}`} className="sl-link" aria-label={`「${story.title || "無題"}」を編集`}>
        <div style={{ height: 130, flexShrink: 0, background: cat.coverBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {story.coverImageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={story.coverImageUrl} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--royal)", letterSpacing: "0.04em" }}>{cat.label}</span>
          )}
        </div>
        <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>{cat.label}</span>
          <span style={{
            fontSize: 15, fontWeight: 700, color: "var(--ink)", lineHeight: 1.45,
            overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          } as React.CSSProperties}>
            {story.title || "（タイトル未入力）"}
          </span>
          {excerpt && (
            <span style={{ fontSize: 13, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }} title={excerpt}>
              {excerpt}
            </span>
          )}
          <span data-state="story-meta" style={{ marginTop: "auto", paddingTop: 6, fontSize: 12, color: "var(--ink-mute)" }}>{meta}</span>
        </div>
      </Link>
      <StoryMenu title={story.title} publicHref={publicHref} isPublished={story.isPublished} busy={busy} onUnpublish={onUnpublish} onDelete={onDelete} />
    </div>
  );
}

function StoryMenu({ title, publicHref, isPublished, busy, onUnpublish, onDelete }: {
  title: string; publicHref: string | null; isPublished: boolean; busy: boolean;
  onUnpublish: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setConfirming(false); } };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setConfirming(false); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "absolute", top: 8, right: 8 }}>
      <button type="button" aria-label={`「${title || "無題"}」の操作`} aria-expanded={open} aria-haspopup="menu" disabled={busy}
        className="btn-fixed-size"
        onClick={() => { setOpen((v) => !v); setConfirming(false); }}
        style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid var(--line)", background: "rgba(255,255,255,0.95)", color: "var(--ink-soft)", fontSize: 16, lineHeight: 1, cursor: "pointer", boxShadow: "0 1px 3px rgba(15,23,42,0.12)" }}>
        ⋯
      </button>
      {open && (
        <div role="menu" style={{ position: "absolute", top: 36, right: 0, zIndex: 20, minWidth: 200, background: "#fff", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "0 8px 24px rgba(15,23,42,0.14)", overflow: "hidden" }}>
          {confirming ? (
            <div style={{ padding: 12 }}>
              <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--ink)", lineHeight: 1.6 }}>このストーリーを削除しますか？元に戻せません。</p>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setConfirming(false)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--line)", background: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>やめる</button>
                <button type="button" onClick={() => { setOpen(false); setConfirming(false); onDelete(); }} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "var(--error)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>削除する</button>
              </div>
            </div>
          ) : (
            <>
              {publicHref && (
                <a role="menuitem" className="sl-menu-item" href={publicHref} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>企業ページで見る ↗</a>
              )}
              {isPublished && (
                <button role="menuitem" type="button" className="sl-menu-item" onClick={() => { setOpen(false); onUnpublish(); }}>下書きに戻す</button>
              )}
              <button role="menuitem" type="button" className="sl-menu-item" style={{ color: "var(--error-ink)" }} onClick={() => setConfirming(true)}>削除</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
