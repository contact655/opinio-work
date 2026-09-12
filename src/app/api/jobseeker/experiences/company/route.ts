import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { revalidateCompanyPages } from "@/lib/companies/revalidate";
import { mutateMany } from "@/lib/supabase/mutate";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PATCH /api/jobseeker/experiences/company
 * ── 同じ会社のまとまりの**会社名だけ**をまとめて変える（2026-09-12）。
 *
 * ⚠️★**`ow_experiences` に「会社の行」は無い。** 会社名は職歴1行ごとの列なので、
 *    会社の編集は**そのまとまりのN行の更新**になる。
 *
 * ⚠️★**1文の UPDATE で当てる**（`.in("id", ids)`）。1行ずつ送ると、途中で失敗したときに
 *    **同じ会社のはずの役割が2社に割れる**。ここが「途中で失敗したら全部元に戻す」の実体で、
 *    そもそも部分適用が起きない形にしてある。
 *    ⚠️ **ループに書き換えないこと。** RPC（DB関数）も要らない ——
 *       更新する値が全行で同じなので1文で足りる。
 *
 * ⚠️ 触るのは会社の3列（`company_id` / `company_text` / `company_anonymized`）だけ。
 *    役職・部署・期間・職種などは**送らないし触らない**。
 *
 * ⚠️ `.eq("user_id", owUser.id)` を外さないこと。id を並べただけのリクエストで
 *    他人の職歴を書き換えられる。
 */
export async function PATCH(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const ids = body.experience_ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((v) => typeof v !== "string" || !UUID_RE.test(v))) {
    return NextResponse.json({ error: "INVALID_IDS", message: "対象の職歴が正しくありません。" }, { status: 400 });
  }

  /* ⚠️ 会社は XOR。2つ以上来たら 400（`experience_company_xor` に当たる前に返す）。
        ⚠️ `company_anonymized` は受けない —— 入力経路を 2026-09-12 に削除してある。 */
  const hasId = typeof body.company_id === "string" && body.company_id.length > 0;
  const hasText = typeof body.company_text === "string" && body.company_text.trim().length > 0;
  if (hasId === hasText) {
    return NextResponse.json(
      { error: "INVALID_COMPANY", message: "会社名を1つ指定してください。" },
      { status: 400 },
    );
  }
  if (hasId && !UUID_RE.test(body.company_id as string)) {
    return NextResponse.json({ error: "INVALID_COMPANY", message: "会社の指定が正しくありません。" }, { status: 400 });
  }

  const { data: owUser } = await supabase.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (!owUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  /* ⚠️★**更新前の company_id を控える**（企業ページの社員一覧が変わるため）。
        前の会社と後の会社の**両方**のキャッシュを落とす。 */
  const { data: beforeRows } = await supabase
    .from("ow_experiences")
    .select("company_id")
    .in("id", ids as string[])
    .eq("user_id", owUser.id as string);
  const beforeCompanyIds = Array.from(
    new Set(((beforeRows ?? []) as { company_id: string | null }[]).map((r) => r.company_id).filter((v): v is string => !!v)),
  );

  /* ⚠️ 1文。部分適用が起きない。⚠️ 0行なら他人の id が混ざっている＝エラーにする */
  const r = await mutateMany(
    supabase
      .from("ow_experiences")
      .update({
        company_id: hasId ? (body.company_id as string) : null,
        company_text: hasText ? (body.company_text as string).trim().slice(0, 200) : null,
        company_anonymized: null,
        updated_at: new Date().toISOString(),
      })
      .in("id", ids as string[])
      .eq("user_id", owUser.id as string),
    "experiences company PATCH",
  );
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  const afterCompanyId = hasId ? (body.company_id as string) : null;
  const targets = Array.from(new Set([...beforeCompanyIds, ...(afterCompanyId ? [afterCompanyId] : [])]));
  for (const cid of targets) await revalidateCompanyPages(cid);

  return NextResponse.json({ success: true, updated: r.count });
}

/**
 * DELETE /api/jobseeker/experiences/company
 * ── 同じ会社のまとまりの**役割をすべて**消す（2026-09-12）。
 *
 * ⚠️★**1文で消す**（`.in("id", ids)`）。1行ずつ消すと、途中で失敗したときに
 *    **会社の一部の役割だけが残る**。PATCH と同じ理由。
 * ⚠️ 紐づけた実績・受賞は `ON DELETE SET NULL` で残る（紐づけだけ外れる）。
 *    呼び出し側は手元の state も同じように null へ落とすこと。
 */
export async function DELETE(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const ids = body.experience_ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((v) => typeof v !== "string" || !UUID_RE.test(v))) {
    return NextResponse.json({ error: "INVALID_IDS", message: "対象の職歴が正しくありません。" }, { status: 400 });
  }

  const { data: owUser } = await supabase.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (!owUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  /* ⚠️★**消す前に company_id を控える**。消してから引いても行が無く、
        その企業ページの社員一覧からその人が消えないまま残る（最大300秒）。 */
  const { data: beforeRows } = await supabase
    .from("ow_experiences").select("company_id")
    .in("id", ids as string[]).eq("user_id", owUser.id as string);
  const companyIds = Array.from(new Set(
    ((beforeRows ?? []) as { company_id: string | null }[]).map((r) => r.company_id).filter((v): v is string => !!v),
  ));

  const r = await mutateMany(
    supabase.from("ow_experiences").delete().in("id", ids as string[]).eq("user_id", owUser.id as string),
    "experiences company DELETE",
  );
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  for (const cid of companyIds) await revalidateCompanyPages(cid);
  return NextResponse.json({ success: true, deleted: r.count });
}
