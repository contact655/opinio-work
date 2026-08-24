import { NextResponse } from "next/server";
import { LANGUAGE_PROFICIENCY_VALUES } from "@/lib/constants/languageProficiency";

/**
 * 言語（`ow_user_languages`）のリクエスト検証（2026-08-24）。
 *
 * ⚠️ **POST と PUT で同じものを使う。** 片方にだけ検証を書くと、
 *    「新規では弾かれるのに編集では通る」形の穴ができる（`certificationInput` と同じ方針）。
 *
 * ⚠️ **400 は `{ error: コード, message: 画面に出す文 }`。** `message` を省かない。
 *
 * ⚠️ 習熟度の許容値を**ここに書き写さない**。`lib/constants/languageProficiency.ts`
 *    を見る（UI と同じ定数を通す。CLAUDE.md）。
 */

/** 保存に使う値。`sort_order` と `user_id` は呼び出し側が付ける */
export type LanguageInput = {
  name: string;
  proficiency: string | null;
};

export function parseLanguageBody(
  body: Record<string, unknown>
): LanguageInput | NextResponse {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 60) {
    return NextResponse.json(
      { error: "INVALID_NAME_LENGTH", message: "言語は1〜60字で入力してください。" },
      { status: 400 }
    );
  }

  /* ★習熟度は任意。⚠️ **空は正常（null）、不正は 400。この2つを混同しない。**
        黙って null に落とすと、選択肢を1つ足し忘れたときに
        「選べたのに保存されていない」形で静かに消える。 */
  let proficiency: string | null = null;
  if (body.proficiency !== null && body.proficiency !== undefined && body.proficiency !== "") {
    if (
      typeof body.proficiency !== "string" ||
      !LANGUAGE_PROFICIENCY_VALUES.includes(body.proficiency)
    ) {
      return NextResponse.json(
        { error: "INVALID_PROFICIENCY", message: "習熟度は一覧から選んでください。" },
        { status: 400 }
      );
    }
    proficiency = body.proficiency;
  }

  return { name, proficiency };
}

/** SELECT で返す列。⚠️ `.select()` を引数なしで呼ばない（列単位 GRANT に弾かれる） */
export const LANGUAGE_COLS = "id, name, proficiency, sort_order" as const;
