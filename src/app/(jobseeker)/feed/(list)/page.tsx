import { redirect } from "next/navigation";

export type { SidebarFollow, SidebarUserFollow, SidebarJob, SidebarCompany } from "./loadFeedProps";

/**
 * ★/feed は /home に統合した（2026-11-03 / 柴さんの指示）。転送の本体は middleware（ログイン中は /home・未ログインは /）。
 * ⚠️ ここは middleware を通らなかったときの保険。FeedClient・loadFeedProps は /home と /search が使うので、このフォルダに残してある
 */
export default function FeedPage() {
  redirect("/home");
}
