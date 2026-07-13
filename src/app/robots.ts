import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/biz"],        // /biz ランディングページは公開（企業向けLP）
        disallow: [
          "/u/",
          "/people",
          "/admin/",
          "/api/",
          "/biz/auth",
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
          "/auth",
          "/feed",
          "/profile/",
          "/mypage/",
          "/onboarding",
          "/reviews",
          "/career-trajectories",
        ],
      },
    ],
    sitemap: "https://opinio.jp/sitemap.xml",
  };
}
