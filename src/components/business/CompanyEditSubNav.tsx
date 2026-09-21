"use client";

import type { CompanySectionId } from "@/lib/business/mockCompany";

export type CompanySubNavSection = {
  id: CompanySectionId;
  label: string;
  showStatus: boolean;
  hasDraft?: boolean;
  /**
   * ★そのタブに「対応が要ること」があるか（2026-09-18）。いまは掲載規約の未同意だけ。
   * ⚠️ 下書きの有無（`hasDraft`）とは**別物**。あちらは「保存したが未公開」、
   *    こちらは「このままだと公開できない」。**同じ印にしないこと。**
   */
  needsAttention?: boolean;
};

type Props = {
  sections: CompanySubNavSection[];
  activeSection: string;
  onSectionClick: (id: string) => void;
  hasDraftChanges: boolean;
  /**
   * ★公開ページ（`/companies/[id]`）が存在するか（2026-09-20 / 柴さんの指示）。
   *
   * ⚠️ 2026-09-21 まで同じURLを開く「プレビュー」もあった（編集中の内容ではなく
   *    **公開済みのページ**を開いていた）。外したので、いまは「公開ページを見る」1つ。
   * ⚠️★**`lastPublishedAt` で判定しないこと**（2026-09-20 まではそうだった）。
   *    あれは `published_at` 由来で、取り下げても消えない列。実測では
   *    **79社が `is_published=true` なのに `published_at` が null** で、
   *    「見えるのにボタンが出ない」状態だった。
   * ⚠️ 判定の本体は `lib/companies/visibility.ts` の `hasPublicCompanyPage`。
   */
  hasPublicPage?: boolean;
  lastPublishedAt?: string;
  onViewPublicPage?: () => void;
  onPublish?: () => void;
  isPublishing?: boolean;
  isAdmin?: boolean;
  termsAgreed?: boolean;
  saveState?: "idle" | "saving" | "saved" | "error";
  saveStatusText?: string;
  onRetrySave?: () => void;
};

/**
 * ★企業ページ編集の上部（2026-09-21 / 柴さん）。
 *
 * それまでは**サイドバーの右にもう1本の縦の列**（公開ボタン・タブ・「公開ページを見る」・
 * 開示充実度）があり、入力欄が右へ押し出されていた。いまは
 *   見出し＋公開の状態＋操作 → 横並びのタブ
 * の2段にして、入力欄は幅いっぱいを使う。
 *
 * ⚠️★「プレビュー」は戻さないこと。**公開済みのページ**を開いていて、編集中の内容は
 *    見えなかった（変更してから押すと古いページが出る）。下書きの本物のプレビューを作るなら別の作業。
 * ⚠️ 開示充実度はダッシュボードに出している（「まだ入れていない項目」付き）。ここに戻さない。
 * ⚠️ 名前は `CompanyEditSubNav` のまま（呼び出し側と検証の data 属性を変えないため）。
 */
export function CompanyEditSubNav({
  sections,
  activeSection,
  onSectionClick,
  hasDraftChanges,
  hasPublicPage = false,
  lastPublishedAt,
  onViewPublicPage,
  onPublish,
  isPublishing,
  isAdmin,
  termsAgreed,
  saveState,
  saveStatusText,
  onRetrySave,
}: Props) {
  return (
    <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
      {/* 1段目: 見出し・状態・操作 */}
      {/* ⚠️ 左右の余白はインラインに書かない（狭い画面で詰めるため。下の style タグ） */}
      <div className="biz-company-head" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>企業ページ</h1>

        {/* 公開の状態。⚠️ 色だけで伝えない（文言で言う） */}
        {hasDraftChanges ? (
          <span data-state="draft" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 100, background: "var(--warm-soft)", border: "1px solid #FDE68A", fontSize: 12, fontWeight: 600, color: "var(--warm-ink)" }}>
            <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--warm-strong)" }} />
            未公開の変更あり
          </span>
        ) : (
          <span data-state="published" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 100, background: "var(--success-soft)", border: "1px solid #A7F3D0", fontSize: 12, fontWeight: 600, color: "var(--success-ink)" }}>
            公開済み・最新
          </span>
        )}
        {/* ⚠️ 日付が無いなら出さない（推測の日付を出さない） */}
        {lastPublishedAt && (
          <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>最終公開 {lastPublishedAt}</span>
        )}

        {/* 保存状態 */}
        {saveState && saveState !== "idle" && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: saveState === "error" ? "var(--error)" : "var(--ink-mute)", fontWeight: 500 }}>
            {saveStatusText}
            {saveState === "error" && onRetrySave && (
              <button type="button" onClick={onRetrySave} style={{ marginLeft: 4, fontSize: 12, fontWeight: 600, color: "var(--error)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", fontFamily: "inherit" }}>再試行</button>
            )}
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* ★公開ページが無いときは出さない（押すと 404）。判定は hasPublicCompanyPage */}
        {hasPublicPage && (
          <button type="button" onClick={onViewPublicPage} className="btn-fixed-size"
            style={{ height: 34, padding: "0 14px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", color: "var(--ink)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            公開ページを見る
          </button>
        )}
        {/* ★未同意のときは公開ボタンの代わりに、どこで同意するかを出す（2026-09-18 の方針のまま）。
               ⚠️ それまで同じ案内がウィンドウ右上にも固定で出ていたが、ヘッダーの
                  「ヘルプ」とアカウントメニューに重なるので 2026-09-21 にここへ一本化した */}
        {isAdmin && !termsAgreed && (
          <button type="button" onClick={() => onSectionClick("settings")}
            style={{ height: 34, padding: "0 12px", borderRadius: 8, border: "1px solid #FDE68A", background: "var(--warm-soft)", color: "var(--warm-ink)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            公開には掲載利用規約への同意が必要です（設定タブ）
          </button>
        )}
        {isAdmin && termsAgreed && (
          <button type="button" onClick={onPublish} disabled={isPublishing || !hasDraftChanges} className="btn-fixed-size"
            style={{ height: 34, padding: "0 16px", borderRadius: 8, border: "none", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit",
              cursor: (isPublishing || !hasDraftChanges) ? "not-allowed" : "pointer",
              background: hasDraftChanges ? "var(--royal)" : "var(--line)", color: hasDraftChanges ? "#fff" : "var(--ink-mute)",
              opacity: isPublishing ? 0.7 : 1 }}>
            {isPublishing ? "公開中..." : hasDraftChanges ? "変更を公開する" : "公開済み"}
          </button>
        )}
      </div>

      {/* 2段目: タブ */}
      <nav aria-label="企業ページの項目" className="biz-company-tabs" style={{ display: "flex", gap: 2, overflowX: "auto", scrollbarWidth: "none" }}>
        {sections.map((s) => {
          const isActive = s.id === activeSection;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSectionClick(s.id)}
              /* ⚠️ 検証で状態を読むための属性。ラベル（「設定」など）で判定しない */
              data-tab={s.id}
              data-state={isActive ? "active" : "inactive"}
              data-attention={s.needsAttention ? "true" : "false"}
              aria-current={isActive ? "page" : undefined}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "10px 12px", marginBottom: -1,
                fontSize: 13, fontWeight: isActive ? 700 : 500,
                color: isActive ? "var(--royal)" : "var(--ink-soft)",
                background: "none", border: "none",
                borderBottom: `2px solid ${isActive ? "var(--royal)" : "transparent"}`,
                cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
              }}
            >
              {s.label}
              {/* ★未対応の印。いまは掲載規約の未同意だけが立てる。
                  ⚠️ 色だけで伝えない。`aria-label` と `title` を必ず付ける。 */}
              {s.needsAttention && (
                <span role="img" aria-label="対応が必要です" title="対応が必要です"
                  style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--warm-strong)", flexShrink: 0 }} />
              )}
              {/* ⚠️ タブごとの「下書きあり」は 2026-09-21 に外した。未公開の変更があると
                     4タブ全部に同時に付き、どのタブの話か分からなかった。状態は1段目に1つだけ出す */}
            </button>
          );
        })}
      </nav>
      <style>{`
        .biz-company-head { padding: 16px 32px 10px; }
        .biz-company-tabs { padding: 0 24px; }
        .biz-company-body { padding: 28px 32px 60px; }
        @media (max-width: 768px) {
          .biz-company-head { padding: 12px 12px 8px; }
          .biz-company-tabs { padding: 0 4px; }
          .biz-company-body { padding: 16px 0 48px; }
        }
      `}</style>
    </div>
  );
}
