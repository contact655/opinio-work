"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
/* ⚠️ `import type` だけにすること。server.ts は admin クライアントを使うので、
      値を import するとバンドルに混ざる。 */
import type { MaterialDocument, MaterialItem } from "@/lib/companyMaterials/server";
import {
  MATERIAL_CATEGORIES,
  MATERIAL_CATEGORY_LABELS,
  MATERIAL_DOCUMENT_STATUS_LABELS,
  MATERIAL_FILE_ACCEPT,
  MATERIAL_VISIBILITIES,
  MATERIAL_VISIBILITY_AUDIENCE,
  MATERIAL_VISIBILITY_LABELS,
  MAX_MATERIAL_FILE_BYTES,
  MATERIAL_CONTENT_MAX,
  type MaterialCategory,
  type MaterialVisibility,
} from "@/lib/constants/companyMaterials";

type Props = {
  documents: MaterialDocument[];
  items: MaterialItem[];
  loadFailed: boolean;
  /** 管理者権限か。⚠️ 画面で隠すだけでなく API も断る（resolveMaterialsActor） */
  canEdit: boolean;
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

export default function MaterialsClient({ documents, items, loadFailed, canEdit }: Props) {
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

  return (
    <div className="mat-root" style={{ padding: "20px 32px 60px", maxWidth: 1040, margin: "0 auto" }}>
      {/* ★押せない間は薄くする。⚠️ インラインの背景色だけだと、0件選択中の「確定」が
             押せそうな濃紺のまま見えた（2026-10-09 に実画面で確認）。
          ⚠️ ui-conventions: style 要素の中で子孫セレクタの「>」と引用符を使わない */}
      <style>{`
        .mat-root button { cursor: pointer; }
        .mat-root button:disabled { opacity: 0.45; cursor: not-allowed; }
        @media (max-width: 640px) { .mat-root { padding: 16px 16px 48px !important; } }
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
          閲覧のみの権限です。登録・編集・確定は管理者権限の担当者が行えます。
        </div>
      )}

      {canEdit && <RegisterDocument busy={busy} call={call} />}
      <DocumentList documents={documents} canEdit={canEdit} busy={busy} call={call} setError={setError} />
      {canEdit && <AddItem documents={documents} busy={busy} call={call} />}

      <UnconfirmedItems items={unconfirmed} canEdit={canEdit} busy={busy} call={call} docTitle={docTitle} />

      {MATERIAL_VISIBILITIES.map((v) => (
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

function RegisterDocument({ busy, call }: { busy: boolean; call: CallFn }) {
  const [file, setFile] = useState<File | null>(null);
  const [fileTitle, setFileTitle] = useState("");
  const [url, setUrl] = useState("");
  const [urlTitle, setUrlTitle] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  async function submitFile() {
    if (!file) return;
    if (file.size > MAX_MATERIAL_FILE_BYTES) { setLocalError("ファイルは10MBまでです。"); return; }
    setLocalError(null);
    const fd = new FormData();
    fd.append("file", file);
    if (fileTitle.trim()) fd.append("title", fileTitle.trim());
    if (await call("/api/biz/materials/documents", { method: "POST", body: fd }, "ファイルを登録しました。")) {
      setFile(null); setFileTitle("");
    }
  }
  async function submitUrl() {
    if (!url.trim()) return;
    if (await call("/api/biz/materials/documents", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim(), title: urlTitle.trim() }),
    }, "リンクを登録しました。")) {
      setUrl(""); setUrlTitle("");
    }
  }

  return (
    <section style={card} aria-label="資料を登録する">
      <h2 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700 }}>資料を登録する</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 16 }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>ファイル（PDF / Word / PowerPoint / テキスト・10MBまで）</div>
          <input type="file" accept={MATERIAL_FILE_ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12.5, marginBottom: 8, maxWidth: "100%" }} />
          <input style={{ ...input, marginBottom: 8 }} placeholder="資料名（任意。空ならファイル名）" value={fileTitle} onChange={(e) => setFileTitle(e.target.value)} />
          <button type="button" style={primaryBtn} disabled={busy || !file} onClick={submitFile}>ファイルを登録</button>
        </div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>URL（http / https）</div>
          <input style={{ ...input, marginBottom: 8 }} placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
          <input style={{ ...input, marginBottom: 8 }} placeholder="資料名（任意。空なら URL）" value={urlTitle} onChange={(e) => setUrlTitle(e.target.value)} />
          <button type="button" style={primaryBtn} disabled={busy || !url.trim()} onClick={submitUrl}>リンクを登録</button>
        </div>
      </div>
      {localError && <p role="alert" style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--error-ink)" }}>{localError}</p>}
      {/* ⚠️ 1a では中身を読まない。読まないことを書いておく（「読み取ってくれる」と思わせない） */}
      <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7 }}>
        登録した資料は、この会社の担当者だけが開けます。いまは資料の中身を自動では読み取りません。
        伝えたい内容は、下の「項目を追加」から入れてください。
      </p>
    </section>
  );
}

// ── 資料一覧 ──────────────────────────────────────────────────────────────────

function DocumentList({ documents, canEdit, busy, call, setError }: {
  documents: MaterialDocument[]; canEdit: boolean; busy: boolean; call: CallFn; setError: (s: string | null) => void;
}) {
  async function openFile(id: string) {
    setError(null);
    const res = await fetch(`/api/biz/materials/documents/${id}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.url) { setError(json.error ?? "ファイルを開けませんでした。"); return; }
    window.open(json.url as string, "_blank", "noopener,noreferrer");
  }
  return (
    <section style={card} aria-label="資料一覧">
      <h2 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700 }}>資料一覧（{documents.length}件）</h2>
      {documents.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>まだ資料はありません。</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--ink-mute)", fontSize: 12 }}>
                <th style={{ padding: "6px 8px" }}>資料</th>
                <th style={{ padding: "6px 8px" }}>登録日</th>
                <th style={{ padding: "6px 8px" }}>状態</th>
                <th style={{ padding: "6px 8px" }}>項目数</th>
                <th style={{ padding: "6px 8px" }} />
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                  <td style={{ padding: "8px", minWidth: 200 }}>
                    {d.sourceType === "url" && d.sourceUrl ? (
                      /* ★外部リンクとして出す（柴さんの指示）。サーバーからは取りに行かない */
                      <a href={d.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--royal)", fontWeight: 600, overflowWrap: "anywhere" }}>{d.title}</a>
                    ) : (
                      <button type="button" onClick={() => openFile(d.id)} style={{ background: "none", border: "none", padding: 0, color: "var(--royal)", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: 13, textAlign: "left", overflowWrap: "anywhere" }}>{d.title}</button>
                    )}
                    <div style={{ fontSize: 11.5, color: "var(--ink-mute)" }}>
                      {d.sourceType === "url" ? "リンク" : `ファイル ${formatBytes(d.byteSize)}`}
                    </div>
                  </td>
                  <td style={{ padding: "8px", whiteSpace: "nowrap" }}>{formatDate(d.createdAt)}</td>
                  <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                    {MATERIAL_DOCUMENT_STATUS_LABELS[d.status]}
                    {d.status === "failed" && d.errorMessage && <div style={{ fontSize: 11.5, color: "var(--error-ink)" }}>{d.errorMessage}</div>}
                  </td>
                  <td style={{ padding: "8px" }}>{d.itemCount}</td>
                  <td style={{ padding: "8px", textAlign: "right" }}>
                    {canEdit && (
                      <button type="button" style={btn} disabled={busy} onClick={() => {
                        if (!confirm(`「${d.title}」を削除します。この資料から作った項目は残ります。`)) return;
                        void call(`/api/biz/materials/documents/${d.id}`, { method: "DELETE" }, "資料を削除しました。");
                      }}>削除</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
