import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateAllowNone } from "@/lib/supabase/mutate";
import { SIGNUP_REF_COOKIE, parseSignupRef } from "@/lib/constants/signupRef";

export const dynamic = "force-dynamic";

/**
 * POST /api/jobseeker/signup-ref
 *
 * 登録経路（`?ref=`）を `ow_users.signup_ref` に**1回だけ**書く。ボディは無い。
 * 見るのは「セッション」と「cookie」だけ。
 *
 * ── 呼び出し元は1つだけ ──────────────────────────────────────────────────────
 * `components/jobseeker/OnboardingGuard.tsx`。
 * ⚠️★**呼び出し元を増やさないこと。** 認証後に必ず1回通るクライアント側の共通処理は
 *    いまあれしかない。増やすと「経路ごとに条件が割れる」形になる。
 *
 * ⚠️★**サーバー側の共通後処理には置けない。** `postAuth.ts` を呼ぶのは
 *    `/auth/confirm` と `/auth/callback` の2つだけで、**パスワード登録は
 *    どちらも通らない**（CLAUDE.md「パスワードログイン/登録は callback を通らない」）。
 *    いちばん本命の経路を取りこぼす。
 *
 * ── 「1回だけ」の実体は SQL 側 ──────────────────────────────────────────────
 * ⚠️★**`.is("signup_ref", null)` を外さないこと。** これが上書き防止の本体。
 *    アプリ側の `if` で判定すると、同時実行で二重に書ける。
 *
 * ⚠️ 0行でも正常（2回目以降・ref 無し・既に入っている）。だから `mutateAllowNone`。
 * ⚠️ **`.select()` はヘルパーが付ける。** 素で書くと全列を返し、
 *    `ow_users` の列単位 GRANT に弾かれて 403 になる。
 *
 * ⚠️★**失敗してもオンボーディングや画面表示を止めない。** これは計測であって機能ではない。
 *    呼び出し元は応答を見ない。ここでは `console.error` を出し、常に 200 を返す。
 *
 * ⚠️ `signup_ref` は列単位 GRANT を配っていないので、**必ず admin クライアントで書く**
 *    （セッションのクライアントでは 403）。
 */
export async function POST() {
  const store = cookies();
  const raw = store.get(SIGNUP_REF_COOKIE)?.value ?? null;

  /* cookie が無ければ何もしない。**認証の確認すらしない**（DB に触らないので意味が無い）。 */
  if (!raw) return NextResponse.json({ recorded: false, reason: "no_cookie" });

  /* ⚠️ middleware で検証済みだが、ここでも通す。cookie は書き換えられる。 */
  const ref = parseSignupRef(raw);
  if (!ref) {
    console.warn("[signup-ref] 形式が不正な cookie を捨てた");
    const res = NextResponse.json({ recorded: false, reason: "invalid" });
    res.cookies.delete(SIGNUP_REF_COOKIE);
    return res;
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  /* 未ログインなら cookie は残す（このあと登録する人かもしれない）。 */
  if (!user) return NextResponse.json({ recorded: false, reason: "unauthenticated" });

  const admin = createAdminClient();
  const r = await mutateAllowNone(
    admin
      .from("ow_users")
      .update({ signup_ref: ref })
      .eq("auth_id", user.id)
      /* ★ここが「1回だけ・上書きしない」の実体。外さないこと。 */
      .is("signup_ref", null),
    "signup_ref",
    { returning: "id" },
  );

  if (!r.ok) {
    /* ⚠️ 計測なので、失敗しても利用者の操作は止めない。
          cookie は**消さない**（次の機会に書けるように）。 */
    console.error("[signup-ref] 記録に失敗:", r.error);
    return NextResponse.json({ recorded: false, reason: "write_failed" });
  }

  /* 書けても書けなくても（＝既に入っていても）cookie は用済み。 */
  const res = NextResponse.json({ recorded: r.count > 0 });
  res.cookies.delete(SIGNUP_REF_COOKIE);
  return res;
}
