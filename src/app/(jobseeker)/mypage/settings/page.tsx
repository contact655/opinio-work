import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MypageLayout from "../_components/MypageLayout";
import AccountSettings from "./AccountSettings";

/**
 * `/mypage/settings`（2026-08-17 / フェーズ4-1）。
 *
 * 「設定」タブの中身のうち、**アカウントの話だけ**をページにした。
 *
 * ⚠️ **`/mypage?tab=settings` を指すリンクが過去のメールに残っている**
 *    （週次メールの配信停止リンク）。タブを畳むときに、ここへ転送すること。
 */
export const metadata = { title: { absolute: "設定 | OPINIO" }, robots: { index: false, follow: false } };

export default async function MypageSettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/mypage/settings");

  return (
    <MypageLayout activeKey="settings">
      <AccountSettings authEmail={user.email ?? ""} />
    </MypageLayout>
  );
}
