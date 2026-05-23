import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/biz"],        // /biz ランディングページは公開（企業向けLP）
        disallow: [
          "/admin/",
          "/api/",
          "/biz/auth",               // ログイン・招待ページはクロール不要
          "/biz/dashboard",
          "/biz/company",
          "/biz/jobs",
          "/biz/meetings",
          "/biz/applications",
          "/biz/conversations",
          "/biz/posts",
          "/biz/members",
          "/biz/analytics",
          "/biz/candidates",
          "/biz/organization",
          "/profile/edit",
          "/mypage/",
          "/onboarding",
        ],
      },
    ],
    sitemap: "https://opinio.jp/sitemap.xml",
  };
}
