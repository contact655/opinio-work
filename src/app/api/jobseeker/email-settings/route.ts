import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
/* ⚠️ 許容キーは constants に置く。route の中に書くと UI と割れる
      （CLAUDE.md「UI / API / DB を3つ揃える」）。
      route ファイルは HTTP メソッド以外を export できないので、置き場所としても不可。 */
import { EMAIL_SETTING_KEYS, EMAIL_SETTING_DEFAULTS, type EmailSettingKey } from "@/lib/constants/emailSettings";

export const dynamic = "force-dynamic";

/* メール配信設定。
   ⚠️ `ow_profiles.user_id` は **auth 空間**（CLAUDE.md「user_id は2つの空間がある」）。
   ⚠️ ここに無い項目を UI に出さないこと。実在するメールと1対1で対応させている。
        email_weekly_enabled … 週次ダイジェスト（weekly-jobs / weekly-match）
        email_scout_enabled  … スカウトが届いたとき
      2026-08-10 以前は localStorage に保存していて、cron から読めなかった。 */

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ow_profiles")
    .select("email_weekly_enabled, email_scout_enabled")
    .eq("user_id", user.id) // ⚠️ auth 空間
    .maybeSingle();

  if (error) {
    console.error("[GET /api/jobseeker/email-settings]", error.message);
    return NextResponse.json({ error: "内部エラー" }, { status: 500 });
  }

  /* ⚠️ 行がまだ無い人には DB の既定値と同じ値を返す。
        ここで false を返すと「オフになっている」と誤って見える。 */
  return NextResponse.json({
    email_weekly_enabled: data?.email_weekly_enabled ?? EMAIL_SETTING_DEFAULTS.email_weekly_enabled,
    email_scout_enabled: data?.email_scout_enabled ?? EMAIL_SETTING_DEFAULTS.email_scout_enabled,
  });
}

export async function PUT(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  /* ⚠️ 不正値は 400 で弾く。黙って既定値に落とさない
        （CLAUDE.md「選択肢が決まっている値は UI / API / DB を3つ揃える」）。 */
  const patch: Partial<Record<EmailSettingKey, boolean>> = {};
  for (const key of EMAIL_SETTING_KEYS) {
    if (!(key in body)) continue;
    const v = body[key];
    if (typeof v !== "boolean") {
      return NextResponse.json({ error: `${key} は true / false のみ` }, { status: 400 });
    }
    patch[key] = v;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "変更する項目がありません" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("ow_profiles").select("id").eq("user_id", user.id).maybeSingle();

  /* ⚠️ 更新結果を返させない（`.select()` を付けない）。
        返却列にも SELECT 権限が要るため、権限を剥がした列があると 403 になる
        （CLAUDE.md「列単位 GRANT を剥がすときのチェックリスト」）。 */
  const { error } = existing
    ? await admin.from("ow_profiles")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
    : await admin.from("ow_profiles").insert({ user_id: user.id, ...patch });

  if (error) {
    console.error("[PUT /api/jobseeker/email-settings]", error.message);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
