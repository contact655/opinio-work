import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/notify/email";
import { newCompanyAdminTemplate } from "@/lib/notify/templates";
import { resolveOrLinkOwUser } from "@/lib/auth/linkOwUser";
import { deriveCompanySlug, resolveSlugCollision } from "@/lib/companies/slug";

/**
 * POST /api/biz/companies
 *
 * 新規企業を作成し、作成者を最初の admin として登録する。
 * **ow_companies を作るアプリ上の唯一の経路**（/admin に作成機能は無い）。
 *
 * フロー:
 *   1. 認証チェック
 *   2. name 必須チェック
 *   3. 重複の**検出**（normalized_name。一致しても止めない）
 *   4. slug の導出（作れないときは NULL のまま）
 *   5. ow_companies INSERT（source: 'biz_self' / status: 'draft' / 非公開）
 *   6. ow_company_admins INSERT（permission: 'admin'）
 *   7. 運営へ通知（重複の疑いがあればその情報も載せる）
 *   8. biz_current_company_id Cookie をセット
 *
 * ── ⚠️ ロール判定は入れない（2026-08-12 の決定）────────────────────────────
 * ログインしていれば求職者アカウントでも到達できるが、**判別しない**。
 *   ・作成されるのは常に is_published=false / is_approved=false で、
 *     公開は運営の `/admin/companies` を通る。**公開面の実害は無い**
 *   ・`company` ロールが存在しない（ow_user_roles は candidate と admin だけ）ので、
 *     ロールで分岐すると無理な判定を足すことになる
 * 代わりに **source に「どの入口か」を記録**する。入口が違えば source が違う。
 *   biz_self … この API から作られたもの
 *   user     … 経歴入力フローからの作成（**その入口はまだ存在しない**）
 *
 * ── ⚠️ 重複しても作成を止めない（2026-08-12 の決定）────────────────────────
 * 同名の別会社は実在する（美容室・飲食店・地方の中小企業）。
 * 止めると正しい登録まで塞ぐので、**作ったうえで運営に知らせる**。
 * 利用者側には作成前に候補を出す導線が別にある
 * （CreateCompanyClient のサジェスト → 参加リクエスト）。
 *
 * ⚠️ `force_create` は 2026-08-12 に廃止した。「一致しても止めない」なら
 *    バイパス用のフラグに意味が無く、残すと「止まることがある」と誤読される。
 */
export async function POST(req: Request) {
  // 1. 認証チェック
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "ログインが必要です" },
      { status: 401 }
    );
  }

  // 2. リクエストボディ
  let body: {
    name?: string;
    description?: string;
    industry?: string;
    size?: string;
    website?: string;
    logo_url?: string;
    name_en?: string;
    genres?: string[];
    agreedTermsBusiness?: boolean;
    agreedFeePct15?: boolean;
    agreedTermsVersion?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json(
      { error: "会社名は必須です" },
      { status: 400 }
    );
  }
  if (name.length > 200) {
    return NextResponse.json(
      { error: "会社名は200字以内で入力してください" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const websiteUrl =
    typeof body.website === "string" && /^https:\/\//i.test(body.website)
      ? body.website.slice(0, 2048)
      : null;

  /*
    3. 重複の**検出**（作成は止めない）

    ⚠️ 旧実装は `.eq("name", name).maybeSingle()` で、
       ① 完全一致しか見ない（「（株）〜」と「株式会社〜」が別物になる）
       ② **同名が既に2件以上あると .maybeSingle() 自体がエラーになり、
          検査が壊れる**
       の2つの問題があった。正規化での照合に置き換え、**複数件が返る前提**で受ける。

    ⚠️ 正規化のルールは DB の normalize_company_name() 1本だけ。
       TS 側で正規化値を作らず、照合ごと RPC に投げる（往復1回）。
  */
  const { data: dupRows, error: dupError } = await admin.rpc(
    "find_companies_by_normalized_name",
    { p_name: name }
  );
  if (dupError) {
    // ⚠️ 握り潰さない。検出できないまま作ると、重複が誰にも気づかれずに残る
    console.error("[POST /api/biz/companies] 重複検出に失敗:", dupError.message);
  }
  const duplicates = (dupRows ?? []) as {
    id: string; name: string; slug: string | null;
    is_published: boolean; source: string | null;
  }[];

  // 4. slug の導出
  /*
     ⚠️ **作れないときは NULL のままにする。** 日本語社名をローマ字に機械変換しない
        （「株式会社データプール」→ datapool は推測。CLAUDE.md「推測値を投入しない」）。
        slug は部分 UNIQUE（WHERE slug IS NOT NULL）なので NULL は何件でも共存できる。
        必要な企業には運営が昇格時に付ける。
  */
  let slug: string | null = null;
  const slugBase = deriveCompanySlug({ name, nameEn: body.name_en ?? null, url: websiteUrl });
  if (slugBase) {
    // 衝突は実データで判定する。前方一致で候補だけ引く
    const { data: takenRows, error: takenErr } = await admin
      .from("ow_companies")
      .select("slug")
      .like("slug", `${slugBase}%`);
    if (takenErr) {
      // ⚠️ 判定できないまま採番すると UNIQUE 違反で INSERT ごと落ちる。slug を諦める
      console.error("[POST /api/biz/companies] slug 衝突判定に失敗:", takenErr.message);
    } else {
      const taken = new Set((takenRows ?? []).map((r) => r.slug as string).filter(Boolean));
      slug = resolveSlugCollision(slugBase, taken);
    }
  }

  // 5. ow_companies INSERT
  const { data: company, error: companyError } = await admin
    .from("ow_companies")
    .insert({
      name,
      description: body.description || null,
      industry: body.industry || null,
      employee_count: body.size ? parseInt(body.size, 10) : null,
      url: websiteUrl,
      logo_url: (typeof body.logo_url === "string" && /^https:\/\//i.test(body.logo_url)) ? body.logo_url.slice(0, 2048) : null,
      status: "draft",
      is_published: false,
      plan: "free",
      /* ⚠️ 入口を記録する。ロールで判別しない（誰が作ったかではなく、どこから作られたか）。
            この API から作られたものは常に biz_self。 */
      source: "biz_self",
      /* ⚠️ 導出できなければ null のまま入れる。推測で作らない。 */
      slug,
      /* ⚠️ normalized_name は書かない。トリガーが name から必ず計算する。
            そもそも authenticated には UPDATE 権限が無い（docs/ow-companies-grants.md）。 */
    })
    .select("id, name, slug, source, status, created_at, industry, url, logo_url")
    .single();

  if (companyError || !company) {
    console.error("[POST /api/biz/companies] INSERT failed:", companyError?.message);
    return NextResponse.json(
      { error: "企業登録に失敗しました" },
      { status: 500 }
    );
  }

  // 5. ow_company_admins INSERT（作成者を最初の admin として登録）
  // 以前はここで email 一致だけを根拠に auth_id を無条件で補完していたが、
  // それだと他人のメールアドレスで登録した人が既存プロフィールを引き継げてしまう。
  // 共通ヘルパーに寄せ、所有証明（メール確認済み）があるときだけ引き継ぐようにする。
  const resolution = await resolveOrLinkOwUser({
    authId: user.id,
    email: user.email,
    name: user.user_metadata?.name || user.user_metadata?.full_name || null,
    emailVerified: !!user.email_confirmed_at,
  });

  const owUser = resolution.status === "error" || resolution.status === "needs_verification"
    ? null
    : resolution.owUser;

  if (!owUser) {
    console.error(
      "[POST /api/biz/companies] ow_users not resolved for current user:",
      resolution.status === "error" ? resolution.message : resolution.status
    );
    // ow_users が見つからない場合も company は作成済みなのでエラーにしない
  } else {
    const { error: adminError } = await admin
      .from("ow_company_admins")
      .insert({
        user_id: owUser.id,
        company_id: company.id,
        permission: "admin",
        is_active: true,
        ...(body.agreedTermsBusiness != null && {
          agreed_terms_business: body.agreedTermsBusiness,
          agreed_fee_15pct: body.agreedFeePct15 ?? false,
          agreed_terms_version: body.agreedTermsVersion ?? null,
          agreed_at: new Date().toISOString(),
        }),
      });

    if (adminError && adminError.code !== "23505") {
      console.error("[POST /api/biz/companies] ow_company_admins INSERT failed:", adminError.message);
    }
  }

  // 5.5 ow_company_genres INSERT（best-effort）
  // genres が指定されている場合のみ実行。ow_companies INSERT 成功済みなので失敗しても 201 を返す。
  const genreSlugs: string[] = Array.isArray(body.genres) ? body.genres.slice(0, 50) : [];
  if (genreSlugs.length > 0) {
    try {
      // slug → genre_id の解決
      const { data: genreRecords } = await admin
        .from("ow_genres")
        .select("id, slug")
        .in("slug", genreSlugs);

      // 不正な slug の警告ログ
      const resolvedSlugs = new Set((genreRecords ?? []).map((r) => r.slug));
      const missingSlugs = genreSlugs.filter((s) => !resolvedSlugs.has(s));
      if (missingSlugs.length > 0) {
        console.warn(`[biz/companies POST] Invalid genre slugs ignored: ${missingSlugs.join(", ")}`);
      }

      const genreIds = (genreRecords ?? []).map((r) => r.id);
      if (genreIds.length > 0) {
        const { error: genresError } = await admin
          .from("ow_company_genres")
          .insert(
            genreIds.map((genre_id) => ({
              company_id: company.id,
              genre_id,
              is_human_approved: true,
              is_ai_suggested: false,
            }))
          );

        if (genresError) {
          console.error(
            `[biz/companies POST] ow_company_genres INSERT failed for ${company.id}:`,
            genresError.message
          );
        }
      }
    } catch (genreErr) {
      console.error("[biz/companies POST] ow_company_genres sync error:", genreErr);
    }
  }

  // 5.6 運営への新規企業通知（best-effort）
  try {
    await sendEmail(
      newCompanyAdminTemplate({
        companyName: company.name,
        companyId: company.id,
        creatorName: owUser?.name ?? user.email ?? "不明",
        creatorEmail: user.email ?? "",
        createdAt: company.created_at,
        /* ⚠️ 作成は止めていないので、**気づけるのはこの通知だけ**。
              正規化して一致した既存企業をそのまま載せる。 */
        duplicates: duplicates
          .filter((d) => d.id !== company.id)
          .map((d) => ({ id: d.id, name: d.name, isPublished: d.is_published, source: d.source })),
      })
    );
  } catch (err) {
    console.error("[POST /api/biz/companies] admin notify failed:", err);
  }

  // 6. Cookie + Response
  const res = NextResponse.json(
    {
      company: {
        id: company.id,
        name: company.name,
        status: company.status,
        created_at: company.created_at,
        industry: company.industry,
        url: company.url,
        logo_url: company.logo_url,
        /* ⚠️ SELECT しているのに返していなかったので足した（2026-08-12）。
              「slug が付いたか」「どの入口から作られたか」は呼び出し側から見えるべき。
              返していないと、検証時に「キーが無い」を「値が null」と誤読する。 */
        slug: company.slug,
        source: company.source,
      },
      /* 正規化名が一致した既存企業。**作成は止めていない**ので、
         呼び出し側が「もしかして既にある？」を出すために使える。 */
      duplicate_candidates: duplicates
        .filter((d) => d.id !== company.id)
        .map((d) => ({ id: d.id, name: d.name, is_published: d.is_published })),
      redirect_to: `/biz/company?id=${company.id}`,
    },
    { status: 201 }
  );

  res.cookies.set("biz_current_company_id", company.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30日
    secure: process.env.NODE_ENV === "production",
  });

  return res;
}
