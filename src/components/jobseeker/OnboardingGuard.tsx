"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ログイン済みで onboarding_completed=false のユーザーを /onboarding へ誘導する
export function OnboardingGuard() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // onboarding ページ自体・auth系ページでは動かさない
    if (pathname.startsWith("/onboarding") || pathname.startsWith("/auth")) return;

    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;

      const { data: profile } = await supabase
        .from("ow_profiles")
        .select("onboarding_completed")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile?.onboarding_completed) {
        router.replace(`/onboarding?next=${encodeURIComponent(pathname)}`);
      }
    });
  }, [pathname, router]);

  return null;
}
