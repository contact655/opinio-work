"use client";

import { PersonAvatar } from "@/components/common/PersonAvatar";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { SplitDivider } from "@/components/common/SplitDivider";
import { renderCandidateProfile } from "@/lib/profile/profileViewAction";
import { PanelExtraSectionsProvider, type PanelSection } from "@/components/profile/view/PanelProfileScroll";
/* ⚠️ この部品を使うページは、page.tsx で `PROFILE_CLIENT_MODULES` を参照すること（profileClientModules.ts の注記） */

/**
 * ★候補者のプロフィール欄（2026-10-11 / 柴さんの指示。LinkedIn Recruiter と同じく、画面を移らずに右側で確かめる）。
 *   候補者を探す（右欄）と メッセージ（右から出るドロワー）が**同じ部品**を使う。
 *
 * - 上の段（名前・新しいタブで開く・閉じる・`headerExtra`）は固定。中身だけがスクロールする
 * - 中身は /u/[id] と同じ関数（`UserProfileContent`）をサーバーで描いたもの（`renderCandidateProfile`）。
 *   ⚠️★見せてよいかの判定とデータの取り方は /u/[id] と同じ1か所。ここで取り直さない・条件を足さない
 * - `before` … プロフィールの前に出すもの（候補者を探すの「合うところ」「社内メモ」）
 * ⚠️ 状態はバッジにしない（灰色の文字）。
 * ★`sectioned` … 中身を節の目次（上に固定の帯）つきの1本のスクロールで出す。候補者を探すだけ（2026-10-12）。`extraSections` は右欄の側から足す節（社内メモ）
 * ★`after` … プロフィールの後に出す項目（候補者を探すの「メッセージ」）。下に固定する段は 2026-10-12 にやめた（1本のスクロールにした）
 * ★`tabs` … 中身を「プロフィール／メッセージ」のタブに分ける（2026-10-13 / 柴さんの指示。候補者を探すだけ）。
 *   ⚠️ 上の段（名前・年齢・意向・接点）はタブの外に固定で残す（誰とやり取りしているかが常に見える）。
 *   ⚠️ 2つのタブの中身は両方とも描いたまま隠すだけ（切り替えでプロフィールを読み直さない・書きかけの返信を消さない）。
 *   ⚠️ 選択中は下線だけ（ui-conventions「タブ」）。返信があるときはメッセージのタブに小さな点。
 */
export type PanelTab = "profile" | "messages";

export function CandidateProfilePanel({ userId, name, avatarUrl, avatarColorByName = false, meta, headerExtra, nameAction, headerRight, before, after, onClose, sectioned = false, extraSections, scrollRef, tabs, topBar, columns }: {
  /** ★段3（詳細を広く）の2列（2026-10-13）。渡したときはタブを使わず、左：プロフィール ／ 右：メッセージ を同時に出す。
   *   ⚠️ 各列は独立してスクロールする（ページ全体を動かさない）。列幅は プロフィール 最低320px・メッセージ 最低300px で残りを分け合う */
  columns?: {
    messages: ReactNode;
    /** 未読があるとき、見出しの右に小さな丸（数字は出さない。ui-conventions） */
    messagesDot?: boolean;
    messagesScrollRef?: React.Ref<HTMLDivElement>;
    /** ★2列の比率を覚える localStorage のキー（会社×利用者ごと。一覧｜右欄の比率とは別。2026-10-13）。null なら覚えない */
    storageKey?: string | null;
  };
  /** ★固定の段のいちばん上に置く操作の帯（候補者を探すの［メッセージ］［☆ 気になる］［見送り］［‹ ›］。2026-10-13） */
  topBar?: ReactNode;
  userId: string;
  /** 名前の右（新しいタブのアイコンの隣）に置くもの。候補者を探すの★（2026-10-12） */
  nameAction?: ReactNode;
  name: string;
  /** ★名前の段の写真（48px。2026-10-12）。undefined なら出さない／null なら頭文字の丸 */
  avatarUrl?: string | null;
  /** ★頭文字の丸を名前から決まった色で塗る（候補者を探すだけ。2026-10-13）。/biz/employees は渡さない */
  avatarColorByName?: boolean;
  /** 名前の下の灰色の1行（社会人〇年・職種など）。無ければ出さない */
  meta?: ReactNode;
  /** 固定の段に出すもの（メッセージを送る・送れない理由など） */
  headerExtra?: ReactNode;
  before?: ReactNode;
  /** 閉じる（✕）。⚠️ 渡さなければ ✕ を出さない（/biz/employees は常に誰かを出す。2026-10-12） */
  onClose?: () => void;
  sectioned?: boolean;
  extraSections?: PanelSection[];
  /** ★プロフィールの後に出すもの（候補者を探すの「メッセージ」の項目。2026-10-12 に下の固定欄から移した） */
  after?: ReactNode;
  /** ★名前の段の右（✕の手前）。「メッセージ（返信あり）↓」など */
  headerRight?: ReactNode;
  /** ★中身のスクロールの要素（ジャンプに使う） */
  scrollRef?: React.Ref<HTMLDivElement>;
  /** ★「プロフィール／メッセージ」のタブ（2026-10-13）。渡したときは `after` を使わない */
  tabs?: {
    active: PanelTab;
    onChange: (tab: PanelTab) => void;
    /** メッセージのタブの中身 */
    messages: ReactNode;
    /** 返信があるとき、メッセージのタブに点を出す */
    messagesDot?: boolean;
    /** メッセージのタブのスクロールの要素（開いたときに最新までスクロールする） */
    messagesScrollRef?: React.Ref<HTMLDivElement>;
  };
}) {
  const [content, setContent] = useState<ReactNode | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setContent(null); setFailed(false);
    renderCandidateProfile(userId, { sectioned })
      .then((node) => { if (alive) setContent(node); })
      .catch((e) => { console.error("[CandidateProfilePanel]", e); if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [userId, sectioned]);

  return (
    <div data-state="candidate-profile-panel" style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* 固定の段 */}
      <div style={{ flexShrink: 0, padding: tabs && !columns ? "16px 20px 0" : "16px 20px 12px", borderBottom: "1px solid var(--line)", background: "#fff" }}>
        {topBar}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          {avatarUrl !== undefined && <div style={{ marginRight: 4 }}><PersonAvatar name={name} url={avatarUrl} size={48} fontSize={18} colorByName={avatarColorByName} /></div>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--ink)", overflowWrap: "anywhere" }}>{name}</h2>
              {/* ★「プロフィール全体を見る」ボタンの代わり。新しいタブで /u/[id] を開く小さなアイコン */}
              <a href={`/u/${userId}`} target="_blank" rel="noopener noreferrer" aria-label={`${name}さんのプロフィールを新しいタブで開く`} title="新しいタブで開く"
                data-state="profile-newtab" className="btn-fixed-size"
                style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, color: "var(--ink-mute)" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
              {nameAction}
            </div>
            {meta && <div style={{ fontSize: 12.5, color: "var(--ink-mute)", marginTop: 4, overflowWrap: "anywhere" }}>{meta}</div>}
          </div>
          {headerRight}
          {onClose && (
            <button type="button" onClick={onClose} aria-label="閉じる"
              style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: "var(--ink-mute)", fontSize: 16, padding: 4 }}>✕</button>
          )}
        </div>
        {headerExtra}
        {tabs && !columns && (
          <div role="tablist" aria-label="表示する内容" data-state="panel-tabs" style={{ display: "flex", gap: 20, marginTop: 10 }}>
            {(["profile", "messages"] as const).map((t) => {
              const on = tabs.active === t;
              return (
                <button key={t} type="button" role="tab" id={`cpp-tab-${t}`} aria-selected={on} aria-controls={`cpp-panel-${t}`}
                  data-state={`tab-${t}${on ? "-active" : ""}`} onClick={() => tabs.onChange(t)}
                  style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 2px 9px", background: "none", border: "none",
                    borderBottom: on ? "2px solid var(--royal)" : "2px solid transparent", marginBottom: -1,
                    fontSize: 13, fontWeight: on ? 700 : 500, color: on ? "var(--ink)" : "var(--ink-mute)", cursor: "pointer", fontFamily: "inherit" }}>
                  {t === "profile" ? "プロフィール" : "メッセージ"}
                  {t === "messages" && tabs.messagesDot && (
                    <span data-state="tab-messages-dot" aria-label="返信があります" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--royal)" }} />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {/* ★段3（2026-10-13）。左：プロフィール ／ 右：メッセージ。⚠️ どちらも overflow:auto のスクロール容器
            （メッセージの「前を読む」がページ全体を動かさないように。PaneThread の scrollParent がここを拾う） */}
      {columns && (
        <ColumnsSplit storageKey={columns.storageKey ?? null}>
          <div ref={scrollRef} data-state="candidate-profile-scroll" style={{ minWidth: 0, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", padding: "4px 20px 20px" }}>
            {before}
            <PanelExtraSectionsProvider sections={extraSections ?? []}>
              {failed ? (
                <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "12px 4px" }}>プロフィールを読み込めませんでした。</p>
              ) : content ?? (
                <p data-state="profile-loading" style={{ fontSize: 13, color: "var(--ink-mute)", margin: "12px 4px" }}>読み込み中…</p>
              )}
            </PanelExtraSectionsProvider>
          </div>
          <div ref={columns.messagesScrollRef} data-state="candidate-messages-scroll" style={{ minWidth: 0, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", padding: "12px 20px 20px", background: "var(--bg-tint)" }}>
            <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
              メッセージ
              {columns.messagesDot && <span data-state="col-messages-dot" aria-label="未読があります" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--royal)" }} />}
            </h3>
            <p style={{ margin: "2px 0 10px", fontSize: 11.5, color: "var(--ink-mute)", lineHeight: 1.6 }}>既読は、この欄で入力やスクロールをしたときに付きます</p>
            {columns.messages}
          </div>
        </ColumnsSplit>
      )}
      {/* ★メッセージのタブ（2026-10-13）。⚠️ 隠すだけで描いたまま（書きかけの返信を消さない） */}
      {tabs && !columns && (
        <div ref={tabs.messagesScrollRef} role="tabpanel" id="cpp-panel-messages" aria-labelledby="cpp-tab-messages" data-state="candidate-messages-scroll"
          style={{ display: tabs.active === "messages" ? "block" : "none", flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", padding: "12px 20px 20px" }}>
          {tabs.messages}
        </div>
      )}
      {/* 中身（ここだけスクロール） */}
      {!columns && <div ref={scrollRef} data-state="candidate-profile-scroll" role={tabs ? "tabpanel" : undefined} id={tabs ? "cpp-panel-profile" : undefined}
        aria-labelledby={tabs ? "cpp-tab-profile" : undefined}
        style={{ display: tabs && tabs.active !== "profile" ? "none" : "block", flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", padding: "4px 20px 20px" }}>
        {before}
        <PanelExtraSectionsProvider sections={extraSections ?? []}>
          {failed ? (
            <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "12px 4px" }}>プロフィールを読み込めませんでした。</p>
          ) : content ?? (
            <p data-state="profile-loading" style={{ fontSize: 13, color: "var(--ink-mute)", margin: "12px 4px" }}>読み込み中…</p>
          )}
        </PanelExtraSectionsProvider>
        {/* ⚠️ プロフィールが読めるまで出さない（先に出すと、読み込み後に位置が下へずれる） */}
        {!tabs && (content || failed) && after}
      </div>}
    </div>
  );
}

/* ── ★2列表示の「プロフィール｜メッセージ」の幅（2026-10-13 / 柴さんの指示）───────────────────────────
   一覧｜右欄と同じ区切り線（`SplitDivider`）。最小幅は プロフィール 320px・メッセージ 300px。既定はプロフィール 55%（それまでの 1.2fr : 1fr に合わせた）。
   比率は外側（一覧｜右欄）とは別に、会社×利用者ごとに localStorage へ覚える（読めなければ既定）。
   ⚠️ 割合で持つので、外側の線を動かして右欄の幅が変わっても比率は保たれる。
   ⚠️ 2列になるのは右欄が 680px 以上のときだけ（それ未満はタブ。CandidatesClient の CAND_COLUMNS_MIN_PANE）。タブのときはこの線は描かない。
   ⚠️ 線を動かしても既読は付けない（既読はメッセージ欄の中での入力・ホイール・キー操作だけ。PreviewApproachArea）。 */
const COLS_DIVIDER_W = 12;
const COLS_PROFILE_MIN = 320;
const COLS_MESSAGES_MIN = 300;
const COLS_DEFAULT_RATIO = 0.55;

function ColumnsSplit({ storageKey, children }: { storageKey: string | null; children: [ReactNode, ReactNode] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState<number | null>(null);
  const [ratio, setRatio] = useState(COLS_DEFAULT_RATIO);
  useEffect(() => {
    if (!storageKey) return;
    try {
      const v = Number(window.localStorage.getItem(storageKey) ?? NaN);
      if (Number.isFinite(v) && v > 0 && v < 1) setRatio(v);
    } catch { /* 既定のまま */ }
  }, [storageKey]);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setW(el.clientWidth);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);
  const inner = w !== null ? w - COLS_DIVIDER_W : null;
  const clamp = useCallback((px: number, total: number) => Math.max(COLS_PROFILE_MIN, Math.min(total - COLS_MESSAGES_MIN, px)), []);
  const profilePx = inner !== null ? clamp(Math.round(ratio * inner), inner) : null;
  const setProfilePx = useCallback((px: number, save: boolean) => {
    if (inner === null || inner <= 0) return;
    const r = clamp(px, inner) / inner;
    setRatio(r);
    if (save && storageKey) { try { window.localStorage.setItem(storageKey, r.toFixed(4)); } catch { /* 覚えられなくても続ける */ } }
  }, [inner, clamp, storageKey]);
  return (
    <div ref={ref} data-state="candidate-columns"
      style={{ flex: 1, minHeight: 0, display: "grid",
        gridTemplateColumns: profilePx !== null ? `${profilePx}px ${COLS_DIVIDER_W}px minmax(${COLS_MESSAGES_MIN}px, 1fr)` : `minmax(${COLS_PROFILE_MIN}px, 1.2fr) ${COLS_DIVIDER_W}px minmax(${COLS_MESSAGES_MIN}px, 1fr)` }}>
      {children[0]}
      <SplitDivider containerRef={ref} firstPx={profilePx} totalPx={inner} width={COLS_DIVIDER_W} grip="center"
        dataState="cand-columns-divider" ariaLabel="プロフィールとメッセージの幅" valueLabel="プロフィール"
        title="ドラッグで幅を変える（ダブルクリックで元に戻す）"
        onMove={setProfilePx} onReset={() => { if (inner !== null) setProfilePx(Math.round(inner * COLS_DEFAULT_RATIO), true); }} />
      {children[1]}
    </div>
  );
}
