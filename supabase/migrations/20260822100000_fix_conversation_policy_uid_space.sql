-- ============================================================================
-- 会話まわりの RLS ポリシー：auth.uid() と ow_users.id の空間取り違えを直す
--
-- 2026-08-21 に有料プランの調査中に見つけた。**どちらも fail-closed** なので
-- 情報漏洩ではないが、「動いているつもりで動いていない」形で残っていた。
--
-- ── 何が起きていたか ────────────────────────────────────────────────────
-- 次の2列はどちらも FK が `ow_users` を指す（＝ow_users.id 空間）:
--     ow_conversation_participants.user_id  -> ow_users.id
--     ow_conversations.candidate_user_id    -> ow_users.id
-- ところが下の2ポリシーだけが、これを `auth.uid()`（= auth.users.id 空間）と
-- 直接比較していた。**値が一致することは無いので、その分岐は常に false。**
--
--   ow_conversation_messages_update … 本人によるメッセージ編集ができない
--                                     （運営の分岐だけが生きていた）
--   ow_conversations_insert         … 求職者が自分で会話を作れない
--                                     （実際の作成は create_conversation()
--                                       = SECURITY DEFINER を通るので実害は無かった）
--
-- 同じ表の SELECT / INSERT ポリシーは正しく ow_users を経由して書かれており、
-- **UPDATE と INSERT の2本だけが崩れていた。**
--
-- ⚠️ 3テーブル9ポリシーを機械的に走査して、取り違えはこの2本だけと確認済み。
--    （`ow_conversations` / `ow_conversation_participants` /
--      `ow_conversation_messages`。`ow_conversation_reads` は存在しない）
--
-- ── 書き方 ──────────────────────────────────────────────────────────────
-- docs/user-id-spaces.md のとおり、ow_users.id 空間は
-- **`public.auth_ow_user_id()`** を使う。自前で ow_users を JOIN しない。
-- admin 判定は `ow_user_roles.user_id` が auth 空間なので
-- **`public.auth_is_admin()`** を使う（こちらは元のままでも正しかったが、
-- 同じ式を2回書かないためヘルパーに寄せる）。
--
-- ── 復元用（元に戻す場合）────────────────────────────────────────────────
-- DROP POLICY ow_conversation_messages_update ON public.ow_conversation_messages;
-- CREATE POLICY ow_conversation_messages_update ON public.ow_conversation_messages
--   FOR UPDATE USING (
--     EXISTS (SELECT 1 FROM ow_conversation_participants
--              WHERE id = ow_conversation_messages.sender_participant_id
--                AND user_id = auth.uid() AND left_at IS NULL)
--     OR EXISTS (SELECT 1 FROM ow_user_roles
--                 WHERE user_id = auth.uid() AND role = 'admin')
--   );
-- DROP POLICY ow_conversations_insert ON public.ow_conversations;
-- CREATE POLICY ow_conversations_insert ON public.ow_conversations
--   FOR INSERT WITH CHECK (
--     candidate_user_id = auth.uid()
--     OR EXISTS (SELECT 1 FROM ow_user_roles
--                 WHERE user_id = auth.uid() AND role = 'admin')
--   );
-- ============================================================================

-- ── ① ow_conversation_messages_update ───────────────────────────────────────
-- 自分が送ったメッセージだけを編集できる。参加を抜けた（left_at）後は不可。
DROP POLICY IF EXISTS ow_conversation_messages_update ON public.ow_conversation_messages;

CREATE POLICY ow_conversation_messages_update
  ON public.ow_conversation_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
        FROM public.ow_conversation_participants p
       WHERE p.id = ow_conversation_messages.sender_participant_id
         AND p.user_id = public.auth_ow_user_id()   -- ★ ow_users 空間
         AND p.left_at IS NULL
    )
    OR public.auth_is_admin()
  );

-- ── ② ow_conversations_insert ───────────────────────────────────────────────
-- 求職者が自分を候補者とする会話を作れる。
-- ⚠️ 実際の作成経路は create_conversation()（SECURITY DEFINER）で、
--    そちらは「p_ow_user_id が auth.uid() と一致するか」を関数内で確認している。
--    このポリシーは PostgREST から直接 INSERT された場合の防波堤。
DROP POLICY IF EXISTS ow_conversations_insert ON public.ow_conversations;

CREATE POLICY ow_conversations_insert
  ON public.ow_conversations
  FOR INSERT
  WITH CHECK (
    candidate_user_id = public.auth_ow_user_id()    -- ★ ow_users 空間
    OR public.auth_is_admin()
  );

-- ── 検算：ow_users 空間の列を auth.uid() と直接比べているポリシーが残っていないか ──
DO $$
DECLARE
  bad int;
BEGIN
  SELECT count(*) INTO bad
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
   WHERE c.relnamespace = 'public'::regnamespace
     AND c.relname IN ('ow_conversations','ow_conversation_participants','ow_conversation_messages')
     AND (coalesce(pg_get_expr(p.polqual, p.polrelid), '') || ' ' ||
          coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''))
         ~ '(candidate_user_id|mentor_user_id|\mp\.user_id|ow_conversation_participants\.user_id)\s*=\s*auth\.uid\(\)';

  IF bad > 0 THEN
    RAISE EXCEPTION '空間取り違えのポリシーが % 本残っている', bad;
  END IF;
END $$;
