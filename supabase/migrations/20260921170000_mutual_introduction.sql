-- ═══════════════════════════════════════════════════════════════════════════
-- ③ 双方合意の紹介 — service_role の素通しと、紹介した記録（2026-09-21）
--
-- 背景は [docs/proposals-mutual-20260921.md](../../docs/proposals-mutual-20260921.md)。
--
-- ⚠️ **追加と緩和のみ。** 既存の列・ポリシー・GRANT には触らない。
--
-- ── ★なぜ素通しが要るか ────────────────────────────────────────────────────
-- `create_conversation` は SECURITY DEFINER で、冒頭で
-- 「`p_candidate_user_id` の `auth_id` が `auth.uid()` と一致すること」を要求する。
-- ③の紹介は **mutual が成立した瞬間にサーバー側（service_role）が作る**ので、
-- **最後に答えたのが企業だと `auth.uid()` は企業管理者のもの**になり、
-- **必ず 42501 で落ちる。** mutual は「最後に答えたほう」で成立するため、
-- **半分のケースで紹介が失敗する。**
--
-- ⚠️★**`current_user = 'service_role'` は使えない。**
--    この関数は SECURITY DEFINER なので `current_user` が**所有者に化ける**
--    （`guard_member_consent` のコメントが明言している）。
--    `guard_job_status_transition` / `guard_company_approval` が
--    `current_user` を見られるのは、あちらが SECURITY INVOKER のトリガーだから。
--    **ここでは `auth.role()`**（PostgREST が検証済み JWT から入れる GUC）を見る。
--    ⚠️ 利用者は JWT を偽造できないので、authenticated から 'service_role' にはならない。
--
-- ⚠️★**素通しの範囲を広げないこと。** 飛ばすのは「候補者本人か」の確認だけで、
--    引数の整合性チェック・stage の決定・ON CONFLICT は**そのまま通る**。
--
-- ⚠️★**`DROP FUNCTION` を使わない。** `ow_conversations` を作る経路が依存しており、
--    CASCADE で落とすと**スカウトの返答・応募・面談から会話が作られなくなる。**
--    常に `CREATE OR REPLACE`。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── ① create_conversation に service_role の素通しを足す ────────────────────

create or replace function public.create_conversation(
  p_kind text,
  p_candidate_user_id uuid,
  p_company_id uuid default null::uuid,
  p_mentor_user_id uuid default null::uuid
)
returns table(conversation_id uuid, created boolean)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_conversation_id UUID;
  v_created         BOOLEAN;
  v_stage           text;
BEGIN
  -- 再認証チェック
  -- ★service_role（サーバーの API ルート）だけ素通しする。
  --   ⚠️ current_user ではなく auth.role() を見る（冒頭の注記を読むこと）。
  --   ⚠️ 素通しする側は、呼び出し元が「誰のために作るか」を必ず確かめること。
  --      ③は ow_proposals の行（candidate_user_id / company_id）から組み立てている。
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM ow_users
      WHERE id = p_candidate_user_id
        AND auth_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'unauthorized: candidate_user_id does not match auth.uid()'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 引数整合性チェック（★素通しの対象外。service_role でも必ず通る）
  IF p_kind NOT IN ('company', 'mentor') THEN
    RAISE EXCEPTION 'invalid kind: %', p_kind USING ERRCODE = '22023';
  END IF;

  IF p_candidate_user_id IS NULL THEN
    RAISE EXCEPTION 'candidate_user_id must not be null' USING ERRCODE = '22023';
  END IF;

  IF p_kind = 'company' THEN
    IF p_company_id IS NULL THEN
      RAISE EXCEPTION 'company_id must be set when kind=company' USING ERRCODE = '22023';
    END IF;
    IF p_mentor_user_id IS NOT NULL THEN
      RAISE EXCEPTION 'mentor_user_id must be null when kind=company' USING ERRCODE = '22023';
    END IF;
  ELSIF p_kind = 'mentor' THEN
    IF p_mentor_user_id IS NULL THEN
      RAISE EXCEPTION 'mentor_user_id must be set when kind=mentor' USING ERRCODE = '22023';
    END IF;
    IF p_company_id IS NOT NULL THEN
      RAISE EXCEPTION 'company_id must be null when kind=mentor' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- stage を kind から自動決定
  v_stage := CASE p_kind
    WHEN 'company' THEN 'active'
    WHEN 'mentor'  THEN 'mediated'
  END;

  -- ow_conversations への INSERT (ON CONFLICT DO NOTHING)
  INSERT INTO ow_conversations (
    kind, stage, company_id, mentor_user_id, candidate_user_id
  ) VALUES (
    p_kind, v_stage, p_company_id, p_mentor_user_id, p_candidate_user_id
  )
  ON CONFLICT (kind, company_id, mentor_user_id, candidate_user_id) DO NOTHING
  RETURNING id INTO v_conversation_id;

  -- 既存対話あり(ON CONFLICT 発火)の場合、SELECT で取得
  IF v_conversation_id IS NULL THEN
    SELECT id INTO v_conversation_id
    FROM ow_conversations
    WHERE kind = p_kind
      AND company_id IS NOT DISTINCT FROM p_company_id
      AND mentor_user_id IS NOT DISTINCT FROM p_mentor_user_id
      AND candidate_user_id = p_candidate_user_id;

    v_created := false;
  ELSE
    v_created := true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM ow_conversation_participants p
    WHERE p.conversation_id = v_conversation_id
      AND p.user_id = p_candidate_user_id
      AND p.left_at IS NULL
  ) THEN
    INSERT INTO ow_conversation_participants (conversation_id, user_id, role)
    VALUES (v_conversation_id, p_candidate_user_id, 'candidate');
  END IF;

  RETURN QUERY SELECT v_conversation_id, v_created;
END;
$function$;

comment on function public.create_conversation(text, uuid, uuid, uuid) is
  '対話を作る（冪等）。★service_role だけ「候補者本人か」の確認を素通しする（③の紹介はサーバーが作るため）。⚠ SECURITY DEFINER なので current_user は使えない。auth.role() を見ている。⚠ DROP せず CREATE OR REPLACE すること（スカウト・応募・面談が依存）。';

-- ── ② 紹介した記録 ─────────────────────────────────────────────────────────
-- ⚠️★**これは「段」ではない。** 段は candidate_response / company_response から
--    `proposalStage()` が導出する（列で持たない）。ここに入れるのは
--    **副作用を1回だけにするための記録**。
-- ⚠️ 2列に CHECK を張らない。`conversation_id` は ON DELETE SET NULL なので、
--    会話が消えた日に「introduced_at はあるのに conversation_id が null」になる。
--    **CHECK を張ると、その DELETE が落ちる。** 正は `introduced_at`。

alter table public.ow_proposals
  add column if not exists conversation_id uuid references public.ow_conversations(id) on delete set null,
  add column if not exists introduced_at   timestamptz;

comment on column public.ow_proposals.introduced_at is
  '★双方合意で紹介した日時。これが「もう紹介した」の正（通知とメールを二重に出さないための記録）。⚠ 段ではない（段は2つの response から導出）';
comment on column public.ow_proposals.conversation_id is
  '紹介で作った会話。⚠ ON DELETE SET NULL なので null になりうる。「紹介したか」の判定には introduced_at を使うこと';

-- ⚠️ GRANT は足さない。`ow_proposals` は authenticated に**テーブルレベル**の SELECT が
--    あるので、追加した2列はそのまま読める（列単位で配っている表ではない）。
--    UPDATE は誰にも配っていない（書き込みは service_role だけ）。実測で確かめること。

-- ── ③ 適用後のアサート ─────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='ow_proposals'
       AND column_name IN ('conversation_id','introduced_at')
     HAVING count(*) = 2
  ) THEN
    RAISE EXCEPTION '列の追加に失敗している';
  END IF;

  IF position('service_role' in pg_get_functiondef('public.create_conversation(text,uuid,uuid,uuid)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'create_conversation に素通しが入っていない';
  END IF;

  -- ★素通しを足しても、本人確認そのものは残っていること
  IF position('does not match auth.uid()' in pg_get_functiondef('public.create_conversation(text,uuid,uuid,uuid)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'create_conversation から本人確認が消えている';
  END IF;
END $$;

COMMIT;
