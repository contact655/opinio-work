import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 標準スキルの削除（2026-08-27）。形は `api/jobseeker/languages/[id]` に揃えてある。
 * ⚠️ **PUT は無い**（理由は `../route.ts` の冒頭）。
 *
 * ── ★なぜ `createAdminClient` なのか（2026-08-27）───────────────────────────
 * **このAPIは `createAdminClient` を使っている（RLS をバイパスする）。**
 *
 * 理由は `types.ts` に `ow_skills` / `ow_user_skills` の型が無く、
 * `Database` 型付きの `createClient` では **tsc が通らない**ため
 * （2026-08-27 時点で `types.ts` は**別セッションが `career_stance` で編集中**。
 *  `npm run gen:types` を流すと相手の未リリースの変更を巻き込むので流せない）。
 *
 * ★**`user_id` はセッションから解決した値だけを使い、リクエスト本文からは
 *   絶対に受け取らないこと。** 全クエリに `.eq("user_id", owUserId)` が
 *   付いていることが**唯一の防御**になっている。
 *
 * ⚠️ **`gen:types` が流せるようになったら `createClient`（RLS 付き）へ戻すこと。**
 * ⚠️ family（資格・言語・メディア・発信コンテンツ）は**すべて `createClient`**。
 *    ここだけが例外であって、これが揃った形ではない。
 *
 * ⚠️ 認証（`getUser`）だけは RLS 付きの `createClient` を使っている。
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveOwUserId(authUid: string): Promise<string | null> {
  const { data, error } = await createAdminClient()
    .from("ow_users")
    .select("id")
    .eq("auth_id", authUid)
    .maybeSingle();
  if (error) {
    console.error("[api/jobseeker/skills/[id] resolveOwUserId]", error.message);
    return null;
  }
  return (data?.id as string | undefined) ?? null;
}

// DELETE /api/jobseeker/skills/[id]
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const owUserId = await resolveOwUserId(user.id);
  if (!owUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  /* ⚠️ `user_id` を必ず条件に入れる。id だけで消すと他人の行に届く
        （RLS でも止まるが、アプリ側でも閉じておく） */
  const { error } = await createAdminClient()
    .from("ow_user_skills")
    .delete()
    .eq("id", params.id)
    .eq("user_id", owUserId);

  if (error) {
    console.error("[DELETE /api/jobseeker/skills/[id]]", error.code, error.message);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
