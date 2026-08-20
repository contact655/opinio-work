import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcPublicScore } from "@/lib/profile/completion";
import {
  resolveExperienceCompanyLabel,
  EXPERIENCE_COMPANY_COLS,
} from "@/lib/experiences/companyName";
import { getRoleTree } from "@/lib/supabase/queries";
import { resolveTopRole } from "@/lib/roles/jobRoles";

/**
 * /people と /people/role/[slug] が共有する「登録ユーザー一覧」の取得。
 *
 * ── 2026-08-04 の方針変更 ───────────────────────────────────────────────────
 * 以前は ow_company_members（運営が作成した掲載レコード）を起点にしていたため、
 * 登録しただけの人は一切出なかった。LinkedIn のメンバーディレクトリと同じ考え方に
 * 変え、ow_users を起点にする。
 *
 * ⚠️ 親（/people）だけ変えて子（/people/role/[slug] 7ページ）を放置すると、
 *    同じ人物が親には出て子には出ない状態になる。両方ここを使うこと。
 *
 * ── 出す / 出さないの線 ─────────────────────────────────────────────────────
 * 「カードに出せる情報が1つでもあること」を下限にする。
 *   現職の所属 または 自己紹介。
 * 名前だけのカードが並ぶのを避けるため。
 * 職歴の有無だけで切らないのは、職歴未入力でも学歴・自己紹介が
 * 揃っている人がいるため（切ると落ちる）。
 *
 * visibility は従来どおり。private は常に除外、login_only はログイン時のみ。
 * is_test / is_system も除外する。
 *
 * ── 所属の出どころは2系統ある ───────────────────────────────────────────────
 *   verified … ow_company_members。企業ページに掲載されている所属
 *   self     … ow_experiences の is_current。本人の自己申告
 * カード側でロゴの有無を変えて区別する。混ぜて同じ見た目にしないこと。
 *
 * ⚠️ verified は「企業が在籍を確認した」という意味ではない。名前に反するので注意。
 *    2026-08-04 実測で、公開中の4件はすべて invited_at / invited_by が空＝
 *    運営が直接作った行。企業側の招待フロー（/api/biz/ambassador/invite）を
 *    通っておらず、ドメイン認証済みの企業も 85社中0社。
 *    この kind を根拠に「確認済み」と表示しないこと。
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
  /**
   * 現職が無い人の、直近の所属。カードには「元 Salesforce」の形で出す。
   * OB/OG が増えたときに、所属が空のカードにならないようにするためのもの。
   */
  | {
      kind: "past";
      companyName: string;
      roleTitle: string | null;
      /** 退職年（YYYY）。取れなければ null */
      endedYear: number | null;
    }
  /**
   * 職歴がまったく無い人の受け皿。最終学歴の学校名を出す。
   *
   * 想定は「登録直後でまだ職歴を入れていない人」。
   * 職歴を入れれば past / self / verified のいずれかに変わるので、
   * 定常的にはほとんど使われない。
   * ⚠️ 自由記述ではなく ow_user_educations.school を使う。品質が揃うため。
   */
  | { kind: "education"; schoolName: string }
  | { kind: "none" };

export type DirectoryPerson = {
  userId: string;
  name: string;
  initial: string;
  gradient: string;
  avatarUrl: string | null;
  affiliation: Affiliation;
  /**
   * 職種。ow_experiences.role_category_id → ow_roles。
   * 子階層があれば子（フィールドセールス）、無ければ大分類（営業）。
   * 5名中4名が大分類「営業」で識別できないため、細かいほうを出す。
   */
  roleName: string | null;
  /** 職種フィルタ用の9大分類 ID。roleName とは粒度が違う（フィルタは粗く） */
  topRoleId: string | null;
  /**
   * これまでの職歴に**1社でも外資系**（`ow_companies.is_foreign`）があるか。
   * ⚠️ 現職に限らない。過去の在籍も含める（/people の外資系フィルタ用）。
   * ⚠️ マスタと紐づいた経歴（`company_id`）だけが対象。自由入力の社名は
   *    外資かどうかを判定できないので false になる（推測しない）。
   */
  hasForeignExperience: boolean;
  /** ow_users.can_casual_meeting。true で「面談可」バッジ */
  canCasualMeeting: boolean;
  /** 公開項目だけの完成度（81点満点）。既定の並び順に使う */
  publicScore: number;
  /** 最初の職歴の開始から現在（または最後の終了）までの月数。職歴が無ければ null */
  experienceMonths: number | null;
  /* ★`age` は 2026-08-20 に落とした。**戻さないこと。**
        `/people` は一覧であり、一覧に年齢は出さない・年齢で絞り込ませない方針。
        型に無ければ表示も絞り込みも書けない（コメントでの禁止は守られていない実績がある）。
        年齢を出してよいのは詳細ページ（`/u/[id]`）だけで、そこは `lib/age.ts` の
        `getUserAge()` を通す。 */
  createdAt: string | null;
  /**
   * プロフィールを最後に更新した日時（`ow_users.updated_at`）。「更新順」の並べ替えに使う。
   *
   * ⚠️ **動くのは `ow_users` の行が変わったときだけ**（名前・肩書き・自己紹介・SNS・
   *    公開範囲など）。職歴や学歴を足しても `ow_users` は触らないので動かない。
   *    「プロフィール本体を直した順」であって「何かを追加した順」ではない。
   * ⚠️ `PUT /api/jobseeker/profile` が毎回書いている（実測: 15件中15件に値あり、
   *    うち4件は created_at と異なる）。
   */
  updatedAt: string | null;
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
  role_category_id: string | null;
  visibility_company: string | null;
  company_id: string | null;
  company_text: string | null;
  company_anonymized: string | null;
  ow_companies: { name: string | null } | { name: string | null }[] | null;
};

type MemberRow = {
  user_id: string;
  role_title: string | null;
  company_id: string;
  ow_companies: {
    id: string; name: string | null; brand_name: string | null;
    logo_url: string | null; logo_gradient: string | null; logo_letter: string | null; phase: string | null;
  } | null;
};

/**
 * ★一覧の中身をキャッシュする（2026-08-20）。
 *
 * ── なぜ ───────────────────────────────────────────────────────────────────
 * **`/people` の「初回だけ遅い」の正体は、クエリの重さではなく最初の接続コスト。**
 * 同じ10本のクエリを連続で走らせた実測（東京→東京）:
 *
 *     1回目 5,154ms → 2回目 450ms → 3回目 98ms
 *
 * 本番の実測（3.74秒 → 1.77 → 0.53）と形が一致する。
 * サーバーレスは**冷えたところから始まる**ので、低トラフィックのページでは
 * 利用者にとって毎回が1回目になる。
 *
 * → 結果をキャッシュしておけば、**冷えたサーバーがDBに触らずに済む**。
 *   ISR 化のような大改修をしなくてもここだけで効く。
 *
 * ⚠️ **鮮度は5分。** 新しい登録者が一覧に出るまで最大5分かかる。
 *    ディレクトリなので許容する（求人一覧 `getJobs` も同じ 300 秒）。
 * ⚠️ **本人ごとの情報をここに入れないこと。** フォロー状態や自分の id は
 *    呼び出し側（page.tsx）がリクエストごとに引いている。混ぜると他人に見える。
 * ⚠️ `isLoggedIn` は引数なのでキャッシュキーに含まれる（true/false で別々に持つ）。
 *    実際には middleware が `/people` をログイン必須にしているので true 側しか使われない。
 * ⚠️ `unstable_cache` は戻り値を JSON 化する。`DirectoryPerson` は素の配列・
 *    オブジェクトだけなので往復できる（Map / Set を足さないこと）。
 */
export const getDirectoryPeople = unstable_cache(
  async (isLoggedIn: boolean): Promise<DirectoryPerson[]> => fetchDirectoryPeople(isLoggedIn),
  ["directory-people"],
  { revalidate: 300, tags: ["directory-people"] }
);

async function fetchDirectoryPeople(isLoggedIn: boolean): Promise<DirectoryPerson[]> {
  const db = createAdminClient();

  const { data: userRows, error } = await db
    .from("ow_users")
    /* ⚠️ **birth_date は取らない**（2026-08-20）。一覧に年齢を出さない・年齢で絞り込まないため。
       ここは createAdminClient なので取れる（/u/[id] も同じ理由で admin に切り替えている）。 */
    .select("id, name, avatar_color, avatar_url, visibility, is_test, is_system, headline, about_me, location, social_links, created_at, updated_at, can_casual_meeting");

  if (error) {
    console.error("[people] ow_users fetch error:", error.message);
    return [];
  }

  type UserRow = {
    id: string; name: string | null; avatar_color: string | null; avatar_url: string | null;
    visibility: string | null; is_test: boolean | null; is_system: boolean | null;
    headline: string | null; about_me: string | null; location: string | null;
    social_links: Record<string, unknown> | null; created_at: string | null;
    updated_at: string | null;
    can_casual_meeting: boolean | null;
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
  const [expRes, eduRes, linkRes, achRes, awdRes, medRes, foreignRes, memberRes, roleTree] = await Promise.all([
    db.from("ow_experiences")
      .select(`user_id, is_current, started_at, ended_at, role_title, role_category_id, visibility_company, ${EXPERIENCE_COMPANY_COLS}`)
      .in("user_id", ids),
    // sort_order 昇順の先頭が最終学歴（/profile/edit の入力順がそうなっている）。
    // graduated_at は欠けている行があるので並べ替えの主キーにしない。
    db.from("ow_user_educations").select("user_id, school, sort_order").in("user_id", ids).order("sort_order"),
    db.from("ow_user_content_links").select("user_id").in("user_id", ids),
    // 「実績・受賞」3点。資格は 2026-08-04 に廃止したのでこの3テーブルだけ見る
    db.from("ow_user_achievements").select("user_id").in("user_id", ids),
    db.from("ow_user_awards").select("user_id").in("user_id", ids),
    db.from("ow_user_media_appearances").select("user_id").in("user_id", ids),
    /* 外資系の企業ID。⚠️ 経歴側の JOIN に列を足すと共有定数
       （EXPERIENCE_COMPANY_COLS）を触ることになるので、ここだけ別に引く。
       企業数は79件（2026-08-14）なので1回引いても軽い。 */
    db.from("ow_companies").select("id").eq("is_foreign", true),
    db.from("ow_company_members")
      .select("user_id, role_title, company_id, ow_companies!company_id(id, name, brand_name, logo_url, logo_gradient, logo_letter, phase)")
      .eq("display_consent", true).eq("is_public", true).in("user_id", ids),
    getRoleTree(),
  ]);

  for (const [label, res] of Object.entries({
    experiences: expRes, educations: eduRes, links: linkRes,
    achievements: achRes, awards: awdRes, media: medRes,
    members: memberRes, foreignCompanies: foreignRes,
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
  const edus    = byUser((eduRes.data ?? []) as { user_id: string; school: string | null }[]);
  const links   = byUser((linkRes.data ?? []) as { user_id: string }[]);
  const achieve = byUser([
    ...((achRes.data ?? []) as { user_id: string }[]),
    ...((awdRes.data ?? []) as { user_id: string }[]),
    ...((medRes.data ?? []) as { user_id: string }[]),
  ]);
  const members = byUser((memberRes.data ?? []) as unknown as MemberRow[]);
  const foreignCompanyIds = new Set(((foreignRes.data ?? []) as { id: string }[]).map((c) => c.id));

  const now = new Date();

  const people = visible.map((u): DirectoryPerson => {
    const myExps    = exps.get(u.id) ?? [];
    /* ⚠️ `visibility_company` は見ない。**社名を出すかどうかと、外資経験があるかは別**。
          伏せている経歴でも「外資経験あり」の絞り込みには入れてよい
          ……ようで実はよくない。伏せた経歴から企業が推測できてしまうため、
          社名を出さない経歴（hidden）は判定から外す。 */
    const hasForeignExperience = myExps.some(
      (e) => e.visibility_company !== "hidden" && e.company_id && foreignCompanyIds.has(e.company_id)
    );
    const myMembers = members.get(u.id) ?? [];

    // ── 所属。企業側の掲載 > 現職 > 直近の退職済み > なし ────────────────
    //    ⚠️ どの経路でも visibility_company を尊重する。hidden の経歴は社名を出さない。
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
      const current = myExps.find((e) => e.is_current);
      const currentLabel = current ? resolveExperienceCompanyLabel(current) : null;
      if (currentLabel) {
        affiliation = { kind: "self", companyName: currentLabel, roleTitle: shortenRoleTitle(current!.role_title) };
      } else {
        // 現職が無い（または hidden）なら直近の退職済みを出す。
        // ended_at の降順。ended_at が無い行は日付で比べられないので候補から外す。
        const past = myExps
          .filter((e) => !e.is_current && e.ended_at)
          .sort((a, b) => (b.ended_at ?? "").localeCompare(a.ended_at ?? ""))
          .find((e) => resolveExperienceCompanyLabel(e));
        const pastLabel = past ? resolveExperienceCompanyLabel(past) : null;
        if (past && pastLabel) {
          const y = Number((past.ended_at ?? "").slice(0, 4));
          affiliation = {
            kind: "past",
            companyName: pastLabel,
            roleTitle: shortenRoleTitle(past.role_title),
            endedYear: Number.isFinite(y) && y > 1900 ? y : null,
          };
        } else {
          // 職歴がまったく無い人。最終学歴で埋める。
          // 「登録ユーザーの一覧」と名乗る以上、登録しただけの人が消えるのは
          // 位置づけと合わない。ただし名前だけのカードも出さない。
          const school = (edus.get(u.id) ?? []).map((e) => e.school?.trim()).find(Boolean);
          if (school) affiliation = { kind: "education", schoolName: school };
        }
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

    // ── 職種。現職 → 無ければ直近の職歴 から role_category_id を引く ──────
    //    ⚠️ カードには「子があれば子」を出す。5名中4名が大分類「営業」で、
    //       大分類だけでは誰が誰だか分からないため。
    //       フィルタ用の topRoleId は逆に大分類（粗いほうが絞り込みには効く）。
    //    現職 → 無ければ直近（ended_at の新しい順）。所属の解決と同じ順序にする。
    const roleSource = myExps.find((e) => e.is_current && e.role_category_id)
      ?? [...myExps]
          .filter((e) => e.role_category_id && e.ended_at)
          .sort((a, b) => (b.ended_at ?? "").localeCompare(a.ended_at ?? ""))[0]
      ?? myExps.find((e) => e.role_category_id);
    const roleNode = roleSource?.role_category_id
      ? roleTree.byId.get(roleSource.role_category_id) ?? null
      : null;
    const topRole = resolveTopRole(roleTree, roleSource?.role_category_id);

    const about = u.about_me?.trim() ?? "";
    const hasAboutMe = about.length > 0;

    const publicScore = calcPublicScore({
      hasName: true,
      hasHeadline: !!u.headline?.trim(),
      hasAboutMe,
      hasLocation: !!u.location?.trim(),
      hasAvatar: !!u.avatar_url,
      experienceCount: myExps.length,
      educationCount: (edus.get(u.id) ?? []).length,
      certOrAchievementCount: (achieve.get(u.id) ?? []).length,
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
      roleName: roleNode?.name ?? null,
      topRoleId: topRole?.id ?? null,
      hasForeignExperience,
      canCasualMeeting: u.can_casual_meeting === true,
      publicScore,
      experienceMonths,
      createdAt: u.created_at,
      updatedAt: u.updated_at,
    };
  });

  // ── 下限: 所属があること ────────────────────────────────────────────────
  //    カードは「直近の所属企業 + 職種」に統一したので、所属が無い人は
  //    名前だけのカードになる。それは出さない。
  //
  //    ⚠️ 経緯: 2026-08-04 の途中まで「スキル3件以上」→「自己紹介」も条件に入れ、
  //       所属の無い人には自己紹介の1行を出していた。
  //       自由記述は人によって品質がばらつくため、カードから外した。
  //       条件も所属だけに揃えている（出す情報と出す条件を一致させる）。
  //       現職が無くても直近の退職済み（kind: "past"）や
  //       最終学歴（kind: "education"）があれば出る。
  const shown = people.filter((p) => p.affiliation.kind !== "none");

  // 既定は完成度の高い順。同点は新しい登録順
  return shown.sort(
    (a, b) => b.publicScore - a.publicScore || (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
  );
}
