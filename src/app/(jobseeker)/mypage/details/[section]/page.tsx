import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import EducationDetails from "./EducationDetails";

/**
 * プロフィールの1セクションだけを**全件**出すページ（2026-08-17 / フェーズ3）。
 *
 * ── なぜ作ったか ─────────────────────────────────────────────────────────────
 * `/mypage` の本体には行ごとの鉛筆・ゴミ箱が並んでいた。LinkedIn と一番違うのがここで、
 * 行が増えるほど本文がアイコンで埋まる。本体は**読むためのページ**にして、
 * 行を1件ずつ触る操作はこのページに寄せる。
 *
 * ⚠️ **取得はそのセクションの1本だけ。** `/mypage` の Promise.all を持ってこないこと。
 *    このページは「1つのセクションを触る」ためだけにある。
 *
 * ⚠️ **存在しない `section` は 404。** 実装済みのものだけを `SECTIONS` に載せる。
 *    本体側の見出しに ✎ を足すのは、そのセクションをここに載せてから。
 */
const SECTIONS = ["education"] as const;
type Section = (typeof SECTIONS)[number];

/**
 * ★存在しない `section` を **ルーティングの段階で 404 にする**（2026-08-17）。
 *
 * ⚠️ **`notFound()` では 404 にならない。** `/mypage/loading.tsx` が
 *    このルートの上に Suspense 境界を作っているため、Next は先にシェルを流し始め、
 *    **ステータスは 200 のまま**で 404 の画面だけが出る（実測）。
 *    `generateStaticParams` + `dynamicParams = false` なら、
 *    知らない param はレンダリングに入る前に落ちるので本物の 404 になる。
 *
 * ⚠️ ページ自体は cookie を読むので動的レンダリングのまま。ここで列挙するのは
 *    「受け付ける値」であって、事前生成の指示ではない。
 */
export function generateStaticParams() {
  return SECTIONS.map((section) => ({ section }));
}
export const dynamicParams = false;

export const metadata = { title: { absolute: "プロフィールの編集 | OPINIO" }, robots: { index: false, follow: false } };

export default async function ProfileDetailsPage({ params }: { params: { section: string } }) {
  const section = params.section as Section;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth?next=/mypage/details/${section}`);

  /* ⚠️ birth_date は authenticated から SELECT 権限を剥がしてあるので admin で引く
        （session クライアントに混ぜるとクエリごと 403 になり、丸ごと空になる）。
        対象は本人の行に固定。 */
  const { data: owUser } = await createAdminClient()
    .from("ow_users")
    .select("id, birth_date")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!owUser) redirect("/mypage");

  const [{ data: edus }, { data: schools }] = await Promise.all([
    supabase
      .from("ow_user_educations")
      .select("id, school, school_id, faculty, degree, enrolled_at, graduated_at, is_current, sort_order, school_master:ow_schools!school_id(id, name, logo_letter, logo_gradient, logo_url)")
      .eq("user_id", owUser.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("ow_schools")
      .select("id, name, name_kana, logo_letter, logo_gradient, logo_url, type")
      .order("name", { ascending: true }),
  ]);

  return (
    <EducationDetails
      initialEducations={(edus ?? []).map((e) => ({
        id: e.id as string,
        school: e.school as string,
        school_id: (e.school_id as string | null) ?? null,
        school_master: (e.school_master as unknown as { id: string; name: string; logo_letter: string | null; logo_gradient: string | null; logo_url: string | null } | null) ?? null,
        faculty: (e.faculty as string | null) ?? null,
        degree: (e.degree as string | null) ?? null,
        enrolled_at: (e.enrolled_at as string | null) ?? null,
        graduated_at: (e.graduated_at as string | null) ?? null,
        is_current: e.is_current as boolean,
        sort_order: e.sort_order as number,
      }))}
      schools={(schools ?? []) as never}
      birthDate={(owUser.birth_date as string | null) ?? null}
    />
  );
}
