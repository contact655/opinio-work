"use client";

import React from "react";

/**
 * /profile/edit のカード・入力欄の共通部品。
 *
 * ⚠️ **見た目の値はここ1箇所。** タブごとのファイルに書き写さないこと。
 *    3-B（2026-08-15）でタブを別ファイルに分けたとき、`ProfileEditClient.tsx` から
 *    **そのまま移した**もの。中身は変えていない。
 */

export const CARD_STYLE: React.CSSProperties = {
  background: "#fff", border: "1px solid var(--line)",
  borderRadius: 14, padding: "28px 32px", marginBottom: 20,
};

/**
 * 見出しを持たないカード。
 * ⚠️ 中の部品が自前の見出しを描くもの（職歴 / 学歴 / 実績3種）に使う。
 *    `FormSection` で包むと見出しが二重になる。
 */
export function Card({ children }: { children: React.ReactNode }) {
  return <section style={CARD_STYLE}>{children}</section>;
}

/** カード内の右下に置く操作行（保存・キャンセル）。⚠️ カードの外に浮かせない。 */
export const CARD_FOOTER_STYLE: React.CSSProperties = {
  display: "flex", justifyContent: "flex-end", alignItems: "center",
  gap: "var(--space-2)", marginTop: 20, paddingTop: 16,
  borderTop: "1px solid var(--line-soft)",
};

/**
 * カード内の保存行（保存 / キャンセル / 状態 / エラー）。
 *
 * ⚠️ 希望条件のカードはこれを使う。②基本情報・⑦SNS と**同じ形・同じ文言**にすること。
 *    片方だけ言い回しが違うと「押した結果が同じか」を利用者が判断できない。
 */
export function CardSaveFooter({
  dirty, saving, justSaved, error, onSave, onCancel,
}: {
  dirty: boolean; saving: boolean; justSaved: boolean;
  /** API が返したエラー文。★どの項目が不正かを含むので、丸めずそのまま出す */
  error: string | null;
  onSave: () => void; onCancel: () => void;
}) {
  const locked = !dirty || saving || justSaved;
  /* ⚠️ **キャンセルは「変更が無いとき」も押せるようにする。**（2026-08-16）
        `EditableSection` では、キャンセルが**編集モードの唯一の出口**になった。
        `locked` で無効にすると、何も入力していないカードを開いたときに
        **閉じる手段が無くなる**（実測で踏んだ）。押せないのは保存中と保存直後だけ。 */
  const cancelLocked = saving || justSaved;
  return (
    <>
      {error && (
        <div role="alert" style={{
          marginTop: 16, padding: "10px 14px", borderRadius: 8,
          background: "var(--error-soft, #FEF2F2)", border: "1px solid #FECACA",
          fontSize: 12, fontWeight: 600, color: "var(--error)",
        }}>
          {error}
        </div>
      )}
      <div style={{ ...CARD_FOOTER_STYLE, justifyContent: "space-between" }}>
        {/* ⚠️ 未保存であることは**画面に出す**。タブ切替では確認を出さない方針なので
               （移動しても入力は消えない）、気づく手段はここと、タブ名の「未保存」印。 */}
        {dirty ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "var(--royal)" }}>
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--royal)", display: "inline-block" }} />
            未保存の変更があります
          </span>
        ) : (
          <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>このカードだけを保存します</span>
        )}
        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={cancelLocked}
            style={{
              padding: "10px 20px", fontSize: "var(--text-sm)", fontWeight: 600,
              background: "#fff", color: "var(--ink-soft)",
              border: "1px solid var(--line)", borderRadius: 8, fontFamily: "inherit",
              cursor: cancelLocked ? "default" : "pointer", opacity: cancelLocked ? 0.5 : 1,
            }}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={locked}
            style={{
              padding: "10px var(--space-6)", fontSize: "var(--text-sm)", fontWeight: 600, minWidth: 140,
              background: justSaved ? "var(--success)" : locked ? "var(--ink-mute)" : "var(--royal)",
              color: "#fff", border: "none", borderRadius: 8, fontFamily: "inherit",
              cursor: locked ? "default" : "pointer", transition: "background 0.2s",
            }}
          >
            {saving ? "保存中…" : justSaved ? "✓ 保存しました" : "保存"}
          </button>
        </span>
      </div>
    </>
  );
}

export function FormSection({
  title, desc, children,
}: {
  title: React.ReactNode; desc?: string; children: React.ReactNode;
}) {
  return (
    <section style={CARD_STYLE}>
      <div style={{ fontWeight: 700, fontSize: 16, color: "var(--ink)", marginBottom: desc ? 6 : 20 }}>
        {title}
      </div>
      {desc && (
        <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 20, lineHeight: 1.7 }}>
          {desc}
        </div>
      )}
      {children}
    </section>
  );
}

export function FormGroup({
  label, hint, children, htmlFor,
}: {
  label: string; hint?: string; children: React.ReactNode; htmlFor?: string;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      {htmlFor ? (
        <label htmlFor={htmlFor} style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
          {label}
        </label>
      ) : (
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
          {label}
        </div>
      )}
      {children}
      {hint && (
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", marginTop: 6, lineHeight: 1.6 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function inputStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    width: "100%", padding: "10px var(--space-3)",
    border: "1.5px solid var(--line)", borderRadius: 8,
    fontFamily: "inherit", fontSize: "var(--text-sm)", color: "var(--ink)",
    background: "#fff", outline: "none", transition: "border-color 0.15s",
    ...extra,
  };
}

export function selectStyle(): React.CSSProperties {
  return {
    ...inputStyle(),
    appearance: "none" as const,
    cursor: "pointer",
    paddingRight: 32,
    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='3'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
  };
}

// ─── Notification Settings Section ───────────────────────────────────────────

/* ⚠️ 2026-08-10 まで localStorage に保存していた。cron はそれを読めないので、
      オフにしてもメールは止まらなかった（週次メールを止めていた理由そのもの）。
      いまは `ow_profiles` に保存する。

   ⚠️ **実在するメールと1対1で対応する項目だけを出すこと。**
      以前は「新着企業」「新着記事」という、送っているメールが存在しない項目が
      2つ並んでいて、逆に実在する新着求人メールには項目が無かった。 */

export function TextareaField({
  value,
  onChange,
  placeholder,
  softLimit = 200,
  rows = 5,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  softLimit?: number;
  rows?: number;
  ariaLabel?: string;
}) {
  const len    = value.length;
  const isOver = len > softLimit;

  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        rows={rows}
        style={{
          ...inputStyle({ resize: "vertical", lineHeight: 1.8, minHeight: rows * 24 }),
        }}
      />
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginTop: 6, gap: "var(--space-2)",
      }}>
        {isOver ? (
          <div style={{ fontSize: "var(--text-xs)", color: "var(--warm)", lineHeight: 1.6, flex: 1 }}>
            {softLimit}字の目安を超えています。保存は可能ですが、読み手が読みやすい長さを意識してみてください。
          </div>
        ) : (
          <div style={{ flex: 1 }} />
        )}
        <div style={{
          fontSize: "var(--text-xs)",
          color: isOver ? "var(--warm)" : "var(--ink-mute)",
          fontFamily: "Inter, sans-serif",
          flexShrink: 0,
          lineHeight: 1.6,
        }}>
          {len} / {softLimit}
        </div>
      </div>
    </div>
  );
}


/* ⚠️ `EditableSection`（表示⇄編集のカード）は 2026-08-17 に削除した。
      **編集はすべて `ProfileEditModal`（モーダル）で開く**形にしたので、
      カードがその場でフォームに化ける器は要らなくなった。
      戻さないこと。戻すと「開いているカードと閉じているカードが混ざる」に逆戻りする。 */


/**
 * 見出し行の右端に出すアイコンボタン（鉛筆 / ＋）。
 * ⚠️ ホバーとフォーカスの見た目はここ1箇所。カードごとに書かない。
 * ⚠️ `.btn-fixed-size` を付ける。globals.css の `min-height: 36px` が
 *    正方形ボタンを縦長に潰すため（ui-debugging.md）。
 */
export function SectionActionButton({
  action, label, onClick,
}: { action: "edit" | "add"; label: string; onClick: () => void }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      /* ⚠️ 767px 以下では当たり判定を 44×44 にする（丸の描画は 32px のまま）。
            `.tap-target` は min-width / min-height だけを足すので、
            width/height 32 の丸い枠線は変わらない */
      className="btn-fixed-size tap-target"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      style={{
        flexShrink: 0,
        width: 32, height: 32, borderRadius: "50%",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: hovered ? "var(--royal-50)" : "transparent",
        border: `1px solid ${hovered ? "var(--royal-100)" : "var(--line)"}`,
        color: hovered ? "var(--royal)" : "var(--ink-mute)",
        cursor: "pointer", transition: "background 0.15s, color 0.15s, border-color 0.15s",
      }}
    >
      {action === "edit" ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      )}
    </button>
  );
}

/**
 * 即時保存のカード（写真・発信コンテンツ）の出口。
 *
 * ⚠️ **「完了」は保存ではない。API を呼ばない。** 表示モードに戻すだけ。
 *    これらのカードは操作した時点で保存が終わっているので、未保存の入力が無い。
 * ⚠️ 見た目（上罫線＋右寄せ）は `CardSaveFooter` と揃える。
 *    出口の位置を7枚で同じにするため、見出し側には戻さない。
 */
export function CardDoneFooter({ onDone, note }: { onDone: () => void; note?: string }) {
  return (
    <div style={{ ...CARD_FOOTER_STYLE, justifyContent: "space-between" }}>
      <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>
        {note ?? "変更はすぐに保存されます"}
      </span>
      <button
        type="button"
        onClick={onDone}
        style={{
          padding: "10px var(--space-6)", fontSize: "var(--text-sm)", fontWeight: 600, minWidth: 120,
          background: "var(--royal)", color: "#fff",
          border: "none", borderRadius: 8, fontFamily: "inherit", cursor: "pointer",
        }}
      >
        完了
      </button>
    </div>
  );
}
