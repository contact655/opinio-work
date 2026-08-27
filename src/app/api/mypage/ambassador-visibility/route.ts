import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { revalidateCompanyAmbassadors } from "@/lib/supabase/queries";
import { mutateOne } from "@/lib/supabase/mutate";
import { touchStanceUpdatedAt } from "@/lib/profile/stance";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/mypage/ambassador-visibility
 * Body: { member_id: string; enabled: boolean }
 *
 * 本人が「話を聞かれてもよい（面談可）」を **ON / OFF** する（2026-08-24）。
 *
 * ★**行を消さない。** 掲載を止めるだけで、登録は残す。これがこのルートの存在理由。
 *   消してしまうと戻すときに作り直しになる（＝会社の招待経由で入った人は招待からやり直し）。
 *   ⚠️ 本人が行ごと消す DELETE ルート（`ambassador-self-remove`）は
 *      2026-08-24 に削除した。**行を消す操作を本人側に戻さないこと。**
 *
 * ⚠️★**セッションクライアントで UPDATE する。** admin クライアントにすると
 *    RLS（`own_member_consent`）と `guard_member_consent` が素通りし、
 *    「本人の行だけ」「在籍している会社だけ公開できる」の保証が
 *    アプリのコードだけに載る。DB 側を効かせたままにする。
 *
 * ⚠️ ONは `display_consent` と `is_public` を**両方 true**にする。
 *    `check_public_requires_consent`（is_public=false OR display_consent=true）があるので、
 *    片方だけ立てると 23514 で落ちる。
 *
 * ⚠️ OFF も**両方 false**にする。`display_consent` だけ残すと「本人はONのままで
 *    会社が非掲載にしている（unlisted）」と区別が付かなくなる。
 *
 * ⚠️ 退職して `is_current` が false になった人も **OFF はできる**
 *    （RLS の在籍チェックは `is_public = true` にする側にだけ掛けてある）。
 *    ONに戻せないのは仕様。在籍していない会社の人として出せてはいけない。
 */
export async function PATCH(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { member_id?: string; enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const memberId = (body.member_id ?? "").trim();
  if (!memberId) return NextResponse.json({ error: "member_id required" }, { status: 400 });
  /* ⚠️ 空を既定値に倒さない。送られてこなかったのか false なのかを区別する */
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be boolean" }, { status: 400 });
  }
  const enabled = body.enabled;

  const admin = createAdminClient();
  const { data: owUser, error: owErr } = await admin
    .from("ow_users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (owErr) {
    console.error("[ambassador-visibility] ow_users:", owErr.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!owUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  /* ⚠️ 先に company_id を取る。キャッシュを捨てるのに要る（`self-remove` と同じ理由）。 */
  const { data: target, error: findErr } = await admin
    .from("ow_company_members")
    .select("company_id")
    .eq("id", memberId)
    .eq("user_id", owUser.id)
    .maybeSingle();
  if (findErr) {
    console.error("[ambassador-visibility] find:", findErr.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  /* ⚠️ `mutateOne` を通す（CLAUDE.md）。素で書くと 0行更新が成功に見える。
        RLS かトリガーに弾かれたときも、ここで 0行として拾える。
     ⚠️ `returning` に `id` を渡す（この表には id がある）。 */
  const r = await mutateOne(
    supabase
      .from("ow_company_members")
      .update({ display_consent: enabled, is_public: enabled })
      .eq("id", memberId)
      .eq("user_id", owUser.id),
    "ambassador-visibility",
    { returning: "id" },
  );
  if (!r.ok) {
    return NextResponse.json(
      {
        error: r.error,
        /* ⚠️ 在籍が切れているとONに戻せない。原因を画面に出せる文言で返す。 */
        message: enabled
          ? "掲載できませんでした。この企業に在籍中の職歴が登録されているか確認してください。"
          : "保存できませんでした。もう一度お試しください。",
      },
      { status: r.status },
    );
  }

  revalidateCompanyAmbassadors(target.company_id);
  /* ★「意思表示を最後に答えた日」を打ち直す（2026-08-26 / フェーズ2）。
     ⚠️ ON / OFF の**どちらでも**打つ。止めるのも意思表示なので。
     ⚠️ `user.id` は auth 空間。`owUser.id`（ow_users 空間）を渡さないこと。
     ⚠️ 記録なので失敗しても 500 にしない（本体は既に成功している）。 */
  await touchStanceUpdatedAt(user.id, "ambassador-visibility stance_updated_at");
  return NextResponse.json({ ok: true, enabled });
}
