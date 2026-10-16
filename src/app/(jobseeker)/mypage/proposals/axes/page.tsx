import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FIT_AXES, buildFitAxesPrompt, fitAxesEnabledFor } from "@/lib/fitAxes/axes";
import { loadFitAxes } from "@/lib/fitAxes/load";
import { JOIN_REASON_LABELS } from "@/lib/constants/careerReasons";
import { companyDisplayName } from "@/lib/companies/displayName";
import MypageLayout from "../../_components/MypageLayout";
import AxesClient from "./AxesClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "相性のものさし | OPINIO" },
  /* ⚠️ 本人にしか出ない画面 */
  robots: { index: false, follow: false },
};

/**
 * ★「相性のものさし」（2026-10-15）。自分の AI に質問文を貼り、答えを貼り戻して作る（OPINIO は LLM を使わない）。
 *
 * ⚠️ 公開前（FIT_AXES_PUBLIC = false）は検証用アカウントだけ。それ以外は 404。
 * ⚠️ 認証は middleware の /mypage が弾く。
 * ⚠️★「以前、入社の決め手に挙げたもの」は**参考として横に出すだけ**。初期値には使わない（柴さんの判断。推測値になるため）。
 */
export default async function AxesPage() {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) redirect("/auth?next=%2Fmypage%2Fproposals%2Faxes");
  const db = createAdminClient();
  const { data: me, error } = await db.from("ow_users").select("id, is_test").eq("auth_id", user.id).maybeSingle();
  if (error) console.error("[axes] ow_users:", error.message);
  if (!me) redirect("/auth?next=%2Fmypage%2Fproposals%2Faxes");
  if (!fitAxesEnabledFor({ isTest: me.is_test === true })) notFound();

  const [saved, expRes] = await Promise.all([
    loadFitAxes(me.id as string),
    /* 参考: 本人が以前、入社の決め手に挙げたもの（⚠️ join_reasons は authenticated に SELECT が無い。admin で本人の分だけ） */
    db.from("ow_experiences")
      .select("join_reasons, started_at, company_text, ow_companies!company_id(name, name_en)")
      .eq("user_id", me.id as string)
      .order("started_at", { ascending: false }),
  ]);
  if (expRes.error) console.error("[axes] ow_experiences:", expRes.error.message);
  const pastReasons = (expRes.data ?? [])
    .map((e) => {
      const co = e.ow_companies as unknown as { name: string; name_en: string | null } | null;
      const labels = ((e.join_reasons as string[] | null) ?? []).map((s) => JOIN_REASON_LABELS[s]).filter(Boolean);
      return { company: co ? companyDisplayName(co.name, co.name_en).displayName : ((e.company_text as string | null) ?? "（会社名なし）"), labels };
    })
    .filter((r) => r.labels.length > 0);

  return (
    <MypageLayout activeKey="proposals">
      <AxesClient
        axes={FIT_AXES.map((a) => ({ key: a.key, name: a.name, left: a.left, right: a.right }))}
        prompt={buildFitAxesPrompt()}
        saved={saved?.values ?? null}
        savedAt={saved?.updatedAt ?? null}
        loadFailed={saved === null}
        pastReasons={pastReasons}
      />
    </MypageLayout>
  );
}
