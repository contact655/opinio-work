import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 対話生成の入力。**`kind='company'` だけ**（候補者1人 ↔ 企業1社）。
 *
 * ⚠️★`kind='mentor'` の枝は 2026-09-27 に削除した。**戻さないこと。**
 *    メンター機能は存在しない —— `ow_mentors` は DROP 済み、`kind='mentor'` の会話は
 *    **本番0件**、呼び出し元も0件で、呼ぶ予定だった `/api/mentor-reservations` も
 *    **存在しない**（「Phase ν-5 で呼ばれる予定(P4)」と書かれたまま残っていた）。
 *
 * ⚠️★**このラッパーは `direct_message` を作らない。** DM の会話は別の経路で作られる。
 *    ここに `kind` を増やす前に、その経路と重複しないかを確かめること。
 *
 * ⚠️ `kind` のフィールド自体は残してある。RPC が `p_kind` を取るので、
 *    呼び出し側に何の会話かを書かせたままにしておく（呼び出し元4つとも `"company"`）。
 */
export type CreateConversationInput = {
  kind: "company";
  candidateUserId: string; // ow_users.id
  companyId: string; // ow_companies.id
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
  /* ⚠️★`p_mentor_user_id` は null でも**必ず渡す**。RPC は引数の名前と数で解決されるので、
        落とすと関数が見つからず **PGRST202** になる（CLAUDE.md「RPC は引数名が違うだけで
        404 になる」）。⚠️ DB の `create_conversation` は触っていない。 */
  const params = {
    p_kind: "company",
    p_candidate_user_id: input.candidateUserId,
    p_company_id: input.companyId,
    p_mentor_user_id: null,
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
