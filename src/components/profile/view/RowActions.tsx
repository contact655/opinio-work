"use client";

import Link from "next/link";

/**
 * 行ごとの編集アフォーダンス（鉛筆・ゴミ箱）と、その受け取り口。
 *
 * ⚠️ **`ProfileSections.tsx` から切り出した**（2026-08-16 / 2-5）。
 *    `MergedTimeline`（職歴・学歴）も同じものを使うため。
 *    セクション定義に依存させると **タイムライン → セクション** という
 *    逆向きの依存ができるので、共通の置き場をここにする。
 */

/* ── ★本人だけに出す操作の口（2026-08-16 / 2-2 で決めた型）──────────────────
      `MergedTimeline` の `viewerIsOwner` に揃える。**2-3〜2-6 でも同じ形を使う。**

      ⚠️ **渡さなければ DOM は1バイトも変わらない。** 他人が見る `/u/[id]` の
         HTML を変えないための約束。ラップ用の `<div>` も、渡されたときだけ足す。
      ⚠️ 見た目（鉛筆・ゴミ箱の形と大きさ）は `RowActions` が1箇所で持つ。
         セクションごとに描き直さない。 */
export type RowActions = {
  /** 行の鉛筆。渡さなければ鉛筆を出さない */
  onEditRow?: (id: string) => void;
  /** 行のゴミ箱。渡さなければ削除を出さない */
  onDeleteRow?: (id: string) => void;
  /** 見出しの「追加」。★`/mypage` では同じページなのでリンクではなくボタンにする */
  onAdd?: () => void;
};

/** 見出し行の「追加」。⚠️ 見た目を各セクションで書き分けない */
/**
 * 見出しの右端に出す「＋」/「＋ 追加」。
 *
 * ⚠️ **ラベルの有無で当たり判定の大きさが変わらないようにする**（2026-08-16）。
 *    職歴・学歴は `<PlusIcon/>` だけを渡すので、`padding: 0` のままだと
 *    **11×36px** しかなかった（ラベルのある他4セクションは 39×36px）。
 *    同じ style を共有しているのに3.5倍違う状態だった。
 *    幅の確保は `.tap-target`（767px 以下で 44×44）に任せる。**アイコンは大きくしない。**
 */
export const sectionAddBtn: React.CSSProperties = {
  fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--royal)",
  background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
  display: "flex", alignItems: "center", gap: 4, padding: 0, whiteSpace: "nowrap",
};
/** 0件のときの「〇〇を追加する」。⚠️ 本人にだけ出る */
export const emptyAddBtn: React.CSSProperties = {
  background: "none", border: "none", padding: 0, marginLeft: 6, cursor: "pointer",
  fontSize: 13, fontWeight: 600, color: "var(--royal)", fontFamily: "inherit",
  textDecoration: "underline", textUnderlineOffset: 2,
};
export function PlusIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

/** 見出しの鉛筆（セクションまるごとの編集）。行の鉛筆と同じ絵 */
export function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

/** 行の右端に出す鉛筆とゴミ箱。⚠️ `<a>` の**外**に置くこと（アンカーの入れ子は不正） */
export function RowActionButtons({ id, label, actions }: { id: string; label: string; actions: RowActions }) {
  if (!actions.onEditRow && !actions.onDeleteRow) return null;
  return (
    /* ⚠️ `gap` は 767px 以下で 8px になる（`.tap-row`）。2px のままだと
          44px の当たり判定どうしが重なり、削除と編集を押し間違える */
    <div className="tap-row" style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
      {actions.onEditRow && (
        <button
          type="button" className="btn-fixed-size tap-target"
          onClick={() => actions.onEditRow!(id)}
          aria-label={`${label} を編集`} title="編集"
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-mute)", padding: 6 }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
      )}
      {actions.onDeleteRow && (
        <button
          type="button" className="btn-fixed-size tap-target"
          onClick={() => actions.onDeleteRow!(id)}
          aria-label={`${label} を削除`} title="削除"
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-mute)", padding: 6 }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
          </svg>
        </button>
      )}
    </div>
  );
}


/**
 * 職歴の行の操作。`RowActions` に「この会社に役割を追加」を足したもの（2026-08-16 / 2-6）。
 *
 * ⚠️ `onAddRole` は**会社ごと**の入口。引数はその会社の職歴のうち**どれか1件の id**で、
 *    受け側（`CareerHistoryEditor`）がそこから会社を引き当てる。
 *    会社のキー文字列を渡さないのは、`MergedTimeline` と `CareerHistoryEditor` が
 *    別々のキー生成を持っていて、匿名企業の扱いが揃っていないため。
 */
export type CareerActions = RowActions & {
  onAddRole?: (careerId: string) => void;
};

/** 「＋ この会社に役割を追加」。会社グループの末尾に出す */
export function AddRoleLink({ careerId, onAddRole }: { careerId: string; onAddRole: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onAddRole(careerId)}
      style={{
        marginTop: 10, display: "inline-flex", alignItems: "center", gap: 4,
        padding: "5px 10px", background: "transparent", border: "1px dashed var(--line)",
        borderRadius: 8, fontSize: 12, fontWeight: 600, color: "var(--ink-soft)",
        cursor: "pointer", fontFamily: "inherit",
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
      この会社に役割を追加
    </button>
  );
}

/**
 * セクションの下に出す「すべて表示 →」（2026-08-17 / フェーズ3）。
 *
 * ⚠️ **N件以下のときは出さないこと。** 押しても同じ行しか出ないリンクになる。
 * ⚠️ 判定は「**画面に出した数 < 保存されている数**」で行う。件数そのものではない。
 *    年表に載らない行（入学年月が無い学歴など）は表示から落ちるので、
 *    件数で比べると「4件だから出さない」のに1件見えていない状態が作れる。
 */
export function SectionShowAll({ href, label, hiddenCount }: {
  href: string;
  /** 「学歴」「職歴」など。読み上げ用の文に使う */
  label: string;
  hiddenCount: number;
}) {
  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line-soft)" }}>
      <Link
        href={href}
        className="tap-min-h"
        aria-label={`${label}をすべて表示（他${hiddenCount}件）`}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13, fontWeight: 600, color: "var(--royal)", textDecoration: "none",
        }}
      >
        すべて表示
        <span style={{ color: "var(--ink-mute)", fontWeight: 500 }}>（他{hiddenCount}件）</span>
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
