import { createAdminClient } from "@/lib/supabase/admin";
import { MEMBER_CREATED_VIA } from "@/lib/constants/companyMembers";

/**
 * 「自己申告で**実際に掲載されている**行」を返す（2026-08-25）。
 *
 * ── なぜ関数にしたか ────────────────────────────────────────────────────────
 * 同じ数を**運営ダッシュボードの要対応**と**一覧ページ**の2箇所が出す。
 * 条件を両方に書くと、片方だけ直したときに**数字と中身が食い違う**。
 * ⚠️ 条件をここ以外に書かないこと。
 *
 * ── 条件 ────────────────────────────────────────────────────────────────────
 *   ① `created_via = 'self'`（本人が自分で載せた行）
 *   ② `is_public = true`
 *   ③ **その企業に `is_current = true` の経歴がある**
 *
 * ⚠️★③を落とさないこと。公開側（企業ページ・/people・/u）は `is_current` を要求しており、
 *    **退職した人は既に降りている**。③が無いと、降りている人まで
 *    「掲載中」として運営の監視対象に並ぶ（2026-08-25 に実際にそうなっていた）。
 *    判定の考え方は `lib/companyMembers/talkable.ts` と同じ。
 *
 * ⚠️ `ops_reviewed_at` は**運営専用の列**で、anon / authenticated には GRANT していない。
 *    この関数は `createAdminClient`（service_role）で読むので通る。
 *    **本人向け・公開側の select に混ぜないこと**（1列でもクエリ全体が 403 になる）。
 */
export type SelfListedRow = {
  id: string;
  user_id: string;
  company_id: string;
  consent_at: string | null;
  created_at: string;
  ops_reviewed_at: string | null;
};

export async function fetchSelfListed(): Promise<SelfListedRow[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("ow_company_members")
    .select("id, user_id, company_id, consent_at, created_at, ops_reviewed_at")
    .eq("created_via", MEMBER_CREATED_VIA.SELF)
    .eq("is_public", true)
    /* ⚠️ **未確認が先・その中で新しい順**。運営が上から見て、確認したら消えていく形。 */
    .order("ops_reviewed_at", { ascending: true, nullsFirst: true })
    .order("consent_at", { ascending: false, nullsFirst: false });

  /* ⚠️ 握り潰さない。空で返すと「誰も自己申告していない」に化ける */
  if (error) {
    console.error("[selfListed] fetch:", error.message);
    return [];
  }
  const rows = (data ?? []) as SelfListedRow[];
  if (rows.length === 0) return [];

  /* ③ 在籍の突き合わせ。⚠️ N+1 にしない */
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const { data: exps, error: expErr } = await admin
    .from("ow_experiences")
    .select("user_id, company_id")
    .eq("is_current", true)
    .in("user_id", userIds);
  /* ⚠️ ここを握り潰すと**全員が退職済み**に見えて一覧が空になる。必ずログに出す */
  if (expErr) {
    console.error("[selfListed] ow_experiences:", expErr.message);
    return [];
  }
  const pairs = new Set(
    (exps ?? [])
      .map((e) => e as { user_id: string; company_id: string | null })
      .filter((e) => e.company_id)
      .map((e) => `${e.user_id}:${e.company_id}`),
  );

  return rows.filter((r) => pairs.has(`${r.user_id}:${r.company_id}`));
}

/** 運営がまだ確認していない件数。⚠️ **0にできる数**なので要対応に数えてよい */
export async function countSelfListedUnreviewed(): Promise<number> {
  const rows = await fetchSelfListed();
  return rows.filter((r) => r.ops_reviewed_at === null).length;
}
