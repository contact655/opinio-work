import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 対話生成の入力。kind ごとに必須引数が分岐する discriminated union。
 *
 * - kind='company': companyId 必須、mentorUserId は使わない
 * - kind='mentor':  mentorUserId 必須、companyId は使わない
 *
 * Phase ν-3 Step 1 では kind='company' のみ使用される。
 * kind='mentor' は Phase ν-5 で /api/mentor-reservations から呼ばれる予定(P4)。
 */
export type CreateConversationInput =
  | {
      kind: "company";
      candidateUserId: string; // ow_users.id
      companyId: string; // ow_companies.id
    }
  | {
      kind: "mentor";
      candidateUserId: string; // ow_users.id
      mentorUserId: string; // ow_users.id (Phase ν-5 まで呼ばれない)
    };

export type CreateConversationResult = {
  conversationId: string; // ow_conversations.id
  created: boolean; // true=新規作成、false=既存対話を返した
};

/**
 * 対話を生成する RPC ラッパー(Phase ν-3 Step 1: F の実装)。
 *
 * migration 063 の create_conversation() RPC を呼び出す。
 * RPC は SECURITY DEFINER で動作し、内部で auth.uid() による再認証を実施。
 *
 * 失敗時は throw する。呼び出し元(API ハンドラ)は Y2 ポリシーに従い、
 * try/catch でログ出力のみ実施し、メインの操作(応募/カジュアル面談)は
 * 成功扱いとすること。
 *
 * @throws {Error} RPC 呼び出し失敗時(認証エラー、引数エラー、DB エラー等)
 */
export async function createConversation(
  supabase: SupabaseClient,
  input: CreateConversationInput
): Promise<CreateConversationResult> {
  const params =
    input.kind === "company"
      ? {
          p_kind: "company",
          p_candidate_user_id: input.candidateUserId,
          p_company_id: input.companyId,
          p_mentor_user_id: null,
        }
      : {
          p_kind: "mentor",
          p_candidate_user_id: input.candidateUserId,
          p_company_id: null,
          p_mentor_user_id: input.mentorUserId,
        };

  const { data, error } = await supabase.rpc("create_conversation", params);

  if (error) {
    throw new Error(
      `createConversation RPC failed: ${error.message} (code: ${error.code})`
    );
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    throw new Error("createConversation RPC returned empty result");
  }

  // RPC は TABLE(conversation_id UUID, created BOOLEAN) を返す
  // Supabase の rpc() は配列で受け取る
  const row = data[0] as { conversation_id: string; created: boolean };
  if (!row.conversation_id || typeof row.created !== "boolean") {
    throw new Error(
      `createConversation RPC returned malformed result: ${JSON.stringify(row)}`
    );
  }

  return {
    conversationId: row.conversation_id,
    created: row.created,
  };
}
