"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
/* ⚠️ `import type` だけにすること。server.ts は admin クライアントを使うので、
      値を import するとバンドルに混ざる。 */
import type { MaterialDocument, MaterialItem } from "@/lib/companyMaterials/server";
import {
  MATERIAL_CATEGORIES,
  MATERIAL_CATEGORY_LABELS,
  MATERIAL_DOCUMENT_STATUS_LABELS,
  MATERIAL_FILE_ACCEPT,
  MATERIAL_FILE_TYPES,
  MATERIAL_TITLE_MAX,
  MATERIAL_VISIBILITIES,
  MATERIAL_VISIBILITY_AUDIENCE,
  MATERIAL_VISIBILITY_LABELS,
  MAX_MATERIAL_FILE_BYTES,
  MATERIAL_CONTENT_MAX,
  type MaterialCategory,
  type MaterialVisibility,
} from "@/lib/constants/companyMaterials";
import { parseMaterialUrlLines } from "@/lib/companyMaterials/links";
import { DRIVE_PICKER_ENABLED, openDrivePicker } from "@/lib/companyMaterials/drivePicker";
import { MaterialKindIcon, materialKindOf } from "./MaterialKindIcon";

type Props = {
  documents: MaterialDocument[];
  items: MaterialItem[];
  loadFailed: boolean;
  /** 管理者権限か。⚠️ 画面で隠すだけでなく API も断る（resolveMaterialsActor） */
  canEdit: boolean;
  /** ★Google ドライブから選ぶ（連携。2026-10-12 / integrations.manage。管理者だけ） */
  canUseDrive?: boolean;
};

const card: React.CSSProperties = {
  background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "18px 20px", marginBottom: 16,
};
const btn: React.CSSProperties = {
  height: 32, padding: "0 12px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff",
  /* ⚠️ cursor をここ（インライン）に書かないこと。インラインが CSS の `:disabled` に勝ち、
        押せないボタンも指の形になっていた（2026-10-09）。cursor は下の style 要素で決める。 */
  fontSize: 12.5, fontWeight: 600, color: "var(--ink)", fontFamily: "inherit",
};
const primaryBtn: React.CSSProperties = { ...btn, background: "var(--royal)", color: "#fff", border: "none" };
const input: React.CSSProperties = {
  width: "100%", padding: "8px 10px", border: "1.5px solid var(--line)", borderRadius: 8,
  fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", background: "#fff",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
}
function formatBytes(n: number | null) {
  if (n == null) return "";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

export default function MaterialsClient({ documents, items, loadFailed, canEdit, canUseDrive = false }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function call(url: string, init: RequestInit, done?: string): Promise<boolean> {
    setBusy(true); setError(null); setNotice(null);
    try {
      const res = await fetch(url, init);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "保存できませんでした。"); return false; }
      if (done) setNotice(done);
      router.refresh();
      return true;
    } catch {
      setError("通信に失敗しました。時間をおいて再度お試しください。");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const unconfirmed = items.filter((i) => !i.confirmedAt && !i.restrictedFlag);
  const restricted = items.filter((i) => i.restrictedFlag);
  const confirmedByVis = useMemo(() => {
    const m: Record<MaterialVisibility, MaterialItem[]> = { public: [], after_mutual: [], internal: [] };
    for (const i of items) if (i.confirmedAt && !i.restrictedFlag) m[i.visibility].push(i);
    return m;
  }, [items]);
  /* ⚠️ 未確定の件数は restricted も含めて数える（ホームの「やること」と同じ数え方） */
  const unconfirmedCount = items.filter((i) => !i.confirmedAt).length;
  const docTitle = (id: string | null) => documents.find((d) => d.id === id)?.title ?? null;

  /* ★余白は BusinessLayout の本文（main）が持つ（2026-10-20）。ここでも足していたので、PC は左右68px・スマホは32pxと他の画面の倍になっていた */
  return (
    <div className="mat-root" style={{ maxWidth: 1040, margin: "0 auto" }}>
      {/* ★押せない間は薄くする。⚠️ インラインの背景色だけだと、0件選択中の「確定」が
             押せそうな濃紺のまま見えた（2026-10-09 に実画面で確認）。
          ⚠️ ui-conventions: style 要素の中で子孫セレクタの「>」と引用符を使わない */}
      <style>{`
        .mat-root button { cursor: pointer; }
        .mat-root button:disabled { opacity: 0.45; cursor: not-allowed; }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>企業資料</h1>
        {/* ★未確定の件数は常に出す（0件でも出す。消えると「片付いた」のか「壊れた」のか分からない） */}
        <span data-state={unconfirmedCount > 0 ? "has-unconfirmed" : "all-confirmed"} style={{
          fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 100,
          background: unconfirmedCount > 0 ? "var(--warm-soft)" : "var(--bg-tint)",
          border: `1px solid ${unconfirmedCount > 0 ? "#FDE68A" : "var(--line)"}`,
          color: unconfirmedCount > 0 ? "var(--warm-ink)" : "var(--ink-soft)",
        }}>
          未確定 {unconfirmedCount}件
        </span>
      </div>
      <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8 }}>
        資料を登録し、伝えたい内容を項目として入れて、項目ごとに公開範囲を決めて確定します。
        確定するまでは<strong style={{ color: "var(--ink)" }}>どの項目も求職者には表示されません</strong>。
      </p>

      {loadFailed && (
        <div role="alert" style={{ ...card, borderColor: "#FECACA", background: "var(--error-soft)", color: "var(--error-ink)", fontSize: 13 }}>
          資料を読み込めませんでした（0件という意味ではありません）。時間をおいて再度お試しください。
        </div>
      )}
      {error && <div role="alert" style={{ ...card, borderColor: "#FECACA", background: "var(--error-soft)", color: "var(--error-ink)", fontSize: 13 }}>{error}</div>}
      {notice && <div role="status" style={{ ...card, background: "var(--bg-tint)", fontSize: 13, color: "var(--ink-soft)" }}>{notice}</div>}
      {!canEdit && (
        <div style={{ ...card, background: "var(--bg-tint)", fontSize: 13, color: "var(--ink-soft)" }}>
          閲覧のみの権限です。登録・編集・確定は管理者・採用担当が行えます。
        </div>
      )}

      {canEdit && (
        <RegisterDocument busy={busy} canUseDrive={canUseDrive}
          existingUrls={documents.map((d) => d.sourceUrl).filter((u): u is string => !!u)}
          onDone={() => router.refresh()} />
      )}
      <DocumentList documents={documents} canEdit={canEdit} busy={busy} call={call} setError={setError} />
      {canEdit && <AddItem documents={documents} busy={busy} call={call} />}

      <UnconfirmedItems items={unconfirmed} canEdit={canEdit} busy={busy} call={call} docTitle={docTitle} />

      {/* ★確定した項目が1件も無いときは、空の3区分（「まだありません」×3）を並べず1枚にまとめる（2026-10-18） */}
      {MATERIAL_VISIBILITIES.every((v) => confirmedByVis[v].length === 0) ? (
        <section style={card} aria-label="確定済みの項目" data-state="confirmed-empty">
          <h2 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700 }}>確定済みの項目（0件）</h2>
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--ink-mute)", lineHeight: 1.7 }}>確定すると、選んだ公開範囲に応じてここに並びます。</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.8 }}>
            {MATERIAL_VISIBILITIES.map((v) => (
              <li key={v}><strong style={{ color: "var(--ink-soft)" }}>{MATERIAL_VISIBILITY_LABELS[v]}</strong>：{MATERIAL_VISIBILITY_AUDIENCE[v]}</li>
            ))}
          </ul>
        </section>
      ) : MATERIAL_VISIBILITIES.map((v) => (
        <ConfirmedGroup key={v} visibility={v} items={confirmedByVis[v]} canEdit={canEdit} busy={busy} call={call} docTitle={docTitle} />
      ))}

      {restricted.length > 0 && (
        <section style={{ ...card, borderColor: "#FECACA" }} aria-label="選考に使ってはいけない内容">
          <h2 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "var(--error-ink)" }}>
            ⚠️ 選考に使ってはいけない内容（{restricted.length}件）
          </h2>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.8 }}>
            印の付いた項目は、<strong style={{ color: "var(--ink)" }}>マッチングにも企業ページにも使われません</strong>。
            年齢・性別・本籍や出身地・家族構成・宗教・支持政党・思想・容姿・健康状態など、
            公正な採用選考で扱ってはいけない事項が対象です。
          </p>
          {restricted.map((i) => (
            <ItemRow key={i.id} item={i} canEdit={canEdit} busy={busy} call={call} docTitle={docTitle} />
          ))}
        </section>
      )}
    </div>
  );
}

type CallFn = (url: string, init: RequestInit, done?: string) => Promise<boolean>;

// ── 資料の登録 ────────────────────────────────────────────────────────────────

type QueueItem = {
  key: string;
  file: File;
  state: "waiting" | "uploading" | "saving" | "done" | "error";
  /** 0〜100（アップロード中だけ） */
  pct: number;
  error?: string;
};

/** ブラウザで先に弾く（担保はサーバーとバケット）。合えば null */
function precheckFile(f: File): string | null {
  if (f.size <= 0) return "空のファイルは登録できません";
  if (f.size > MAX_MATERIAL_FILE_BYTES) return "10MBを超えています";
  const ext = (f.name.match(/\.([A-Za-z0-9]+)$/)?.[1] ?? "").toLowerCase();
  if (!MATERIAL_FILE_TYPES[ext]) return "この種類は登録できません（PDF / Word / PowerPoint / テキスト）";
  return null;
}

/** 署名つきの書き込み URL へ直接 PUT する。進み具合を返す */
function putWithProgress(url: string, file: File, mime: string, onPct: (n: number) => void): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", mime);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onPct(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.send(file);
  });
}

/**
 * ★資料の登録（2026-10-12 / 柴さんの指示で複数まとめて登録に）。
 *   ファイル … 複数選択・ドラッグ＆ドロップ。1件ずつ進み具合を出す（1ファイル10MBまで・種類は今のまま）
 *              ⚠️ ファイルはブラウザから Storage へ直接置く（`/upload-url` → PUT → `/complete`）。
 *                 Vercel の関数は 4.5MB までなので、関数を通すと 10MB が通らない。
 *   URL      … 1行1件。http / https だけ。貼り付けの中の重複と、登録済みの URL は除く（サーバーも 409 で断る）
 */
function RegisterDocument({ busy, existingUrls, onDone, canUseDrive }: { busy: boolean; existingUrls: string[]; onDone: () => void; canUseDrive: boolean }) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const [drag, setDrag] = useState(false);
  const [urlText, setUrlText] = useState("");
  const [urlResult, setUrlResult] = useState<{ ok: number; failed: { url: string; error: string }[] } | null>(null);
  const [urlRunning, setUrlRunning] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const parsed = useMemo(() => parseMaterialUrlLines(urlText, existingUrls), [urlText, existingUrls]);

  function patch(key: string, p: Partial<QueueItem>) {
    setQueue((q) => q.map((x) => (x.key === key ? { ...x, ...p } : x)));
  }

  async function addFiles(list: FileList | File[]) {
    const files = Array.from(list);
    if (files.length === 0) return;
    const items: QueueItem[] = files.map((f, i) => {
      const err = precheckFile(f);
      return { key: `${Date.now()}-${i}-${f.name}`, file: f, state: err ? "error" : "waiting", pct: 0, error: err ?? undefined };
    });
    setQueue((q) => [...q.filter((x) => x.state !== "done"), ...items]);
    setRunning(true);
    /* ⚠️ 1件ずつ順に送る（同時に送ると、遅い回線で全部が途中で止まって見える） */
    let any = false;
    for (const it of items) {
      if (it.state === "error") continue;
      patch(it.key, { state: "uploading", pct: 0 });
      try {
        const prep = await fetch("/api/biz/materials/documents/upload-url", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: it.file.name, size: it.file.size, type: it.file.type }),
        });
        const pj = await prep.json().catch(() => ({}));
        if (!prep.ok) { patch(it.key, { state: "error", error: pj.error ?? "準備できませんでした" }); continue; }
        const put = await putWithProgress(pj.signedUrl, it.file, pj.storedMime, (n) => patch(it.key, { pct: n }));
        if (!put) { patch(it.key, { state: "error", error: "アップロードできませんでした" }); continue; }
        patch(it.key, { state: "saving", pct: 100 });
        const done = await fetch("/api/biz/materials/documents/complete", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: pj.id, path: pj.path, title: it.file.name }),
        });
        const dj = await done.json().catch(() => ({}));
        if (!done.ok) { patch(it.key, { state: "error", error: dj.error ?? "登録できませんでした" }); continue; }
        patch(it.key, { state: "done" });
        any = true;
      } catch {
        patch(it.key, { state: "error", error: "通信に失敗しました" });
      }
    }
    setRunning(false);
    if (any) onDone();
  }

  /* ★Google ドライブから選ぶ（2026-10-12）。中身はコピーせず、名前・種類・リンクだけ保存する */
  const [driveRunning, setDriveRunning] = useState(false);
  const [driveResult, setDriveResult] = useState<string | null>(null);
  async function pickFromDrive() {
    setDriveRunning(true); setDriveResult(null);
    try {
      const files = await openDrivePicker();
      if (files.length === 0) { setDriveRunning(false); return; }
      let ok = 0; const errors: string[] = [];
      for (const f of files) {
        if (existingUrls.includes(f.url)) { errors.push(`「${f.name}」は登録済み`); continue; }
        const res = await fetch("/api/biz/materials/documents", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: f.url, title: f.name, driveMimeType: f.mimeType }),
        });
        const j = await res.json().catch(() => ({}));
        if (res.ok) ok++; else errors.push(`「${f.name}」：${j.error ?? "登録できませんでした"}`);
      }
      setDriveResult(`${ok}件を登録しました。${errors.length ? `（${errors.join("／")}）` : ""}`);
      if (ok > 0) onDone();
    } catch (e) {
      setDriveResult(e instanceof Error ? e.message : "Google ドライブを開けませんでした");
    } finally {
      setDriveRunning(false);
    }
  }

  async function submitUrls() {
    if (parsed.valid.length === 0) return;
    setUrlRunning(true); setUrlResult(null);
    let ok = 0;
    const failed: { url: string; error: string }[] = [];
    for (const url of parsed.valid) {
      try {
        const res = await fetch("/api/biz/materials/documents", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, title: "" }),
        });
        const j = await res.json().catch(() => ({}));
        if (res.ok) ok++; else failed.push({ url, error: j.error ?? "登録できませんでした" });
      } catch {
        failed.push({ url, error: "通信に失敗しました" });
      }
    }
    setUrlRunning(false);
    setUrlResult({ ok, failed });
    /* 登録できたものは欄から消し、失敗したものだけ残す（打ち直さずに済むように） */
    setUrlText(failed.map((f) => f.url).join("\n"));
    if (ok > 0) onDone();
  }

  const stateLabel = (q: QueueItem) =>
    q.state === "waiting" ? "待機中" : q.state === "uploading" ? `${q.pct}%` : q.state === "saving" ? "登録中…" : q.state === "done" ? "登録しました" : q.error ?? "失敗";

  return (
    <section style={card} aria-label="資料を登録する">
      <h2 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700 }}>資料を登録する</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 16 }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>ファイル（PDF / Word / PowerPoint / テキスト・1ファイル10MBまで）</div>
          <div
            data-state={drag ? "drop-active" : "drop-idle"}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); if (!busy && !running) void addFiles(e.dataTransfer.files); }}
            style={{
              border: `1.5px dashed ${drag ? "var(--royal)" : "var(--line)"}`, borderRadius: 10, padding: "18px 14px",
              background: drag ? "var(--royal-50)" : "var(--bg-tint)", textAlign: "center",
            }}
          >
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--ink-soft)" }}>ここにファイルをドラッグ＆ドロップ（複数可）</p>
            <input ref={fileRef} type="file" multiple accept={MATERIAL_FILE_ACCEPT} hidden
              onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ""; }} />
            <button type="button" style={btn} disabled={busy || running} onClick={() => fileRef.current?.click()}>ファイルを選ぶ</button>
          </div>
          {queue.length > 0 && (
            <ul data-state="upload-queue" style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {queue.map((q) => (
                <li key={q.key} data-upload-state={q.state} style={{ fontSize: 12.5, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={q.file.name}>{q.file.name}</span>
                    <span style={{ flexShrink: 0, color: q.state === "error" ? "var(--error-ink)" : "var(--ink-mute)" }}>{stateLabel(q)}</span>
                  </div>
                  {(q.state === "uploading" || q.state === "saving") && (
                    <div style={{ height: 4, borderRadius: 2, background: "var(--line-soft)", marginTop: 3, overflow: "hidden" }}>
                      <div style={{ width: `${q.pct}%`, height: "100%", background: "var(--royal)", transition: "width 0.2s" }} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>URL（1行に1件・http / https）</div>
          <textarea data-state="url-lines" value={urlText} onChange={(e) => { setUrlText(e.target.value); setUrlResult(null); }} rows={5}
            placeholder={"https://docs.google.com/presentation/d/…\nhttps://www.notion.so/…"}
            style={{ ...input, resize: "vertical", lineHeight: 1.6 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
            <button type="button" style={primaryBtn} disabled={busy || urlRunning || parsed.valid.length === 0} onClick={submitUrls} data-state="url-submit">
              {urlRunning ? "登録中…" : `リンクを登録（${parsed.valid.length}件）`}
            </button>
            {(parsed.invalid.length > 0 || parsed.duplicate.length > 0) && (
              <span data-state="url-skipped" style={{ fontSize: 12, color: "var(--ink-mute)" }}>
                {parsed.duplicate.length > 0 && `重複・登録済み ${parsed.duplicate.length}件を除きます`}
                {parsed.duplicate.length > 0 && parsed.invalid.length > 0 && "／"}
                {parsed.invalid.length > 0 && `http / https でない ${parsed.invalid.length}件を除きます`}
              </span>
            )}
          </div>
          {urlResult && (
            <p role="status" style={{ margin: "8px 0 0", fontSize: 12.5, color: urlResult.failed.length ? "var(--error-ink)" : "var(--ink-soft)" }}>
              {urlResult.ok}件を登録しました。
              {urlResult.failed.length > 0 && ` ${urlResult.failed.length}件は登録できませんでした（欄に残しています）：${urlResult.failed[0].error}`}
            </p>
          )}
        </div>
      </div>
      {DRIVE_PICKER_ENABLED && canUseDrive && (
        <div data-state="drive-picker" style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button type="button" style={btn} disabled={busy || driveRunning} onClick={() => void pickFromDrive()}>
            {driveRunning ? "Google ドライブを開いています…" : "Google ドライブから選ぶ"}
          </button>
          <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>ほかの担当者が開けるかどうかは、Google ドライブ側の共有設定によります。</span>
          {driveResult && <span role="status" style={{ fontSize: 12.5, color: "var(--ink-soft)", width: "100%" }}>{driveResult}</span>}
        </div>
      )}
      {/* ⚠️ 中身を読まないことを書いておく（「読み取ってくれる」と思わせない） */}
      <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7 }}>
        登録した資料は、この会社の担当者だけが開けます。資料の中身・リンク先は読み取りません（資料名はファイル名か URL。一覧で変更できます）。
        伝えたい内容は、下の「項目を追加」から入れてください。
      </p>
    </section>
  );
}

// ── 資料一覧 ──────────────────────────────────────────────────────────────────

/**
 * ★資料一覧（2026-10-12）。種類のアイコンと種類名・資料名の変更・ドラッグで並び替え（取っ手を選んで ↑↓ でも）・削除。
 * ⚠️ 並び替えは画面を先に動かし、保存に失敗したら元に戻して理由を出す。
 */
function DocumentList({ documents, canEdit, busy, call, setError }: {
  documents: MaterialDocument[]; canEdit: boolean; busy: boolean; call: CallFn; setError: (s: string | null) => void;
}) {
  const [order, setOrder] = useState<MaterialDocument[]>(documents);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setOrder(documents); }, [documents]);

  async function openFile(id: string) {
    setError(null);
    const res = await fetch(`/api/biz/materials/documents/${id}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.url) { setError(json.error ?? "ファイルを開けませんでした。"); return; }
    window.open(json.url as string, "_blank", "noopener,noreferrer");
  }

  async function saveOrder(next: MaterialDocument[]) {
    const prev = order;
    setOrder(next);
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/biz/materials/documents/order", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: next.map((d) => d.id) }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setOrder(prev); setError(j.error ?? "並び順を保存できませんでした。");
      }
    } catch {
      setOrder(prev); setError("通信に失敗しました。並び順は保存されていません。");
    } finally {
      setSaving(false);
    }
  }

  function moveTo(id: string, index: number) {
    const from = order.findIndex((d) => d.id === id);
    if (from < 0) return;
    const to = Math.max(0, Math.min(index, order.length - 1));
    if (to === from) return;
    const next = [...order];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    void saveOrder(next);
  }

  async function commitRename(d: MaterialDocument) {
    const t = editTitle.trim();
    if (!t || t === d.title) { setEditingId(null); return; }
    if (await call(`/api/biz/materials/documents/${d.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: t }),
    }, "資料名を変更しました。")) setEditingId(null);
  }

  return (
    <section style={card} aria-label="資料一覧">
      <h2 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700 }}>資料一覧（{order.length}件）</h2>
      {order.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>まだ資料はありません。</p>
      ) : (
        <ul data-state="document-list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {order.map((d, i) => {
            const k = materialKindOf(d);
            return (
              <li key={d.id} data-document-id={d.id}
                onDragOver={(e) => { if (dragId && dragId !== d.id) { e.preventDefault(); setOverId(d.id); } }}
                onDragLeave={() => { if (overId === d.id) setOverId(null); }}
                onDrop={(e) => { e.preventDefault(); if (dragId) moveTo(dragId, i); setDragId(null); setOverId(null); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 4px", borderTop: i === 0 ? "none" : "1px solid var(--line-soft)",
                  boxShadow: overId === d.id ? "inset 0 2px 0 var(--royal)" : undefined, opacity: dragId === d.id ? 0.5 : 1,
                }}>
                {canEdit && (
                  <button type="button" className="btn-fixed-size mat-handle" draggable={!saving}
                    data-handle-for={d.id}
                    onDragStart={(e) => { setDragId(d.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", d.id); }}
                    onDragEnd={() => { setDragId(null); setOverId(null); }}
                    onKeyDown={(e) => {
                      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                      e.preventDefault();
                      moveTo(d.id, e.key === "ArrowUp" ? i - 1 : i + 1);
                      setTimeout(() => (document.querySelector(`[data-handle-for="${d.id}"]`) as HTMLElement | null)?.focus(), 0);
                    }}
                    disabled={saving}
                    aria-label={`${d.title} の並び順を変える（↑ ↓ キーで移動、またはドラッグ）`} title="ドラッグで並べ替え（↑ ↓ キーでも動かせます）"
                    style={{ width: 22, height: 30, border: "none", background: "transparent", color: "var(--ink-mute)", cursor: "grab", padding: 0, flexShrink: 0 }}>
                    <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden fill="currentColor">
                      <circle cx="2.5" cy="2.5" r="1.3" /><circle cx="7.5" cy="2.5" r="1.3" /><circle cx="2.5" cy="7" r="1.3" />
                      <circle cx="7.5" cy="7" r="1.3" /><circle cx="2.5" cy="11.5" r="1.3" /><circle cx="7.5" cy="11.5" r="1.3" />
                    </svg>
                  </button>
                )}
                <MaterialKindIcon kind={k.kind} label={k.label} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingId === d.id ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input autoFocus value={editTitle} maxLength={MATERIAL_TITLE_MAX} onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") void commitRename(d); if (e.key === "Escape") setEditingId(null); }}
                        aria-label="資料名" style={{ ...input, padding: "6px 8px" }} />
                      <button type="button" style={primaryBtn} disabled={busy || !editTitle.trim()} onClick={() => void commitRename(d)}>保存</button>
                      <button type="button" style={btn} onClick={() => setEditingId(null)}>やめる</button>
                    </div>
                  ) : (
                    <>
                      {d.sourceType === "url" && d.sourceUrl ? (
                        /* ★外部リンクとして出す。サーバーからは取りに行かない */
                        <a href={d.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--royal)", fontWeight: 600, fontSize: 13, overflowWrap: "anywhere" }}>{d.title}</a>
                      ) : (
                        <button type="button" onClick={() => openFile(d.id)} style={{ background: "none", border: "none", padding: 0, color: "var(--royal)", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: 13, textAlign: "left", overflowWrap: "anywhere" }}>{d.title}</button>
                      )}
                      <div style={{ fontSize: 11.5, color: "var(--ink-mute)", marginTop: 2 }} data-state="document-kind">
                        {k.label}
                        {d.sourceType === "file" && d.byteSize != null && `・${formatBytes(d.byteSize)}`}
                        {`・${formatDate(d.createdAt)}`}
                        {d.itemCount > 0 && `・項目 ${d.itemCount}件`}
                        {d.status !== "uploaded" && `・${MATERIAL_DOCUMENT_STATUS_LABELS[d.status]}`}
                        {d.status === "failed" && d.errorMessage && <span style={{ color: "var(--error-ink)" }}>（{d.errorMessage}）</span>}
                      </div>
                    </>
                  )}
                </div>
                {canEdit && editingId !== d.id && (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button type="button" style={btn} disabled={busy} onClick={() => { setEditingId(d.id); setEditTitle(d.title); }}>名前を変更</button>
                    <button type="button" style={btn} disabled={busy} onClick={() => {
                      if (!confirm(`「${d.title}」を削除します。この資料から作った項目は残ります。`)) return;
                      void call(`/api/biz/materials/documents/${d.id}`, { method: "DELETE" }, "資料を削除しました。");
                    }}>削除</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {canEdit && order.length > 1 && (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--ink-mute)" }}>左の取っ手をドラッグ（または取っ手を選んで ↑ ↓ キー）で並べ替えます。</p>
      )}
    </section>
  );
}

// ── 項目の追加 ────────────────────────────────────────────────────────────────

function AddItem({ documents, busy, call }: { documents: MaterialDocument[]; busy: boolean; call: CallFn }) {
  const [category, setCategory] = useState<MaterialCategory>("business");
  const [documentId, setDocumentId] = useState("");
  const [content, setContent] = useState("");
  async function submit() {
    if (!content.trim()) return;
    if (await call("/api/biz/materials/items", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, content: content.trim(), documentId: documentId || null }),
    }, "項目を追加しました。下の「未確定の項目」で公開範囲を決めて確定してください。")) {
      setContent("");
    }
  }
  return (
    <section style={card} aria-label="項目を追加">
      <h2 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700 }}>項目を追加</h2>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <select style={{ ...input, width: "auto" }} value={category} onChange={(e) => setCategory(e.target.value as MaterialCategory)} aria-label="区分">
          {MATERIAL_CATEGORIES.map((c) => <option key={c} value={c}>{MATERIAL_CATEGORY_LABELS[c]}</option>)}
        </select>
        <select style={{ ...input, width: "auto", maxWidth: "100%" }} value={documentId} onChange={(e) => setDocumentId(e.target.value)} aria-label="元の資料">
          <option value="">元の資料（なし）</option>
          {documents.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
        </select>
      </div>
      <textarea style={{ ...input, minHeight: 80, resize: "vertical" }} maxLength={MATERIAL_CONTENT_MAX}
        placeholder="例: 入社後3か月は既存顧客の引き継ぎから始めます" value={content} onChange={(e) => setContent(e.target.value)} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{content.length} / {MATERIAL_CONTENT_MAX}・追加した時点では「内部のみ・未確定」です</span>
        <button type="button" style={primaryBtn} disabled={busy || !content.trim()} onClick={submit}>追加</button>
      </div>
    </section>
  );
}

// ── 未確定の項目（区分を決めて確定・一括確定）───────────────────────────────────

function VisibilityChoice({ name, value, onChange, disabledExceptInternal }: {
  name: string; value: MaterialVisibility; onChange: (v: MaterialVisibility) => void; disabledExceptInternal?: boolean;
}) {
  return (
    <div>
      <div role="radiogroup" aria-label="公開範囲" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {MATERIAL_VISIBILITIES.map((v) => (
          <label key={v} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, cursor: "pointer" }}>
            <input type="radio" name={name} checked={value === v} disabled={disabledExceptInternal && v !== "internal"}
              onChange={() => onChange(v)} style={{ accentColor: "var(--royal)" }} />
            {MATERIAL_VISIBILITY_LABELS[v]}
          </label>
        ))}
      </div>
      {/* ★「誰に見えるか」を文言で出す（柴さんの指示）。内部のみでも出す（見えないことも事実として伝える） */}
      <p data-visibility={value} style={{
        margin: "6px 0 0", fontSize: 12, lineHeight: 1.7,
        color: value === "internal" ? "var(--ink-mute)" : "var(--warm-ink)",
      }}>
        {MATERIAL_VISIBILITY_AUDIENCE[value]}
      </p>
    </div>
  );
}

function UnconfirmedItems({ items, canEdit, busy, call, docTitle }: {
  items: MaterialItem[]; canEdit: boolean; busy: boolean; call: CallFn; docTitle: (id: string | null) => string | null;
}) {
  /* ⚠️ 既定は AI の提案（1b）か「内部のみ」。1a では AI の提案が無いので常に「内部のみ」 */
  const [choice, setChoice] = useState<Record<string, MaterialVisibility>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const vis = (i: MaterialItem) => choice[i.id] ?? i.aiSuggestedVisibility ?? "internal";
  const selected = items.filter((i) => checked[i.id]);
  const selectedNonInternal = selected.filter((i) => vis(i) !== "internal").length;

  async function confirmList(list: MaterialItem[]) {
    if (list.length === 0) return;
    const nonInternal = list.filter((i) => vis(i) !== "internal");
    if (nonInternal.length > 0) {
      const lines = MATERIAL_VISIBILITIES.filter((v) => v !== "internal")
        .map((v) => ({ v, n: nonInternal.filter((i) => vis(i) === v).length }))
        .filter((x) => x.n > 0)
        .map((x) => `・${MATERIAL_VISIBILITY_LABELS[x.v]} ${x.n}件 … ${MATERIAL_VISIBILITY_AUDIENCE[x.v]}`);
      if (!confirm(`次の公開範囲で確定します。\n\n${lines.join("\n")}\n\nよろしいですか？`)) return;
    }
    if (await call("/api/biz/materials/items/confirm", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: list.map((i) => ({ id: i.id, visibility: vis(i) })) }),
    }, `${list.length}件を確定しました。`)) {
      setChecked({});
    }
  }

  return (
    <section style={card} aria-label="未確定の項目">
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>未確定の項目（{items.length}件）</h2>
        {canEdit && items.length > 0 && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" style={btn} disabled={busy} onClick={() => setChecked(Object.fromEntries(items.map((i) => [i.id, true])))}>すべて選ぶ</button>
            <button type="button" style={primaryBtn} disabled={busy || selected.length === 0} onClick={() => confirmList(selected)}>
              選んだ{selected.length}件を確定{selectedNonInternal > 0 ? `（うち公開範囲あり${selectedNonInternal}件）` : ""}
            </button>
          </div>
        )}
      </div>
      {items.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>未確定の項目はありません。</p>
      ) : items.map((i) => (
        <div key={i.id} data-item-state="unconfirmed" style={{ borderTop: "1px solid var(--line-soft)", padding: "12px 0", display: "flex", gap: 10 }}>
          {canEdit && (
            <input type="checkbox" checked={!!checked[i.id]} onChange={(e) => setChecked({ ...checked, [i.id]: e.target.checked })}
              aria-label="一括確定の対象にする" style={{ marginTop: 3, accentColor: "var(--royal)" }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <ItemBody item={i} docTitle={docTitle} />
            {canEdit && (
              <div style={{ marginTop: 8, display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <VisibilityChoice name={`vis-${i.id}`} value={vis(i)} onChange={(v) => setChoice({ ...choice, [i.id]: v })} />
                </div>
                <button type="button" style={primaryBtn} disabled={busy} onClick={() => confirmList([i])}>この区分で確定</button>
              </div>
            )}
            {canEdit && <ItemActions item={i} busy={busy} call={call} />}
          </div>
        </div>
      ))}
    </section>
  );
}

// ── 確定済み（公開範囲ごと）──────────────────────────────────────────────────

function ConfirmedGroup({ visibility, items, canEdit, busy, call, docTitle }: {
  visibility: MaterialVisibility; items: MaterialItem[]; canEdit: boolean; busy: boolean; call: CallFn;
  docTitle: (id: string | null) => string | null;
}) {
  return (
    <section style={card} aria-label={`確定済み: ${MATERIAL_VISIBILITY_LABELS[visibility]}`}>
      <h2 style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700 }}>
        {MATERIAL_VISIBILITY_LABELS[visibility]}（確定済み {items.length}件）
      </h2>
      <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7 }}>{MATERIAL_VISIBILITY_AUDIENCE[visibility]}</p>
      {items.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>まだありません。</p>
      ) : items.map((i) => (
        <ItemRow key={i.id} item={i} canEdit={canEdit} busy={busy} call={call} docTitle={docTitle} confirmedGroup />
      ))}
    </section>
  );
}

function ItemRow({ item, canEdit, busy, call, docTitle, confirmedGroup }: {
  item: MaterialItem; canEdit: boolean; busy: boolean; call: CallFn; docTitle: (id: string | null) => string | null;
  confirmedGroup?: boolean;
}) {
  const [changing, setChanging] = useState(false);
  const [vis, setVis] = useState<MaterialVisibility>(item.visibility);
  return (
    <div data-item-state={item.restrictedFlag ? "restricted" : `confirmed-${item.visibility}`} style={{ borderTop: "1px solid var(--line-soft)", padding: "10px 0" }}>
      <ItemBody item={item} docTitle={docTitle} />
      {item.restrictedFlag && item.restrictedReason && (
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--error-ink)" }}>理由: {item.restrictedReason}</p>
      )}
      {canEdit && confirmedGroup && (
        changing ? (
          <div style={{ marginTop: 8, display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <VisibilityChoice name={`re-${item.id}`} value={vis} onChange={setVis} />
            </div>
            <button type="button" style={primaryBtn} disabled={busy} onClick={async () => {
              if (vis !== "internal" && !confirm(`「${MATERIAL_VISIBILITY_LABELS[vis]}」で確定します。\n${MATERIAL_VISIBILITY_AUDIENCE[vis]}`)) return;
              if (await call("/api/biz/materials/items/confirm", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: [{ id: item.id, visibility: vis }] }),
              }, "公開範囲を変更しました。")) setChanging(false);
            }}>この区分で確定</button>
            <button type="button" style={btn} onClick={() => { setChanging(false); setVis(item.visibility); }}>やめる</button>
          </div>
        ) : (
          <div style={{ marginTop: 6 }}>
            <button type="button" style={btn} disabled={busy} onClick={() => setChanging(true)}>公開範囲を変更</button>
          </div>
        )
      )}
      {canEdit && <ItemActions item={item} busy={busy} call={call} />}
    </div>
  );
}

function ItemBody({ item, docTitle }: { item: MaterialItem; docTitle: (id: string | null) => string | null }) {
  const src = docTitle(item.documentId);
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 100, background: "var(--bg-tint)", border: "1px solid var(--line)", color: "var(--ink-soft)" }}>
          {MATERIAL_CATEGORY_LABELS[item.category]}
        </span>
        {src && <span style={{ fontSize: 11.5, color: "var(--ink-mute)" }}>元の資料: {src}</span>}
      </div>
      <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink)", lineHeight: 1.8, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{item.content}</p>
    </div>
  );
}

/** 編集・印・削除。★本文を直すと確定が外れることを、保存の前に必ず伝える */
function ItemActions({ item, busy, call }: { item: MaterialItem; busy: boolean; call: CallFn }) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(item.content);
  const [category, setCategory] = useState<MaterialCategory>(item.category);
  const willUnconfirm = !!item.confirmedAt && (content.trim() !== item.content || category !== item.category);

  if (editing) {
    return (
      <div style={{ marginTop: 8 }}>
        <select style={{ ...input, width: "auto", marginBottom: 6 }} value={category} onChange={(e) => setCategory(e.target.value as MaterialCategory)} aria-label="区分">
          {MATERIAL_CATEGORIES.map((c) => <option key={c} value={c}>{MATERIAL_CATEGORY_LABELS[c]}</option>)}
        </select>
        <textarea style={{ ...input, minHeight: 70, resize: "vertical" }} maxLength={MATERIAL_CONTENT_MAX} value={content} onChange={(e) => setContent(e.target.value)} />
        {willUnconfirm && (
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--warm-ink)" }}>
            保存すると確定が外れ、「内部のみ・未確定」に戻ります。公開中の項目は企業ページから消えます。
          </p>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button type="button" style={primaryBtn} disabled={busy || !content.trim()} onClick={async () => {
            if (await call(`/api/biz/materials/items/${item.id}`, {
              method: "PATCH", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: content.trim(), category }),
            }, willUnconfirm ? "保存しました。確定が外れたので、もう一度公開範囲を決めてください。" : "保存しました。")) setEditing(false);
          }}>保存</button>
          <button type="button" style={btn} onClick={() => { setEditing(false); setContent(item.content); setCategory(item.category); }}>やめる</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
      <button type="button" style={btn} disabled={busy} onClick={() => setEditing(true)}>編集</button>
      {item.restrictedFlag ? (
        <button type="button" style={btn} disabled={busy} onClick={() => {
          if (!confirm("「選考に使ってはいけない内容」の印を外します。外した項目は「内部のみ」のままです。")) return;
          void call(`/api/biz/materials/items/${item.id}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ restricted: { flag: false } }),
          }, "印を外しました。");
        }}>印を外す</button>
      ) : (
        <button type="button" style={btn} disabled={busy} onClick={() => {
          const reason = prompt("選考に使ってはいけない内容として印を付けます。理由を入力してください（例: 年齢に関する記述）。\n印を付けた項目は「内部のみ」になり、マッチングにも企業ページにも使われません。");
          if (!reason || !reason.trim()) return;
          void call(`/api/biz/materials/items/${item.id}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ restricted: { flag: true, reason: reason.trim() } }),
          }, "印を付けました。この項目はマッチングにも企業ページにも使われません。");
        }}>選考に使えない内容として印を付ける</button>
      )}
      <button type="button" style={btn} disabled={busy} onClick={() => {
        if (!confirm("この項目を削除します。")) return;
        void call(`/api/biz/materials/items/${item.id}`, { method: "DELETE" }, "項目を削除しました。");
      }}>削除</button>
    </div>
  );
}
