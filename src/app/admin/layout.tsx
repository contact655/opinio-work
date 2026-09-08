import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
import {
  LayoutDashboard,
  Users,
  FileText,
  Pencil,
  Newspaper,
  School,
  UserCheck,
  Eye,
  Briefcase,
  CalendarCheck,
  Inbox,
  Award,
  Send,
  CreditCard,
  ClipboardCheck,
  UserPlus,
} from "lucide-react";

const NAV_GROUPS = [
  {
    label: "概要",
    items: [
      { label: "ダッシュボード", href: "/admin",                  icon: <LayoutDashboard size={16} strokeWidth={2} /> },
    ],
  },
  {
    label: "ユーザー管理",
    items: [
      { label: "ユーザー管理",        href: "/admin/candidates",       icon: <Users        size={16} strokeWidth={2} /> },
      { label: "BIZ担当者管理",       href: "/admin/biz-accounts",     icon: <UserCheck    size={16} strokeWidth={2} /> },
    ],
  },
  {
    label: "コンテンツ管理",
    items: [
      { label: "企業審査",            href: "/admin/companies",        icon: <Briefcase    size={16} strokeWidth={2} /> },
      { label: "充填状況",            href: "/admin/companies/coverage", icon: <ClipboardCheck size={16} strokeWidth={2} /> },
      { label: "求人審査",            href: "/admin/jobs",             icon: <FileText     size={16} strokeWidth={2} /> },
      { label: "職種マスタ",          href: "/admin/roles",            icon: <Briefcase    size={16} strokeWidth={2} /> },
      { label: "記事管理",            href: "/admin/articles",         icon: <Pencil       size={16} strokeWidth={2} /> },
      { label: "発信管理",            href: "/admin/posts",            icon: <Newspaper    size={16} strokeWidth={2} /> },
    ],
  },
  {
    label: "オペレーション",
    items: [
      { label: "応募管理",            href: "/admin/applications",     icon: <Inbox         size={16} strokeWidth={2} /> },
      { label: "面談管理",            href: "/admin/meetings",         icon: <CalendarCheck size={16} strokeWidth={2} /> },
      /* ⚠️ 2026-08-24 に「申請」から改名（会社の事前承認を廃止したため）。
            ⚠️★2026-08-25 に「掲載」を外した。**運営は1人で「企業の掲載」「求人の掲載」
               「人の掲載」を全部扱う**ので、`掲載` だけでは何の掲載か読めない。
               人を指すときは `面談対応者` を使う（`/biz` と同じ語彙で、企業や求人と衝突しない）。 */
      { label: "面談対応者（自己申告）", href: "/admin/ambassador-requests", icon: <UserCheck    size={16} strokeWidth={2} /> },
      /* ★2026-09-04 追加。「勝手に載っている人がいないか」（上）とは**別の問い**で、
            こちらは「企業に入りたい人を入れるか」。統合しないこと。
            ⚠️ 依頼メールが届く企業は掲載中79社のうち2社だけ（2026-09-04 実測）。
               残りは運営が見なければどこにも着かない。 */
      { label: "企業への参加依頼",     href: "/admin/company-join-requests", icon: <UserPlus     size={16} strokeWidth={2} /> },
      /* ★「登録している人」ではなく「訪問者に実際に見えている人」の一覧（2026-08-26）。
            /admin/candidates とは別の問いに答えるので分けてある。 */
      { label: "公開面に出ている人", href: "/admin/public-faces", icon: <Eye          size={16} strokeWidth={2} /> },
      { label: "学校マスタ",          href: "/admin/schools",          icon: <School       size={16} strokeWidth={2} /> },
      { label: "就職実績管理",        href: "/admin/placements",       icon: <Award        size={16} strokeWidth={2} /> },
      { label: "スカウト枠管理",      href: "/admin/scout-quotas",     icon: <Send         size={16} strokeWidth={2} /> },
      { label: "プラン管理",          href: "/admin/plans",            icon: <CreditCard   size={16} strokeWidth={2} /> },
    ],
  },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ── Auth guard ────────────────────────────────────────────────────────────
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  /* ⚠️ 戻り先は**いま開こうとしたページ**にする（2026-09-09）。
        以前は `/auth?next=/admin` の**固定値**で、運営宛メールの
        「管理画面で確認する →」（`/admin/companies/<id>`）を踏んでログインしても
        **一覧のトップに着地して、その企業に辿り着けなかった。**
     ⚠️ `x-pathname` は middleware が全経路で入れている（`/biz/layout.tsx` も同じものを読む）。
        ⚠️ クエリ文字列は入っていない。`/admin` はパスで場所が決まるので足りている。 */
  const pathname = headers().get("x-pathname") || "/admin";

  if (!user) {
    redirect(`/auth?next=${encodeURIComponent(pathname)}`);
  }

  // auth_is_admin() RPC — ow_user_roles に role='admin' の行があるか確認
  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) {
    /* ⚠️★**`redirect("/")` に戻さないこと**（2026-09-09）。何が起きたか誰にも伝わらず、
          しかも `/` は求職者側なので `OnboardingGuard` に捕まり、
          **「転職について、いまの気持ちに近いものは？」に連れて行かれていた。**
          実際に踏んだ経路（本番 / 2026-09-09 に報告）:
            運営宛メールの「管理画面で確認する →」→ `/admin/companies/<id>`
            → 管理者ではないセッションだったので `redirect("/")`
            → `/` で `OnboardingGuard` が `career_stance` 未設定を見て
              `/onboarding/stance?next=%2F` へ
          **管理画面を開こうとした人に転職の意向を聞く**という、説明のしようがない画面になる。
       ⚠️ 出すのは「権限が無い」という事実と、**別のアカウントで入り直す導線**だけ。
          管理画面の中身（メニュー構成など）は出さない。
       ⚠️ ログイン中のメールアドレスは**本人のもの**なので出してよい。
          むしろ「入っているつもりのアカウントと違う」に気づく唯一の手がかり。 */
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, background: "#f0f4f8",
      }}>
        <div style={{
          maxWidth: 480, width: "100%", background: "#fff", borderRadius: 16,
          border: "1px solid var(--line)", padding: 32,
        }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>
            この画面は運営メンバーだけが開けます
          </h1>
          <p style={{ margin: "12px 0 0", fontSize: 13.5, lineHeight: 1.9, color: "var(--ink-soft)" }}>
            いま <strong style={{ color: "var(--ink)" }}>{user.email}</strong> でログインしています。
            このアカウントには管理画面の権限がありません。
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 24 }}>
            <Link href={`/auth?next=${encodeURIComponent(pathname)}`} style={{
              display: "inline-flex", alignItems: "center", padding: "11px 20px", borderRadius: 10,
              fontSize: 13, fontWeight: 700, background: "var(--royal)", color: "#fff", textDecoration: "none",
            }}>別のアカウントでログイン</Link>
            <Link href="/" style={{
              display: "inline-flex", alignItems: "center", padding: "11px 20px", borderRadius: 10,
              fontSize: 13, fontWeight: 700, background: "#fff", color: "var(--royal)",
              border: "1px solid var(--royal-100)", textDecoration: "none",
            }}>トップへ</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      {/* ⚠️★縦は flex で3段に割る（2026-09-09）。ヘッダー / スクロールするメニュー / 下段。
             それまで下段が `absolute bottom-4` で、**スクロールしたメニューの上に重なって**
             いた（実測: 「スカウト枠管理」「プラン管理」にメールと「サイトに戻る」が重なる）。
             `overflow-y-auto` の要素の中で `absolute bottom` は**見えている枠の下端**に付くので、
             中身が伸びるほど必ず重なる。
          ⚠️ `overflow-y-auto` は `<aside>` ではなく **`<nav>`** に移した。
             ⚠️ `min-h-0` を外さないこと。flex の子は既定で縮まないので、付けないと
                nav がはみ出して下段が押し出される。 */}
      <aside className="w-[240px] bg-[#1a1a1a] text-white flex-shrink-0 fixed top-0 left-0 bottom-0 z-40 flex flex-col">
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin" className="text-lg font-bold">
              opinio<span className="text-primary">.jp</span>
            </Link>
            <span className="text-[10px] font-bold tracking-widest uppercase bg-red-600 text-white px-1.5 py-0.5 rounded">
              ADMIN
            </span>
          </div>
          <p className="text-xs text-gray-400">管理コンソール</p>
        </div>
        <nav className="p-3 flex-1 min-h-0 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-4">
              <p className="px-3 mb-1 text-[10px] font-bold tracking-widest uppercase text-gray-600">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="shrink-0 px-4 pb-4 pt-3">
          <p className="text-[10px] text-gray-600 text-center mb-2">{user.email}</p>
          <Link
            href="/"
            className="block text-center text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← サイトに戻る
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main id="main-content" className="flex-1 ml-[240px] bg-background min-h-screen">
        {children}
      </main>
    </div>
  );
}
