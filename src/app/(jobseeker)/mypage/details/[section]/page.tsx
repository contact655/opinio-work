import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AchievementsDetails, AwardsDetails, CertificationsDetails, LanguagesDetails, SkillsDetails, MediaDetails, ContentDetails } from "./SimpleDetails";

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
 *    （職歴だけは職種マスタ・企業ロゴが要るので3本になる。表示に必要な最小。）
 *
 * ⚠️ **存在しない `section` は 404。** 下の `SECTIONS` に無いものは
 *    `dynamicParams = false` によりレンダリングに入る前に落ちる。
 */
const SECTIONS = ["achievements", "awards", "certifications", "languages", "skills", "media", "content"] as const;
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

  /* ⚠️★**職歴（experience）と学歴（education）はここには無い**（2026-09-12 / 柴さんの指示）。
        `/mypage/details/experience` と `/mypage/details/education` は
        **`src/middleware.ts` が `/mypage` へ転送する**。行ごとの編集は `/mypage` 本体の
        行の鉛筆 → その場のモーダルに戻した。
     ⚠️ 下の `SECTIONS` からも外してある。**戻すときは middleware の転送も外すこと。** */

  /* ── 残り6つ。表も形も同じなので取得だけ切り替える ────────────────────────── */
  /* ★資格（2026-08-24）。⚠️ **職歴に紐づかない**ので、下の実績・受賞のように
        職歴の表示名を組み立てる必要がない。media / content と同じ形。 */
  if (section === "certifications") {
    const { data, error: qErr } = await supabase
      .from("ow_user_certifications")
      .select("id, name, issuer, issued_at, credential_id, credential_url, sort_order")
      .eq("user_id", owUser.id).order("sort_order", { ascending: true });
    if (qErr) console.error("[mypage/details/[section]] ow_user_certifications:", qErr.message);
    return <CertificationsDetails initial={(data ?? []) as never} />;
  }

  /* ★言語（2026-08-24）。⚠️ 資格と同じく職歴に紐づかない。 */
  /* ⚠️ `language_id` も引く（2026-08-27 のマスタ化）。編集モーダルの初期選択に要る。
        ⚠️ `createAdminClient` なのは `types.ts` にこの列がまだ無いため
           （`gen:types` が流せない事情は `api/jobseeker/languages` の冒頭）。
           admin は RLS をバイパスするので `user_id` の条件を必ず付けること。 */
  if (section === "languages") {
    const { data, error } = await createAdminClient()
      .from("ow_user_languages")
      /* ⚠️ `name`（複製）は読まない。**表示名はマスタから取る**（2026-08-28）。 */
      .select("id, language_id, proficiency, sort_order, language:ow_languages(label)")
      .eq("user_id", owUser.id).order("sort_order", { ascending: true });
    if (error) console.error("[details/languages]", error.message);
    /* ⚠️ マスタが引けなかった行は出さない（空文字の行を並べない） */
    const rows = ((data ?? []) as unknown as Array<{
      id: string; language_id: string | null; proficiency: string | null; sort_order: number;
      language: { label: string } | null;
    }>)
      .filter((l) => !!l.language?.label)
      .map((l) => ({
        id: l.id, language_id: l.language_id, name: l.language!.label,
        proficiency: l.proficiency, sort_order: l.sort_order,
      }));
    return <LanguagesDetails initial={rows as never} />;
  }

  /* ★スキル（2026-08-27）。⚠️ 読み取りは `createAdminClient`。
        ⚠️ **admin は RLS をバイパスする**ので、`user_id` の条件を自分で必ず付けること。
        ⚠️ マスタ（`ow_skills`）も一緒に引く。ピッカーの選択肢になる。
           `is_active` で絞る——止めたスキルを新しく選べてはいけない。 */
  if (section === "skills") {
    const admin = createAdminClient();
    const [{ data: rows, error: rowsErr }, { data: masters, error: mastersErr }] = await Promise.all([
      admin
        .from("ow_user_skills")
        .select("id, skill_id, skill:ow_skills(id, label, category)")
        .eq("user_id", owUser.id)
        .order("created_at", { ascending: true }),
      admin
        .from("ow_skills")
        .select("id, label, category, aliases")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);
    /* ⚠️ error を握りつぶさない。`?? []` だけで受けると「0件」に化ける */
    if (rowsErr)    console.error("[details/skills rows]", rowsErr.message);
    if (mastersErr) console.error("[details/skills masters]", mastersErr.message);
    return <SkillsDetails initial={(rows ?? []) as never} masters={(masters ?? []) as never} />;
  }

  if (section === "media") {
    const { data, error: qErr } = await supabase
      .from("ow_user_media_appearances")
      .select("id, title, media_name, url, thumbnail_url, appeared_at, description, sort_order")
      .eq("user_id", owUser.id).order("sort_order", { ascending: true });
    if (qErr) console.error("[mypage/details/[section]] ow_user_media_appearances:", qErr.message);
    return <MediaDetails initial={(data ?? []) as never} />;
  }

  if (section === "content") {
    const { data, error: qErr } = await supabase
      .from("ow_user_content_links")
      .select("id, url, platform, title, description, thumbnail_url, sort_order")
      .eq("user_id", owUser.id).order("sort_order", { ascending: true });
    if (qErr) console.error("[mypage/details/[section]] ow_user_content_links:", qErr.message);
    return <ContentDetails initial={(data ?? []) as never} />;
  }

  /* 数値実績・受賞は「どの職歴に紐づけるか」のセレクトがあるので職歴の表示名も要る */
  const [{ data: rows }, { data: expRows }] = await Promise.all([
    section === "achievements"
      ? supabase.from("ow_user_achievements")
          .select("id, title, value, unit, description, period_start, period_end, sort_order, experience_id")
          .eq("user_id", owUser.id).order("sort_order", { ascending: true })
      : supabase.from("ow_user_awards")
          .select("id, title, issuer, awarded_at, description, sort_order, experience_id")
          .eq("user_id", owUser.id).order("sort_order", { ascending: true }),
    createAdminClient()
      .from("ow_experiences")
      .select("id, company_id, company_text, company_anonymized, started_at, ended_at, is_current")
      .eq("user_id", owUser.id)
      .order("is_current", { ascending: false })
      .order("started_at", { ascending: false }),
  ]);

  const expCompanyIds = (expRows ?? []).filter((r) => r.company_id).map((r) => r.company_id as string);
  const nameById = new Map<string, string>();
  if (expCompanyIds.length > 0) {
    const { data: companies, error: companiesErr } = await supabase.from("ow_companies").select("id, name").in("id", expCompanyIds);
    if (companiesErr) console.error("[mypage/details/[section]] ow_companies:", companiesErr.message);
    for (const c of companies ?? []) nameById.set(c.id as string, c.name as string);
  }
  const experienceOptions = (expRows ?? []).map((r) => {
    const label = r.company_id
      ? (nameById.get(r.company_id as string) ?? "不明な企業")
      : (r.company_text as string | null) ?? (r.company_anonymized as string | null) ?? "非公開企業";
    const from = r.started_at ? (r.started_at as string).slice(0, 7) : "";
    const to = r.is_current ? "現在" : (r.ended_at ? (r.ended_at as string).slice(0, 7) : "");
    return { id: r.id as string, label: `${label}（${from}〜${to}）` };
  });

  return section === "achievements"
    ? <AchievementsDetails initial={(rows ?? []) as never} experienceOptions={experienceOptions} />
    : <AwardsDetails initial={(rows ?? []) as never} experienceOptions={experienceOptions} />;
}
