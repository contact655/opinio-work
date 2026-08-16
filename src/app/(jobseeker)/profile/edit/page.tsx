import { redirect } from "next/navigation";

/**
 * `/profile/edit` → `/mypage`（2026-08-16）。
 *
 * プロフィールの中身は `/mypage` に移した。ここは**転送だけ**。
 *
 * ⚠️ **クエリ文字列を引き継ぐこと。** 過去に送ったメールに
 *    `/profile/edit?tab=settings`（配信停止）や `?welcome=1` が入っており、
 *    落とすと設定タブに着地しない。`?tab=` は `/mypage` がそのまま解釈する。
 *
 * ⚠️ **このファイルを消さないこと。** メールは何年も受信箱に残る。
 *    アプリ内のリンクは 2026-08-16 に全部 `/mypage` へ向け直したので、
 *    ここに来るのは**過去のメールとブックマークだけ**。
 */
export default function ProfileEditRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === "string") qs.set(k, v);
    else if (Array.isArray(v) && v[0] !== undefined) qs.set(k, v[0]);
  }
  const suffix = qs.toString();
  redirect(suffix ? `/mypage?${suffix}` : "/mypage");
}
