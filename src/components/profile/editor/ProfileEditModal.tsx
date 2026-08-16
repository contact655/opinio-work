"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

/**
 * プロフィール編集のモーダル。**編集はすべてこれを通す。**
 *
 * ── なぜ作ったか（2026-08-17）────────────────────────────────────────────────
 * `/mypage` は「カードがその場で編集フォームに化ける」形だった。そのため
 *   - ページの中でカードの高さが変わり、押した場所と入力欄がずれる
 *   - 開いているカードと閉じているカードが混ざり、いま何を編集しているのか分からない
 *   - 保存行がカードごとにあり、「このカードだけを保存します」と説明が要る
 * という状態になっていた。編集をモーダルに寄せると、この3つが同時に消える。
 *
 * ── 構造（LinkedIn に合わせた）──────────────────────────────────────────────
 *   見出し ＋ ×   … 固定
 *   本文           … **ここだけスクロールする**
 *   フッター       … 固定。**「保存」だけ。キャンセルは置かない**
 *
 * ⚠️ **キャンセルボタンを戻さないこと。** 閉じる操作は × / Esc / 背景クリックの3つで、
 *    未保存があるときは確認を出す（下記）。出口を4つに増やすと、
 *    「どれが捨てる操作か」が分からなくなる。
 *
 * ⚠️ **未保存があるときに閉じようとしたら確認を出す。** 変更が無ければ黙って閉じる。
 *    インライン時代の「キャンセル」は押した本人が捨てる意思を示していたが、
 *    **× は「閉じる」であって「捨てる」ではない**。背景クリックは誤爆しやすく、
 *    黙って消えると事故になる。
 *
 * ⚠️ 保存の中身と API の呼び方はこの部品の関心ではない。`onSave` を呼ぶだけ。
 */
export function ProfileEditModal({
  open,
  title,
  /** 未保存の変更があるか。閉じるときの確認の要否に使う */
  dirty,
  saving,
  justSaved,
  /** API が返したエラー文。★丸めずそのまま出す */
  error,
  onSave,
  onClose,
  children,
  /** 保存ボタンの文言。既定は「保存」 */
  saveLabel = "保存",
}: {
  open: boolean;
  title: string;
  dirty: boolean;
  saving: boolean;
  justSaved: boolean;
  error: string | null;
  onSave: () => void;
  onClose: () => void;
  children: React.ReactNode;
  saveLabel?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  /** 閉じる要求。未保存なら確認を挟む */
  const requestClose = useCallback(() => {
    if (saving) return;              // 保存中は閉じさせない
    if (dirty) { setConfirmDiscard(true); return; }
    onClose();
  }, [dirty, saving, onClose]);

  /* ⚠️ 背景を固定する。モーダルを開いたまま後ろがスクロールすると、
        閉じたときに元の位置を見失う（`JobseekerHeader` と同じ形）。 */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  /* Esc で閉じる。⚠️ 破棄の確認が出ているときは、そちらが Esc を受ける */
  useEffect(() => {
    if (!open || confirmDiscard) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") requestClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, confirmDiscard, requestClose]);

  /* ★フォーカストラップ。**キーボードだけで完結すること。**
     開いたら中の最初の入力へ。Tab がモーダルの外へ出ない。 */
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = () => Array.from(panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((el) => el.offsetParent !== null);
    /* ⚠️ `setTimeout` で待つ。開いた直後は中身がまだ描かれていないことがある
          （`requestAnimationFrame` は非表示のタブで発火しない。ルール⑪） */
    const t = setTimeout(() => {
      const list = focusables();
      (list.find((el) => el.tagName === "INPUT" || el.tagName === "TEXTAREA") ?? list[0])?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = focusables();
      if (list.length === 0) return;
      const first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    panel.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); panel.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!open) return null;

  const titleId = `profile-edit-modal-${title}`;
  const saveLocked = !dirty || saving || justSaved;

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* 背景 */}
        <div onClick={requestClose} style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.45)" }} />

        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          style={{
            position: "relative", zIndex: 1, background: "#fff",
            borderRadius: 16, width: "min(720px, 96vw)", maxHeight: "92vh",
            overflow: "hidden", display: "flex", flexDirection: "column",
            boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
          }}
        >
          {/* 見出し（固定） */}
          <div style={{
            padding: "16px 20px", borderBottom: "1px solid var(--line)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 12, flexShrink: 0,
          }}>
            <span id={titleId} style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{title}</span>
            <button
              type="button"
              onClick={requestClose}
              aria-label="閉じる"
              title="閉じる"
              className="tap-target"
              style={{
                width: 32, height: 32, border: "none", background: "var(--line-soft)",
                borderRadius: 8, cursor: "pointer", fontSize: 17, lineHeight: 1,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--ink-soft)", flexShrink: 0, fontFamily: "inherit",
              }}
            >×</button>
          </div>

          {/* 本文（★ここだけスクロールする） */}
          <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px", WebkitOverflowScrolling: "touch" as unknown as undefined }}>
            {children}
          </div>

          {/* フッター（固定・保存だけ） */}
          <div style={{
            padding: "14px 20px", borderTop: "1px solid var(--line)",
            display: "flex", alignItems: "center", justifyContent: "flex-end",
            gap: 12, flexShrink: 0,
          }}>
            {error && (
              <span role="alert" style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: "var(--error)" }}>
                {error}
              </span>
            )}
            <button
              type="button"
              onClick={onSave}
              disabled={saveLocked}
              className="tap-min-h"
              style={{
                padding: "10px 28px", fontSize: "var(--text-sm)", fontWeight: 700, minWidth: 120,
                background: justSaved ? "var(--success)" : saveLocked ? "var(--ink-mute)" : "var(--royal)",
                color: "#fff", border: "none", borderRadius: 999, fontFamily: "inherit",
                cursor: saveLocked ? "default" : "pointer", transition: "background 0.2s",
              }}
            >
              {saving ? "保存中…" : justSaved ? "✓ 保存しました" : saveLabel}
            </button>
          </div>
        </div>
      </div>

      {/* 破棄の確認。⚠️ `ConfirmDialog` は zIndex 3000 なのでモーダル（1000）の上に出る */}
      <ConfirmDialog
        isOpen={confirmDiscard}
        title="変更を破棄しますか？"
        message="保存していない変更があります。閉じると入力した内容は失われます。"
        confirmLabel="破棄する"
        confirmVariant="danger"
        onConfirm={() => { setConfirmDiscard(false); onClose(); }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  );
}
