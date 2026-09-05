import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/notify/email";
import { newCompanyAdminTemplate } from "@/lib/notify/templates";
import { resolveOrLinkOwUser } from "@/lib/auth/linkOwUser";
import { deriveBrandName } from "@/lib/companies/displayName";
import { deriveCompanySlug, resolveSlugCollision } from "@/lib/companies/slug";

/**
 * POST /api/jobseeker/companies
 *
 * **経歴入力からマスタに無い会社を作る。** 求職者が自分の勤務先を登録するための入口。
 *
 * ── ⚠️★なぜ `POST /api/biz/companies` を使い回さないのか（2026-09-05）───────────
 * あちらは企業を作るだけでなく、**呼んだ人をその企業の担当者にする**:
 *   ① `ow_company_admins` に `permission='admin' / is_active=true` を INSERT
 *   ② `ow_company_plans` に free を1本 INSERT
 *   ③ `biz_current_company_id` Cookie をセット
 * ①が入ると `getCompanyContext` が非 null を返すので、**元勤務先を登録した求職者に
 * /biz のサイドバーが出て、その会社の情報を編集でき、応募・面談の通知の宛先にもなる。**
 *
 * `/api/biz/*` は「企業担当者の空間」。そこに「担当者にならない呼び方」を足すと
 * 入口ごとの分岐が増えるので、**別のエンドポイントにした**
 * （`/api/companies/lookup` を `/api/companies/search` と別口にしたのと同じ判断）。
 *
 * ⚠️★**このルートは `ow_company_admins` / `ow_company_plans` / Cookie を一切触らない。**
 *    触るコードを足さないこと。足した瞬間に上の問題が戻る。
 *
 * ── 何を作るか ────────────────────────────────────────────────────────────
 * 必須は **会社名と業種の2つだけ**。それ以外（URL・従業員数・所在地）は取らない。
 * ⚠️ 項目を増やさないこと。ここは職歴を書いている途中に挟まる画面で、
 *    増やすと入力が止まる。**残りは運営が後から埋める前提**（docs に明記）。
 *
 * 作られる企業は常に:
 *   `status='draft'` / `is_published=false` / `listing_status='draft'`
 *   / `is_approved=false`（DB既定）/ `source='user'`
 * ⚠️ **求職者側からは見えない**（`filterListedCompanies` が
 *    `is_published AND listing_status='listed'` の両方を要求する）。
 *
 * ── 重複 ──────────────────────────────────────────────────────────────────
 * ⚠️ **一致しても作成を止めない**（`/api/biz/companies` と同じ判断）。
 *    同名の別会社は実在する。止めると正しい登録まで塞ぐ。
 *    利用者には**作る前に**候補を出す（画面側）。気づく経路は運営通知。
 */

/** ⚠️ 返す候補の上限。`/api/companies/lookup` と同じ考え方で絞る */
const MAX_DUPLICATE_CANDIDATES = 5;

/**
 * GET /api/jobseeker/companies?name=... — **作る前の重複照会。**
 *
 * ⚠️★`/api/companies/lookup` では代われない。あちらは名前の**部分一致**（ILIKE）で、
 *    「（株）鹿島建設」と打った人に「鹿島建設」を出せない。
 *    ここは DB の `normalize_company_name()` を通すので、法人格の表記ゆれを吸収する。
 *
 * ⚠️ 返すのは **id / name / isListed** ＋ **matchedOn**（なぜ候補に出たか）。
 * ⚠️ それ以外は返さない（lookup と同じ条件）。`matchedOn` は列名そのものなので、**画面では文言に畳む**。
 * ⚠️ 非公開の企業も候補に出す。**出さないと、同じ会社をもう一度作らせることになる。**
 */
export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const name = (new URL(req.url).searchParams.get("name") ?? "").trim();
  if (name.length < 2) {
    // ⚠️ 短すぎるときは空で返す。エラーにしない（入力中に赤が出るのは邪魔）
    return NextResponse.json({ candidates: [] });
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin.rpc("find_companies_by_normalized_name", { p_name: name });
  if (error) {
    // ⚠️ 握りつぶさない。空配列で返すと「該当なし」と区別が付かない
    console.error("[GET /api/jobseeker/companies] 重複照会に失敗:", error.message);
    return NextResponse.json({ error: "照会に失敗しました" }, { status: 500 });
  }

  const hits = ((rows ?? []) as { id: string; name: string; matched_on: string | null }[])
    .slice(0, MAX_DUPLICATE_CANDIDATES);
  if (hits.length === 0) return NextResponse.json({ candidates: [] });

  /* ⚠️ RPC は `listing_status` を返さないので、掲載中かどうかはここで引き直す。
        `is_published` だけでは `isListed` にならない（`filterListedCompanies` は
        `is_published AND listing_status='listed'` の**両方**を要求する）。
     ⚠️ 検証用企業は候補に出さない。 */
  const { data: meta, error: metaErr } = await admin
    .from("ow_companies")
    .select("id, is_published, listing_status, is_test")
    .in("id", hits.map((h) => h.id));
  if (metaErr) {
    console.error("[GET /api/jobseeker/companies] 掲載状態の取得に失敗:", metaErr.message);
    return NextResponse.json({ error: "照会に失敗しました" }, { status: 500 });
  }
  const byId = new Map((meta ?? []).map((m) => [m.id as string, m]));

  return NextResponse.json({
    candidates: hits
      .filter((h) => byId.get(h.id)?.is_test !== true)
      .map((h) => {
        const m = byId.get(h.id);
        return {
          id: h.id,
          name: h.name,
          isListed: m?.is_published === true && m?.listing_status === "listed",
          /* ★なぜ候補に出たか。⚠️ 実装語をそのまま返すが、**画面では文言に畳んでから出す**
                （`companyMatchLabelForUser`）。ここで日本語にしないのは、
                運営向けと利用者向けで言い方が違うため。 */
          matchedOn: h.matched_on,
        };
      }),
  });
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  let body: { name?: string; industry_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "会社名を入力してください" }, { status: 400 });
  }
  if (name.length > 200) {
    return NextResponse.json({ error: "会社名は200字以内で入力してください" }, { status: 400 });
  }

  const admin = createAdminClient();

  /* ── 業種 ────────────────────────────────────────────────────────────────
     ⚠️★**この入口では必須にする。** `/api/biz/companies` は任意（公開時に
        `checkPublishable` が要求する）だが、こちらは**業界マッチのために作る**
        入口なので、業種が無いと作る意味がない（`ow_industries` を介して
        対象業界と突き合わせるのが目的）。
     ⚠️ 値がマスタに実在することを確かめる。黙って null に落とさず 400 で返す。 */
  const rawIndustryId = (body.industry_id ?? "").trim();
  if (!rawIndustryId) {
    return NextResponse.json(
      { error: "INDUSTRY_REQUIRED", message: "業種を選んでください。" },
      { status: 400 },
    );
  }
  const { data: industryRow, error: industryErr } = await admin
    .from("ow_industries")
    .select("id")
    .eq("id", rawIndustryId)
    .eq("is_active", true)
    .maybeSingle();
  if (industryErr) {
    // ⚠️ 握りつぶさない。捨てると「マスタに無い」と区別が付かなくなる
    console.error("[POST /api/jobseeker/companies] ow_industries:", industryErr.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!industryRow) {
    return NextResponse.json(
      { error: "INVALID_INDUSTRY", message: "選択された業種は業種マスタにありません。画面を再読み込みしてください。" },
      { status: 400 },
    );
  }

  /* ── 重複の**検出**（止めない）──────────────────────────────────────────
     ⚠️ 正規化のルールは DB の `normalize_company_name()` 1本だけ。
        TS 側で正規化値を作らず、照合ごと RPC に投げる。 */
  const { data: dupRows, error: dupError } = await admin.rpc(
    "find_companies_by_normalized_name",
    { p_name: name },
  );
  if (dupError) {
    // ⚠️ 握り潰さない。検出できないまま作ると、重複が誰にも気づかれずに残る
    console.error("[POST /api/jobseeker/companies] 重複検出に失敗:", dupError.message);
  }
  const duplicates = (dupRows ?? []) as {
    id: string; name: string; slug: string | null;
    is_published: boolean; source: string | null;
    /** ★どの列で一致したか（2026-09-05）。運営が「なぜ候補に出たか」を判断するために要る */
    matched_on: string | null;
  }[];

  /* ── slug ────────────────────────────────────────────────────────────────
     ⚠️ 作れないときは NULL のまま。日本語社名をローマ字に機械変換しない
        （CLAUDE.md「推測値を投入しない」）。必要な企業には運営が昇格時に付ける。 */
  let slug: string | null = null;
  const slugBase = deriveCompanySlug({ name, nameEn: null, url: null });
  if (slugBase) {
    const { data: takenRows, error: takenErr } = await admin
      .from("ow_companies")
      .select("slug")
      .like("slug", `${slugBase}%`);
    if (takenErr) {
      // ⚠️ 判定できないまま採番すると UNIQUE 違反で INSERT ごと落ちる。slug を諦める
      console.error("[POST /api/jobseeker/companies] slug 衝突判定に失敗:", takenErr.message);
    } else {
      const taken = new Set((takenRows ?? []).map((r) => r.slug as string).filter(Boolean));
      slug = resolveSlugCollision(slugBase, taken);
    }
  }

  const { data: company, error: companyError } = await admin
    .from("ow_companies")
    .insert({
      name,
      /* ブランド名の既定値。⚠️ 機械的に法人格を落とすだけなので、例外は運営が直す */
      brand_name: deriveBrandName(name),
      industry_id: rawIndustryId,
      /* ⚠️ `industry`(text) は書かない（2026-08-25 に書き込み経路を閉じた廃止列）。 */
      status: "draft",
      is_published: false,
      /* ⚠️ **明示的に 'draft'。DB既定は 'listed' だが、それに任せない。**
            既定のままだと、運営が is_published を立てた瞬間にディレクトリへ直行する。 */
      listing_status: "draft",
      /* ★入口を記録する。ロールで判別しない（誰が作ったかではなく、どこから作られたか）。 */
      source: "user",
      slug,
      /* ⚠️ normalized_name は書かない。トリガーが name から必ず計算する。 */
    })
    .select("id, name, slug, source, created_at")
    .single();

  if (companyError || !company) {
    console.error("[POST /api/jobseeker/companies] INSERT failed:", companyError?.message);
    return NextResponse.json({ error: "企業の登録に失敗しました" }, { status: 500 });
  }

  /* ── 運営への通知（best-effort）────────────────────────────────────────
     ⚠️ 作成を止めていないので、**重複に気づける経路はこの通知だけ**。 */
  const resolution = await resolveOrLinkOwUser({
    authId: user.id,
    email: user.email,
    name: user.user_metadata?.name || user.user_metadata?.full_name || null,
    emailVerified: !!user.email_confirmed_at,
  });
  const owUser =
    resolution.status === "error" || resolution.status === "needs_verification"
      ? null
      : resolution.owUser;

  try {
    await sendEmail(
      newCompanyAdminTemplate({
        companyName: company.name,
        companyId: company.id,
        creatorName: owUser?.name ?? user.email ?? "不明",
        creatorEmail: user.email ?? "",
        createdAt: company.created_at,
        duplicates: duplicates
          .filter((d) => d.id !== company.id)
          .map((d) => ({
            id: d.id, name: d.name, isPublished: d.is_published, source: d.source,
            /* ★どの列で一致したか。「ANDPAD」で「株式会社アンドパッド」が出ても
                  名前は似ていないので、理由が無いと運営が判断できない */
            matchedOn: d.matched_on,
          })),
      }),
    );
  } catch (err) {
    console.error("[POST /api/jobseeker/companies] admin notify failed:", err);
  }

  /* ⚠️★返すのは `/api/companies/lookup` と同じ3つだけ（id / name / isListed）。
        作った直後の企業は必ず未掲載なので `isListed` は false。
        ⚠️ Cookie は付けない（このルートは企業担当者を作らない）。 */
  return NextResponse.json(
    {
      company: { id: company.id, name: company.name, isListed: false },
      /* 正規化名が一致した既存企業。呼び出し側が「もしかして既にある？」に使う。
         ⚠️ ここでも列を絞る。掲載していない企業の情報を渡さない。 */
      duplicate_candidates: duplicates
        .filter((d) => d.id !== company.id)
        .slice(0, MAX_DUPLICATE_CANDIDATES)
        .map((d) => ({ id: d.id, name: d.name, matchedOn: d.matched_on })),
    },
    { status: 201 },
  );
}
