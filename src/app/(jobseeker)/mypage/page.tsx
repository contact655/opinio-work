import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MypageClient from "./MypageClient";
import type { Bookmark } from "@/app/mypage/mockMypageData";

export const metadata = { title: "マイページ — Opinio" };

export default async function MypagePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/mypage");
  }

  const { data: owUser } = await supabase
    .from("ow_users")
    .select("id, name, avatar_color, cover_color, about_me, age_range, location, social_links, is_mentor")
    .eq("auth_id", user.id)
    .maybeSingle();

  // Fetch company bookmarks (target_type='company' only; articles/mentors are mock for now)
  let companyBookmarks: Bookmark[] = [];
  if (owUser) {
    const { data: bmarks } = await supabase
      .from("ow_bookmarks")
      .select("id, target_id")
      .eq("user_id", owUser.id)
      .eq("target_type", "company")
      .order("created_at", { ascending: false });

    if (bmarks && bmarks.length > 0) {
      const companyIds = bmarks.map((b) => b.target_id as string);
      const { data: companies } = await supabase
        .from("ow_companies")
        .select("id, name, industry, employee_count, phase")
        .in("id", companyIds);

      if (companies) {
        // Preserve bookmark order (most recently bookmarked first)
        const companyMap = new Map(companies.map((c) => [c.id, c]));
        companyBookmarks = bmarks
          .map((b): Bookmark | null => {
            const c = companyMap.get(b.target_id as string);
            if (!c) return null;
            const meta = [
              c.industry,
              c.employee_count ? `${c.employee_count}名` : null,
            ]
              .filter(Boolean)
              .join(" / ");
            return {
              id: b.id as string,
              type: "company",
              title: c.name as string,
              meta,
              badge_label: (c.industry as string) ?? "企業",
              href: `/companies/${c.id}`,
            };
          })
          .filter((b): b is Bookmark => b !== null);
      }
    }
  }

  return <MypageClient owUser={owUser} companyBookmarks={companyBookmarks} />;
}
