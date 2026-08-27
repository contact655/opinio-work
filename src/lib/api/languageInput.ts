import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LANGUAGE_PROFICIENCY_VALUES } from "@/lib/constants/languageProficiency";
import { MAX_USER_LANGUAGES } from "@/lib/constants/languages";

/**
 * 言語（`ow_user_languages`）のリクエスト検証（2026-08-24 / 2026-08-27 にマスタ化）。
 *
 * ⚠️ **POST と PUT で同じものを使う。** 片方にだけ検証を書くと、
 *    「新規では弾かれるのに編集では通る」形の穴ができる。
 *
 * ⚠️ **400 は `{ error: コード, message: 画面に出す文 }`。** `message` を省かない。
 *
 * ⚠️ 習熟度の許容値を**ここに書き写さない**。`lib/constants/languageProficiency.ts`
 *    を見る（UI と同じ定数を通す。CLAUDE.md）。
 *
 * ── ★`name` はマスタの `label` の複製（2026-08-27）───────────────────────────
 * 正は `language_id`。`name` を残しているのは、読み手の `u/[id]/page.tsx` と
 * `mypage/page.tsx` が別セッションの作業中で join に変えられないため。
 *
 * ★**この一致検証が、自由入力の復活を防ぐ唯一の防御。** DB 側に制約は無い
 *   （`name` は素の text）。**外さないこと。**
 *   外すと `name` に任意の文字列が入り、`/search` は `language_id` で引くので
 *   **画面に出る名前だけがズレる**という最悪の形になる。
 * ⚠️ 片付け方（`name` を落とす手順）は docs/todo.md。
 */

/** 保存に使う値。`sort_order` と `user_id` は呼び出し側が付ける */
export type LanguageInput = {
  language_id: string;
  name: string;
  proficiency: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ★マスタに存在することまで確かめる。**DB を見るので async。**
 *
 * ⚠️ マスタ（`ow_languages`）の参照に `createAdminClient` を使っている。
 *    このテーブルは `USING (true)` で anon にも公開しているので、admin でも
 *    見えるものは変わらない（権限の格上げにはならない）。
 *    型（`types.ts`）に `ow_languages` がまだ無いのが直接の理由で、
 *    `gen:types` が流せるようになったら `createClient` に戻してよい。
 */
export async function parseLanguageBody(
  body: Record<string, unknown>
): Promise<LanguageInput | NextResponse> {
  /* ★受けるのは `language_id`。**名前の自由入力は受け付けない。** */
  const languageId = typeof body.language_id === "string" ? body.language_id : "";
  if (!UUID_RE.test(languageId)) {
    return NextResponse.json(
      { error: "INVALID_LANGUAGE_ID", message: "言語は一覧から選んでください。" },
      { status: 400 }
    );
  }

  const { data: master, error } = await createAdminClient()
    .from("ow_languages")
    .select("id, label, is_active")
    .eq("id", languageId)
    .maybeSingle();
  if (error) {
    console.error("[languageInput master]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!master || master.is_active !== true) {
    return NextResponse.json(
      { error: "UNKNOWN_LANGUAGE", message: "その言語は選べません。一覧から選んでください。" },
      { status: 400 }
    );
  }

  /* ★`name` が送られてきたら、マスタの `label` と**完全一致**していること。
     ⚠️ 送られてこなければマスタの値を使う（呼び出し側の書き忘れで
        自由な値が入る余地を残さない）。 */
  const label = master.label as string;
  if (body.name !== undefined && body.name !== null && body.name !== label) {
    return NextResponse.json(
      {
        error: "NAME_MISMATCH",
        message: "言語名は一覧の表記と一致している必要があります。選び直してください。",
      },
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

  return { language_id: languageId, name: label, proficiency };
}

/**
 * ★件数の上限。**UI と API の2層だけ**で担保する（DB のトリガーは足さない）。
 * 行数（濃度）の制約なので CHECK では書けない。理由は
 * CLAUDE.md「この規約の適用範囲 —— 『値の集合』の制約だけ」。
 *
 * ⚠️ **追加のときだけ呼ぶ。** 編集（PUT）で呼ぶと、上限に達した人が
 *    既存の行を直せなくなる。
 */
export async function checkLanguageLimit(owUserId: string): Promise<NextResponse | null> {
  const { count, error } = await createAdminClient()
    .from("ow_user_languages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", owUserId);
  if (error) {
    console.error("[languageInput count]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if ((count ?? 0) >= MAX_USER_LANGUAGES) {
    return NextResponse.json(
      {
        error: "TOO_MANY_LANGUAGES",
        message: `言語は${MAX_USER_LANGUAGES}個までです。入れ替えるには、どれかを削除してください。`,
      },
      { status: 400 }
    );
  }
  return null;
}

/**
 * SELECT で返す列。⚠️ `.select()` を引数なしで呼ばない（列単位 GRANT に弾かれる）。
 * ⚠️ `name` も返す。マスタの複製だが、読み手2ファイルがまだこれを使っている。
 */
export const LANGUAGE_COLS = "id, language_id, name, proficiency, sort_order" as const;
