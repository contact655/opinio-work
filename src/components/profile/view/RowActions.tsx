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
  /** ★行のアイコンの大きさ（2026-09-12）。
      `md` は職歴・学歴の行だけ（アイコン18px・当たり判定32px）。
      ⚠️ **既定（`sm`）は変えていない。** 実績・受賞・メディア・発信コンテンツの行は従来どおり。 */
  size?: "sm" | "md";
  /** 行のゴミ箱。渡さなければ削除を出さない */
  onDeleteRow?: (id: string) => void;
  /** 見出しの「追加」。★`/mypage` では同じページなのでリンクではなくボタンにする */
  onAdd?: () => void;
  /** ★見出しの「✎」→ 一覧ページ（2026-08-17 / フェーズ3）。
      **本体では行ごとの鉛筆を出さず、1件ずつ触るのは一覧ページに寄せる。** */
  manageHref?: string;
  manageLabel?: string;
};

/** 見出しの右端に出す「✎」（一覧ページへのリンク）。⚠️ 見た目を各セクションで書き分けない */
export function SectionManageLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="tap-target tap-target-end" aria-label={label} title={label} style={sectionAddBtn}>
      <PencilIcon />
    </Link>
  );
}

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

/** 見出しの鉛筆（セクションまるごとの編集）。行の鉛筆と同じ絵。
    ⚠️ `size` は 2026-09-12 に足した。**既定（13）は変えていない** ——
       大きくしているのは職歴の見出しだけで、他の節は今までどおり。 */
export function PencilIcon({ size = 13 }: { size?: number } = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

/** 行の右端に出す鉛筆とゴミ箱。⚠️ `<a>` の**外**に置くこと（アンカーの入れ子は不正） */
export function RowActionButtons({ id, label, actions }: { id: string; label: string; actions: RowActions }) {
  if (!actions.onEditRow && !actions.onDeleteRow) return null;
  /* ★`md` は職歴・学歴の行（2026-09-12）。見出しから ✎ を外して**行の鉛筆が唯一の入口**に
     なったので、`sm`（15px / 当たり判定27px）では小さすぎる。
     ⚠️ 767px 以下は `.tap-target` が 44px にするので、ここは下限。 */
  const md = actions.size === "md";
  const icon = md ? 18 : 15;
  const box = md ? 32 : undefined;
  const btnStyle: React.CSSProperties = {
    background: "none", border: "none", cursor: "pointer", color: "var(--ink-mute)",
    padding: md ? 0 : 6,
    ...(md ? { width: box, height: box, display: "inline-flex", alignItems: "center", justifyContent: "center" } : null),
  };
  return (
    /* ⚠️ `gap` は 767px 以下で 8px になる（`.tap-row`）。2px のままだと
          44px の当たり判定どうしが重なり、削除と編集を押し間違える */
    <div className="tap-row" style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
      {actions.onEditRow && (
        <button
          type="button" className="btn-fixed-size tap-target"
          onClick={() => actions.onEditRow!(id)}
          aria-label={`${label} を編集`} title="編集"
          style={btnStyle}
        >
          <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
      )}
      {actions.onDeleteRow && (
        <button
          type="button" className="btn-fixed-size tap-target"
          onClick={() => actions.onDeleteRow!(id)}
          aria-label={`${label} を削除`} title="削除"
          style={btnStyle}
        >
          <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
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
  /** ★会社の行の鉛筆（2026-09-12）。引数はその会社の役割のうち**どれか1件の id**。
      受け側がそこから会社を引き当てる（`onAddRole` と同じ規約）。
      ⚠️ 編集できるのは**会社名だけ**。雇用形態は役割の項目なので役割の鉛筆から。 */
  onEditCompany?: (careerId: string) => void;
};

/** 「＋ この会社に役割を追加」。会社グループの末尾に出す */
export function AddRoleLink({ careerId, onAddRole }: { careerId: string; onAddRole: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onAddRole(careerId)}
      /* ⚠️★767px 以下で 44px にする（2026-09-12）。モーダルの中の補助リンクだった頃は
            36px でよかったが、本体に出して**役割を足す唯一の入口**になったので下限を満たす。 */
      className="tap-min-h"
      style={{
        marginTop: 10, display: "inline-flex", alignItems: "center", gap: 4,
        padding: "8px 12px", background: "transparent", border: "1px dashed var(--line)",
        borderRadius: 8, fontSize: 12, fontWeight: 600, color: "var(--ink-soft)",
        cursor: "pointer", fontFamily: "inherit",
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
      {/* ⚠️★文言は「この会社での異動・昇進を追加」（2026-09-12 / 柴さんの指示）。
             「役割を追加」だと何を足すのか読めなかった。 */}
      この会社での異動・昇進を追加
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
/**
 * ★その場で展開する「すべて表示 ／ 閉じる」（2026-09-12）。
 *
 * ⚠️★**職歴・学歴は一覧ページへ送るのをやめた**（`/mypage/details/*` は `/mypage` へ転送）。
 *    リンク（`SectionShowAll`）ではなくトグルにする。
 * ⚠️ 判定は従来どおり「**画面に出した数 < 保存されている数**」。件数そのものではない。
 */
export function SectionShowAllToggle({ label, hiddenCount, expanded, onToggle }: {
  label: string;
  hiddenCount: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line-soft)" }}>
      <button
        type="button"
        onClick={onToggle}
        className="tap-min-h"
        aria-expanded={expanded}
        aria-label={expanded ? `${label}を折りたたむ` : `${label}をすべて表示（他${hiddenCount}件）`}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: 0,
          background: "none", border: "none", fontFamily: "inherit",
          fontSize: 13, fontWeight: 600, color: "var(--royal)", cursor: "pointer",
        }}
      >
        {expanded ? "閉じる" : "すべて表示"}
        {!expanded && <span style={{ color: "var(--ink-mute)", fontWeight: 500 }}>（他{hiddenCount}件）</span>}
        <span aria-hidden="true">{expanded ? "↑" : "↓"}</span>
      </button>
    </div>
  );
}

/**
 * ★セクションの下に置く「＋ 〇〇を追加」（2026-09-12）。
 *
 * ⚠️★**0件でも1件以上でも常に出す。** 見出しから ＋ を外したので、
 *    **これが唯一の追加の入口**（職歴・学歴）。丸い ＋（`SectionAddCircle`）と違い、
 *    何を足すのかが読めるようにラベルを置く。
 */
export function SectionAddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div style={{ marginTop: 16 }}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="tap-min-h"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "9px 16px", borderRadius: 8,
          border: "1.5px dashed var(--line)", background: "#fff",
          color: "var(--royal)", fontSize: 13, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        {label}
      </button>
    </div>
  );
}

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

/**
 * セクションの下に置く**丸い ＋**（2026-08-17）。
 *
 * 0件のセクションで「〇〇を追加する」という文中リンクの代わりに使う。
 * ⚠️ **中央に置く。** 文の中に混ぜると、読む文と押す物が同じ行に並んで区別しにくい。
 * ⚠️ 見出しの ✎ と役割が重なるが、**押した先は同じ追加モーダル**なので入口は2つのまま
 *    （文中リンク → この ＋ に置き換えただけ。ルール⑧の数は変わらない）。
 */
export function SectionAddCircle({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={label}
        className="btn-fixed-size"
        style={{
          width: 44, height: 44, borderRadius: "50%",
          border: "1.5px dashed var(--line)", background: "#fff",
          color: "var(--royal)", cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "border-color 0.15s, background 0.15s",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
