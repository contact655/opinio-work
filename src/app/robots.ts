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
          /* ★横断検索。クエリごとに無限にURLが生えるうえ、中身は
                /companies /jobs /people の再掲。入力がそのままURLに出るので
                個人名を含むURLがインデックスされうる。
             ⚠️ **Disallow だけでは足りない。** クロールされないと meta が読まれず、
                既にインデックスされたURLが消えない。`/search` 側の
                `metadata.robots` に noindex を入れてあるので、両方で守る
                （/people と同じ形）。 */
          "/search",
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
          "/mypage",
          "/onboarding",
          "/reviews",
          "/career-trajectories",
        ],
      },
    ],
    sitemap: "https://opinio.jp/sitemap.xml",
  };
}
