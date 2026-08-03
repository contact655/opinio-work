import { createAdminClient } from "@/lib/supabase/admin";
import { calcPublicScore } from "@/lib/profile/completion";
import {
  resolveExperienceCompanyLabel,
  EXPERIENCE_COMPANY_COLS,
} from "@/lib/experiences/companyName";

/**
 * /people と /people/role/[slug] が共有する「登録ユーザー一覧」の取得。
 *
 * ── 2026-08-04 の方針変更 ───────────────────────────────────────────────────
 * 以前は ow_company_members（企業の採用担当が承認した所属）を起点にしていたため、
 * 登録しただけの人は一切出なかった。LinkedIn のメンバーディレクトリと同じ考え方に
 * 変え、ow_users を起点にする。
 *
 * ⚠️ 親（/people）だけ変えて子（/people/role/[slug] 7ページ）を放置すると、
 *    同じ人物が親には出て子には出ない状態になる。両方ここを使うこと。
 *
 * ── 出す / 出さないの線 ─────────────────────────────────────────────────────
 * 「カードに出せる情報が1つでもあること」を下限にする。
 *   現職の所属 / 自己紹介 / スキル3件以上 のいずれか。
 * 名前だけのカードが並ぶのを避けるためで、実質「完成度30%相当」に当たる。
 * 職歴の有無だけで切らないのは、職歴未入力でもスキル・学歴・自己紹介が
 * 揃っている人がいるため（切ると落ちる）。
 *
 * visibility は従来どおり。private は常に除外、login_only はログイン時のみ。
 * is_test / is_system も除外する。
 *
 * ── 所属の出どころは2系統ある ───────────────────────────────────────────────
 *   verified … ow_company_members。企業の採用担当が承認した所属
 *   self     … ow_experiences の is_current。本人の自己申告
 * カード側でロゴの有無を変えて区別する。混ぜて同じ見た目にしないこと。
 */

export type Affiliation =
  | {
      kind: "verified";
      companyId: string;
      companyName: string;
      roleTitle: string | null;
      logoUrl: string | null;
      logoGradient: string | null;
      logoLetter: string | null;
      phase: string | null;
    }
  | {
      kind: "self";
      companyName: string;
      roleTitle: string | null;
    }
  | { kind: "none" };

export type DirectoryPerson = {
  userId: string;
  name: string;
  initial: string;
  gradient: string;
  avatarUrl: string | null;
  affiliation: Affiliation;
  /** 所属が無い人のカードに出す。最大3件 */
  skills: string[];
  /** ow_company_members.talk_themes。1件以上で「面談可」バッジ */
  talkThemes: string[];
  /** 公開項目だけの完成度（81点満点）。既定の並び順に使う */
  publicScore: number;
  /** 最初の職歴の開始から現在（または最後の終了）までの月数。職歴が無ければ null */
  experienceMonths: number | null;
  birthYear: number | null;
  createdAt: string | null;
  /** 職種フィルタの照合対象。承認済みと自己申告の役職名を両方含む */
  roleText: string;
  /** 下限判定に使う内部値。skills は表示用に3件へ切っているので別に持つ */
  _hasAboutMe: boolean;
  _skillCount: number;
};

const FALLBACK_GRADIENT = "linear-gradient(135deg, #002366, #3B5FD9)";

/**
 * 自己申告の役職名は部署名を含んでいて長い。
 *   「金融営業本部 営業第1部 / 法人営業（アカウント営業）」
 * カード幅は5列で 235px しかないので、最後の「/」以降だけを出す。
 *
 * 「/」が無ければそのまま返す（"Enterprise Account Executive" 等）。
 * これでも入らない場合は CSS 側で2行までにクランプする。切り詰めはしない
 * （途中で切れた役職名は誤読のもとになるため）。
 */
export function shortenRoleTitle(raw: string | null): string | null {
  if (!raw) return null;
  const parts = raw.split("/").map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

function monthsBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()));
}

type ExpRow = {
  user_id: string;
  is_current: boolean | null;
  started_at: string | null;
  ended_at: string | null;
  role_title: string | null;
  visibility_company: string | null;
  company_id: string | null;
  company_text: string | null;
  company_anonymized: string | null;
  ow_companies: { name: string | null } | { name: string | null }[] | null;
};

type MemberRow = {
  user_id: string;
  role_title: string | null;
  talk_themes: string[] | null;
  company_id: string;
  ow_companies: {
    id: string; name: string | null; brand_name: string | null;
    logo_url: string | null; logo_gradient: string | null; logo_letter: string | null; phase: string | null;
  } | null;
};

export async function getDirectoryPeople(isLoggedIn: boolean): Promise<DirectoryPerson[]> {
  const db = createAdminClient();

  const { data: userRows, error } = await db
    .from("ow_users")
    .select("id, name, avatar_color, avatar_url, visibility, is_test, is_system, about_me, location, social_links, created_at");

  if (error) {
    console.error("[people] ow_users fetch error:", error.message);
    return [];
  }

  type UserRow = {
    id: string; name: string | null; avatar_color: string | null; avatar_url: string | null;
    visibility: string | null; is_test: boolean | null; is_system: boolean | null;
    about_me: string | null; location: string | null;
    social_links: Record<string, unknown> | null; created_at: string | null;
  };

  const visible = ((userRows ?? []) as UserRow[]).filter((u) => {
    if (!u.name) return false;
    if (u.is_test || u.is_system) return false;
    if (u.visibility === "private") return false;
    if (u.visibility === "login_only" && !isLoggedIn) return false;
    return true;
  });

  if (visible.length === 0) return [];
  const ids = visible.map((u) => u.id);

  // 完成度と所属の材料をまとめて引く。
  // ⚠️ 希望条件（ow_profiles）は引かない。公開されない情報を並び順に混ぜないため
  //    （src/lib/profile/completion.ts の PUBLIC_KEYS を参照）。
  const [expRes, eduRes, skillRes, certRes, linkRes, memberRes, careerRes] = await Promise.all([
    db.from("ow_experiences")
      .select(`user_id, is_current, started_at, ended_at, role_title, visibility_company, ${EXPERIENCE_COMPANY_COLS}`)
      .in("user_id", ids),
    db.from("ow_user_educations").select("user_id").in("user_id", ids),
    db.from("ow_user_skill_tags").select("user_id, label, sort_order").in("user_id", ids).order("sort_order"),
    db.from("ow_user_certifications").select("user_id").in("user_id", ids),
    db.from("ow_user_content_links").select("user_id").in("user_id", ids),
    db.from("ow_company_members")
      .select("user_id, role_title, talk_themes, company_id, ow_companies!company_id(id, name, brand_name, logo_url, logo_gradient, logo_letter, phase)")
      .eq("display_consent", true).eq("is_public", true).in("user_id", ids),
    db.from("ow_career_profiles").select("user_id, birth_year").in("user_id", ids),
  ]);

  for (const [label, res] of Object.entries({
    experiences: expRes, educations: eduRes, skills: skillRes,
    certifications: certRes, links: linkRes, members: memberRes, career: careerRes,
  })) {
    if (res.error) console.error(`[people] ${label} fetch error:`, res.error.message);
  }

  const byUser = <T extends { user_id: string }>(rows: T[] | null): Map<string, T[]> => {
    const m = new Map<string, T[]>();
    for (const r of rows ?? []) {
      const arr = m.get(r.user_id);
      if (arr) arr.push(r); else m.set(r.user_id, [r]);
    }
    return m;
  };

  const exps    = byUser((expRes.data ?? []) as unknown as ExpRow[]);
  const edus    = byUser((eduRes.data ?? []) as { user_id: string }[]);
  const skills  = byUser((skillRes.data ?? []) as { user_id: string; label: string }[]);
  const certs   = byUser((certRes.data ?? []) as { user_id: string }[]);
  const links   = byUser((linkRes.data ?? []) as { user_id: string }[]);
  const members = byUser((memberRes.data ?? []) as unknown as MemberRow[]);
  const birthYear = new Map<string, number | null>(
    ((careerRes.data ?? []) as { user_id: string; birth_year: number | null }[]).map((c) => [c.user_id, c.birth_year])
  );

  const now = new Date();

  const people = visible.map((u): DirectoryPerson => {
    const myExps    = exps.get(u.id) ?? [];
    const mySkills  = (skills.get(u.id) ?? []).map((s) => s.label).filter(Boolean);
    const myMembers = members.get(u.id) ?? [];

    // ── 所属。承認済み > 自己申告（現職）> なし ──────────────────────────
    let affiliation: Affiliation = { kind: "none" };

    const verified = myMembers.find((m) => m.ow_companies?.name || m.ow_companies?.brand_name);
    if (verified && verified.ow_companies) {
      const c = verified.ow_companies;
      affiliation = {
        kind: "verified",
        companyId: c.id,
        companyName: c.brand_name ?? c.name ?? "",
        roleTitle: shortenRoleTitle(verified.role_title),
        logoUrl: c.logo_url, logoGradient: c.logo_gradient, logoLetter: c.logo_letter,
        phase: c.phase,
      };
    } else {
      // visibility_company を尊重する。hidden の経歴は社名を出さない
      const current = myExps.find((e) => e.is_current);
      const label = current ? resolveExperienceCompanyLabel(current) : null;
      if (label) {
        affiliation = { kind: "self", companyName: label, roleTitle: shortenRoleTitle(current!.role_title) };
      }
    }

    // ── 経験年数。最初の開始から、現職なら今日、そうでなければ最後の終了まで ──
    const starts = myExps.map((e) => e.started_at).filter(Boolean) as string[];
    let experienceMonths: number | null = null;
    if (starts.length) {
      const first = new Date(starts.sort()[0]);
      const hasCurrent = myExps.some((e) => e.is_current);
      const ends = myExps.map((e) => e.ended_at).filter(Boolean) as string[];
      const last = hasCurrent || ends.length === 0 ? now : new Date(ends.sort()[ends.length - 1]);
      experienceMonths = monthsBetween(first, last);
    }

    const hasAboutMe = !!u.about_me?.trim();

    const publicScore = calcPublicScore({
      hasName: true,
      hasAboutMe,
      hasLocation: !!u.location?.trim(),
      hasAvatar: !!u.avatar_url,
      experienceCount: myExps.length,
      educationCount: (edus.get(u.id) ?? []).length,
      skillCount: mySkills.length,
      certOrAchievementCount: (certs.get(u.id) ?? []).length,
      socialOrContentCount:
        Object.values(u.social_links ?? {}).filter(Boolean).length + (links.get(u.id) ?? []).length,
    });

    return {
      userId: u.id,
      name: u.name!,
      initial: u.name!.charAt(0),
      gradient: u.avatar_color?.startsWith("linear-gradient") ? u.avatar_color : FALLBACK_GRADIENT,
      avatarUrl: u.avatar_url,
      affiliation,
      skills: mySkills.slice(0, 3),
      talkThemes: myMembers.flatMap((m) => m.talk_themes ?? []),
      publicScore,
      experienceMonths,
      birthYear: birthYear.get(u.id) ?? null,
      createdAt: u.created_at,
      // 職種フィルタは承認済み・自己申告の両方を見る。
      // 片方だけだと、自己申告しかない人がどの職種にも当たらなくなる。
      roleText: [
        ...myMembers.map((m) => m.role_title ?? ""),
        ...myExps.map((e) => e.role_title ?? ""),
      ].join(" "),
      _hasAboutMe: hasAboutMe,
      _skillCount: mySkills.length,
    };
  });

  // ── 下限: カードに出せる情報が1つでもあること ────────────────────────────
  //    名前だけのカードを並べないための線。この3つはいずれもカード上に出る情報。
  const shown = people.filter(
    (p) => p.affiliation.kind !== "none" || p._hasAboutMe || p._skillCount >= 3
  );

  // 既定は完成度の高い順。同点は新しい登録順
  return shown.sort(
    (a, b) => b.publicScore - a.publicScore || (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
  );
}
