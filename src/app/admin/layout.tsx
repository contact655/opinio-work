import Link from "next/link";

const NAV_ITEMS = [
  { label: "ダッシュボード", href: "/admin", icon: "📊" },
  { label: "候補者管理", href: "/admin/candidates", icon: "👤" },
  { label: "企業審査", href: "/admin/companies", icon: "🏢" },
  { label: "求人審査", href: "/admin/jobs", icon: "📋" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-[240px] bg-[#1a1a1a] text-white flex-shrink-0 fixed top-0 left-0 bottom-0 z-40">
        <div className="p-5 border-b border-white/10">
          <Link href="/admin" className="text-lg font-bold">
            opinio<span className="text-primary">.work</span>
          </Link>
          <p className="text-xs text-gray-400 mt-1">Admin Console</p>
        </div>
        <nav className="p-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-4 left-4 right-4">
          <Link
            href="/"
            className="block text-center text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← サイトに戻る
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-[240px] bg-background min-h-screen">
        {children}
      </main>
    </div>
  );
}
