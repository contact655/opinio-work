import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { talkableCompanyIds } from "@/lib/companyMembers/talkable";
import { calcPublicScore } from "@/lib/profile/completion";
import { isRegisteredUser } from "@/lib/users/registered";
import {
  resolveExperienceCompanyLabel,
  EXPERIENCE_COMPANY_COLS,
} from "@/lib/experiences/companyName";
import { getRoleTree } from "@/lib/supabase/queries";
import { getUserAge } from "@/lib/age";
import { resolveTopRole, expandWithAncestors } from "@/lib/roles/jobRoles";

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
      /* ⚠️★企業ロゴ（logoUrl / logoGradient / logoLetter）と `phase` は
            2026-09-20 に落とした。カードからロゴを外した（柴さんの指示）ので
            読み手が0になり、人数ぶんクライアントへ運ぶだけになっていたため。
            `phase` はそれ以前から読み手が0件だった。
            **足し戻さないこと** —— ロゴは足すとカードに画像を出す口が復活する。 */
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
   * ★キーワード検索の職種辞書照合に使う。`roleName` と同じ職種を**祖先まで展開**したもの。
   *
   * ⚠️ **求人側の `job.roleIds`（queries.ts の getJobs）と同じ形にしてある。**
   *    辞書（`getRoleAliases()`）は「その語が指す職種そのもの」だけを返し、
   *    祖先方向へは広げない約束なので、**受け側がここで祖先を持っていないと
   *    「営業」で検索してもフィールドセールスの人に当たらない。**
   *    2026-08-26 まで `/people` は辞書を使っておらず、実際に当たっていなかった。
   *
   * ⚠️ **出どころは `roleName` / `topRoleId` と同じ1件（roleSource）**にしてある。
   *    全職歴の職種を混ぜると、カードに出ている職種・職種チップの絞り込みと
   *    検索の対象がずれる（「営業で引いたのに、カードにはコーポレートと出ている」）。
   *    過去の職歴まで対象にしたくなったら、チップ側と一緒に変えること。
   */
  roleIds: string[];
  /**
   * これまでの職歴に**1社でも外資系**（`ow_companies.is_foreign`）があるか。
   * ⚠️ 現職に限らない。過去の在籍も含める（/people の外資系フィルタ用）。
   * ⚠️ マスタと紐づいた経歴（`company_id`）だけが対象。自由入力の社名は
   *    外資かどうかを判定できないので false になる（推測しない）。
   */
  hasForeignExperience: boolean;
  /**
   * ★新卒入社（職歴のいちばん古い行）の業種と、現在（いちばん新しい行）の業種（2026-09-18）。
   *
   * ⚠️ 出どころは `ow_companies.industry_id` → `ow_industries.name`。**事業領域ではなく業種**
   *    （匿名化した職歴の会社ラベルと同じ粒度。粗いほうが勤務先を推測されにくい）。
   * ⚠️ マスタと紐づいた経歴（`company_id`）だけが対象。自由入力の社名は業種が引けないので
   *    `null` になる（推測しない）。`hasForeignExperience` と同じ方針。
   * ⚠️ 社名を出さない経歴（`visibility_company === "hidden"`）は判定から外す。
   * ⚠️★**「不明」「その他」などで埋めないこと。** 引けなければ画面から行ごと落とす。
   */
  firstIndustry: string | null;
  currentIndustry: string | null;
  /**
   * ★これまでに在籍した企業の id（現職・過去の両方）。**「同じ会社にいた人」の突き合わせ用**（2026-09-18）。
   *
   * ⚠️ マスタと紐づいた経歴（`company_id`）だけ。自由入力の社名は入らない
   *    （表記ゆれで別会社を同じ会社と見なしてしまうため。`hasForeignExperience` と同じ方針）。
   * ⚠️ **`visibility_company` で伏せた経歴も入る。** ここは突き合わせにしか使わず、
   *    社名を画面に出さないため。⚠️★**この配列を画面に出さないこと。**
   *    出すと、本人が伏せた勤務先が id 経由で漏れる。
   */
  companyIds: string[];
  /** ★「この会社の話を聞ける人」か（`lib/companyMembers/talkable.ts`）。
   *  ⚠️ 旧 `canCasualMeeting`（`ow_users.can_casual_meeting`）から 2026-08-23 に置き換えた。
   *     **名前ごと変えてある。** 同じ名前で意味だけ変えると、次に読む人が
   *     運営フラグのつもりで参照する。 */
  canTalk: boolean;
  /**
   * ★`canTalk` の人が在籍する企業が、いまカジュアル面談を受け付けているか。
   *
   * ⚠️ **2026-08-23 時点でどこからも使われていない。**
   *    一度はバッジの文言を出し分けるのに使っていた（受付中だけ「面談可」、
   *    それ以外は「話を聞けます」）が、柴さんの判断で**バッジは「面談可」に一本化**した。
   * ⚠️★**2026-09-18 に `/people` の注釈も削除した**（柴さんの指示）ので、
   *    申込可否を伝えているのは**企業ページの申込導線だけ**になった。
   * ⚠️ **これを使ってバッジを出し分ける実装を勝手に戻さないこと。**
   * ⚠️ 追加のクエリは発生していない（既存の JOIN に列を1つ足しただけ）ので、
   *    残しておく費用は無い。
   *
   * ⚠️ **`canTalk` の判定に混ぜないこと。** 人が出るかどうかは本人の同意で決まり、
   *    受付状態は企業の都合で変わる。混ぜると、企業が受付を止めた瞬間に
   *    「本人が同意した事実」まで画面から消える（`lib/companyMembers/talkable.ts` の方針D）。
   * ⚠️ 2026-08-23 実測: バッジが出る4名のうち受付中は1社だけ。
   *    だから全員を「面談可」と書くと 3/4 が誤表示になる。
   */
  acceptingCasualMeetings: boolean;
  /** 公開項目だけの完成度（81点満点）。既定の並び順に使う */
  publicScore: number;
  /** 最初の職歴の開始から現在（または最後の終了）までの月数。職歴が無ければ null */
  experienceMonths: number | null;
  /**
   * ★年代（`20s` 〜 `70s`）。**2026-09-18 に柴さんの判断で年代の絞り込みを入れたため足した。**
   *
   * ⚠️★**`age`（実年齢）は入れないこと。** ここに入るのは**10年刻みの帯だけ**。
   *    絞り込みに要るのは帯までで、実年齢はクライアントへ送る必要がない。
   *    ⚠️ 帯をカードに**表示しない**。使うのは絞り込みだけ（一覧に年齢は出さない）。
   *
   * ⚠️ 経緯（残す）: 2026-08-20 に `age` を型ごと落として「一覧に年齢を出さない・
   *    年齢で絞り込ませない」を型で担保していた。2026-09-18 に**絞り込みだけ**を戻した。
   *    **「型に無ければ書けない」という担保は、表示側については `age` を置かないことで
   *    維持している。**
   *
   * ⚠️ 生年月日が無い人は `null`。**推測で埋めないこと。**
   *    `null` の人は「年代で絞り込んだときだけ」落ちる（他の条件では落とさない）。
   *    実測（2026-09-18 / 本番）: 実ユーザー7人中 **3人**しか生年月日を持っていない。
   */
  ageBand: string | null;
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
    /** バッジの文言の出し分けにだけ使う。**`canTalk` の判定には混ぜない**（下記） */
    accepting_casual_meetings: boolean | null;
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
 * ⚠️ **鮮度は30分。5分では効かない**（2026-08-20 実測）。
 *    このページは訪問がまばらなので、**5分だと次の人が来る頃には期限切れ**になり、
 *    結局その人がDBを引き直すことになる（本番で導入直後の初回が 6.24秒だった）。
 *    ねらいは「冷えたサーバーがDBに触らずに済むこと」なので、
 *    **期限は訪問の間隔より長くないと意味がない。**
 *    登録は週に数人なので、30分古い一覧で困る場面が無い。
 * ⚠️ 求人一覧（`getJobs`）が 300 秒なのは、公開/非公開の反映を早くしたいため。
 *    **同じ値に揃える必要はない。** 何が古くなるかで決める。
 * ⚠️ 早く反映したくなったら期限を縮めるのではなく、
 *    `revalidateTag("directory-people")` を登録・プロフィール更新の経路から呼ぶこと。
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
  { revalidate: 1800, tags: ["directory-people"] }
);

async function fetchDirectoryPeople(isLoggedIn: boolean): Promise<DirectoryPerson[]> {
  const db = createAdminClient();

  const { data: userRows, error } = await db
    .from("ow_users")
    /* ★`birth_date` は 2026-09-18 に取り直した（年代の絞り込みのため）。
       ⚠️★**この値をそのまま返さないこと。** 下で10年刻みの `ageBand` に畳んでから返す。
          クライアントへ実年齢や生年月日を送る必要はない。
       ⚠️ `authenticated` には SELECT を配っていない列なので、セッションクライアントだと
          クエリごと 403 になる。ここは createAdminClient なので取れる。 */
    .select("id, auth_id, name, avatar_color, avatar_url, visibility, is_test, is_system, headline, about_me, location, social_links, birth_date, created_at, updated_at");

  if (error) {
    console.error("[people] ow_users fetch error:", error.message);
    return [];
  }

  type UserRow = {
    id: string; name: string | null; avatar_color: string | null; avatar_url: string | null;
    auth_id: string | null;
    visibility: string | null; is_test: boolean | null; is_system: boolean | null;
    headline: string | null; about_me: string | null; location: string | null;
    social_links: Record<string, unknown> | null; created_at: string | null;
    updated_at: string | null;
    /* ⚠️★**この値を DirectoryPerson に載せないこと。** 10年刻みの `ageBand` に畳んで返す */
    birth_date: string | null;
  };

  const visible = ((userRows ?? []) as UserRow[]).filter((u) => {
    if (!u.name) return false;
    if (u.is_test || u.is_system) return false;
    /* ★本人が登録していない行（auth_id IS NULL）は出さない。理由は
       `lib/users/registered.ts`。⚠️ `auth_id` を select に含めること。 */
    if (!isRegisteredUser(u)) return false;
    if (u.visibility === "private") return false;
    if (u.visibility === "login_only" && !isLoggedIn) return false;
    return true;
  });

  if (visible.length === 0) return [];
  const ids = visible.map((u) => u.id);

  // 完成度と所属の材料をまとめて引く。
  // ⚠️ 希望条件（ow_profiles）は引かない。公開されない情報を並び順に混ぜないため
  //    （src/lib/profile/completion.ts の PUBLIC_KEYS を参照）。
  const [expRes, eduRes, linkRes, achRes, awdRes, medRes, foreignRes, industryRes, memberRes, roleTree] = await Promise.all([
    /* ⚠️★**並び順を指定すること**（2026-09-18）。下の `myExps.find((e) => e.is_current)`
          （所属）と `find((e) => e.is_current && e.role_category_id)`（職種）は
          **配列の先頭の現職**を採るので、順序を空けると**並行在籍の人のカードが
          リロードのたびに別の会社・別の職種になりうる。**
       ⚠️ 過去の職歴側は元から `ended_at` で明示的に並べ替えている。
          **現職側だけが空いていた。**
       ⚠️★**`id` のタイブレーカーを外さないこと**（同着は実在する）。
          `sidebarData.ts` と**同じ並び**にしてある。片方だけ変えない。 */
    db.from("ow_experiences")
      .select(`user_id, is_current, started_at, ended_at, role_title, role_category_id, visibility_company, ${EXPERIENCE_COMPANY_COLS}`)
      .in("user_id", ids)
      .order("started_at", { ascending: false })
      .order("id", { ascending: true }),
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
    /* ★会社 → 業種。⚠️ 外資系と同じ理由で**ここだけ別に引く**
          （経歴側の JOIN に足すと共有定数 EXPERIENCE_COMPANY_COLS を触ることになる）。
       ⚠️ `ow_industries` への FK は1本なので埋め込んでよい
          （複合FKの `ow_company_target_industries` とは違う）。
       ⚠️ 企業数は105件（2026-09-18）なので1回引いても軽い。 */
    db.from("ow_companies").select("id, ow_industries!industry_id(name)"),
    db.from("ow_company_members")
      .select("user_id, role_title, company_id, ow_companies!company_id(id, name, brand_name, accepting_casual_meetings)")
      .eq("display_consent", true).eq("is_public", true).in("user_id", ids),
    getRoleTree(),
  ]);

  for (const [label, res] of Object.entries({
    experiences: expRes, educations: eduRes, links: linkRes,
    achievements: achRes, awards: awdRes, media: medRes,
    members: memberRes, foreignCompanies: foreignRes, companyIndustries: industryRes,
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

  /* ⚠️★`error` を捨てない（2026-09-12）。ここが落ちると所属が付かず、
        `affiliation.kind === "none"` の人が一覧から**丸ごと消える**
        （実際に PGRST201 で実ユーザー3人が消えた）。 */
  if (expRes.error) console.error("[people/directory] ow_experiences:", expRes.error.message);
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

  /* ★会社 → 業種名。業種が未設定の企業は入れない（下で null になり、行ごと出なくなる）。 */
  const industryByCompany = new Map<string, string>();
  /* ⚠️ supabase-js は埋め込みを配列型として推論するが、単純FKなので**実体はオブジェクト**
        （2026-09-18 に実データで確認）。両方受けられる形にしてある。 */
  type IndustryRow = { id: string; ow_industries: { name: string | null } | { name: string | null }[] | null };
  for (const row of (industryRes.data ?? []) as unknown as IndustryRow[]) {
    const embedded = Array.isArray(row.ow_industries) ? row.ow_industries[0] : row.ow_industries;
    const name = embedded?.name?.trim();
    if (name) industryByCompany.set(row.id, name);
  }

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
    /* ── ★新卒入社の業種 → 現在の業種（2026-09-18）─────────────────────────
          `myExps` は `started_at DESC, id ASC` で並んでいるので、
          **先頭がいちばん新しい職歴・末尾がいちばん古い職歴**。
          ⚠️★**並び順に依存している。** 上の `.order()` を外さないこと。
          ⚠️ 業種を引けない経歴（自由入力の会社・業種未設定の企業）と、
             社名を出さない経歴（hidden）は候補から外す。**推測で埋めない。** */
    const industryPath = myExps
      .filter((e) => e.visibility_company !== "hidden" && e.company_id)
      .map((e) => industryByCompany.get(e.company_id!))
      .filter((n): n is string => Boolean(n));
    const currentIndustry = industryPath[0] ?? null;
    const firstIndustry   = industryPath[industryPath.length - 1] ?? null;

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

    /* ★「話を聞ける会社」の id。バッジの有無（canTalk）と文言（受付中か）の
          両方がここから決まるので、1回だけ計算して使い回す。
       ⚠️ 判定は `lib/companyMembers/talkable.ts`。ここに書き直さないこと。
       ⚠️ 企業の受付状態は **talkableCompanyIds の中に入れない**（方針D）。
          受付は下の acceptingCasualMeetings で別に見る。 */
    const talkableIds = talkableCompanyIds(
      (members.get(u.id) ?? []).map((m) => m.company_id),
      (exps.get(u.id) ?? []).flatMap((e) => (e.is_current && e.company_id ? [e.company_id] : [])),
    );

    return {
      userId: u.id,
      name: u.name!,
      initial: u.name!.charAt(0),
      gradient: u.avatar_color?.startsWith("linear-gradient") ? u.avatar_color : FALLBACK_GRADIENT,
      avatarUrl: u.avatar_url,
      affiliation,
      roleName: roleNode?.name ?? null,
      topRoleId: topRole?.id ?? null,
      /* 職種辞書の照合用。⚠️ 祖先まで展開する（型のコメント参照） */
      roleIds: expandWithAncestors(roleTree, roleSource?.role_category_id ? [roleSource.role_category_id] : []),
      hasForeignExperience,
      /* ★新卒入社の業種 → 現在の業種。⚠️ 引けなければ null（型のコメント参照） */
      firstIndustry,
      currentIndustry,
      /* ★在籍した企業の id（「同じ会社にいた人」用）。⚠️ 画面に出さない（型のコメント参照） */
      companyIds: Array.from(new Set(myExps.flatMap((e) => (e.company_id ? [e.company_id] : [])))),
      /* ★「話を聞ける人」の判定（2026-08-23 / B-1）。
            ⚠️ 判定は `lib/companyMembers/talkable.ts` に置いてある。ここに書き直さないこと。
            ⚠️ 企業の受付状態は見ない（方針D）。人の表示は本人の同意で決まる。 */
      canTalk: talkableIds.length > 0,
      /* ★バッジの文言用。**判定そのものは上の canTalk と別建てにしてある**（型のコメント参照） */
      acceptingCasualMeetings: (members.get(u.id) ?? []).some(
        (m) => talkableIds.includes(m.company_id) && m.ow_companies?.accepting_casual_meetings === true,
      ),
      publicScore,
      /* ★年代だけに畳む。⚠️ 実年齢を返さないこと（型のコメント参照）。
            判定は `lib/age.ts` の `getUserAge()` に一本化してある（2つ目の計算を作らない）。 */
      ageBand: (() => {
        const age = getUserAge(u.birth_date as string | null);
        if (age == null) return null;
        /* ⚠️ 20歳未満と80歳以上は帯を持たせない（選択肢に無いので絞り込みの対象外）。
              ここで 20s / 70s に丸めると、実データと違う帯に入れることになる。 */
        if (age < 20 || age >= 80) return null;
        return `${Math.floor(age / 10) * 10}s`;
      })(),
      experienceMonths,
      createdAt: u.created_at,
      updatedAt: u.updated_at,
    };
  });

  /* ── ★下限は無くした（2026-09-18 / 柴さんの指示）────────────────────────────
     それまでは `affiliation.kind !== "none"`（所属があること）で絞っており、
     **職歴も学歴も持たない人が一覧から丸ごと消えていた。**
     実測（2026-09-18 / 本番）: 対象7人のうち **2人**がこれで落ちていた。

     ⚠️★**この filter を書き戻さないこと。** 登録しただけの人が
        「自分が一覧に居ない」状態になるのを避けるのが目的。

     ⚠️ 経緯（残す）: 2026-08-04 の途中まで「スキル3件以上」→「自己紹介」も条件に入れ、
        所属の無い人には自己紹介の1行を出していた。自由記述は品質がばらつくため
        カードから外し、条件も所属だけに揃えた——という順で今の形になっていた。
        **自己紹介をカードに戻したわけではない。** 所属が無いカードは
        名前と職種だけになり、高さは CSS 側（`.ppl-grid-card`）で揃える。
        ⚠️ **空欄を「未登録」等の文字で埋めないこと**（データ表示の原則）。 */

  // 既定は完成度の高い順。同点は新しい登録順
  return people.sort(
    (a, b) => b.publicScore - a.publicScore || (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
  );
}
