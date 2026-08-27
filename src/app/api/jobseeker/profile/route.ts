import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Json } from "@/lib/supabase/types";
/* ⚠️ 空入力の扱いは1箇所に寄せる。ここに if を書き足さないこと（lib/api/normalize.ts の冒頭を参照）。 */
import { optionalText, optionalTextMap, requiredText, InvalidInputError } from "@/lib/api/normalize";
import { normalizeUsername, validateUsername, USERNAME_ERROR_MESSAGE } from "@/lib/constants/username";

export const dynamic = "force-dynamic";

// PUT /api/jobseeker/profile — 求職者プロフィール基本情報の更新
export async function PUT(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const VALID_VISIBILITY = new Set(["public", "login_only", "private"]);
  const BIRTH_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

  const patch: {
    name?: string;
    headline?: string | null;
    avatar_color?: string | null;
    cover_color?: string | null;
    about_me?: string | null;
    birth_date?: string | null;
    location?: string | null;
    social_links?: Json | null;
    visibility?: string;
    profile_setup_at?: string | null;
    updated_at: string;
    username?: string | null;
  } = { updated_at: new Date().toISOString() };

  /* ⚠️ 空は正常系（任意項目は null）、不正は異常系（400）。混同しない。
        ⚠️ **受け取る項目を増やさないこと。** ここに列を足すと、編集UIが無いのに
           書き込める列が生まれる（`catchphrase` を足しかけて外した経緯がある）。 */
  try {
    /* ⚠️ `name` は必須だが、**キーが無いときは触らない**。
          未送信は「変更なし」であって空ではない。同一視すると、
          他項目だけを保存したときに名前が消える。 */
    if ("name" in body) {
      patch.name = requiredText(body.name, "ow_users.name", "お名前を入力してください", 100);
    }
    /* ⚠️ avatar_color / cover_color は値のホワイトリスト検証が本来要る（docs に宿題として記載）。
          ここでは空→null だけを揃える。形式の検証は入れない。 */
    /* 肩書き1行。⚠️ 上限は DB の CHECK（ow_users_headline_length）と同じ 40。
          超過は **切らずに 400**。切ると「入力したのに途中で消えた」になる。 */
    if ("headline" in body) {
      const h = optionalText(body.headline, 200);
      if (h !== null && h.length > 40) {
        return NextResponse.json({ error: "INVALID_HEADLINE", message: "肩書きは40文字以内で入力してください。" }, { status: 400 });
      }
      patch.headline = h;
    }
    if ("avatar_color" in body) patch.avatar_color = optionalText(body.avatar_color, 100);
    if ("cover_color"  in body) patch.cover_color  = optionalText(body.cover_color, 100);
    if ("about_me" in body) patch.about_me = optionalText(body.about_me, 2000);
    if ("location" in body) patch.location = optionalText(body.location, 100);

    /* ★プロフィールURL（`/u/<username>`）。編集UIは /profile/edit の基本情報にある。
       ⚠️ 形式は `lib/constants/username.ts` と DB の CHECK（ow_users_username_format）に
          同じ式を書いてある。ここで独自の正規表現を書かないこと。
       ⚠️ 空文字は「未設定に戻す」＝ null。不正値は 400（黙って null にしない）。
       ⚠️ **生年月日を混ぜた既定値を作らない。** URL に生年月日を出さない方針
          （constants 側のコメント参照）。 */
    if ("username" in body) {
      const raw = typeof body.username === "string" ? body.username : "";
      const normalized = normalizeUsername(raw);
      if (normalized === "") {
        patch.username = null;
      } else {
        const err = validateUsername(normalized);
        if (err) {
          return NextResponse.json(
            { error: `INVALID_USERNAME_${err}`, message: USERNAME_ERROR_MESSAGE[err] },
            { status: 400 },
          );
        }
        patch.username = normalized;
      }
    }

    /* ⚠️ 不正値は 400。黙って null にすると「入力したのに消えた」になる（学歴で実際に1ヶ月起きた） */
    if ("birth_date" in body) {
      const bd = body.birth_date;
      if (bd === null || bd === "") patch.birth_date = null;
      else if (typeof bd === "string" && BIRTH_RE.test(bd)) patch.birth_date = bd;
      else return NextResponse.json({ error: "INVALID_BIRTH_DATE", message: "生年月日の形式が正しくありません。" }, { status: 400 });
    }
    /* ⚠️ **空文字のキーを残さない。** 残すと、全部消して保存しても `{"x": ""}` が残り、
          `null` に戻す手段が画面から無くなる（2026-08-16 まで実際にそうだった）。
          text 列の `optionalText` と同じ扱いを JSONB にも通す。 */
    if ("social_links" in body) {
      if (JSON.stringify(body.social_links).length > 2000) {
        return NextResponse.json({ error: "SOCIAL_LINKS_TOO_LARGE", message: "SNS リンクの量が多すぎます。" }, { status: 400 });
      }
      patch.social_links = optionalTextMap(
        body.social_links,
        500,
        "ow_users.social_links",
        "SNS リンクの形式が正しくありません。",
      ) as Json | null;
    }
    /* ⚠️ 公開設定は黙って捨てない。捨てると「非公開にしたのに公開のまま」になる */
    if ("visibility" in body) {
      if (typeof body.visibility !== "string" || !VALID_VISIBILITY.has(body.visibility)) {
        return NextResponse.json({ error: "INVALID_VISIBILITY", message: "公開範囲の値が不正です。" }, { status: 400 });
      }
      patch.visibility = body.visibility;
    }
    /* ⚠️ `is_open_to_work` の受け口は 2026-08-26 に外した（フェーズ2）。
          「転職について」の正は `ow_profiles.career_stance`（4値・null 可）になり、
          保存は `PUT /api/jobseeker/career-preferences` が持つ。
          ⚠️ **ここに書き戻さないこと。** 同じ意思表示を触る経路が2つになる。
          ⚠️ 列（`ow_users.is_open_to_work`）は DROP していない。写さなかった
             false 35件の事実を残すため。**読む側も書く側もいない。** */

    /* ⚠️ **これは text ではなく timestamptz。** 任意 text の正規化を通さない。
          空文字をそのまま渡すと Postgres が 22007 で弾き、**400 ではなく 500 になる**。
          空・null は null、文字列は形式を検証して不正なら 400。 */
    if ("profile_setup_at" in body) {
      const v = body.profile_setup_at;
      if (v === null || v === "" || v === undefined) patch.profile_setup_at = null;
      else if (typeof v === "string" && !Number.isNaN(Date.parse(v))) patch.profile_setup_at = v;
      else return NextResponse.json({ error: "INVALID_PROFILE_SETUP_AT", message: "日時の形式が正しくありません。" }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof InvalidInputError) {
      console.error("[PUT /api/jobseeker/profile]", e.message);
      return NextResponse.json({ error: "INVALID_INPUT", message: e.userMessage }, { status: 400 });
    }
    throw e;
  }

  const { updated_at: _, ...rest } = patch;
  if (Object.keys(rest).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const { error } = await supabase
    .from("ow_users")
    .update(patch)
    .eq("auth_id", user.id);

  if (error) {
    /* ⚠️ username の重複は利用者の入力ミスなので **409 で文言を返す**。
          500 にすると「保存できない」としか伝わらず、直しようがない。
          23505 = unique_violation（`ow_users_username_unique`）。 */
    if (error.code === "23505" && "username" in patch) {
      return NextResponse.json(
        { error: "USERNAME_TAKEN", message: USERNAME_ERROR_MESSAGE.TAKEN },
        { status: 409 },
      );
    }
    /* ⚠️ 23514 = check_violation。DB の CHECK に落ちたということは、
          上の validateUsername と DB の式がずれている（3つ揃えの崩れ）。 */
    console.error("[PUT /api/jobseeker/profile]", error.code, error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
