import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "xtutnecqeamftygufxco.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "logo.clearbit.com",
      },
    ],
  },
  async headers() {
    // CSP: script-src には 'unsafe-inline' が必要（Next.js のインラインスクリプト）。
    // script-src-elem で外部スクリプトを制限し、外部ドメインのスクリプト読み込みを防ぐ。
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.sentry-cdn.com https://browser.sentry-cdn.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      /* ⚠️ Sentry の送信先はプロジェクト固有のホスト。**ここを固定値で書かないこと。**
            2026-08-09 まで別プロジェクトの `o4505551827705856.ingest.sentry.io` が
            書かれており、実際の DSN（`o…4511592536276992.ingest.us.sentry.io`）と
            一致しないため、**本番のクライアントエラーが1件も届いていなかった**。
            JS は配信・実行されるので、画面もビルドも正常に見える。
            US / EU など地域サフィックスも変わるのでワイルドカードで受ける。 */
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://sentry.io https://*.ingest.sentry.io https://*.ingest.us.sentry.io",
      /* Sentry の Session Replay が blob: の Worker を作る。
         これが無いと script-src にフォールバックして弾かれる */
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
  async redirects() {
    return [
      /* ★`/salary`（年収相場）は 2026-08-29 に削除した。**sitemap に10URL 載せていた**ので、
            404 にせず 301 で `/jobs` へ送る（年収レンジは求人一覧で見られる）。
         ⚠️ 削除の理由は `src/app/sitemap.ts` のコメントを参照。**復活させないこと。** */
      { source: "/salary", destination: "/jobs", permanent: true },
      { source: "/salary/:slug", destination: "/jobs", permanent: true },
      {
        source: "/for-companies",
        destination: "/business",
        permanent: true,
      },
      {
        source: "/mentors",
        destination: "/people",
        permanent: true,
      },
      {
        source: "/mentors/:path*",
        destination: "/people",
        permanent: true,
      },
      // 職種ページを ow_roles の9大分類に揃えた際に消えた2スラッグ（2026-08-03）。
      // 移行時点で両方とも0件だったが sitemap に載っていたのでクローラは辿る。
      // /jobs/dept/management は「経営・事業開発」で、9大分類では exec と bizdev に
      // 分かれる。ラベルの先頭が「経営」だったため exec に寄せた。
      {
        source: "/jobs/dept/management",
        destination: "/jobs/dept/exec",
        permanent: true,
      },
      // 「インフラ・SRE」は9大分類では engineer 配下（SRE/インフラ）に含まれる。
      {
        source: "/jobs/dept/infra",
        destination: "/jobs/dept/engineer",
        permanent: true,
      },
      {
        source: "/biz/company/employees/categories",
        destination: "/biz/organization",
        permanent: true,
      },
      {
        source: "/biz/company/employees/categories/:path*",
        destination: "/biz/organization/:path*",
        permanent: true,
      },
    ];
  },
};

/* ★ローカルの build / start だけ出力先を `.next` から分ける（2026-08-22）
 *
 * ── なぜ ──────────────────────────────────────────────────────────────────
 * `next dev` / `next build` / `next start` は既定で**同じ `.next` を共有する**ため、
 * 並行して動かすと壊れる。実際に4回踏んでいる（CLAUDE.md「dev サーバー稼働中に
 * `.next` を触る他のコマンドを打たない」）。
 *   ② dev 稼働中に build      → `Cannot find module './vendor-chunks/*.js'`（500）
 *   ③ dev 稼働中に next start → 同上（**ポートを分けても `.next` は共有**）
 *   ④ build の直後に dev      → クライアントチャンクが 404。**500 にならない**ので
 *                               「実装が効いていない」ように見える（一番たちが悪い）
 * 出力先を分ければ ②③④ は**原理的に起きなくなる**。
 *
 * ⚠️ ①（dev の二重起動）はこれでは防げない。両方 `.next` を使うため。
 *    そちらは PID チェック側で見る。
 *
 * ── ⚠️ Vercel では絶対に変えない ────────────────────────────────────────────
 * `distDir` を条件分岐にすると Vercel の出力トレース（どのファイルを
 * サーバーレス関数へ同梱するかの解決）と噛み合わない箇所があるため、
 * **本番側は既定の `.next` のまま**にする。
 * `VERCEL` / `CI` があるときは**この分岐に一切入らない**。
 * ⚠️ 将来 CI を足すときも、ここを通さない（既定のままにする）こと。
 */
const isDev = process.env.NODE_ENV === "development";
const isManagedBuild = Boolean(process.env.VERCEL || process.env.CI);

if (!isDev && !isManagedBuild) {
  // ローカルの build / start だけ。dev（`.next`）と衝突しない場所へ出す
  nextConfig.distDir = ".next-prod";
}

export default isDev
  ? nextConfig
  : withSentryConfig(nextConfig, {
      org: "opinio",
      project: "javascript-nextjs",
      silent: !process.env.CI,
      widenClientFileUpload: true,
      hideSourceMaps: true,
      disableLogger: true,

      /*
        ⚠️ **ソースマップを作らない。作ってもどこにも使われず、関数だけが太る。**

        Sentry のプラグインは既定でマップを生成し、**アップロードしたあとに削除する**
        （`sourcemaps.deleteSourcemapsAfterUpload` の既定が true）。
        ところが **アップロードには `SENTRY_AUTH_TOKEN` が要る**。
        2026-08-23 に確認したところ、Vercel には Production / Preview のどちらにも
        このトークンが**無い**。つまり——

          アップロードされない → 削除もされない → マップだけが残る

        実測（2026-08-23 / 本番と同じ設定のビルド）:

          サーバーレス関数1つあたりの同梱物 … 29.60 MB
            うち .js.map ………………………… 22.74 MB（**77%**）
            うち .js ……………………………… 6.84 MB

        `.js` の末尾に `//# sourceMappingURL=...` が付くため、Next の出力トレースが
        マップまで関数に同梱する。**中身は誰も読まない**
        （`hideSourceMaps: true` なのでブラウザにも配られず、Sentry にも上がっていない）。
        コールドスタートは関数の取得と展開から始まるので、これは丸ごと待ち時間になる。

        ── ⚠️ スタックトレースを読めるようにしたくなったら ──────────────────
        **ここを消すのではなく、`SENTRY_AUTH_TOKEN` を Vercel に足すこと。**
        トークンがあれば「アップロード → 自動削除」が働くので、
        **読めるトレースと小さい関数が両立する**（既定の挙動に戻すだけでよい）。
        いまのように「マップはあるが上がっていない」状態は、
        **読めないうえに重い**という一番損な組み合わせになっている。
      */
      sourcemaps: { disable: true },
    });
