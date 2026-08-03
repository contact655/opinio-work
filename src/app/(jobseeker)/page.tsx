import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import LandingPage, { type LPMember } from "./LandingPage";
import { DB_BAND_LABELS, LP_GUEST_BAND, type LPBandMember } from "./lpGuestMembers";

export const metadata: Metadata = {
  title: "OPINIO — IT/SaaS業界特化のキャリアプラットフォーム",
  description:
    "取材された企業情報と求人を、ひとつの場所に。スカウトも営業電話もなく、自分のペースでIT/SaaS企業のリアルを調べられます。",
  openGraph: {
    title: "OPINIO — 知ってから、動く。",
    description:
      "IT/SaaS業界に特化したキャリアプラットフォーム。取材された企業情報と求人票で、追われずに転職を考えられます。",
    url: "https://opinio.jp",
    siteName: "OPINIO",
    locale: "ja_JP",
    type: "website",
  },
  alternates: { canonical: "https://opinio.jp" },
};

// このページはメンバー情報を Supabase から取る。fetch ではなく supabase-js 経由なので
// Next は動的だと判断できず、指定が無いと静的レンダリング結果が固定される
// （= コードを変えるまで DB の更新が LP に反映されない）。
// マーケティングページなので force-dynamic ではなく ISR にして、
// 表示速度を保ちつつ最大5分で追従させる。
export const revalidate = 300;

type MemberRow = {
  role_title: string | null;
  talk_themes: string[] | null;
  ow_users: { id: string; name: string; avatar_color: string | null; visibility: string | null; is_test: boolean | null; can_casual_meeting: boolean | null } | null;
  ow_companies: { name: string; brand_name: string | null } | null;
};

/**
 * FV「いま話を聞ける現役社員」の顔写真（public/images/people/ の透過PNG）。
 * キーは ow_users.id。ここに無いユーザーはイニシャル表示にフォールバックする。
 */
const MEMBER_PHOTOS: Record<string, string> = {
  // 生藤 弘樹（セールスフォース・ジャパン）
  "0c99e403-7540-4cf9-8bb1-67571af4f2b6": "/images/people/shodo.png",
  // 木村 雅樹（伊藤忠テクノソリューションズ）
  "b51fc35e-776a-425e-876f-dcb2005c4389": "/images/people/kimura.png",
};

type ExpRow = {
  user_id: string;
  company_id: string | null;
  company_text: string | null;
  started_at: string | null;
  is_current: boolean | null;
  visibility_company: string | null;
};

export default async function HomePage() {
  const adminSupabase = createAdminClient();

  const { data: raw } = await adminSupabase
    .from("ow_company_members")
    .select(`
      role_title,
      talk_themes,
      ow_users!user_id(id, name, avatar_color, visibility, is_test, can_casual_meeting),
      ow_companies!company_id(name, brand_name)
    `)
    .eq("display_consent", true)
    .eq("is_public", true)
    .limit(24);

  // 掲載同意済みで表に出してよい人。面談可否はここでは問わない。
  const listed = (raw ?? [])
    .map((r) => r as unknown as MemberRow)
    .filter((r) => {
      const u = r.ow_users;
      if (!u) return false;
      if (u.is_test === true) return false;
      if (u.visibility === "private") return false;
      return true;
    });

  // Fetch career history for each member
  // company_text だけでなく company_id も取る。マスタ企業に紐づく職歴は company_text が
  // NULL のため、company_text だけを見ると経歴の大半が欠落する。
  const userIds = listed.map((r) => r.ow_users!.id);
  const expByUser: Record<string, string[]> = {};
  const expRowsByUser: Record<string, ExpRow[]> = {};

  if (userIds.length > 0) {
    const { data: exps, error: expError } = await adminSupabase
      .from("ow_experiences")
      .select("user_id, company_id, company_text, started_at, is_current, visibility_company")
      .in("user_id", userIds)
      .order("started_at", { ascending: true, nullsFirst: false });

    if (expError) {
      console.error("[HomePage] ow_experiences fetch failed:", expError.message);
    }

    for (const e of (exps ?? []) as ExpRow[]) {
      if (!e.user_id) continue;
      (expRowsByUser[e.user_id] ??= []).push(e);
      // FVカードの経歴チップは自由入力の社名のみ（従来どおり）
      if (e.company_text) (expByUser[e.user_id] ??= []).push(e.company_text);
    }
  }

  /**
   * 人物帯用に、ある人の「中間の会社数」と「起点・現職の公開可否」を求める。
   * 同じ会社での役割変更が別行になっているため、行数ではなく会社の distinct 数で数える
   * （木村さんは4行あるが会社は3社で、中間は1社）。
   */
  const analyzeCareer = (rows: ExpRow[]) => {
    const keys: string[] = [];
    for (const r of rows) {
      const key = r.company_id ?? r.company_text;
      if (!key) continue;
      if (keys[keys.length - 1] !== key) keys.push(key); // 連続する同一社をまとめる
    }
    const distinct = Array.from(new Set(keys));
    const first = rows.find((r) => (r.company_id ?? r.company_text) === keys[0]);
    const current = rows.find((r) => r.is_current === true) ?? rows[rows.length - 1];
    return {
      viaCount: Math.max(0, distinct.length - 2),
      // 起点と現職のどちらかが実名公開でなければ帯には出さない。
      // 人物帯は経歴を見せる枠なので、経歴側の同意（visibility_company）が効く。
      canShowRealNames:
        first?.visibility_company === "real" && current?.visibility_company === "real",
    };
  };

  const toLPMember = (r: MemberRow): LPMember => {
    const u = r.ow_users!;
    const co = r.ow_companies;
    const flow = expByUser[u.id] ?? null;
    return {
      id: u.id,
      name: u.name,
      avatarColor: u.avatar_color,
      photoUrl: MEMBER_PHOTOS[u.id] ?? null,
      roleTitle: r.role_title,
      companyName: co?.brand_name ?? co?.name ?? null,
      careerFlow: flow && flow.length > 1 ? flow : null,
      quote: r.talk_themes?.[0] ?? null,
    };
  };

  // ow_company_members に表示順カラムが無く、ORDER BY なしの並びは不定。
  // 4枠に絞る前に、顔写真のあるメンバーを優先して決定的に並べる。
  const photoFirst = (a: LPMember, b: LPMember) => {
    const rank = (m: LPMember) => (m.photoUrl ? 0 : 1);
    return rank(a) - rank(b) || a.name.localeCompare(b.name, "ja");
  };

  // FV カード: can_casual_meeting = true の人だけ（掲載 ≠ 面談可）。
  // /u/[id] のカジュアル面談CTAと同じ条件に揃えている。
  const members = listed
    .filter((r) => r.ow_users!.can_casual_meeting === true)
    .map(toLPMember)
    .sort(photoFirst)
    .slice(0, 4);

  // ヒーロー直下の人物帯「その転職を、すでにした人」。
  // 表示文字列は DB_BAND_LABELS / LP_GUEST_BAND が持ち、
  // 中間社数と公開可否は DB のある人だけ ow_experiences から算出・検証する。
  const dbBand: LPBandMember[] = listed.flatMap((r) => {
    const u = r.ow_users!;
    const label = DB_BAND_LABELS[u.id];
    if (!label) return []; // 帯に出すラベルが未定義の人は出さない

    const { viaCount, canShowRealNames } = analyzeCareer(expRowsByUser[u.id] ?? []);
    if (!canShowRealNames) {
      // 本人が経歴上「社名を伏せる」を選んでいる。企業側の掲載要望より本人の希望を優先する。
      console.info("[HomePage] 人物帯から除外（visibility_company が real でない）:", u.name);
      return [];
    }

    return [{
      id: u.id,
      name: u.name,
      photoUrl: MEMBER_PHOTOS[u.id] ?? null,
      fromCompany: label.fromCompany,
      toCompany: label.toCompany,
      viaCount,
      quote: r.talk_themes?.[0] ?? null,
    }];
  });

  const bandMembers: LPBandMember[] = [...dbBand, ...LP_GUEST_BAND]
    .sort((a, b) => a.name.localeCompare(b.name, "ja"))
    .slice(0, 4);

  // 枠に出ている全員が面談可なので、そのまま人数になる。
  return (
    <LandingPage members={members} bookableCount={members.length} bandMembers={bandMembers} />
  );
}
