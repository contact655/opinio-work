import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeNext } from "@/lib/auth/redirects";
import StanceStepClient from "./StanceStepClient";

/**
 * 「転職について」を1問だけ聞く。**未設定のまま使わせないための1枚。**
 *
 * ── なぜ要るか（2026-08-27 / フェーズ3）─────────────────────────────────────
 * スカウトの送信可否を `ow_profiles.scout_enabled`（登録時に自動で true）から
 * `career_stance`（本人が選ぶ・**既定値なし**）へ付け替えた。
 * 未設定を「送れる」に読み替えないと決めたので、**未設定のままだと誰からも届かない。**
 * つまり「答えていない人」を放置すると、本人にも企業にも不利益しか無い。
 *
 * ⚠️ **スキップを置かない。** 置いた瞬間に未設定が残り、この画面を作った意味が消える。
 *    4択のどれを選んでも先へ進める（「いまは声をかけられたくない」も答えのひとつ）。
 *
 * ⚠️ **既に答えている人はここへ来ない**（下で `next` へ送る）。
 *    `OnboardingGuard` と `postAuth` の両方がここへ誘導するので、
 *    到達したときに答え済みという状況は普通に起きる。
 *
 * ⚠️ オンボーディング（会社・職種・入社年月）より**後**に置く。
 *    先に置くと、登録直後の入口が2枚になる。
 */
/* ⚠️ タイトルを付ける。付けないと LP の既定タイトル
      （「OPINIO | IT/SaaS業界の転職・求人情報」）がタブに出て、
      **何を聞かれている画面なのかがタブから読めない。**
   ⚠️ 認証の内側なので `robots` は不要（middleware が未ログインを弾く）。 */
export const metadata = { title: "転職について | OPINIO" };

export default async function StancePage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  /* ⚠️ 認証の判定はここではなく middleware にも入れてある。
        ここだけに頼ると `loading.tsx` を足したときに 200 のまま素通りする。 */
  if (!user) redirect("/auth?next=/onboarding/stance");

  const next = safeNext(searchParams?.next, "/companies");

  const { data: profile, error } = await createAdminClient()
    .from("ow_profiles")
    .select("career_stance, onboarding_completed")
    .eq("user_id", user.id)
    .maybeSingle();

  /* ⚠️ **取得に失敗したら通す**（fail-open）。ここは同意の記録ではなく誘導なので、
        読めなかったことを理由に利用者を足止めしない。失敗はログに残す。 */
  if (error) {
    console.error("[onboarding/stance] ow_profiles:", error.message);
    redirect(next);
  }

  /* オンボーディング自体が終わっていない人は、まずそちらへ。
     ⚠️ 順番を逆にしないこと（会社を聞く前に意思表示だけ聞いても意味が繋がらない）。 */
  if (!profile?.onboarding_completed) {
    redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  }

  if (profile?.career_stance) redirect(next);

  return <StanceStepClient next={next} />;
}
