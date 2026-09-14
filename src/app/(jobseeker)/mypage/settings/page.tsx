import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MypageLayout from "../_components/MypageLayout";
import AccountSettings from "./AccountSettings";
import PrivacySettings from "./PrivacySettings";
import BasicInfoSettings from "./BasicInfoSettings";
import type { Gender } from "@/lib/constants/gender";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProfileVisibility } from "@/lib/constants/profileVisibility";

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
    /* ⚠️ 2026-09-14 に `location, gender, phone` を足した。**admin で引いているので通る。**
          ⚠️★`gender` / `phone` は authenticated に SELECT を配っていない（`ow_users` の RLS は
             「ログインしていれば他人の行も読める」ため）。**session クライアントに移さないこと。** */
    .select("id, visibility, location, gender, phone")
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

  /* ⚠️★会社名を伏せる設定を畳んだので（2026-09-15）、その初期値を作る問い合わせも外した。
        `ow_experiences` の `visibility_company` / `generateMaskedCompanyLabel()` を
        ここで引いていたが、読む画面が無くなった。**戻すなら PrivacySettings の注記を先に読むこと。**
        ⚠️ 列・データ・読み手（`/biz/candidates` など）は残っている。消えたのは入力側だけ。 */

  return (
    <MypageLayout activeKey="settings">
      {/* ★基本情報（2026-09-14）。⚠️ **性別・電話番号は SELECT の GRANT を配っていない**ので、
             ここ（admin クライアント）で引いて初期値として渡す。
             ⚠️★セッションのクライアントで select しないこと —— **クエリが丸ごと 403** になり、
                `visibility` まで取れなくなる（CLAUDE.md「403 は『0件』として静かに素通りする」）。 */}
      <BasicInfoSettings
        initialLocation={(owUser?.location as string | null) ?? null}
        initialGender={(owUser?.gender as Gender | null) ?? null}
        initialPhone={(owUser?.phone as string | null) ?? null}
      />
      <PrivacySettings
        initialVisibility={((owUser?.visibility as ProfileVisibility | null) ?? "login_only")}
        careerStance={(prof?.career_stance as string | null) ?? null}
        careerStanceKnown={!profError}
      />
      <AccountSettings authEmail={user.email ?? ""} />
    </MypageLayout>
  );
}
