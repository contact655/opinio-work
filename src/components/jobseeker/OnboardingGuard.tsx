"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * ⚠️ キーにユーザーIDを含めること。同じタブで別アカウントに入り直したときに
 *    前の人の判定を引き継がないため。
 */
function completedKey(userId: string): string {
  return `opinio.onboarded.${userId}`;
}

/**
 * ログイン済みで onboarding_completed=false のユーザーを /onboarding へ誘導する。
 *
 * ── ここは「ページ遷移のたびに走る」場所であることに注意（2026-08-13）────────
 * useEffect の依存に pathname が入っているので、**遷移1回ごとに実行される**。
 * 以前はここで毎回
 *   ① `auth.getUser()`（Supabase Auth へネットワーク往復）
 *   ② `ow_profiles` の SELECT（もう1往復）
 * の2往復を出していた。描画が終わった後に走るので「表示はされたのに、まだ重い」
 * という体感の主因になっていた。
 *
 * 2点変えて、定常状態では**往復0回**にした（実測: 遷移で Supabase 往復が 2 → 0）。
 *   ① `getUser()` → `getSession()`。クッキーのトークンが期限内ならネットワークに出ない。
 *      ⚠️ ここは**認可ではなく誘導**なので署名検証は要らない。
 *         偽造クッキーで得をするのは「オンボーディングに飛ばされない」ことだけで、
 *         保護対象のデータには一切触れない。認可は各ページ／RLS 側にある。
 *   ② onboarding_completed = true をタブ内（sessionStorage）に覚える。
 *      ⚠️ **true だけ覚える。** false を覚えると、オンボーディングを完了した直後に
 *         古い false を読んで /onboarding に送り返す無限ループになる。
 */
export function OnboardingGuard() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // onboarding ページ自体・auth系ページでは動かさない
    if (pathname.startsWith("/onboarding") || pathname.startsWith("/auth")) return;

    const supabase = createClient();

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const user = session?.user;
      if (!user) return;

      const key = completedKey(user.id);
      try {
        if (sessionStorage.getItem(key) === "1") return;
      } catch {
        // sessionStorage が使えない環境（プライベートブラウズ等）。毎回引きに行く
      }

      const { data: profile } = await supabase
        .from("ow_profiles")
        .select("onboarding_completed")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile?.onboarding_completed) {
        router.replace(`/onboarding?next=${encodeURIComponent(pathname)}`);
        return;
      }

      try {
        sessionStorage.setItem(key, "1");
      } catch {
        // 保存できなくても動作は変わらない（毎回引くだけ）
      }
    }).catch(() => {
      // Supabase auth lock race condition — non-fatal, ignore silently
    });
  }, [pathname, router]);

  return null;
}
