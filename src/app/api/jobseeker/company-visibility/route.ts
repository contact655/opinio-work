import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateMany } from "@/lib/supabase/mutate";
import { COMPANY_VISIBILITY_VALUES } from "@/lib/constants/companyVisibility";

/**
 * ★会社名の公開範囲を**職歴全体**にまとめて設定する（2026-09-11）。
 *
 * ── ★なぜ「職歴1件ずつ」ではないか ────────────────────────────────────────
 * `CareerHistoryEditor.tsx` に 2026-08-16 の注記がそのまま残っている:
 *   > 掲載可否を本人が選べる形に戻すときは、ここに戻すのではなく
 *   > 「職歴全体をどう見せるか」の1設定として設定タブに置くこと
 *   > （**1件ずつ選ばせると、選び忘れが同意なき公開になる**）。
 * ⚠️★**1件ずつの入力欄を復活させないこと。**
 *
 * ── ⚠️★新しい職歴に引き継がれること ──────────────────────────────────────
 * 値は `ow_experiences` の各行が持つ（読み手6面がその列を見るため）。
 * したがって**後から足した職歴が既定の `real` に戻る**穴があるので、
 * `POST /api/jobseeker/experiences` が**既存の行から引き継ぐ**ようにしてある。
 * ⚠️ 片方だけ直すと、伏せている人が職歴を1件足した瞬間に**その1件だけ実名で出る。**
 *
 * ⚠️ 別テーブルに「利用者ごとの既定値」を持たせる案は採らなかった。
 *    読み手が見るのは行の値なので、**正が2つになる。**
 */
export async function PUT(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: owUser, error: owErr } = await admin
    .from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (owErr) console.error("[PUT /api/jobseeker/company-visibility] ow_users:", owErr.message);
  if (!owUser?.id) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const value = body.visibility_company;
  /* ⚠️ 不正値は 400。**黙って "real" に倒さない**（本人が選んでいない公開設定を
     勝手に付けることになる。`experiences` の POST と同じ扱い）。 */
  if (typeof value !== "string" || !(COMPANY_VISIBILITY_VALUES as readonly string[]).includes(value)) {
    return NextResponse.json({ error: "INVALID_VISIBILITY", message: "公開設定の値が不正です。" }, { status: 400 });
  }

  /* ⚠️ **admin クライアントで、`user_id` を必ず条件に入れる。**
     ⚠️ 0行はエラーにする（`mutateMany`）。職歴0件の人は画面側で保存させないので、
        ここに来た時点で0行なら**条件の書き漏れ**を疑う（CLAUDE.md「0行更新を成功として扱わない」）。 */
  const r = await mutateMany(
    admin.from("ow_experiences").update({ visibility_company: value }).eq("user_id", owUser.id),
    "company-visibility PUT",
    { returning: "id" },
  );
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  return NextResponse.json({ ok: true, updated: r.count, visibility_company: value });
}
