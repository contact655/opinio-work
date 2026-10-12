"use client";
import { can, ROLE_LABELS, type CompanyAction } from "@/lib/auth/roles";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { createClient } from "@/lib/supabase/client";
import { CompanySwitcher } from "./CompanySwitcher";
import type { TenantCompany } from "@/lib/business/dashboard";
import { LayoutGrid, Building2, Briefcase, Users, Newspaper, ChevronDown, Layers, BarChart2, Inbox, UsersRound, Search, FileText, Calendar, ExternalLink, HelpCircle, ArrowLeftRight, User, LogOut, PanelLeft } from "lucide-react";
import { useBizShell } from "./BizShellContext";
import OpinioLogo from "@/components/common/OpinioLogo";

type BusinessLayoutVariant = "default" | "fullBleed";

/* ★サイドバーをしまう（2026-10-12 / 柴さんの指示）。状態は <html data-biz-sidebar="collapsed"> と localStorage。
      ⚠️ 最初の表示で「開いた → しまった」に切り替わって見えないよう、**描画の前に**この小さなスクリプトで属性を付ける
         （見た目は CSS が属性を見て決める。React の state は aria-expanded とツールチップのためだけ）。
      ⚠️ 読み書きは try/catch。保存できない環境では開いた状態のまま。
      ⚠️ 1024px 未満では効かない（CSS のメディアクエリの中だけで切り替える）。 */
const SIDEBAR_KEY = "biz-sidebar";
/* ★サイドバーの幅を変える（2026-10-12 / 柴さんの指示。Claude と同じ形）。右端の線をドラッグすると幅が変わり、押すとしまう／開く。
      幅は <html style="--biz-sidebar-open-w: …px"> と localStorage。⚠️ 開閉と同じく描画の前に付ける（読み込みで幅が動いて見えないように）。
      ⚠️ 1024px 以上だけで効く（CSS は --biz-sidebar-open-w をメディアクエリの中でだけ読む）。 */
const SIDEBAR_W_KEY = "biz-sidebar-w";
const SIDEBAR_W_DEFAULT = 240;
/* ⚠️ 下限は既定と同じ 240。これより狭いと「求職者から見た企業ページ ↗」が2行に折れる（実測で 235px 要る）。
      狭くしたいときは、しまう（64px）を使う */
const SIDEBAR_W_MIN = 240;
const SIDEBAR_W_MAX = 400;
/** 開いた状態でこれより左まで引いたら、しまう */
const SIDEBAR_SNAP_COLLAPSE = 140;
const clampSidebarW = (w: number) => Math.min(SIDEBAR_W_MAX, Math.max(SIDEBAR_W_MIN, Math.round(w)));
const SIDEBAR_INIT = `try{var d=document.documentElement;if(localStorage.getItem("${SIDEBAR_KEY}")==="collapsed")d.setAttribute("data-biz-sidebar","collapsed");var w=parseInt(localStorage.getItem("${SIDEBAR_W_KEY}")||"",10);if(w>=${SIDEBAR_W_MIN}&&w<=${SIDEBAR_W_MAX})d.style.setProperty("--biz-sidebar-open-w",w+"px")}catch(e){}`;

type Props = {
  userName: string;
  tenantName?: string;
  tenantLogoGradient?: string | null;
  tenantLogoLetter?: string | null;
  variant?: BusinessLayoutVariant;
  /**
   * ★本文の最大幅（px）。既定は 1200（2026-10-10 に足した）。
   * ⚠️ 2列（一覧＋右のプレビュー）のページだけが広げる。他のページは渡さないこと。
   * ★`"none"` … 上限なし（2026-10-13。/biz/candidates だけ。一覧と詳細の幅を3段で切り替えるため、広い画面で余白を残さない）
   */
  mainMaxWidth?: number | "none";
  children: React.ReactNode;
  memberships?: TenantCompany[];
  currentTenantId?: string;
  /**
   * ⚠️★**企業が紐付いていないときは `false` を渡す**（2026-09-04 / 柴さんの指摘）。
   *
   * 企業が無いのに **12項目のサイドバーが出ていた。** 押すと `BizNoTenantPage`
   * （「企業アカウントが必要です」）へ着くだけで、**どれ一つ使えない。**
   * 登録直後・承認待ちの人には「使える機能が並んでいる」ようにしか見えず、
   * 押して初めて行き止まりだと分かる形だった。
   *
   * ⚠️ 灰色にして無効化する案は採らない。**押せないものを並べる意味が無い**
   *    （CLAUDE.md「値が無いことを、ある値に置き換えない」と同じ）。**出さない。**
   *
   * ⚠️ `loading.tsx` の骨組みには渡さないこと（既定の `true` のまま）。
   *    あれは**企業がある人**のページの骨組みで、`false` にすると
   *    サイドバーが消えてから生えるちらつきになる。
   */
  hasCompany?: boolean;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactElement;
  /** ★未読バッジの出どころ（2026-09-21）。値は `BizShellContext` の `badges` */
  badge?: "messages" | "proposals";
  /** ★この項目を出す条件（2026-10-12）。いずれかの操作ができれば出す。⚠️ 判定は can() の1か所 */
  needs: CompanyAction[];
  children?: { href: string; label: string }[];
};

/* ★2026-09-21 にグループ分けした（柴さん。YOUTRUST / LinkedIn Recruiter / ビズリーチを参考）。
      それまでは「採用活動」の見出し1つに13項目が平たく並び、候補者まわり
      （探す・提案・選考・メッセージ）と自社の見せ方（企業ページ・組織・社員・投稿）が
      交互に出ていた。
   ⚠️★**並びは採用の流れの順**（出会う → やり取り・選考 → 会社を伝える → 管理）。
      ビズリーチの「探す → 声をかける → 選考」と同じ向き。**五十音やよく使う順に並べ替えないこと。**
   ⚠️ 見出しは狭い画面（≤768px）では隠れる（横スクロールの列に混ぜない）。
      だから**見出しが無くても意味が通るラベル**にしておくこと。 */
const NAV_GROUPS: { heading: string | null; items: NavItem[] }[] = [
  {
    heading: null,
    items: [
      { href: "/biz/dashboard", label: "ホーム", needs: ["dashboard.view"], icon: <LayoutGrid size={16} strokeWidth={2.2} /> },
    ],
  },
  {
    heading: "候補者と出会う",
    items: [
      { href: "/biz/candidates", label: "候補者を探す", needs: ["candidates.viewProfile"], icon: <Search size={16} strokeWidth={2.2} /> },
      /* ★「メッセージリクエスト」の行は 2026-10-11 に外した（柴さんの指示）。企業から送る1通目も
            「やり取り・選考」の「メッセージ」（/biz/messages の返事待ちタブ）にまとめた。旧 URL は 301 で転送。 */
      /* ★「紹介」の行は 2026-10-11 に外した（柴さんの指示。「紹介」は人材紹介と紛らわしいため）。
            求職者が「話を聞いてみたい」と答えた方は「メッセージ」に届く（一覧で「貴社に興味があります」と出る）。
            旧 URL /biz/proposals は next.config.mjs が /biz/messages へ 301 で転送する。⚠️ 戻さないこと */
      /* ⚠️★「スカウト履歴」は 2026-10-08 にスカウトごと廃止した。**戻さないこと。**
            旧 URL `/biz/scouts` は middleware が `/biz/messages` へ転送する。 */
    ],
  },
  {
    heading: "やり取り・選考",
    items: [
      /* ★バッジは「未読のある会話 ∪ 返信があってまだ開いていない会話」の数（2026-10-11。`lib/business/navBadges.ts`） */
      { href: "/biz/messages", label: "メッセージ", needs: ["messages.use"], icon: <Inbox size={16} strokeWidth={2.2} />, badge: "messages" },
      { href: "/biz/meetings", label: "選考管理", needs: ["selection.view", "selection.viewAssigned"], icon: <Calendar size={16} strokeWidth={2.2} /> },
    ],
  },
  {
    heading: "会社を伝える",
    items: [
      { href: "/biz/jobs", label: "求人管理", needs: ["jobs.view"], icon: <Briefcase size={16} strokeWidth={2.2} /> },
      /* ★2026-09-21 に「組織体制」から改名し、求人管理の直下へ移した。
            ここで登録する部門・職種は**求人作成の選択肢としてだけ**使われる（社員登録・
            求職者向けのページには出ない）。旧名は企業ページの「組織体制」欄と同じ名前だった。
         ⚠️ パスは /biz/organization のまま（変えていない） */
      { href: "/biz/organization", label: "部門・職種", needs: ["organization.manage"], icon: <Layers size={16} strokeWidth={2.2} /> },
      /* ⚠️ 2026-09-21 に「企業情報」から改名。求職者に見える**公開ページの編集**だと
            分かるようにするため。パスは `/biz/company` のまま（変えていない）。 */
      { href: "/biz/company", label: "企業ページ", needs: ["company.page"], icon: <Building2 size={16} strokeWidth={2.2} /> },
      /* ★企業資料（2026-10-09 / 依頼②）。資料を登録し、項目ごとに公開範囲を決めて確定する。
            ⚠️ 企業ページのタブにしなかった理由: 「内部のみ」の項目（企業ページに出ないもの）を含み、
               確定も項目ごとに即時に保存する（企業ページの下書き → 「変更を公開する」とは作りが違う） */
      { href: "/biz/materials", label: "企業資料", needs: ["materials.view"], icon: <FileText size={16} strokeWidth={2.2} /> },
      { href: "/biz/employees", label: "社員・OB/OG", needs: ["employees.manage"], icon: <UsersRound size={16} strokeWidth={2.2} /> },
      /* ★2026-09-21 に「投稿・発信」から改名（外部リンクのタブを外し、中身がストーリーだけになった） */
      { href: "/biz/posts", label: "企業ストーリー", needs: ["stories.edit"], icon: <Newspaper size={16} strokeWidth={2.2} /> },
    ],
  },
  {
    heading: "管理",
    items: [
      { href: "/biz/analytics", label: "分析", needs: ["analytics.view"], icon: <BarChart2 size={16} strokeWidth={2.2} /> },
      { href: "/biz/members", label: "メンバーと権限", needs: ["members.manage"], icon: <Users size={16} strokeWidth={2.2} /> },
    ],
  },
];


/**
 * ★サイドバーとヘッダーは /biz の共通レイアウトで1回だけ描く（2026-10-12 / 柴さんの指示）。
 *
 *   それまでは各ページ（と各 loading.tsx）が自分で `BusinessLayout` を描いており、
 *   ページを移るたびにサイドバーごと作り直されていた。しかも loading.tsx は
 *   `userName=""` だけを渡すので、**読み込み中は企業の切り替えの枠が消え、全項目が上へずれていた。**
 *
 *   いまは `app/biz/layout.tsx` が `BizFrame` で枠（ヘッダー・サイドバー）を描き、
 *   ページ側の `BusinessLayout` は**枠の中では本文（main）だけ**を返す。
 *   枠が無いところ（ログイン前・企業の参加画面・企業が取れないとき）は従来どおり全部を描く。
 * ⚠️ ページの props（tenantName など）は枠の中では使わない（枠は layout の `getTenantContext` から描く。
 *    `cache` で同じ値になる）。本文の幅（`mainMaxWidth`・`variant`・`hasCompany`）だけ効く。
 */
const BizFrameContext = createContext(false);

function mainStyleOf(variant: BusinessLayoutVariant, hasCompany: boolean, mainMaxWidth: number | "none"): React.CSSProperties {
  return variant === "fullBleed"
    ? { padding: 0, minWidth: 0, overflow: "hidden" }
    : hasCompany
      ? { padding: "28px 36px 60px", maxWidth: mainMaxWidth, minWidth: 0 }
      : { padding: "28px 36px 60px", maxWidth: 960, minWidth: 0, margin: "0 auto", width: "100%" };
}

export function BusinessLayout(props: Props) {
  const framed = useContext(BizFrameContext);
  if (framed) {
    return (
      <main id="main-content" className="biz-layout-main" style={mainStyleOf(props.variant ?? "default", props.hasCompany ?? true, props.mainMaxWidth ?? 1200)}>
        {props.children}
      </main>
    );
  }
  return <BusinessChrome {...props} />;
}

/** ★/biz の共通レイアウトが描く枠。中のページの `BusinessLayout` は本文だけを返す */
export function BizFrame({ children, ...props }: Omit<Props, "children" | "variant" | "mainMaxWidth" | "hasCompany"> & { children: React.ReactNode }) {
  return (
    <BizFrameContext.Provider value={true}>
      <BusinessChrome {...props} frame>{children}</BusinessChrome>
    </BizFrameContext.Provider>
  );
}

function BusinessChrome({
  userName,
  tenantName,
  tenantLogoGradient,
  tenantLogoLetter,
  variant = "default",
  mainMaxWidth = 1200,
  children,
  memberships,
  currentTenantId,
  hasCompany = true,
  frame = false,
}: Props & { frame?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const shell = useBizShell();

  /* ★未読バッジ（2026-09-21）。**ページを移るたびに取り直す。**
        ⚠️★layout（サーバー）で数えないこと。App Router の layout は
           ページ間の移動で描き直されないので、数字が古いまま残る。
        ⚠️ 取得に失敗したら出さない（0 と同じ扱い）。**「0件」とは言わない** ——
           バッジが出ないことを「未読なし」の根拠にしないこと。
        ⚠️ 企業が無い人（`hasCompany = false`）はサイドバーごと無いので叩かない。 */
  const [badges, setBadges] = useState<{ messages: number; proposals: number } | null>(null);
  useEffect(() => {
    if (!hasCompany) return;
    let cancelled = false;
    fetch("/api/biz/nav-badges", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => { if (!cancelled && b && typeof b.messages === "number") setBadges(b); })
      .catch((e) => console.error("[BusinessLayout] 未読バッジを取得できませんでした:", e));
    return () => { cancelled = true; };
  }, [pathname, hasCompany]);
  /* ★狭い画面（ナビが横スクロールの1行になる）で、いまのページの項目を見える位置へ寄せる（2026-10-11）。
        「メッセージリクエスト」は右端で切れて見えていた。⚠️ 縦並び（広い画面）では何もしない。
        ⚠️ rAF にしない（非表示のタブでは発火しない。ui-debugging ⑪）。バッジで幅が変わるので badges も見る */
  useEffect(() => {
    const t = setTimeout(() => {
      const nav = document.querySelector<HTMLElement>(".biz-layout-sidebar nav");
      if (!nav || getComputedStyle(nav).flexDirection !== "row" || nav.scrollWidth <= nav.clientWidth) return;
      const cur = nav.querySelector<HTMLElement>('a[aria-current="page"]');
      if (!cur) return;
      const n = nav.getBoundingClientRect(), c = cur.getBoundingClientRect();
      nav.scrollLeft = Math.max(0, nav.scrollLeft + (c.left - n.left) - (n.width - c.width) / 2);
    }, 60);
    return () => clearTimeout(t);
  }, [pathname, badges]);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    }
    if (avatarOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [avatarOpen]);

  /* ★名前と権限は `BizShellContext`（layout が `getTenantContext` から入れる）を正にする。
        props の `userName` は Provider の外（企業が無い画面など）だけの逃げ道。 */
  const displayName = shell.userName ?? userName;
  const roleLabel = shell.permission ? ROLE_LABELS[shell.permission] : null;
  const userInitial = displayName.trim().charAt(0).toUpperCase() || null;
  const logoLetter = tenantLogoLetter || (tenantName || "?").trim().charAt(0).toUpperCase();
  const logoGradient = tenantLogoGradient || "linear-gradient(135deg, #F97316, #EA580C)";

  /* ★押した瞬間に選択中の表示にする（2026-10-12）。読み込みの完了（pathname の変化）を待たない。
        ⚠️ 読み込み中であることは本文の上の細い線だけで示す（サイドバーは動かさない） */
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  useEffect(() => { setPendingHref(null); }, [pathname]);
  const currentPath = pendingHref ?? pathname;

  /* ★サイドバーをしまう（2026-10-12）。見た目は CSS（html の属性）が決める。ここは押したときの切り替えと aria-expanded だけ */
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { setCollapsed(document.documentElement.getAttribute("data-biz-sidebar") === "collapsed"); }, []);
  function setSidebarCollapsed(next: boolean, animate = true) {
    setCollapsed(next);
    const html = document.documentElement;
    if (animate) html.classList.add("biz-sidebar-anim");  // ⚠️ 押したときだけ動かす（最初の表示・ドラッグ中は動かさない）
    else html.classList.remove("biz-sidebar-anim");
    if (next) html.setAttribute("data-biz-sidebar", "collapsed"); else html.removeAttribute("data-biz-sidebar");
    try { localStorage.setItem(SIDEBAR_KEY, next ? "collapsed" : "expanded"); } catch { /* 保存できない環境では次回は開いた状態 */ }
  }
  function toggleSidebar() { setSidebarCollapsed(!collapsed); }

  /* ★右端の線（2026-10-12）。ドラッグで幅、押すと開閉。幅は html の CSS 変数を直接書き換える（ドラッグ中に React を描き直さない） */
  const [sidebarW, setSidebarW] = useState(SIDEBAR_W_DEFAULT);
  useEffect(() => {
    const v = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--biz-sidebar-open-w"), 10);
    if (v >= SIDEBAR_W_MIN && v <= SIDEBAR_W_MAX) setSidebarW(v);
  }, []);
  function applySidebarW(w: number, save: boolean) {
    document.documentElement.style.setProperty("--biz-sidebar-open-w", `${w}px`);
    setSidebarW(w);
    if (save) { try { localStorage.setItem(SIDEBAR_W_KEY, String(w)); } catch { /* 保存できない環境では次回は既定の幅 */ } }
  }
  const [handleTip, setHandleTip] = useState<number | null>(null);
  const [resizing, setResizing] = useState(false);
  const dragRef = useRef<{ startX: number; moved: boolean; collapsed: boolean } | null>(null);
  function onHandlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, moved: false, collapsed };
  }
  function onHandlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d) { setHandleTip(e.clientY); return; }
    if (!d.moved) {
      if (Math.abs(e.clientX - d.startX) < 4) return;  // ⚠️ 押しただけ（わずかなぶれ）はドラッグにしない
      d.moved = true;
      setResizing(true);
      setHandleTip(null);
      document.documentElement.classList.add("biz-sidebar-resizing");
    }
    /* ⚠️ サイドバーは画面の左端から始まるので、マウスの x がそのまま幅になる */
    const x = e.clientX;
    if (x < SIDEBAR_SNAP_COLLAPSE) {
      if (!d.collapsed) { d.collapsed = true; setSidebarCollapsed(true, false); }
      return;
    }
    if (d.collapsed) { d.collapsed = false; setSidebarCollapsed(false, false); }
    applySidebarW(clampSidebarW(x), false);
  }
  /* ⚠️★ドラッグの後片付けは必ずここを通す。片付けが漏れると、カーソルが画面じゅう「幅を変える」形のまま残り、
        線も濃いままになる（2026-10-12 に本番で実際に起きた）。pointerup が要素に届かない終わり方
        （ウィンドウの外で離す・キャプチャが外れる・タブを切り替える）があるので、要素のイベントだけに頼らない */
  function endDrag(): { moved: boolean; collapsed: boolean } | null {
    const d = dragRef.current;
    dragRef.current = null;
    document.documentElement.classList.remove("biz-sidebar-resizing");
    setResizing(false);
    return d;
  }
  function onHandlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    /* ⚠️ 先に片付けてからキャプチャを外す。外すと lostpointercapture が走るので、逆だと押しただけの開閉が消える */
    const d = endDrag();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!d) return;
    if (!d.moved) { toggleSidebar(); return; }
    if (!d.collapsed) applySidebarW(sidebarWNow(), true);
  }
  /* 要素に届かなかった終わり方の保険。幅はそのとき見えている値で保存する */
  function abandonDrag() {
    const d = endDrag();
    if (d && d.moved && !d.collapsed) applySidebarW(sidebarWNow(), true);
  }
  useEffect(() => {
    if (!resizing) return;
    window.addEventListener("pointerup", abandonDrag);
    window.addEventListener("blur", abandonDrag);
    return () => { window.removeEventListener("pointerup", abandonDrag); window.removeEventListener("blur", abandonDrag); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resizing]);
  function sidebarWNow() {
    const v = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--biz-sidebar-open-w"), 10);
    return v >= SIDEBAR_W_MIN && v <= SIDEBAR_W_MAX ? v : SIDEBAR_W_DEFAULT;
  }
  /* キーボード: ←→ で幅（16px ずつ）、Enter / Space で開閉 */
  function onHandleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSidebar(); return; }
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    if (collapsed) { if (e.key === "ArrowRight") setSidebarCollapsed(false); return; }
    const next = clampSidebarW(sidebarW + (e.key === "ArrowRight" ? 16 : -16));
    document.documentElement.classList.remove("biz-sidebar-anim");
    applySidebarW(next, true);
  }
  /* しまっているときの項目名（ツールチップ）。⚠️ サイドバーは縦にスクロールするので、はみ出す吹き出しは position: fixed で出す */
  const [tip, setTip] = useState<{ label: string; top: number; left: number } | null>(null);
  useEffect(() => { setTip(null); }, [pathname, collapsed]);
  /* 窓の大きさが変わったり、サイドバーや本文がスクロールしたら消す（位置が古くなるため） */
  useEffect(() => {
    if (!tip) return;
    const clear = () => setTip(null);
    window.addEventListener("resize", clear);
    window.addEventListener("scroll", clear, true);
    return () => { window.removeEventListener("resize", clear); window.removeEventListener("scroll", clear, true); };
  }, [tip]);
  function showTip(e: React.SyntheticEvent<HTMLElement>, label: string) {
    if (!collapsed || window.innerWidth < 1024) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ label, top: r.top + r.height / 2, left: r.right + 8 });
  }
  const hideTip = () => setTip(null);
  function isActive(href: string) {
    return currentPath === href || currentPath.startsWith(href + "/");
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setAvatarOpen(false);
    router.push("/biz/auth");
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-tint)",
      fontFamily: "var(--font-inter), var(--font-noto)",
      WebkitFontSmoothing: "antialiased",
    }}>
      {/* ── Topbar ── */}
      {/* ⚠️★ヘッダーは 2026-08-31 まで `@media` の対象外だった。
             `display:flex` / `gap:24` / `padding:12px 28px` の固定で、
             375px では**企業切り替えが右端 443px、ユーザーメニューが 601px** まで出ており、
             `body { overflow-x: hidden }` に**切り取られていた**（横スクロールは出ない）。
             ＝ スマホでは企業の切り替えとアカウントメニューに触れなかった。
          ⚠️ サイドバー側の ≤768px 対応は元からあった。**ヘッダーだけ漏れていた。** */}
      <header className="biz-header" style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.96)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--line)",
        padding: "12px 28px",
        display: "flex",
        alignItems: "center",
        gap: 24,
      }}>
        {/* ★しまう／開くボタン（2026-10-12）。ヘッダーの左端（Claude.ai と同じ場所）。
               ⚠️ サイドバーの中に置かないこと（専用の行が1つ増え、項目が下へずれる）。
               ⚠️ 左の余白を詰めて、しまったときのアイコンの列（64px）の真ん中にそろえてある（CSS）。
               ⚠️ 1024px 未満と、企業が無い画面（サイドバーが無い）では出さない */}
        {hasCompany && (
          <button
            type="button"
            className="biz-sidebar-toggle btn-fixed-size"
            onClick={toggleSidebar}
            aria-label={collapsed ? "サイドバーを開く" : "サイドバーをしまう"}
            aria-expanded={!collapsed}
            aria-controls="biz-sidebar-nav"
            title={collapsed ? "サイドバーを開く" : "サイドバーをしまう"}
          >
            <PanelLeft size={18} strokeWidth={2} />
          </button>
        )}
        {/* Brand */}
        <Link href="/biz/dashboard" className="biz-header-brand" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}>
          <OpinioLogo height={22} style={{ color: "var(--brand-ink)" }} />
          <span style={{
            fontFamily: "var(--font-inter), var(--font-noto)",
            fontSize: 9, fontWeight: 700,
            letterSpacing: "0.15em",
            padding: "2px 7px",
            background: "var(--royal)", color: "#fff",
            borderRadius: 3,
            textTransform: "uppercase",
          }} className="biz-header-badge">Business</span>
        </Link>

        {/* Company identifier / switcher */}
        {tenantName && (
          memberships && currentTenantId ? (
            <div className="biz-header-company biz-header-company-switch" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <CompanySwitcher
                currentCompany={{ id: currentTenantId, name: tenantName, logoGradient: tenantLogoGradient, logoLetter: tenantLogoLetter }}
                memberships={memberships}
              />
            </div>
          ) : (
            <div className="biz-header-company" style={{
              display: "flex", alignItems: "center", gap: 8,
              paddingLeft: 20, minWidth: 0,
              borderLeft: "1px solid var(--line)",
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6,
                background: logoGradient,
                color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-inter), var(--font-noto)", fontWeight: 700, fontSize: 13,
                flexShrink: 0,
              }}>
                {logoLetter}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {tenantName}
              </span>
            </div>
          )
        )}

        <div style={{ flex: 1 }} />

        {/* ★右側の導線（2026-09-21 / 柴さん。YOUTRUST・LinkedIn の管理画面を参考）。
               ⚠️ 通知のベルは置かない —— 企業側に届く通知が1種類も無く、空のベルになる。
               ⚠️ 狭い画面では文字を落としてアイコンだけにする（押せる場所は残す）。 */}
        <nav aria-label="補助メニュー" className="biz-header-links" style={{ alignItems: "center", gap: 4, flexShrink: 0 }}>
          {/* ⚠️ 採用担当者は求職者としても使う人が多い。行き先は自分のプロフィール */}
          <Link href="/mypage" className="biz-header-link" title="求職者画面へ">
            <ArrowLeftRight size={15} strokeWidth={2.2} aria-hidden />
            <span className="biz-header-link-label">求職者画面へ</span>
          </Link>
          {/* ⚠️ ヘルプページはまだ無い。問い合わせ先のメールにしてある（作ったら差し替える） */}
          <a href="mailto:contact@opinio.co.jp" className="biz-header-link" title="ヘルプ・お問い合わせ">
            <HelpCircle size={15} strokeWidth={2.2} aria-hidden />
            <span className="biz-header-link-label">ヘルプ</span>
          </a>
        </nav>

        {/* User menu */}
        <div className="relative biz-header-user" ref={avatarRef} style={{ flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setAvatarOpen(!avatarOpen)}
            className="biz-header-avatar-btn"
            aria-label="アカウントメニュー"
            aria-expanded={avatarOpen}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              cursor: "pointer", padding: "6px 12px 6px 6px",
              borderRadius: 100, border: "none", background: "transparent",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tint)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: userInitial
                ? "linear-gradient(135deg, var(--royal), var(--accent))"
                : "var(--line)",
              color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 600, fontSize: 12,
            }}>
              {userInitial ?? null}
            </div>
            {/* ⚠️ 狭い画面ではこの2行を隠す（アバターとシェブロンは残す）。
                   隠さないと押せる領域ごと画面外へ出る。 */}
            <div className="biz-header-username" style={{ textAlign: "left", minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-inter), var(--font-noto)", fontSize: 12, color: "var(--ink)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                {displayName}
              </div>
              {/* ★権限（2026-09-21）。それまで全員に「Admin」と直書きしていた。
                     ⚠️ 分からないときは出さない（「メンバー」に倒さない） */}
              {roleLabel && <div style={{ fontSize: 10, color: "var(--ink-mute)", fontWeight: 400 }}>{roleLabel}</div>}
            </div>
            <ChevronDown
              size={14}
              style={{
                color: "var(--ink-mute)",
                transform: avatarOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
                flexShrink: 0,
              }}
            />
          </button>

          {avatarOpen && (
            <div role="menu" style={{
              position: "absolute", right: 0, top: 48,
              minWidth: 240, background: "#fff",
              borderRadius: 10,
              boxShadow: "0 4px 20px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)",
              overflow: "hidden", zIndex: 200,
            }}>
              <div style={{ padding: "12px 16px", borderBottom: "0.5px solid var(--line-soft)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{displayName}</div>
                {(tenantName || roleLabel) && (
                  <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 2 }}>
                    {[tenantName, roleLabel].filter(Boolean).join(" ・ ")}
                  </div>
                )}
              </div>
              {/* ★「あなた」と「この会社」で分けた（2026-09-21）。
                     ⚠️ 「企業ページを編集」はサイドバーの「企業ページ」と同じ行き先なので外した。
                        **サイドバーにある入口をここに足さないこと**（同じ場所に着く入口を増やさない）。 */}
              <div className="biz-menu-heading">あなた</div>
              <Link href="/mypage" role="menuitem" className="biz-menu-item" onClick={() => setAvatarOpen(false)}>
                <User size={15} strokeWidth={2.2} aria-hidden />個人プロフィール
              </Link>
              {hasCompany && (
                <>
                  <div className="biz-menu-heading">この会社</div>
                  <Link href="/biz/members" role="menuitem" className="biz-menu-item" onClick={() => setAvatarOpen(false)}>
                    <Users size={15} strokeWidth={2.2} aria-hidden />メンバーと権限
                  </Link>
                </>
              )}
              {/* ⚠️ ヘッダー右の「ヘルプ」と同じ行き先。狭い画面ではヘッダー側が消えるので、ここが入口になる */}
              <a href="mailto:contact@opinio.co.jp" role="menuitem" className="biz-menu-item" style={{ borderTop: "0.5px solid var(--line-soft)", marginTop: 6 }} onClick={() => setAvatarOpen(false)}>
                <HelpCircle size={15} strokeWidth={2.2} aria-hidden />ヘルプ・お問い合わせ
              </a>
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="biz-menu-item"
                style={{ borderTop: "0.5px solid var(--line-soft)", marginTop: 6 }}
              >
                <LogOut size={15} strokeWidth={2.2} aria-hidden />ログアウト
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Body: sidebar + main ── */}
      {/* ⚠️ 企業が無いときは1列。列だけ残すと本文が右に寄り、
             「サイドバーが読み込み中」に見える。 */}
      {/* ★サイドバーの開閉を描画の前に決める（上の SIDEBAR_INIT）。⚠️ 消すと、しまった人に毎回「開いた → しまった」の切り替えが見える */}
      {hasCompany && <script dangerouslySetInnerHTML={{ __html: SIDEBAR_INIT }} />}
      {/* ⚠️ サイドバーの幅は CSS の変数（--biz-sidebar-w）。しまうと 64px。数字をここに書かない */}
      <div className="biz-layout-grid" style={{ display: "grid", gridTemplateColumns: hasCompany ? "var(--biz-sidebar-w) 1fr" : "1fr", minHeight: "calc(100vh - var(--biz-header-h))" }}>

        {/* Sidebar
            ⚠️★**企業が紐付いていないときは丸ごと出さない**（2026-09-04 / 柴さんの指摘）。
               12項目とも `BizNoTenantPage` へ着くだけで、使えるものが1つも無い。
               詳細は `Props.hasCompany` の注記。 */}
        {hasCompany && (
        <aside className="biz-layout-sidebar" style={{
          background: "#fff",
          borderRight: "1px solid var(--line)",
          padding: "20px 0",
          position: "sticky",
          /* ⚠️ ヘッダーの高さは --biz-header-h（下の style）。数字で書かないこと */
          top: "var(--biz-header-h)",
          alignSelf: "start",
          height: "calc(100vh - var(--biz-header-h))",
          overflowY: "auto",
          outline: "none",
          /* ★sticky は重なりの層を作るので、層の順を本文より上にする（2026-10-12）。
                無いと、会社の切り替えのメニュー（position: fixed）が本文の下に隠れる */
          zIndex: 20,
        }}>
          {/* ★企業の切り替えをサイドバーの最上段へ（2026-09-21。YOUTRUST / LinkedIn と同じ位置）。
                 ⚠️ 狭い画面ではサイドバーが横スクロールの列になるので、ここは隠して
                    ヘッダー側を出す（CSS の `.biz-sidebar-company` / `.biz-header-company-switch`）。
                    **どちらか一方しか見えない**ようにしてある。 */}
          {tenantName && memberships && currentTenantId && (
            <div className="biz-sidebar-company">
              <CompanySwitcher
                placement="sidebar"
                currentCompany={{ id: currentTenantId, name: tenantName, logoGradient: tenantLogoGradient, logoLetter: tenantLogoLetter }}
                memberships={memberships}
              />
            </div>
          )}

          <nav id="biz-sidebar-nav">
            {/* ★権限が無い項目は出さない（押せない状態で残さない。2026-10-12）。見出しは中身が残るときだけ */}
            {NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((it) => it.needs.some((a) => can(shell.permission, a))) }))
              .filter((g) => g.items.length > 0).map((group, gi) => (
            <React.Fragment key={group.heading ?? `g${gi}`}>
            {/* ⚠️ 狭い画面では隠す（横スクロールの列に見出しを混ぜない）。
                   ⚠️ 見出しと項目は **nav の直下に兄弟として**並べる。グループを div で包むと、
                      狭い画面の横並び（nav が flex）で1グループが1かたまりになり崩れる。 */}
            {group.heading && (
              /* ⚠️ 文字の大きさ・余白はインラインに書かない（しまったときに細い区切り線にするため。下の style タグ） */
              <div className="biz-nav-heading" role="presentation">
                <span className="biz-nav-label">{group.heading}</span>
              </div>
            )}
            {group.items.map((item) => {
              const active = isActive(item.href);
              // 子リンクのどれかが active かどうか
              const childActive = item.children?.some(
                (c) => pathname === c.href || pathname.startsWith(c.href + "/")
              ) ?? false;
              // 子が active な時は親をサブデュード表示 (背景なし・テキストのみ royal)
              const showFullActive = active && !childActive;

              const badgeCount = item.badge && badges ? (badges[item.badge] ?? 0) : 0;

              return (
                <div key={item.href} className="biz-nav-item">
                  <Link
                    href={item.href}
                    className="biz-nav-link"
                    aria-current={active ? "page" : undefined}
                    /* ⚠️ しまうと項目名が見えなくなる（display: none）ので、名前は aria-label でも持つ。件数も入れる */
                    aria-label={badgeCount > 0 ? `${item.label}（${item.badge === "proposals" ? "未回答" : "未読・新しい返信"} ${badgeCount}件）` : item.label}
                    onFocus={(e) => showTip(e, item.label)}
                    onBlur={hideTip}
                    onClick={(e) => {
                      /* ⚠️ ⌘・中クリック（別タブ）では選択を変えない */
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                      if (!(pathname === item.href)) setPendingHref(item.href);
                    }}
                    style={{
                      /* ★各項目の高さを固定（2026-10-12）。バッジの有無・読み込みで行の高さが変わらないように
                         ⚠️ 横の余白と寄せ方は CSS（.biz-nav-link）。しまったときにアイコンを真ん中へ寄せるため */
                      display: "flex", alignItems: "center",
                      height: 38, boxSizing: "border-box",
                      fontSize: 13, fontWeight: active ? 600 : 500,
                      color: active ? "var(--royal)" : "var(--ink-soft)",
                      textDecoration: "none",
                      borderLeft: `3px solid ${showFullActive ? "var(--royal)" : "transparent"}`,
                      background: showFullActive ? "var(--royal-50)" : "transparent",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      showTip(e, item.label);
                      if (!showFullActive) {
                        (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-tint)";
                        if (!childActive) (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      hideTip();
                      if (!showFullActive) {
                        (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                        if (!childActive) (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink-soft)";
                      }
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      {/* ⚠️ position: relative は件数の点（しまったとき）の基準 */}
                      <span style={{ color: active ? "var(--royal)" : "var(--ink-mute)", flexShrink: 0, position: "relative", display: "inline-flex" }}>
                        {item.icon}
                        {badgeCount > 0 && <span className="biz-nav-dot" aria-hidden="true" />}
                      </span>
                      <span className="biz-nav-label">{item.label}</span>
                    </span>
                    {/* ★バッジの場所は常に取っておく（2026-10-12）。読み込みで出たり消えたりしても項目が動かないように。
                           ⚠️ 0件・未取得のときは中身ごと出さない（visibility ではなく空の箱。読み上げにも出さない） */}
                    {item.badge && badgeCount <= 0 && <span className="biz-nav-badge" aria-hidden="true" style={{ width: 18, height: 18, flexShrink: 0 }} />}
                    {badgeCount > 0 && (
                      <span className="biz-nav-badge" style={{
                        minWidth: 18, height: 18, borderRadius: 100,
                        background: "var(--error)", color: "#fff",
                        fontSize: 10, fontWeight: 700, fontFamily: "var(--font-inter), var(--font-noto)",
                        /* ⚠️ display はインラインに書かない（しまったときに CSS で隠すため。.biz-nav-badge） */
                        alignItems: "center", justifyContent: "center",
                        padding: "0 5px", flexShrink: 0,
                        /* ⚠️★position: relative を外さないこと（2026-10-11）。中の .sr-only（position: absolute）の基準を
                              このバッジにする。無いと、狭い画面の横スクロールのナビの外まで基準が抜けて、
                              ページ全体の幅を押し広げていた（375px で 728px。原因はこれで、1fr の件より大きかった） */
                        position: "relative",
                      }}>
                        <span aria-hidden="true">{badgeCount > 99 ? "99+" : badgeCount}</span>
                        <span className="sr-only">（{item.badge === "proposals" ? "未回答" : "未読・新しい返信"} {badgeCount}件）</span>
                      </span>
                    )}
                  </Link>

                  {/* サブリンク: 親が active な時だけ展開 */}
                  {active && item.children?.map((child) => {
                    const childIsActive = pathname === child.href || pathname.startsWith(child.href + "/");
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        /* ⚠️ 狭い画面では隠す。横スクロールの列に子リンクを混ぜると
                              親と子の区別が付かなくなる（インデントが効かないため） */
                        className="biz-nav-child"
                        style={{
                          display: "flex", alignItems: "center",
                          padding: "6px 20px 6px 38px",
                          fontSize: 12, fontWeight: childIsActive ? 600 : 500,
                          color: childIsActive ? "var(--royal)" : "var(--ink-mute)",
                          textDecoration: "none",
                          borderLeft: `3px solid ${childIsActive ? "var(--royal)" : "transparent"}`,
                          background: childIsActive ? "var(--royal-50)" : "transparent",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          if (!childIsActive) {
                            (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-tint)";
                            (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink-soft)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!childIsActive) {
                            (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                            (e.currentTarget as HTMLAnchorElement).style.color = "var(--ink-mute)";
                          }
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{
                            width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                            background: childIsActive ? "var(--royal)" : "var(--line)",
                          }} />
                          {child.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
            </React.Fragment>
            ))}
          </nav>

          {/* ★公開ページを見る（2026-09-21）。求職者から自社がどう見えるかをすぐ確かめる導線。
                 ⚠️★**公開ページが無いときは出さない**（押すと 404）。判定は layout が
                    `hasPublicCompanyPage` で決めて `BizShellContext` に入れている。
                    **ここで条件を書き直さないこと。**
                 ⚠️ 狭い画面では隠す（ダッシュボードの企業カードに同じボタンがある）。 */}
          {/* ★2026-10-12: 404 にならないプレビュー（/preview/company）に変えた。掲載前・検証用でも開ける。
                 ⚠️ そのため hasPublicPage の条件は外した（担当者なら必ず開ける） */}
          {shell.tenantId && can(shell.permission, "company.page") && (
            <div className="biz-sidebar-footer">
              <a
                href="/preview/company"
                target="_blank"
                data-state="sidebar-company-preview"
                rel="noopener noreferrer"
                className="biz-sidebar-footer-link"
                aria-label="求職者から見た企業ページ（新しいタブで開く）"
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  borderRadius: 8,
                  fontSize: 13, fontWeight: 500, color: "var(--ink-soft)", textDecoration: "none",
                }}
                onFocus={(e) => showTip(e, "求職者から見た企業ページ")}
                onBlur={hideTip}
                onMouseEnter={(e) => { showTip(e, "求職者から見た企業ページ"); e.currentTarget.style.background = "var(--bg-tint)"; e.currentTarget.style.color = "var(--ink)"; }}
                onMouseLeave={(e) => { hideTip(); e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--ink-soft)"; }}
              >
                <ExternalLink size={16} strokeWidth={2.2} style={{ color: "var(--ink-mute)", flexShrink: 0 }} />
                <span className="biz-nav-label">求職者から見た企業ページ ↗</span>
              </a>
            </div>
          )}

        </aside>
        )}
        {/* ★右端の線（2026-10-12）。ドラッグで幅、押すと開閉。⚠️ 1024px 未満では出さない（CSS） */}
        {hasCompany && (
          <div
            className={`biz-sidebar-handle${resizing ? " is-active" : ""}`}
            role="separator"
            aria-orientation="vertical"
            aria-controls="biz-sidebar-nav"
            aria-label={collapsed ? "サイドバーを開く（ドラッグで幅を変える）" : "サイドバーの幅（ドラッグで変える・押すとしまう）"}
            aria-valuemin={SIDEBAR_W_MIN}
            aria-valuemax={SIDEBAR_W_MAX}
            aria-valuenow={collapsed ? SIDEBAR_W_MIN : sidebarW}
            tabIndex={0}
            onPointerDown={onHandlePointerDown}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
            onPointerCancel={abandonDrag}
            onLostPointerCapture={abandonDrag}
            onPointerLeave={() => { if (!dragRef.current) setHandleTip(null); }}
            onKeyDown={onHandleKeyDown}
          />
        )}
        {handleTip !== null && !resizing && (
          <div className="biz-sidebar-tip biz-sidebar-handle-tip" aria-hidden="true" style={{ top: handleTip, left: "calc(var(--biz-sidebar-w) + 10px)" }}>
            {collapsed ? "押すと開く" : "押すとしまう"}
            <span>ドラッグで幅を変える</span>
          </div>
        )}
        {/* ★しまっているときの項目名（2026-10-12）。⚠️ 読み上げは aria-label が担うので aria-hidden */}
        {collapsed && tip && (
          <div className="biz-sidebar-tip" aria-hidden="true" style={{ top: tip.top, left: tip.left }}>{tip.label}</div>
        )}

        {/* Main content */}
        {/* ⚠️ 企業が無いときはサイドバーを出さないので、**本文を中央に寄せる**
               （2026-09-04）。左寄せのままだと 1440px で左端に貼り付き、
               右が大きく空いて「サイドバーが消えた」ように見える。
               ここは登録フローなので、`/biz/auth` と同じ中央寄せに揃える。 */}
        {frame ? (
          /* ★枠のときは、本文（main）はページ側の BusinessLayout が描く。ここは入れ物だけ。
                読み込み中は上に細い線（pendingHref があいだ）。⚠️ サイドバーには何も出さない */
          <div className="biz-layout-main-col" style={{ minWidth: 0, position: "relative" }}>
            {pendingHref && <div className="biz-nav-progress" role="progressbar" aria-label="読み込み中" />}
            {children}
          </div>
        ) : (
          <main id="main-content" className="biz-layout-main" style={mainStyleOf(variant, hasCompany, mainMaxWidth)}>
            {children}
          </main>
        )}
      </div>

      {/* Mobile fallback nav (≤768px) */}
      <style>{`
        /* ── ヘッダー（2026-08-31 追加）──────────────────────────────────
           ⚠️ 段階を2つに分ける。768px では詰めるだけ、480px で要素を落とす。
              いきなり落とすとタブレットで情報が減りすぎる。 */
        /* ★ヘッダー右の導線とアカウントメニュー（2026-09-21）。
              ⚠️ 色・余白をここに寄せている。hover をインラインの onMouseEnter で書かない。 */
        /* ⚠️ display はインラインに書かない（480px 以下で消すため） */
        /* ★ヘッダーの高さ（2026-10-10）。ヘッダー自身もこの高さで描き、固定の位置（サイドバー・候補者のプレビュー）と
             画面いっぱいの高さ（面談・企業情報の編集・求人の編集）はすべてこの変数から計算する。
             ⚠️ 値は中身（アカウントのボタン 49px か 44px）＋上下の余白＋下の線 1px。余白やボタンの大きさを変えたら、ここも変える。
             ⚠️ 切り替える幅は、ヘッダーの余白を変えている 768px と 480px に合わせてある。 */
        :root { --biz-header-h: 74px; --biz-sidebar-w: 240px; }
        /* ★スクロールバーの有無で全体の幅が変わらないように（2026-10-12） */
        html { scrollbar-gutter: stable; }
        .biz-nav-progress { position: sticky; top: var(--biz-header-h); z-index: 90; height: 2px; margin-bottom: -2px;
          background: linear-gradient(90deg, transparent, var(--royal), transparent); background-size: 50% 100%;
          background-repeat: no-repeat; animation: biz-nav-progress 1s linear infinite; }
        @keyframes biz-nav-progress { from { background-position: -50% 0; } to { background-position: 150% 0; } }
        .biz-header { height: var(--biz-header-h); box-sizing: border-box; }
        @media (max-width: 768px) { :root { --biz-header-h: 70px; } }
        @media (max-width: 480px) { :root { --biz-header-h: 65px; } }
        .biz-header-links { display: flex; }
        .biz-header-link {
          display: inline-flex; align-items: center; gap: 6px;
          height: 32px; padding: 0 10px; border-radius: 8px;
          font-size: 12.5px; font-weight: 500; color: var(--ink-soft); text-decoration: none;
          white-space: nowrap;
        }
        .biz-header-link:hover { background: var(--bg-tint); color: var(--ink); }
        .biz-menu-heading {
          padding: 10px 16px 4px; font-size: 10.5px; font-weight: 700; color: var(--ink-mute);
        }
        .biz-menu-item {
          display: flex; align-items: center; gap: 10px; width: 100%;
          padding: 9px 16px; font-size: 13px; font-weight: 500; color: var(--ink-soft);
          text-decoration: none; text-align: left; background: transparent; border: none; cursor: pointer;
          font-family: inherit;
        }
        .biz-menu-item:hover { background: var(--bg-tint); color: var(--ink); }
        .biz-menu-item svg { color: var(--ink-mute); flex-shrink: 0; }
        @media (max-width: 768px) {
          .biz-header-link-label { display: none; }
          .biz-header-link { padding: 0 8px; }
        }
        /* ⚠️ 480px 以下は右の導線をアカウントメニューの中へ移す（企業名とぶつかるため）。
              メニューの「個人プロフィール」は「求職者画面へ」と同じ行き先で、
              ヘルプはメニュー側にも常にある。 */
        @media (max-width: 480px) {
          .biz-header-links { display: none; }
        }

        /* ★企業の切り替えは広い画面ではサイドバー、狭い画面ではヘッダー（2026-09-21）。
              ⚠️ 境界は下のサイドバー横並び化と**同じ 768px**。ずらすと両方消える帯ができる。 */
        @media (min-width: 769px) {
          .biz-header-company-switch { display: none !important; }
        }
        @media (max-width: 768px) {
          .biz-sidebar-company { display: none !important; }
          .biz-sidebar-footer { display: none !important; }
        }

        @media (max-width: 768px) {
          .biz-header { padding: 10px 14px !important; gap: 10px !important; }
          .biz-header-company { padding-left: 10px !important; }
        }
        @media (max-width: 480px) {
          /* ⚠️ ロゴの「BUSINESS」バッジは落とす。OPINIO の文字だけで区別は付く */
          .biz-header-badge { display: none !important; }
          /* ⚠️ 氏名と Admin は落とす。**アバターとシェブロンは残す**
                （押せる場所が消えるとメニューを開けなくなる） */
          .biz-header-username { display: none !important; }
          /* ⚠️ アバターのボタンだけ。ボタン全般にするとメニューのログアウトまで潰れる
                （2026-09-21 に実際に踏んだ）。子の結合子の記号はここに書かないこと */
          .biz-header-avatar-btn { padding: 6px !important; gap: 0 !important; }
        }

        /* ★サイドバーをしまう（2026-10-12）。⚠️ 見出し・項目・会社の切り替えの余白は、しまったときに変えるのでここに置く */
        .biz-sidebar-toggle { display: none; }
        .biz-sidebar-handle { display: none; }
        .biz-sidebar-handle-tip { display: flex; flex-direction: column; gap: 1px; }
        .biz-sidebar-handle-tip span { font-size: 11px; font-weight: 500; opacity: 0.75; }
        .biz-sidebar-company { height: 58px; box-sizing: border-box; padding: 0 12px 14px; margin-bottom: 6px; border-bottom: 1px solid var(--line-soft); }
        .biz-nav-heading { font-size: 11px; font-weight: 700; color: var(--ink-mute); letter-spacing: 0.04em; padding: 16px 20px 6px; }
        .biz-nav-link { justify-content: space-between; padding: 0 20px; }
        .biz-nav-dot { display: none; }
        .biz-nav-badge { display: flex; }
        .biz-sidebar-footer { margin: 14px 12px 0; padding-top: 12px; border-top: 1px solid var(--line-soft); }
        .biz-sidebar-footer-link { padding: 8px; }
        .biz-sidebar-tip { position: fixed; z-index: 400; transform: translateY(-50%); pointer-events: none;
          padding: 5px 10px; border-radius: 6px; background: var(--ink); color: #fff; font-size: 12px; font-weight: 600; white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0,0,0,0.18); }
        @media (min-width: 1024px) {
          .biz-sidebar-toggle { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; flex-shrink: 0;
            margin: 0 -12px 0 -12px; border: none; border-radius: 8px; background: transparent; color: var(--ink-mute); cursor: pointer; }
          .biz-sidebar-toggle:hover { background: var(--bg-tint); color: var(--ink); }
          .biz-sidebar-toggle:focus-visible { outline: 2px solid var(--royal); outline-offset: 1px; }
          :root { --biz-sidebar-w: var(--biz-sidebar-open-w, 240px); }
          html[data-biz-sidebar=collapsed] { --biz-sidebar-w: 64px; }
          /* ★右端の線（2026-10-12）。当たりは 8px、見た目は hover で濃い線 2px。⚠️ サイドバーは左端から始まるので left は幅そのもの
                ⚠️ 線は背景のグラデーションで描く。疑似要素の content に引用符を書くと、style タグの中でサーバーだけがエスケープし
                   ハイドレーションが丸ごと失敗する（実際に踏んだ。ui-debugging ⑲） */
          .biz-sidebar-handle { display: block; position: fixed; z-index: 30; top: var(--biz-header-h); bottom: 0;
            left: calc(var(--biz-sidebar-w) - 4px); width: 8px; cursor: col-resize; touch-action: none; outline: none;
            --biz-handle-line: transparent;
            background: linear-gradient(to right, transparent 3px, var(--biz-handle-line) 3px, var(--biz-handle-line) 5px, transparent 5px); }
          .biz-sidebar-handle:hover, .biz-sidebar-handle.is-active { --biz-handle-line: var(--ink-mute); }
          .biz-sidebar-handle:focus-visible { --biz-handle-line: var(--royal); }
          html[data-biz-sidebar=collapsed] .biz-sidebar-handle { cursor: e-resize; }
          html.biz-sidebar-resizing, html.biz-sidebar-resizing * { cursor: col-resize !important; user-select: none !important; }
          html.biz-sidebar-anim .biz-sidebar-handle { transition: left 150ms ease; }
          html[data-biz-sidebar=collapsed] .biz-layout-sidebar { overflow-x: hidden; }
          html[data-biz-sidebar=collapsed] .biz-nav-label { display: none; }
          html[data-biz-sidebar=collapsed] .biz-nav-heading { height: 1px; padding: 0; margin: 10px 14px; background: var(--line-soft); }
          html[data-biz-sidebar=collapsed] .biz-nav-link { justify-content: center; padding: 0; }
          html[data-biz-sidebar=collapsed] .biz-nav-badge { display: none; }
          html[data-biz-sidebar=collapsed] .biz-nav-dot { display: block; position: absolute; top: -2px; right: -3px; width: 7px; height: 7px;
            border-radius: 50%; background: var(--error); box-shadow: 0 0 0 2px #fff; }
          html[data-biz-sidebar=collapsed] .biz-nav-child { display: none; }
          html[data-biz-sidebar=collapsed] .biz-sidebar-company { padding: 0 0 14px; display: flex; justify-content: center; }
          html[data-biz-sidebar=collapsed] .biz-csw-name, html[data-biz-sidebar=collapsed] .biz-csw-chev { display: none; }
          html[data-biz-sidebar=collapsed] .biz-csw-btn { width: auto; padding: 4px; border-color: transparent; }
          html[data-biz-sidebar=collapsed] .biz-sidebar-footer { margin: 14px 8px 0; }
          html[data-biz-sidebar=collapsed] .biz-sidebar-footer-link { justify-content: center; }
          html.biz-sidebar-anim .biz-layout-grid { transition: grid-template-columns 150ms ease; }
        }
        @media (prefers-reduced-motion: reduce) {
          html.biz-sidebar-anim .biz-layout-grid { transition: none; }
          html.biz-sidebar-anim .biz-sidebar-handle { transition: none; }
        }

        @media (max-width: 768px) {
          /* ⚠️★1fr ではなく minmax(0, 1fr)（2026-10-11）。1fr だとトラックの最小が中身（横に並べたナビの全幅）になり、
                ナビ自体は横スクロールなのに**ページ全体が広がっていた**（375px で innerWidth 637px。
                「メッセージリクエスト」に改名して 728px）。サイドバーにも min-width: 0 を当てる。 */
          .biz-layout-grid { grid-template-columns: minmax(0, 1fr) !important; align-content: start; }
          /* ⚠️ align-content: start（2026-10-11）。縦に2行（ナビ・本文）になると、中身が短いページでは最小の高さを埋めるため
                2行が引き伸ばされ、ナビと見出しのあいだに 200px 以上の空白ができていた（375px の /biz/messages で実測） */
          .biz-layout-sidebar { min-width: 0 !important; }
          .biz-layout-sidebar {
            position: static !important;
            height: auto !important;
            border-right: none !important;
            border-bottom: 1px solid var(--line) !important;
            padding: 8px 0 !important;
          }
          /* ⚠️★flex-direction: row だけでは効かなかった（2026-08-31 に実測）。
                nav は素の display:block なので、方向を指定しても縦のままで、
                12項目がフルハイトで縦に並び、本文が画面のはるか下に押し出されていた。
                display:flex を先に当てる必要がある。
             ⚠️★この style ブロックの中でバッククォートを使わないこと。
                テンプレートリテラルがそこで閉じ、以降が JSX として解釈される
                （2026-08-31 に実際に踏んだ。tsc が「nav に閉じタグが無い」と言い出す）。
                CLAUDE.md の「子孫セレクタの記号と引用符を使わない」と同じ場所の話。 */
          .biz-layout-sidebar nav {
            display: flex !important;
            flex-direction: row !important;
            overflow-x: auto !important;
            gap: 2px;
            padding: 0 12px;
            scrollbar-width: none;
          }
          .biz-layout-sidebar nav::-webkit-scrollbar { display: none; }
          .biz-nav-item { flex: 0 0 auto; }
          .biz-layout-sidebar nav a { white-space: nowrap; }
          /* ⚠️ グループの見出しと、開いている項目の子リンクは畳む。
                横スクロールの列に混ぜると、親と子の区別が付かなくなる。 */
          .biz-nav-heading { display: none !important; }
          .biz-nav-child { display: none !important; }
          .biz-layout-main { padding: 20px 16px 48px !important; }
        }
      `}</style>
    </div>
  );
}
