import { NextResponse } from "next/server";
import { requireOwnExperience } from "@/lib/experiences/reasonAnswers";
import { saveSalary } from "@/lib/experiences/salary";
import { parseExperienceSalary } from "@/lib/constants/experienceSalary";

export const dynamic = "force-dynamic";

/**
 * ★1件の職歴の年収を保存する（2026-10-16 / フェーズ2）。body は `{ amount_man: number | null }`。
 * ⚠️★書き込みは service role。**本人確認は `requireOwnExperience` だけが担う**（RLS は効かない）。
 *    他人の職歴は 404（存在を区別させない）。
 * ⚠️ 職歴の本体（PUT /api/jobseeker/experiences/[id]）とは別。あちらは年収を読まない・書かない。
 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const own = await requireOwnExperience(params.id);
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!("amount_man" in body)) return NextResponse.json({ error: "amount_man required" }, { status: 400 });
  const amount = parseExperienceSalary(body.amount_man);
  if (amount === "invalid") {
    return NextResponse.json({ error: "INVALID_SALARY", message: "年収は1〜100000（万円）の整数で入力してください。" }, { status: 400 });
  }

  const r = await saveSalary(own.row.id, amount);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });
  return NextResponse.json({ ok: true, amount_man: amount });
}
