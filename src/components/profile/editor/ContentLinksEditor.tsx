"use client";

import { useState, useEffect, useRef } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { ProfileEditModal } from "./ProfileEditModal";


/**
 * 発信コンテンツの編集（2026-08-17 / フェーズ3 で `ProfileTab` から切り出した）。
 *
 * ⚠️ **`/mypage` 本体と `/mypage/details/content` の両方が使う。**
 *    本体は「追加」だけ、一覧ページは追加・編集・削除。**API の呼び方はここ1箇所。**
 *
 * ⚠️ 他の5セクションのエディタ（`RecordEditors.tsx`）と**同じプロップの形**にしてある。
 *    `openAddNonce` / `openEditId` / `openDeleteId` / `onClosed`。
 *    ここだけ違う形にすると、次に触る人がどちらの流儀か分からなくなる。
 */

/** 発信コンテンツ1件（DB の行）。⚠️ `ProfileTab` から移した（2026-08-17） */
export type ContentLink = {
  id: string;
  url: string;
  platform: string | null;
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  sort_order: number;
};

const PLATFORM_OPTIONS = [
  { value: "youtube",     label: "YouTube" },
  { value: "note",        label: "note" },
  { value: "zenn",        label: "Zenn" },
  { value: "speakerdeck", label: "Speaker Deck" },
  { value: "podcast",     label: "Podcast" },
  { value: "github",      label: "GitHub" },
  { value: "other",       label: "その他（Web記事など）" },
] as const;

function detectPlatform(url: string): string {
  if (/youtube\.com|youtu\.be/.test(url)) return "youtube";
  if (/note\.com/.test(url)) return "note";
  if (/zenn\.dev/.test(url)) return "zenn";
  if (/speakerdeck\.com/.test(url)) return "speakerdeck";
  if (/anchor\.fm|spotify\.com\/show|podcasts\.apple\.com/.test(url)) return "podcast";
  if (/github\.com/.test(url)) return "github";
  return "other";
}

/** 発信コンテンツの入力値。追加と編集で同じ形を使う */
type LinkDraft = {
  url: string;
  platform: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
};

const EMPTY_LINK_DRAFT: LinkDraft = {
  url: "", platform: "other", title: "", description: "", thumbnail_url: null,
};

const draftFromLink = (l: ContentLink): LinkDraft => ({
  url: l.url,
  platform: l.platform ?? "other",
  title: l.title ?? "",
  description: l.description ?? "",
  thumbnail_url: l.thumbnail_url,
});

/**
 * 発信コンテンツの入力フォーム。**追加と編集で同じものを使う**（2026-08-16）。
 *
 * ⚠️ 編集用のフォームを別に作らない。項目・検証・OGP 取得が2箇所に割れると、
 *    片方だけ直る形の不具合が生まれる（週次メールの配信停止で実際に起きた形）。
 *
 * ⚠️ ★初期値は呼び出し側が渡す `initial` から取る。**閉じるとアンマウントされる**ので、
 *    `initial` には必ず**保存済みの行**（親の `contentLinks`）を渡すこと。
 *    SSR 時点のプロップを渡すと、保存した値が開き直しで消える
 *    （`.claude/rules/ui-debugging.md` ⑦）。
 */
function ContentLinkForm({ initial, onDraftChange }: {
  initial: LinkDraft;
  /** ★入力を親へ返す。**保存はモーダルのフッターがする**ので、これが無いと何も届かない */
  onDraftChange: (d: LinkDraft) => void;
}) {
  const [draft, setDraft] = useState<LinkDraft>(initial);
  const [ogpFetching, setOgpFetching] = useState(false);
  const [ogpFetched, setOgpFetched] = useState(false);

  const set = <K extends keyof LinkDraft>(k: K, v: LinkDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  /* ⚠️ ref に逃がす。依存に入れると下の effect が毎回動く */
  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;
  /* ★入力を親へ返す（2026-08-17）。モーダルのフッターが保存するために要る。
        ⚠️ **effect で返すこと。** `setDraft` の更新関数の中で親の state を触ると、
           別のコンポーネントを描画中に更新することになり React が警告を出す。
        ⚠️ **`draft` を見ること。** 個々の `set` に足すと、`setDraft` を直に呼んでいる
           URL 欄と OGP 取得の2箇所が漏れる（実際に漏れていた）。 */
  useEffect(() => { onDraftChangeRef.current?.(draft); }, [draft]);

  /* URL を離れたときに OGP を取りに行く。★埋まっている項目は上書きしない
     （編集で開いたときに、本人が書いたタイトルを消さないため） */
  const handleUrlBlur = async () => {
    const url = draft.url.trim();
    if (!url) return;
    try { new URL(url); } catch { return; }
    setOgpFetching(true);
    setOgpFetched(false);
    try {
      const res = await fetch(`/api/jobseeker/content-links/ogp?url=${encodeURIComponent(url)}`);
      if (!res.ok) return;
      const data: { title: string | null; thumbnail_url: string | null; description: string | null } = await res.json();
      setDraft((d) => ({
        ...d,
        title: data.title && !d.title.trim() ? data.title : d.title,
        description: data.description && !d.description.trim() ? data.description.slice(0, 200) : d.description,
        thumbnail_url: data.thumbnail_url ?? d.thumbnail_url,
      }));
      if (data.title || data.thumbnail_url) setOgpFetched(true);
    } catch {
      // サイレントフェイル（OGP は補助。取れなくても入力は続けられる）
    } finally {
      setOgpFetching(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", display: "block", marginBottom: 4 }}>URL *</label>
          <input
            type="url"
            value={draft.url}
            onChange={(e) => {
              const v = e.target.value;
              setOgpFetched(false);
              setDraft((d) => ({ ...d, url: v, platform: v.trim() ? detectPlatform(v.trim()) : d.platform }));
            }}
            onBlur={() => { void handleUrlBlur(); }}
            placeholder="https://note.com/..."
            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
          />
          {ogpFetching && (
            <p style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", margin: "4px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ display: "inline-block", width: 10, height: 10, border: "2px solid var(--ink-mute)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              ページ情報を取得中...
            </p>
          )}
          {ogpFetched && !ogpFetching && (
            <p style={{ fontSize: 12, fontWeight: 500, color: "var(--success-ink)", margin: "4px 0 0" }}>✓ タイトル・サムネイルを自動取得しました</p>
          )}
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", display: "block", marginBottom: 4 }}>プラットフォーム（URL入力で自動判定）</label>
          <select
            value={draft.platform}
            onChange={(e) => set("platform", e.target.value)}
            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", background: "#fff", cursor: "pointer" }}
          >
            {PLATFORM_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", display: "block", marginBottom: 4 }}>タイトル（任意）</label>
          <input
            type="text"
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="例：SaaS営業で学んだこと"
            maxLength={200}
            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", display: "block", marginBottom: 4 }}>説明（任意）</label>
          <input
            type="text"
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="一言コメント"
            maxLength={500}
            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
          />
        </div>

      </div>
    </div>
  );
}

export function ContentLinksEditor({
  contentLinks, setContentLinks, openAddNonce, openEditId, openDeleteId, onClosed,
}: {
  contentLinks: ContentLink[];
  setContentLinks: React.Dispatch<React.SetStateAction<ContentLink[]>>;
  /** 見出しの「追加」から開く合図。⚠️ 値が変わったときだけ開く（ルール⑭） */
  openAddNonce?: number;
  /** 行の鉛筆から開く行の id */
  openEditId?: string | null;
  /** 行のゴミ箱から削除確認を開く行の id */
  openDeleteId?: string | null;
  /** 閉じたことを親へ知らせる。★親はこれで id を null に戻す */
  onClosed?: () => void;
}) {
  const [adding, setAdding] = useState(false);
  /** 行編集の対象。★常に1つ。別の行の鉛筆を押すと前の行は閉じる（差し替わるだけ） */
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  /** 追加フォームを初期化するための鍵。追加が成功したら +1 して作り直す */
  const [addFormNonce, setAddFormNonce] = useState(0);
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  /* ★モーダルのフッターが保存するための控え（2026-08-17）。フォームから流れてくる。
        ⚠️ 差分の基準は**開いた直後に控えた値ではなく、いま保存されている行**にする。
           控える形にすると、フォームが自分で初期値を整えた（URL から platform を決める等）
           ぶんまで「変更あり」になる。 */
  const [contentDraft, setContentDraft] = useState<LinkDraft | null>(null);

  /* ⚠️ `linkSaving` / `linkError` を追加と編集で共有している。
        **同時に出るフォームは常に1つ**（モーダルなので必ず1つ）なので取り違えは起きない。
        モードを切り替えるときにエラーを消すこと。 */

  const handleAddContentLink = async (draft: LinkDraft) => {
    const url = draft.url.trim();
    if (!url) { setLinkError("URLを入力してください"); return; }
    setLinkSaving(true); setLinkError(null);
    try {
      const res = await fetch("/api/jobseeker/content-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          platform: draft.platform,
          title: draft.title.trim() || null,
          description: draft.description.trim() || null,
          thumbnail_url: draft.thumbnail_url || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setLinkError(err.message ?? "保存に失敗しました");
        return;
      }
      const inserted: ContentLink = await res.json();
      setContentLinks((prev) => [...prev, inserted]);
      setAddFormNonce((n) => n + 1); // 入力欄を空に戻す（フォームを作り直す）
      return true;
    } catch {
      setLinkError("通信エラーが発生しました");
    } finally {
      setLinkSaving(false);
    }
  };

  /* ⚠️ 保存後は**API の戻り値で該当行を置き換える**。手元の draft で置き換えない
        （サーバー側の正規化（trim・切り詰め・null 化）が反映されなくなる）。 */
  const handleUpdateContentLink = async (id: string, draft: LinkDraft) => {
    const url = draft.url.trim();
    if (!url) { setLinkError("URLを入力してください"); return; }
    setLinkSaving(true); setLinkError(null);
    try {
      const res = await fetch(`/api/jobseeker/content-links/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          platform: draft.platform,
          title: draft.title.trim() || null,
          description: draft.description.trim() || null,
          thumbnail_url: draft.thumbnail_url || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setLinkError(err.message ?? "保存に失敗しました");
        return; // ★失敗時は編集モードのまま（入力を捨てない）
      }
      const updated: ContentLink = await res.json();
      setContentLinks((prev) => prev.map((l) => (l.id === id ? updated : l)));
      setEditingLinkId(null);
      return true;
      /* ★行の編集は保存したら**カードごと表示モードに戻す**（2026-08-16）。
            戻さないと「新しいコンテンツを追加」のフォームが出たままになり、
            直したはずの行が画面から消えたように見える（実測で確認）。
         ⚠️ 追加のときは閉じない（続けて足せるように。出口は「完了」）。 */
    } catch {
      setLinkError("通信エラーが発生しました");
    } finally {
      setLinkSaving(false);
    }
  };

  const handleDeleteContentLink = async (id: string) => {
    if (editingLinkId === id) setEditingLinkId(null);
    setContentLinks((prev) => prev.filter((l) => l.id !== id));
    await fetch(`/api/jobseeker/content-links/${id}`, { method: "DELETE" });
  };

  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;

  /* ⚠️ nonce は値が変わったときだけ発火させる（ルール⑭）。ref の初期値は現在値 */
  const lastAddNonce = useRef(openAddNonce);
  useEffect(() => {
    if (openAddNonce === undefined || openAddNonce === lastAddNonce.current) return;
    lastAddNonce.current = openAddNonce;
    setLinkError(null);
    setEditingLinkId(null);
    setAdding(true);
  }, [openAddNonce]);

  /* 外から行の編集を開く。⚠️ 閉じるのは null を渡すのではなく `onClosed` */
  useEffect(() => {
    if (!openEditId) return;
    setLinkError(null);
    setEditingLinkId(openEditId);
  }, [openEditId]);

  const [deleteTarget, setDeleteTarget] = useState<ContentLink | null>(null);
  useEffect(() => {
    if (!openDeleteId) return;
    const t = contentLinks.find((l) => l.id === openDeleteId);
    if (t) setDeleteTarget(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDeleteId]);

  const close = () => {
    setAdding(false);
    setEditingLinkId(null);
    setContentDraft(null);
    setLinkError(null);
    onClosedRef.current?.();
  };

  /* 差分の基準は**いま保存されている行**（ルール⑦） */
  const base = editingLinkId ? contentLinks.find((l) => l.id === editingLinkId) : undefined;
  const initial = base ? draftFromLink(base) : EMPTY_LINK_DRAFT;
  /* ⚠️ URL が空のあいだは押させない（インライン時代の disabled と同じ意味） */
  const dirty = !!contentDraft
    && !!contentDraft.url.trim()
    && JSON.stringify(contentDraft) !== JSON.stringify(initial);

  return (
    <>
      <ProfileEditModal
        open={adding || editingLinkId !== null}
        title={editingLinkId ? "発信コンテンツを編集" : "発信コンテンツを追加"}
        dirty={dirty}
        saving={linkSaving}
        justSaved={false}
        error={linkError}
        onSave={() => {
          if (!contentDraft) return;
          void (async () => {
            const ok = editingLinkId
              ? await handleUpdateContentLink(editingLinkId, contentDraft)
              : await handleAddContentLink(contentDraft);
            if (ok) close();
          })();
        }}
        onClose={close}
      >
        <ContentLinkForm
          key={base ? base.id : `add-${addFormNonce}`}
          initial={initial}
          onDraftChange={setContentDraft}
        />
      </ProfileEditModal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="発信コンテンツを削除しますか？"
        message={deleteTarget ? `「${deleteTarget.title || deleteTarget.url}」を削除します。この操作は取り消せません。` : ""}
        confirmLabel="削除する"
        confirmVariant="danger"
        onConfirm={() => {
          if (!deleteTarget) return;
          void handleDeleteContentLink(deleteTarget.id);
          setDeleteTarget(null);
          onClosedRef.current?.();
        }}
        onCancel={() => { setDeleteTarget(null); onClosedRef.current?.(); }}
      />
    </>
  );
}
