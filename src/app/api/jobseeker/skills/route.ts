import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { MAX_USER_SKILLS } from "@/lib/constants/skills";

export const dynamic = "force-dynamic";

/**
 * 標準スキルの一覧・追加（2026-08-27）。
 * ⚠️ 形は `api/jobseeker/languages` に揃えてある。片方を直すときはもう片方も見ること。
 *
 * ⚠️ **PUT は無い。** スキルは `ow_skills` から選ぶだけで、行の中に編集できる値が無い
 *    （年数も習熟度も持たない）。差し替えは「消して選び直す」。
 *    ⚠️ ここに PUT を足すなら、それは `skill_id` の付け替えになる。
 *       `unique (user_id, skill_id)` に当たるので、重複の扱いを決めてから作ること。
 *
 * ⚠️ **自由入力は受け付けない。** 受けるのは `skill_id`（`ow_skills` の UUID）だけ。
 *    文字列を受けると、そこから語彙が増えて `/search` の閉じた語彙が崩れる。
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

/** ⚠️ `.select()` を引数なしで呼ばない（列単位 GRANT に弾かれる） */
const USER_SKILL_COLS = "id, skill_id, created_at, skill:ow_skills(id, label, category)" as const;

async function resolveOwUserId(authUid: string): Promise<string | null> {
  const { data, error } = await createAdminClient()
    .from("ow_users")
    .select("id")
    .eq("auth_id", authUid)
    .maybeSingle();
  if (error) {
    console.error("[api/jobseeker/skills resolveOwUserId]", error.message);
    return null;
  }
  return (data?.id as string | undefined) ?? null;
}

// GET /api/jobseeker/skills
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owUserId = await resolveOwUserId(user.id);
  if (!owUserId) return NextResponse.json({ skills: [] });

  const { data, error } = await createAdminClient()
    .from("ow_user_skills")
    .select(USER_SKILL_COLS)
    .eq("user_id", owUserId)
    .order("created_at", { ascending: true });

  /* ⚠️ error を握りつぶさない。`?? []` だけで受けると権限エラーが「0件」に化ける */
  if (error) {
    console.error("[GET /api/jobseeker/skills]", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ skills: data ?? [] });
}

// POST /api/jobseeker/skills
export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const skillId = typeof body.skill_id === "string" ? body.skill_id : "";
  if (!UUID_RE.test(skillId)) {
    return NextResponse.json(
      { error: "INVALID_SKILL_ID", message: "スキルは一覧から選んでください。" },
      { status: 400 }
    );
  }

  const owUserId = await resolveOwUserId(user.id);
  if (!owUserId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  /* ★実在して有効なスキルであること。
     ⚠️ FK があるので存在しない id は DB でも弾かれるが、それだと 500 になる。
        「一覧から選んでください」と言える 400 でここで止める。 */
  const { data: master, error: masterErr } = await createAdminClient()
    .from("ow_skills")
    .select("id, is_active")
    .eq("id", skillId)
    .maybeSingle();
  if (masterErr) {
    console.error("[POST /api/jobseeker/skills master]", masterErr.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!master || master.is_active !== true) {
    return NextResponse.json(
      { error: "UNKNOWN_SKILL", message: "そのスキルは選べません。一覧から選んでください。" },
      { status: 400 }
    );
  }

  /* ★上限。⚠️ **UI だけに置かない。** 画面を経由しない呼び出しが素通りする。
        DB 側には置いていない（行数の制約なのでトリガーが要る。lib/constants/skills.ts）。 */
  const { count, error: countErr } = await createAdminClient()
    .from("ow_user_skills")
    .select("id", { count: "exact", head: true })
    .eq("user_id", owUserId);
  if (countErr) {
    console.error("[POST /api/jobseeker/skills count]", countErr.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if ((count ?? 0) >= MAX_USER_SKILLS) {
    return NextResponse.json(
      {
        error: "TOO_MANY_SKILLS",
        message: `スキルは${MAX_USER_SKILLS}個までです。入れ替えるには、どれかを削除してください。`,
      },
      { status: 400 }
    );
  }

  const { data: inserted, error: insertError } = await createAdminClient()
    .from("ow_user_skills")
    .insert({ user_id: owUserId, skill_id: skillId })
    .select(USER_SKILL_COLS)
    .single();

  if (insertError) {
    /* 23505 = unique (user_id, skill_id)。**既に持っている**ので 409 で返す */
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "DUPLICATE_SKILL", message: "そのスキルはすでに登録されています。" },
        { status: 409 }
      );
    }
    console.error("[POST /api/jobseeker/skills]", insertError.code, insertError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(inserted, { status: 201 });
}
