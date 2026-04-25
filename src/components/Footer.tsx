import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-foreground text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px" }}>
              Opinio
            </span>
            <p className="mt-3 text-sm text-gray-400">
              Truth to Careers
              <br />
              キャリアに、第三者の目を。
            </p>
          </div>

          {/* 求職者向け */}
          <div>
            <h4 className="text-sm font-semibold mb-3">求職者の方</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <Link href="/companies" className="hover:text-white">
                  企業
                </Link>
              </li>
              <li>
                <Link href="/jobs" className="hover:text-white">
                  募集
                </Link>
              </li>
              <li>
                <Link href="/career-consultation" className="hover:text-white">
                  相談
                </Link>
              </li>
              <li>
                <Link href="/articles" className="hover:text-white">
                  記事
                </Link>
              </li>
              <li>
                <Link href="/consultation-cases" className="hover:text-white">
                  相談事例
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
                  Opinioについて
                </Link>
              </li>
              <li>
                <Link href="/about/scope" className="hover:text-white">
                  対象業界
                </Link>
              </li>
              <li>
                <Link href="/about/selection-criteria" className="hover:text-white">
                  掲載企業の審査基準
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

        {/* Concept copy */}
        <div style={{ textAlign: "center", paddingTop: 16, marginTop: 16, borderTop: "0.5px solid rgba(255,255,255,0.1)" }}>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.7 }}>
            創業以来、早期離職ゼロ。
            <br />
            本当のマッチングだけを追求しています。
          </p>
        </div>

        <div className="pt-4 border-t border-gray-800 text-center text-xs text-gray-500">
          &copy; {new Date().getFullYear()} Opinio Inc. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
