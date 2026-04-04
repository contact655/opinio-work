import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-foreground text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <span className="text-xl font-bold">
              opinio<span className="text-primary">.work</span>
            </span>
            <p className="mt-3 text-sm text-gray-400">
              Truth to Careers
              <br />
              採用の情報非対称をなくす
            </p>
          </div>

          {/* 求職者向け */}
          <div>
            <h4 className="text-sm font-semibold mb-3">求職者の方</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <Link href="/companies" className="hover:text-white">
                  企業を探す
                </Link>
              </li>
              <li>
                <Link href="/auth/signup" className="hover:text-white">
                  無料登録
                </Link>
              </li>
            </ul>
          </div>

          {/* 企業向け */}
          <div>
            <h4 className="text-sm font-semibold mb-3">企業の方</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <Link href="/company/register" className="hover:text-white">
                  企業登録
                </Link>
              </li>
            </ul>
          </div>

          {/* 運営 */}
          <div>
            <h4 className="text-sm font-semibold mb-3">運営</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <Link href="/about" className="hover:text-white">
                  opinio.workについて
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white">
                  プライバシーポリシー
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white">
                  利用規約
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-800 text-center text-xs text-gray-500">
          &copy; {new Date().getFullYear()} Opinio Inc. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
