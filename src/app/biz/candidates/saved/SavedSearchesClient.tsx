"use client";

import { useState } from "react";
import Link from "next/link";
import { MAX_SAVED_SEARCH_NAME } from "@/lib/business/savedSearch";

/**
 * ★保存した条件の一覧（段3）。名前・条件のチップ・作った人・共有・お知らせ・新着の人数。
 * ⚠️ 編集は作った人だけ、削除は作った人と企業の管理者（サーバーが決めた canEdit / canDelete に従う）。
 * ⚠️ 「新着を見る」「この条件で探す」は /biz/candidates に移って、その条件で一覧を開く（前回見た日時はそこで更新）。
 */
export type SavedSearchView = {
  id: string;
  name: string;
  ownerName: string | null;
  isMine: boolean;
  isShared: boolean;
  notifyFrequency: "daily" | "weekly" | "none";
  canEdit: boolean;
  canDelete: boolean;
  /** null = 数えられなかった（「—」） */
  newCount: number | null;
  chips: string[];
};

const FREQ_LABEL = { daily: "毎朝", weekly: "毎週月曜", none: "受け取らない" } as const;

export default function SavedSearchesClient({ initial, initialEditId }: { initial: SavedSearchView[] | null; initialEditId: string | null }) {
  const [rows, setRows] = useState(initial);
  const [editId, setEditId] = useState<string | null>(initialEditId);
  const [draft, setDraft] = useState<{ name: string; notifyFrequency: SavedSearchView["notifyFrequency"]; isShared: boolean } | null>(() => {
    const r = initial?.find((x) => x.id === initialEditId);
    return r ? { name: r.name, notifyFrequency: r.notifyFrequency, isShared: r.isShared } : null;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = (r: SavedSearchView) => { setEditId(r.id); setDraft({ name: r.name, notifyFrequency: r.notifyFrequency, isShared: r.isShared }); setError(null); };
  const save = async (id: string) => {
    if (!draft) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/biz/saved-searches/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "保存できませんでした");
      setRows((rs) => rs?.map((r) => (r.id === id ? { ...r, ...draft } : r)) ?? rs);
      setEditId(null);
    } catch (e) { setError(e instanceof Error ? e.message : "保存できませんでした"); } finally { setBusy(false); }
  };
  const remove = async (r: SavedSearchView) => {
    if (!confirm(`保存した条件「${r.name}」を削除します。よろしいですか？`)) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/biz/saved-searches/${r.id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "削除できませんでした");
      setRows((rs) => rs?.filter((x) => x.id !== r.id) ?? rs);
    } catch (e) { setError(e instanceof Error ? e.message : "削除できませんでした"); } finally { setBusy(false); }
  };

  const btn: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", padding: "7px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)", cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap" };

  return (
    <div style={{ padding: "16px clamp(16px, 3vw, 32px)", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: 0 }}>保存した条件</h1>
        <Link href="/biz/candidates" style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, color: "var(--royal)", textDecoration: "none" }}>候補者を探す →</Link>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.7, margin: "0 0 14px" }}>
        新着は、前回その条件で一覧を開いたあとに登録した方と、プロフィールを更新した方です。お知らせのメールは、条件を作った方に届きます。
      </p>
      {error && <p role="alert" style={{ fontSize: 12.5, color: "var(--error)", margin: "0 0 10px" }}>{error}</p>}
      {rows === null ? (
        <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>保存した条件を読み込めませんでした（0件という意味ではありません）。</p>
      ) : rows.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>保存した条件はまだありません。候補者を探す画面で条件を選ぶと「この条件を保存」が出ます。</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((r) => (
            <li key={r.id} data-saved-search={r.id} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "14px 16px", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", overflowWrap: "anywhere" }}>{r.name}</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, color: "var(--ink-mute)", marginTop: 4 }}>
                    <span>{r.isMine ? "自分" : `${r.ownerName ?? "担当者"}さん`}が作成</span>
                    <span>{r.isShared ? "チームで共有" : "自分だけ"}</span>
                    <span>お知らせ：{FREQ_LABEL[r.notifyFrequency]}</span>
                  </div>
                </div>
                <div data-state="new-count" style={{ fontSize: 13, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
                  新着 <strong style={{ fontSize: 18, color: r.newCount ? "var(--royal)" : "var(--ink-mute)", fontFamily: "var(--font-inter), var(--font-noto)" }}>{r.newCount ?? "—"}</strong> 名
                </div>
              </div>
              {r.chips.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                  {r.chips.map((c) => (
                    <span key={c} style={{ fontSize: 12, fontWeight: 600, padding: "2px 9px", borderRadius: 100, background: "var(--royal-50)", border: "1px solid var(--royal-100)", color: "var(--royal)", overflowWrap: "anywhere" }}>{c}</span>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                {r.newCount ? <Link href={`/biz/candidates?saved=${r.id}&new=1`} style={{ ...btn, background: "var(--royal)", borderColor: "var(--royal)", color: "#fff" }}>新着を見る</Link> : null}
                <Link href={`/biz/candidates?saved=${r.id}`} style={btn}>この条件で探す</Link>
                {r.canEdit && editId !== r.id && <button type="button" onClick={() => startEdit(r)} style={btn}>編集</button>}
                {r.canDelete && <button type="button" disabled={busy} onClick={() => void remove(r)} style={{ ...btn, color: "var(--error)" }}>削除</button>}
              </div>
              {editId === r.id && draft && (
                <div data-state="saved-edit" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line-soft)", display: "flex", flexDirection: "column", gap: 10 }}>
                  <label style={{ fontSize: 12, color: "var(--ink-soft)" }}>名前
                    <input type="text" value={draft.name} maxLength={MAX_SAVED_SEARCH_NAME} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      style={{ display: "block", width: "100%", maxWidth: 420, height: 34, marginTop: 4, padding: "0 10px", boxSizing: "border-box", border: "1px solid var(--line)", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} />
                  </label>
                  <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
                    <legend style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 4 }}>新着のお知らせ（メール）</legend>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 13 }}>
                      {(["daily", "weekly", "none"] as const).map((v) => (
                        <label key={v} style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                          <input type="radio" name={`notify-${r.id}`} checked={draft.notifyFrequency === v} onChange={() => setDraft({ ...draft, notifyFrequency: v })} />{FREQ_LABEL[v]}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
                    <legend style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 4 }}>公開範囲</legend>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 13 }}>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}><input type="radio" name={`share-${r.id}`} checked={!draft.isShared} onChange={() => setDraft({ ...draft, isShared: false })} />自分だけ</label>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}><input type="radio" name={`share-${r.id}`} checked={draft.isShared} onChange={() => setDraft({ ...draft, isShared: true })} />チームで共有</label>
                    </div>
                  </fieldset>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" disabled={busy || !draft.name.trim()} onClick={() => void save(r.id)} style={{ ...btn, background: "var(--royal)", borderColor: "var(--royal)", color: "#fff" }}>保存する</button>
                    <button type="button" onClick={() => setEditId(null)} style={btn}>やめる</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
