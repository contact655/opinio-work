import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MypageLayout from "../_components/MypageLayout";
import AccountSettings from "./AccountSettings";
import PrivacySettings from "./PrivacySettings";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProfileVisibility } from "@/lib/constants/profileVisibility";
import type { CompanyVisibility } from "@/lib/constants/companyVisibility";
import { generateMaskedCompanyLabel } from "@/lib/utils/timeline";

/**
 * `/mypage/settings`（2026-08-17 / フェーズ4-1）。
 *
 * 「設定」タブの中身のうち、**アカウントの話だけ**をページにした。
 *
 * ⚠️ **公開範囲とブロック中の企業もここに置く**（2026-08-20 / B-2）。
 *    公開範囲は本文の「転職の希望」から移した。**両方に置かないこと。**
 *    ブロック中の企業は 2026-08-17 以降どこにも出ていなかった（SettingsTab がタブごと外れたため）。
 *
 * ⚠️ **`/mypage?tab=settings` を指すリンクが過去のメールに残っている**
 *    （週次メールの配信停止リンク）。タブを畳むときに、ここへ転送すること。
 */
export const metadata = { title: { absolute: "設定 | OPINIO" }, robots: { index: false, follow: false } };

export default async function MypageSettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/mypage/settings");

  /* ⚠️ `visibility` は `ow_users`。**admin で引く**（列単位 GRANT の表で、
        session クライアントだと将来ここに列を足したときに 403 になりうる）。 */
  const admin = createAdminClient();
  const { data: owUser, error: owUserError } = await admin
    .from("ow_users")
    .select("id, visibility")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (owUserError) console.error("[mypage/settings] ow_users:", owUserError.message);

  /* ★「企業の候補者検索での見え方」の前置きを書き分けるために要る（2026-09-10）。
     ⚠️ `ow_profiles.user_id` は **auth 空間**（`ow_users.id` ではない）。
     ⚠️ **null と `no_contact` を潰さないこと。** 前者は「まだ答えていない」、
        後者は「答えた結果」で、出す文が違う（`IntentCard` と同じ区別）。
     ⚠️ 取得に失敗しても画面は出す。⚠️★ただし**その節を出さない**——
        取れなかったのに「表示されています」と書くと嘘になる。 */
  const { data: prof, error: profError } = await admin
    .from("ow_profiles")
    .select("career_stance")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profError) console.error("[mypage/settings] ow_profiles:", profError.message);

  /* ★会社名の公開範囲（2026-09-11）。**職歴全体の1設定**として出す。
     ⚠️ 値は行ごとに持つ（読み手6面がその列を見る）ので、**全行の共通値**を初期値にする。
        割れている場合はいちばん強いものを出す（迷ったら狭いほうへ）。
     ⚠️★**職歴0件なら入力欄を出さない。** 設定する対象の行が無く、保存しても0行更新になる。 */
  const { data: expRows, error: expErr } = await admin
    .from("ow_experiences")
    .select("visibility_company, is_current, company_id, company_anonymized")
    .eq("user_id", (owUser?.id as string | undefined) ?? "00000000-0000-0000-0000-000000000000");
  if (expErr) console.error("[mypage/settings] ow_experiences:", expErr.message);

  const visValues = new Set((expRows ?? []).map((r) => (r.visibility_company as string) ?? "real"));
  const companyVisibility: CompanyVisibility =
    visValues.has("hidden") ? "hidden" : visValues.has("masked") ? "masked" : "real";

  /* ★「伏せるとどう出るか」の実物。⚠️ 規則を書き写さず `generateMaskedCompanyLabel()` を呼ぶ。
     ⚠️ 現職が無ければ何も出さない（推測で例を作らない）。 */
  let maskedSample: string | null = null;
  const currentExp = (expRows ?? []).find((r) => r.is_current) ?? (expRows ?? [])[0];
  if (currentExp) {
    const cid = currentExp.company_id as string | null;
    const { data: co } = cid
      ? await admin.from("ow_companies").select("name, industry, phase, employee_count").eq("id", cid).maybeSingle()
      : { data: null };
    maskedSample = generateMaskedCompanyLabel(
      co ? {
        name: co.name as string, logoUrl: null, logoLetter: null, logoGradient: null,
        industry: (co.industry as string | null) ?? null,
        phase: (co.phase as string | null) ?? null,
        employee_count: Number(co.employee_count) || null,
      } : undefined,
      (currentExp.company_anonymized as string | null) ?? null,
    );
  }

  return (
    <MypageLayout activeKey="settings">
      <PrivacySettings
        initialVisibility={((owUser?.visibility as ProfileVisibility | null) ?? "login_only")}
        careerStance={(prof?.career_stance as string | null) ?? null}
        careerStanceKnown={!profError}
        companyVisibility={companyVisibility}
        hasExperiences={(expRows ?? []).length > 0}
        maskedSample={maskedSample}
      />
      <AccountSettings authEmail={user.email ?? ""} />
    </MypageLayout>
  );
}
