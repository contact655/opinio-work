"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarkdownEditor } from "@/components/business/MarkdownEditor";
import { CompanyStoryCard } from "@/components/companies/CompanyStoryCard";
import { useBizShell } from "@/components/business/BizShellContext";
import { checkWording, wordingMessage } from "@/lib/jobs/wordingCheck";
import {
  STORY_CATEGORIES, STORY_COVER_MAX_BYTES, STORY_COVER_MIMES, DEFAULT_STORY_CATEGORY,
  canReplaceWithTemplate, storyPublishProblems, storyTemplate,
} from "@/lib/companyStories/shared";
import type { StoryFields, StoryWithDraft } from "@/lib/companyStories/server";
import {
  saveStoryAction, publishStoryAction, discardStoryChangesAction, storyCoverUploadUrlAction,
} from "./_actions/stories";

/**
 * ★企業ストーリーの編集画面（2026-10-12 / 柴さんの指示）。
 *
 *   1280px 以上 … 左が入力（種類・タイトル・表紙写真・本文）、右が企業ページでの見え方
 *   1279px 以下 … 「編集／プレビュー」の切り替え
 *
 * ⚠️★プレビューは企業ページと**同じ部品**（CompanyStoryCard）。見た目を片方だけ変えないこと。
 * ⚠️ 自動で保存する（入力が止まって約1秒後）。置き場所はサーバーが決める
 *    （下書きなら本体・公開中なら「未公開の変更」。lib/companyStories/server.ts）。
 * ⚠️ 公開は上部のボタンだけ。公開のときに求人と同じ禁止表現の確認（wordingCheck）を通す。
 *    入力中も同じ関数で確かめて黄色で知らせる（止めるのはサーバー）。
 */

type Status =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; at: string }
  | { kind: "published"; at: string }
  | { kind: "error"; message: string };

const keyOf = (f: StoryFields) => JSON.stringify([f.title, f.body, f.category, f.coverImageUrl ?? null]);

function fieldsOf(s: StoryWithDraft | null): StoryFields {
  if (!s) return { title: "", body: storyTemplate(DEFAULT_STORY_CATEGORY), category: DEFAULT_STORY_CATEGORY, coverImageUrl: null };
  const src = s.draft ?? s;
  return { title: src.title, body: src.body, category: src.category, coverImageUrl: src.coverImageUrl };
}

/**
 * ⚠️ Server Action は通信の失敗・サーバーの 500 で**例外を投げるか undefined を返す**。
 *    そのまま `.ok` を読むと画面が「保存中…」のまま止まる（2026-10-12 に踏んだ）。必ずここを通す。
 */
async function call<T>(fn: () => Promise<{ ok: true; value: T } | { ok: false; error: string; wording?: string[] }>) {
  try {
    const r = await fn();
    return r ?? { ok: false as const, error: "通信に失敗しました。もう一度お試しください。" };
  } catch {
    return { ok: false as const, error: "通信に失敗しました。もう一度お試しください。" };
  }
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });

function putFile(url: string, file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.send(file);
  });
}

export function StoryEditor({ initial }: { initial: StoryWithDraft | null }) {
  const shell = useBizShell();
  const [story, setStory] = useState<StoryWithDraft | null>(initial);
  const [fields, setFields] = useState<StoryFields>(() => fieldsOf(initial));
  const [hasDraft, setHasDraft] = useState(!!initial?.draft);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<{ message: string; wording?: string[] } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);

  const idRef = useRef<string | null>(initial?.id ?? null);
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  /* ⚠️ 保存済みの内容（これと同じなら保存しない）。最初に開いた時点の値で始める */
  const savedKeyRef = useRef(keyOf(fieldsOf(initial)));
  const chainRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  /* ⚠️ 別のストーリーがサーバーから渡されたら（戻る・進むで移ったとき）、入力中の状態を入れ替える。
        自分で作った直後（/new → /<id>）は同じ id なので何もしない。page.tsx の key の注記を参照 */
  useEffect(() => {
    if (!initial || initial.id === idRef.current) return;
    idRef.current = initial.id;
    const f = fieldsOf(initial);
    savedKeyRef.current = keyOf(f);
    setStory(initial);
    setFields(f);
    setHasDraft(!!initial.draft);
    setStatus({ kind: "idle" });
    setPublishError(null);
  }, [initial]);

  const isPublished = story?.isPublished === true;
  /* 新しいストーリーは、何か書くまで作らない（ひな形のままで行を作らない） */
  const meaningful = (f: StoryFields) => !!f.title.trim() || !canReplaceWithTemplate(f.body) || !!f.coverImageUrl;

  const save = useCallback((): Promise<boolean> => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    chainRef.current = chainRef.current.then(async () => {
      const f = fieldsRef.current;
      const k = keyOf(f);
      if (k === savedKeyRef.current) return true;
      if (!idRef.current && !meaningful(f)) return true;
      setStatus({ kind: "saving" });
      const r = await call(() => saveStoryAction(idRef.current, f));
      if (!r.ok) { setStatus({ kind: "error", message: r.error }); return false; }
      if (!idRef.current) {
        idRef.current = r.value.id;
        /* ⚠️ router.replace にしない（ページが作り直され、入力中の内容が消える） */
        window.history.replaceState(null, "", `/biz/posts/${r.value.id}`);
      }
      savedKeyRef.current = k;
      setHasDraft(r.value.hasDraft);
      setStatus(keyOf(fieldsRef.current) === k ? { kind: "saved", at: r.value.savedAt } : { kind: "dirty" });
      return true;
    });
    return chainRef.current;
  }, []);

  useEffect(() => {
    if (keyOf(fields) === savedKeyRef.current) return;
    if (!idRef.current && !meaningful(fields)) return;
    setStatus((s) => (s.kind === "saving" ? s : { kind: "dirty" }));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void save(); }, 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [fields, save]);

  /* 保存前に閉じようとしたら止める */
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (keyOf(fieldsRef.current) !== savedKeyRef.current && (idRef.current || meaningful(fieldsRef.current))) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);

  const set = <K extends keyof StoryFields>(k: K, v: StoryFields[K]) => {
    setPublishError(null);
    setFields((f) => ({ ...f, [k]: v }));
  };

  /* ★種類を選ぶと、本文が空（またはひな形のまま）のときだけひな形を入れる */
  const changeCategory = (c: string) => {
    setPublishError(null);
    setFields((f) => ({ ...f, category: c, body: canReplaceWithTemplate(f.body) ? storyTemplate(c) : f.body }));
  };

  const wording = useMemo(
    () => checkWording([{ field: "タイトル", text: fields.title }, { field: "本文", text: fields.body }]).map(wordingMessage),
    [fields.title, fields.body],
  );
  const problems = storyPublishProblems(fields);
  const dirty = keyOf(fields) !== savedKeyRef.current;
  const canPublish = problems.length === 0 && wording.length === 0 && !publishing && (!isPublished || hasDraft || dirty);

  const publish = async () => {
    setPublishError(null);
    setPublishing(true);
    try {
      if (!(await save())) return;
      const id = idRef.current;
      if (!id) { setPublishError({ message: problems.join(" ") || "先に内容を書いてください。" }); return; }
      const r = await call(() => publishStoryAction(id));
      if (!r.ok) { setPublishError({ message: r.error, wording: r.wording }); return; }
      setStory(r.value);
      const f = fieldsOf(r.value);
      savedKeyRef.current = keyOf(f);
      setFields(f);
      setHasDraft(false);
      setStatus({ kind: "published", at: new Date().toISOString() });
    } finally {
      setPublishing(false);
    }
  };

  const discard = async () => {
    const id = idRef.current;
    if (!id || !confirm("未公開の変更を取り消して、公開中の内容に戻しますか？")) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    await chainRef.current;
    const r = await call(() => discardStoryChangesAction(id));
    if (!r.ok) { setPublishError({ message: r.error }); return; }
    setStory(r.value);
    const f = fieldsOf(r.value);
    savedKeyRef.current = keyOf(f);
    setFields(f);
    setHasDraft(false);
    setStatus({ kind: "idle" });
  };

  const pickCover = async (file: File | undefined) => {
    setCoverError(null);
    if (!file) return;
    if (!(STORY_COVER_MIMES as readonly string[]).includes(file.type)) { setCoverError("JPG・PNG・WebP の画像を選んでください。"); return; }
    if (file.size > STORY_COVER_MAX_BYTES) { setCoverError("5MB 以内の画像を選んでください。"); return; }
    setUploading(true);
    try {
      const u = await call(() => storyCoverUploadUrlAction(file.type, file.size));
      if (!u.ok) { setCoverError(u.error); return; }
      if (!(await putFile(u.value.signedUrl, file))) { setCoverError("アップロードできませんでした。もう一度お試しください。"); return; }
      set("coverImageUrl", u.value.publicUrl);
    } finally {
      setUploading(false);
    }
  };

  const statusText =
    status.kind === "saving" ? "保存中…"
    : status.kind === "dirty" ? "編集中"
    : status.kind === "error" ? `保存できませんでした：${status.message}`
    : status.kind === "published" ? `公開しました ${hhmm(status.at)}`
    : status.kind === "saved" ? (isPublished ? `変更を保存しました（まだ公開していません）${hhmm(status.at)}` : `下書きを保存しました ${hhmm(status.at)}`)
    : !idRef.current ? "書き始めると自動で保存されます"
    : isPublished && hasDraft ? "未公開の変更があります"
    : "";

  /* ⚠️ 公開ページではなく担当者用のプレビューへ（PostsClient と同じ理由） */
  const publicHref = isPublished && shell.tenantId ? "/preview/company#posts" : null;

  return (
    <div className="se-wrap" data-mode={mode}>
      <style>{`
        .se-top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
        .se-panes { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; align-items: start; }
        .se-preview { position: sticky; top: 16px; }
        .se-toggle { display: none; }
        .se-field { margin-bottom: 18px; }
        .se-label { display: block; font-size: 12px; font-weight: 700; color: var(--ink-soft); margin-bottom: 6px; }
        .se-input { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; font-size: 15px; font-weight: 600; color: var(--ink); font-family: inherit; background: #fff; }
        .se-input:focus { outline: 2px solid var(--royal-100, #c7d4ea); border-color: var(--royal); }
        .se-cats { display: flex; flex-wrap: wrap; gap: 6px; }
        .se-cat { padding: 6px 12px; border-radius: 100px; border: 1px solid var(--line); background: #fff; font-size: 13px; color: var(--ink-soft); cursor: pointer; font-family: inherit; }
        .se-cat[aria-pressed=true] { border-color: var(--royal); color: var(--royal); font-weight: 700; background: var(--royal-50); }
        .se-ghost { padding: 7px 12px; border-radius: 8px; border: 1px solid var(--line); background: #fff; color: var(--ink-soft); font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .se-ghost:disabled { opacity: .5; cursor: default; }
        @media (max-width: 1279px) {
          .se-panes { grid-template-columns: minmax(0, 1fr); }
          .se-toggle { display: inline-flex; }
          .se-wrap[data-mode=edit] .se-preview { display: none; }
          .se-wrap[data-mode=preview] .se-edit { display: none; }
          .se-preview { position: static; }
        }
      `}</style>

      {/* ── 上部: 戻る・状態・公開 ── */}
      <div className="se-top">
        <Link href="/biz/posts" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)", textDecoration: "none" }}>← ストーリー一覧</Link>
        <span data-state={isPublished ? "published" : "draft"} style={{ fontSize: 13, color: "var(--ink-mute)" }}>
          {isPublished ? "公開中" : "下書き"}
        </span>
        <span data-state={`save-${status.kind}`} role="status" style={{ fontSize: 12, color: status.kind === "error" ? "var(--error-ink)" : "var(--ink-mute)", minWidth: 0 }}>
          {statusText}
        </span>
        <div style={{ flex: 1 }} />
        <div className="se-toggle" role="tablist" aria-label="表示の切り替え" style={{ border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
          {(["edit", "preview"] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} data-state={mode === m ? "active" : "inactive"} onClick={() => setMode(m)}
              style={{ padding: "7px 14px", border: "none", background: mode === m ? "var(--royal-50)" : "#fff", color: mode === m ? "var(--royal)" : "var(--ink-soft)", fontWeight: mode === m ? 700 : 500, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              {m === "edit" ? "編集" : "プレビュー"}
            </button>
          ))}
        </div>
        {publicHref && (
          <a href={publicHref} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: "var(--royal)", textDecoration: "none" }}>企業ページで見る ↗</a>
        )}
        {isPublished && hasDraft && (
          <button type="button" className="se-ghost" onClick={discard} disabled={publishing}>変更を取り消す</button>
        )}
        <button
          type="button"
          data-state="publish"
          onClick={publish}
          disabled={!canPublish}
          title={problems.length ? problems.join(" ") : wording.length ? "公開できない表現があります" : undefined}
          style={{
            padding: "9px 20px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
            background: canPublish ? "var(--royal)" : "var(--line)", color: canPublish ? "#fff" : "var(--ink-mute)",
            cursor: canPublish ? "pointer" : "default",
          }}
        >
          {publishing ? "公開しています…" : isPublished ? "変更を公開する" : "公開する"}
        </button>
      </div>

      {(publishError || wording.length > 0) && (
        <div role="alert" style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "var(--warm-soft)", border: "1px solid var(--warm)", fontSize: 13, color: "var(--warm-ink)", lineHeight: 1.7 }}>
          {publishError && <div style={{ fontWeight: 700 }}>{publishError.message}</div>}
          {(publishError?.wording ?? wording).map((w) => <div key={w}>{w}</div>)}
        </div>
      )}

      {!shell.hasPublicPage && (
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--ink-mute)" }}>
          企業ページがまだ公開されていないため、公開しても求職者にはまだ表示されません。
        </p>
      )}

      <div className="se-panes">
        {/* ── 左: 入力 ── */}
        <div className="se-edit" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: 20, minWidth: 0 }}>
          <div className="se-field">
            <span className="se-label" id="se-cat-label">種類</span>
            <div className="se-cats" role="group" aria-labelledby="se-cat-label">
              {STORY_CATEGORIES.map((c) => (
                <button key={c.value} type="button" className="se-cat" aria-pressed={fields.category === c.value} onClick={() => changeCategory(c.value)}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="se-field">
            <label className="se-label" htmlFor="se-title">タイトル</label>
            <input id="se-title" className="se-input" value={fields.title} maxLength={200}
              placeholder="例: 入社1年目のエンジニアに聞いた、最初の3か月"
              onChange={(e) => set("title", e.target.value)} />
          </div>

          <div className="se-field">
            <span className="se-label">表紙写真（任意）</span>
            {fields.coverImageUrl ? (
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fields.coverImageUrl} alt="" style={{ width: 160, height: 90, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }} />
                <button type="button" className="se-ghost" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? "アップロード中…" : "写真を変える"}</button>
                <button type="button" className="se-ghost" disabled={uploading} onClick={() => set("coverImageUrl", null)}>外す</button>
              </div>
            ) : (
              <button type="button" className="se-ghost" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? "アップロード中…" : "写真を選ぶ"}
              </button>
            )}
            <input ref={fileRef} type="file" accept={STORY_COVER_MIMES.join(",")} hidden
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void pickCover(f); }} />
            <p style={{ margin: "6px 0 0", fontSize: 12, color: coverError ? "var(--error-ink)" : "var(--ink-mute)" }}>
              {coverError ?? "JPG・PNG・WebP、5MB まで。横長の写真が合います。"}
            </p>
          </div>

          <div className="se-field" style={{ marginBottom: 0 }}>
            <span className="se-label">本文</span>
            <MarkdownEditor value={fields.body} onChange={(v) => set("body", v)} minHeight={360}
              placeholder="社員の声、チームの雰囲気、プロダクトの話など、求人票には書ききれない会社の中身を書いてください。" />
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--ink-mute)" }}>
              {fields.body.trim().length.toLocaleString("ja-JP")}字。上のボタンで見出し・太字・箇条書き・リンクを付けられます。
            </p>
          </div>
        </div>

        {/* ── 右: 企業ページでの見え方 ── */}
        <div className="se-preview" style={{ minWidth: 0 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "var(--ink-soft)" }}>企業ページでの見え方</p>
          <div data-state="story-preview" style={{ background: "var(--bg-tint)", border: "1px solid var(--line)", borderRadius: 12, padding: 16 }}>
            <CompanyStoryCard
              title={fields.title.trim() || "（タイトル）"}
              body={fields.body}
              category={fields.category}
              coverImageUrl={fields.coverImageUrl}
              publishedAt={isPublished ? story?.publishedAt ?? null : new Date().toISOString()}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
