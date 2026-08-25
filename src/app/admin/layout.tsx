import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
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
  Briefcase,
  CalendarCheck,
  Inbox,
  Award,
  Send,
  CreditCard,
  ClipboardCheck,
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
      { label: "学校マスタ",          href: "/admin/schools",          icon: <School       size={16} strokeWidth={2} /> },
      { label: "学校追加リクエスト",  href: "/admin/school-requests",  icon: <School       size={16} strokeWidth={2} /> },
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
  if (!user) {
    redirect("/auth?next=/admin");
  }

  // auth_is_admin() RPC — ow_user_roles に role='admin' の行があるか確認
  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) {
    redirect("/");
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-[240px] bg-[#1a1a1a] text-white flex-shrink-0 fixed top-0 left-0 bottom-0 z-40 overflow-y-auto">
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
        <nav className="p-3">
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
        <div className="absolute bottom-4 left-4 right-4">
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
