import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { TERMS_TYPES } from "@/lib/constants/terms";

/*
 * 掲載利用規約などへの同意を記録する。
 *
 * ── ⚠️★2026-09-18 に「失敗しても 200」をやめた ────────────────────────────────
 * それまでは insert の `error` を見ず、`catch` も `{ ok: true }` に潰していた:
 *
 *     await admin.from("ow_terms_agreements").insert({ ... });   // error を見ていない
 *     return NextResponse.json({ ok: true });
 *     } catch { return NextResponse.json({ ok: true }); }
 *
 * 実測（2026-09-18）: `termsVersion` を送らずに叩くと **200 `{ok:true}` が返り、
 * 行は1つも入らなかった**（`terms_version` は NOT NULL）。
 * 画面には「同意を記録しました ✓」と出る。**記録が残らないことに誰も気づけない。**
 *
 * ⚠️★**`ok: true` を既定にしないこと。** ここは掲載の前提条件を残す場所で、
 *    「入ったつもり」が一番まずい（CLAUDE.md「0行更新を成功として扱わない」）。
 * ⚠️ 既に入っている行には触らない。
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { companyId?: string; termsType?: string; termsVersion?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON", message: "リクエストの形式が不正です。" }, { status: 400 });
  }

  const { companyId, termsType, termsVersion } = body;

  /* ⚠️ 空を既定値に倒さない。`terms_version` は NOT NULL なので、
        欠けたまま insert すると**黙って0行**になる（それがこの修正の理由）。 */
  if (!termsType || !termsVersion) {
    return NextResponse.json(
      { error: "MISSING_FIELDS", message: "同意の種類と版が必要です。" },
      { status: 400 },
    );
  }
  /* ⚠️ 種類は定数から。知らない値を記録すると `hasAgreedTerms` が拾えず、
        「同意したのに通らない」になる。 */
  const allowed: string[] = [TERMS_TYPES.listing, TERMS_TYPES.placement, TERMS_TYPES.legacy];
  if (!allowed.includes(termsType)) {
    return NextResponse.json(
      { error: "INVALID_TERMS_TYPE", message: "同意の種類が不正です。" },
      { status: 400 },
    );
  }

  /* ⚠️ `user_id` は **auth 空間**（`auth.users.id`）。`ow_users.id` を入れないこと。
        `hasAgreedTerms` も `auth.uid()` 側で引いている（2026-09-18 に実測して確認）。 */
  const { error } = await createAdminClient().from("ow_terms_agreements").insert({
    user_id: user.id,
    company_id: companyId ?? null,
    terms_type: termsType,
    terms_version: termsVersion,
    user_agent: req.headers.get("user-agent") ?? null,
  });

  if (error) {
    console.error("[terms-agreement insert]", error.message);
    return NextResponse.json(
      { error: "SAVE_FAILED", message: "同意を記録できませんでした。時間をおいてもう一度お試しください。" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
