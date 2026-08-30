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
 *   ① `created_via` が **`'self'` または NULL**（＝**誰も確認していない行**）
 *   ② `is_public = true`
 *   ③ **その企業に `is_current = true` の経歴がある**
 *
 * ⚠️★**①に NULL を含めるのを外さないこと（2026-08-30 に直した本体）。**
 *    それまでは `'self'` だけで引いており、**掲載中5名のうち4名がこの一覧に出ていなかった。**
 *    `created_via` は 2026-08-23（`20260823040000`）に追加され、既存行は
 *    **意図的にバックフィルしていない**ので NULL のまま残っている
 *    （「推測値を投入しない」に従った正しい判断。**列の側は直さない**）。
 *    ⚠️ 公開側（企業ページ・/people・talkable.ts）は `created_via` で**絞っていない**。
 *       取得条件だけが厳しく、**出ている人と監視できる人が食い違っていた。**
 *
 * ⚠️ NULL は「不明」であって「企業が招待した」ではない。**確認済みとして扱えない。**
 *    実測（2026-08-30 / 本番）: `ow_company_members` 7行中 **6行が NULL**、
 *    うち掲載中4行。`approved_at` は**全行 0件**で、企業が承認した実績も無い。
 *
 * ⚠️ `invite` / `admin` は除く。**企業か運営が相手を知っている**経路なので、
 *    なりすましを後から探す対象ではない。**ここを緩めて全件にしないこと。**
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
    /* ⚠️★`'self'` **と NULL** の両方。`.eq()` だけにすると NULL 行が落ち、
          **企業ページに出ているのに運営から見えない人**が生まれる（上のコメント）。
       ⚠️ PostgREST の `.or()` で書く。`.in()` に null は渡せない。 */
    .or(`created_via.eq.${MEMBER_CREATED_VIA.SELF},created_via.is.null`)
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

/**
 * 運営がまだ確認していない件数と、**最も古いものの経過日数**。
 * ⚠️ **0にできる数**なので要対応に数えてよい。
 *
 * ── なぜ経過日数まで返すか（2026-08-30）─────────────────────────────────────
 * ⚠️★**件数だけでは「放置されていること」が分からない。**
 *    事前の承認を廃止した以上、なりすましは**後から見つけて外すしかなく**、
 *    掲載中の大半は**企業側に気づける人がいない**（宛先0件の会社）。
 *    つまり「何名いるか」より「**何日誰も見ていないか**」が判断材料になる。
 *    実測（2026-08-30）: 掲載5名すべて未確認で、**最も古いものが47日**経っていた。
 *
 * ⚠️ しきい値で色を変えたり警告にしたりはしない。**何日で問題かは決まっていない**
 *    （見る人と頻度が未決）。数字だけ出して、判断は運営に委ねる。
 *    CLAUDE.md「値が無いことを、ある値に置き換えない」と同じ筋で、
 *    **決まっていない基準を勝手に作らない。**
 *
 * ⚠️ `oldestDays` は未確認が0件のとき `null`（**0ではない**）。
 *    0 にすると「今日から放置が始まった」と読めてしまう。
 */
export async function countSelfListedUnreviewed(): Promise<{ count: number; oldestDays: number | null }> {
  const rows = await fetchSelfListed();
  const unreviewed = rows.filter((r) => r.ops_reviewed_at === null);
  if (unreviewed.length === 0) return { count: 0, oldestDays: null };

  /* ⚠️ 起点は `consent_at ?? created_at`。**一覧の「◯日前」と同じ値**を使う
        （一覧は appliedAt = consent_at ?? created_at で日数を出している）。
        別の起点にすると、ダッシュボードと一覧で日数が食い違う。 */
  const now = Date.now();
  const days = unreviewed
    .map((r) => {
      const t = Date.parse(r.consent_at ?? r.created_at);
      return Number.isNaN(t) ? null : Math.floor((now - t) / 86_400_000);
    })
    .filter((d): d is number => d !== null);

  return { count: unreviewed.length, oldestDays: days.length ? Math.max(...days) : null };
}
