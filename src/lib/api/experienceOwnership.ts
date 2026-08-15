import { NextResponse } from "next/server";
import type { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 実績・受賞に付ける `experience_id` を検証して返す。
 *
 * ★**DB では防げない。** FK の検査は RLS を通らないので、
 *   「他人の職歴の id」を入れた行も FK 制約は通ってしまう（4-1 で確認）。
 *   書き込み経路（この関数）が唯一の関門。
 *
 * 戻り値:
 *   - `null`            … 未指定（「その他の実績・受賞」になる）
 *   - `string`          … 検証済みの experience_id
 *   - `NextResponse`    … 呼び出し側はそのまま return する（400 / 403）
 *
 * ⚠️ 本人の職歴かどうかは **session クライアントで引く**。
 *    `ow_experiences` の RLS（own_manage）が効くので、他人の行はそもそも見えない。
 *    admin クライアントで引くと RLS を素通りし、この検証の意味が無くなる。
 */
export async function verifyExperienceId(
  supabase: ReturnType<typeof createClient>,
  owUserId: string,
  raw: unknown
): Promise<string | null | NextResponse> {
  if (raw === undefined || raw === null || raw === "") return null;

  if (typeof raw !== "string" || !UUID_RE.test(raw)) {
    return NextResponse.json(
      { error: "INVALID_EXPERIENCE_ID", message: "職歴の指定が不正です。" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("ow_experiences")
    .select("id")
    .eq("id", raw)
    .eq("user_id", owUserId)
    .maybeSingle();

  if (error) {
    console.error("[verifyExperienceId]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!data) {
    /* 他人の職歴 id / 存在しない id。**404 ではなく 403**。
       「その id は存在するが自分のものではない」と「存在しない」を
       呼び出し側に区別させない（存在の有無を漏らさない）。 */
    return NextResponse.json(
      { error: "FORBIDDEN_EXPERIENCE_ID", message: "その職歴には紐づけられません。" },
      { status: 403 }
    );
  }
  return data.id as string;
}
