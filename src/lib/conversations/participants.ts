import type { SupabaseClient } from "@supabase/supabase-js";
import { mutateMany } from "@/lib/supabase/mutate";

/**
 * DM（`kind='direct_message'`）の参加者に入れる role。
 *
 * ⚠️ **両者とも `'candidate'`。方向を role に持たせない。**
 *    `ow_conversation_participants_role_check` が許すのは
 *    `candidate / company_admin / mentor / editor / operator` の5つで、
 *    これは「**その人が OPINIO 上で何者か**」を表す語彙。
 *    「この会話でどちら側か」は別の軸なので、同じ列に同居させない。
 *
 * ⚠️ 2026-08-25 まで `'initiator'` / `'recipient'` を INSERT していたが、
 *    どちらも CHECK に無いため **必ず 23514 で落ちていた**。
 *    その結果、DM は会話行だけが作られて参加者0件のまま残り、
 *    **メッセージを1件も送れない状態が 2026-06-14 からずっと続いていた。**
 *
 * ⚠️ 方向は `ow_conversations` 側が持っている。
 *    `candidate_user_id` = 始めた人 / `mentor_user_id` = 相手
 *    （`ow_conversations_kind_consistency` が direct_message に
 *      `mentor_user_id IS NOT NULL` を要求している）。
 *
 * ⚠️ **DM の画面は role を読んでいない。** 発言の左右は
 *    `sender_participant_id === myParticipantId` で決めている。
 */
export const DM_PARTICIPANT_ROLE = "candidate" as const;

export type EnsureParticipantsResult =
  | { ok: true; byUserId: Map<string, string> }
  | { ok: false; error: string; status: number };

/**
 * 会話の参加者を**冪等に**揃える。足りない人だけ INSERT する。
 *
 * ⚠️ **会話を作る経路と、会話を開く経路の両方から呼ぶこと。**
 *    会話行だけ作られて参加者が入らなかった過去のデータ（孤児）は、
 *    どちらかが一度開けばこれで揃う。
 *
 * ⚠️ **両者ぶんを揃える。** 呼び出した本人のぶんだけ作ると、
 *    相手は一覧に会話が出ないまま（可視性は参加者行で決まる）になり、
 *    **相手からは永久に開けない**。実際その形になっていた。
 *
 * ⚠️ 既存判定に `left_at` の条件を付けない。付けると、抜けた人を
 *    「居ない」と見なして**2行目を作ってしまう**。
 *    （`left_at` を書くコードは現状どこにも無く、本番も0件。）
 */
export async function ensureDmParticipants(
  admin: SupabaseClient,
  conversationId: string,
  userIds: (string | null | undefined)[],
): Promise<EnsureParticipantsResult> {
  const ids = Array.from(new Set(userIds.filter((v): v is string => !!v)));
  if (ids.length === 0) {
    return { ok: false, error: "参加者が特定できませんでした", status: 500 };
  }

  const read = async () => {
    const { data, error } = await admin
      .from("ow_conversation_participants")
      .select("id, user_id")
      .eq("conversation_id", conversationId)
      .in("user_id", ids);
    return { rows: (data ?? []) as { id: string; user_id: string }[], error };
  };

  const first = await read();
  /* ⚠️ error を捨てない。捨てると権限エラーが「参加者が居ない」に化け、
        そのまま重複 INSERT に進む。 */
  if (first.error) {
    console.error("[conversations/participants] 既存の取得:", first.error.message);
    return { ok: false, error: "参加者の取得に失敗しました", status: 500 };
  }

  const byUserId = new Map(first.rows.map((p) => [p.user_id, p.id]));
  const missing = ids.filter((id) => !byUserId.has(id));

  if (missing.length > 0) {
    /* ⚠️ 0行 INSERT を成功として扱わない（lib/supabase/mutate.ts）。 */
    const r = await mutateMany(
      admin.from("ow_conversation_participants").insert(
        missing.map((user_id) => ({
          conversation_id: conversationId,
          user_id,
          role: DM_PARTICIPANT_ROLE,
        })),
      ),
      "DM 参加者の作成",
    );
    if (!r.ok) {
      console.error("[conversations/participants] 作成:", r.error);
      return { ok: false, error: "参加者の登録に失敗しました", status: r.status };
    }

    // 採番された id を取り直す（mutateMany は件数しか返さない）
    const again = await read();
    if (again.error) {
      console.error("[conversations/participants] 再取得:", again.error.message);
      return { ok: false, error: "参加者の取得に失敗しました", status: 500 };
    }
    for (const p of again.rows) byUserId.set(p.user_id, p.id);
  }

  return { ok: true, byUserId };
}
