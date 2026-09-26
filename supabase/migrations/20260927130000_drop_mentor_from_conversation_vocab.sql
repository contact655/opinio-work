-- ★会話まわりの語彙から 'mentor' を外す（2026-09-27 / 柴さんの指示）。**5箇所まとめて。**
--
-- メンター機能は存在しない。TS 側は既に落としてある（`kind: "mentor"` を渡す呼び出しは
-- 0件・作る経路も無い・表示の分岐も削除済み）。**残っていたのは DB の許容値だけ。**
--
-- ⚠️★**まとめてやる理由。** 3つの CHECK は互いに整合している ——
--    `kind='mentor'` なら `stage` は `mediated`/`direct`、参加者の `role` に `mentor`。
--    **片方だけ外すと整合が崩れる**（例: kind から外して stage に残すと、
--    到達しない枝が残り、次に読む人が「まだ使うのか」と迷う）。
--
-- ⚠️ 作業前ダンプ: .dumps/ の ow_conversations / ow_conversation_participants（同日）
--
-- 実測（2026-09-27 / 本番）: すべて **0件**
--    kind='mentor' 0 ／ stage in ('mediated','direct') 0 ／ role='mentor' 0
--    内訳: kind = direct_message:2 / company:1 ／ stage = active:3 ／ role = candidate:3
--
-- ⚠️ これは**狭める**変更なので順序の制約は無い。古いコードが 'mentor' を送っても
--    23514 で弾かれるだけで、実際に送る経路が存在しない。
--
-- ⚠️★**RPC は `CREATE OR REPLACE`。引数は1つも変えないので窓はできない。**
--    引数 `p_partner_user_id` は**残す**（`kind='company'` では null であることを
--    引き続き検証する）。消すには `DROP FUNCTION` ＝ 署名の変更が要り、
--    **PostgREST の契約が変わってまた窓ができる**ため。

do $$
declare
  n_kind bigint; n_stage bigint; n_role bigint;
begin
  select count(*) into n_kind  from public.ow_conversations where kind = 'mentor';
  select count(*) into n_stage from public.ow_conversations where stage in ('mediated','direct');
  select count(*) into n_role  from public.ow_conversation_participants where role = 'mentor';
  -- ⚠️ 1行でもあれば中止する。CHECK を狭めると、その行は
  --    「制約に違反しているのに存在する」状態になり、ALTER が必ず落ちる。
  if n_kind <> 0 or n_stage <> 0 or n_role <> 0 then
    raise exception
      'mentor 由来の行が残っている（kind=% / stage=% / role=%）。中止する', n_kind, n_stage, n_role;
  end if;
end $$;

-- ① kind の許容値
alter table public.ow_conversations drop constraint ow_conversations_kind_check;
alter table public.ow_conversations add constraint ow_conversations_kind_check
  check (kind = any (array['company'::text, 'editor'::text, 'direct_message'::text]));

-- ② kind と相手の整合（`partner_user_id` は 20260927090000 で改名済み）
alter table public.ow_conversations drop constraint ow_conversations_kind_consistency;
alter table public.ow_conversations add constraint ow_conversations_kind_consistency
  check (
    ((kind = 'company'::text)        and (company_id is not null) and (partner_user_id is null))
    or ((kind = 'editor'::text)         and (company_id is null)     and (partner_user_id is null))
    or ((kind = 'direct_message'::text) and (company_id is null)     and (partner_user_id is not null))
  );

-- ③ kind と stage の整合
--    ⚠️ 'mediated' と 'direct' は kind='mentor' 専用だったので、一緒に消える。
alter table public.ow_conversations drop constraint ow_conversations_stage_consistency;
alter table public.ow_conversations add constraint ow_conversations_stage_consistency
  check (
    ((kind = 'company'::text)        and (stage = 'active'::text))
    or ((kind = 'editor'::text)         and (stage = 'active'::text))
    or ((kind = 'direct_message'::text) and (stage = 'active'::text))
  );

-- ④ 参加者の role
alter table public.ow_conversation_participants drop constraint ow_conversation_participants_role_check;
alter table public.ow_conversation_participants add constraint ow_conversation_participants_role_check
  check (role = any (array['candidate'::text, 'company_admin'::text, 'editor'::text, 'operator'::text]));

-- ⑤ RPC の分岐。⚠️ CREATE OR REPLACE（引数は1つも変えない＝窓ができない）。
--    ⚠️★`DROP FUNCTION` を使わないこと。ここは引数を変えていないので使う理由が無い。
create or replace function public.create_conversation(
  p_kind text,
  p_candidate_user_id uuid,
  p_company_id uuid default null::uuid,
  p_partner_user_id uuid default null::uuid
)
returns table(conversation_id uuid, created boolean)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_conversation_id UUID;
  v_created         BOOLEAN;
BEGIN
  -- 再認証チェック
  -- ★service_role（サーバーの API ルート）だけ素通しする。
  --   ⚠️ current_user ではなく auth.role() を見る（SECURITY DEFINER の中では
  --      current_user が所有者に化けるため）。
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
  -- ⚠️★2026-09-27: kind='mentor' の枝を外した。この関数が作れるのは 'company' だけ。
  --    ⚠️ direct_message は**この関数を通らない**（/api/dm/start が直接 INSERT する）。
  --       ここに足す前に、あちらと重複しないかを確かめること。
  IF p_kind <> 'company' THEN
    RAISE EXCEPTION 'invalid kind: %', p_kind USING ERRCODE = '22023';
  END IF;

  IF p_candidate_user_id IS NULL THEN
    RAISE EXCEPTION 'candidate_user_id must not be null' USING ERRCODE = '22023';
  END IF;

  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id must be set when kind=company' USING ERRCODE = '22023';
  END IF;

  -- ⚠️ 引数は残してある（署名を変えると PostgREST の契約が変わり窓ができるため）。
  --    kind='company' では必ず null であることを引き続き検証する。
  IF p_partner_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'partner_user_id must be null when kind=company' USING ERRCODE = '22023';
  END IF;

  -- ow_conversations への INSERT (ON CONFLICT DO NOTHING)
  -- ⚠️ stage は 'active' 固定（kind='company' の整合 CHECK がそれを要求する）。
  INSERT INTO ow_conversations (
    kind, stage, company_id, partner_user_id, candidate_user_id
  ) VALUES (
    p_kind, 'active', p_company_id, p_partner_user_id, p_candidate_user_id
  )
  ON CONFLICT (kind, company_id, partner_user_id, candidate_user_id) DO NOTHING
  RETURNING id INTO v_conversation_id;

  -- 既存対話あり(ON CONFLICT 発火)の場合、SELECT で取得
  IF v_conversation_id IS NULL THEN
    SELECT id INTO v_conversation_id
    FROM ow_conversations
    WHERE kind = p_kind
      AND company_id IS NOT DISTINCT FROM p_company_id
      AND partner_user_id IS NOT DISTINCT FROM p_partner_user_id
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

-- ⚠️★`CREATE OR REPLACE` は GRANT を保つ（DROP と違う）。念のため検算する。
do $$
declare
  acl text;
  n_ct bigint;
begin
  select coalesce(array_to_string(proacl,' | '),'(既定のまま)') into acl
    from pg_proc where pronamespace='public'::regnamespace and proname='create_conversation';
  if acl not like '%authenticated=X%' or acl not like '%service_role=X%' then
    raise exception 'create_conversation の GRANT が失われている: %', acl;
  end if;

  select count(*) into n_ct from pg_constraint
   where connamespace='public'::regnamespace and pg_get_constraintdef(oid) ~ '\mmentor\M';
  if n_ct <> 0 then
    raise exception 'mentor を含む制約が % 本残っている', n_ct;
  end if;

  -- ⚠️★**行コメントを落としてから照合する**（CLAUDE.md にそう書いてあるのに、
  --    2026-09-27 に**実際に踏んだ** ——上の「kind='mentor' の枝を外した」という
  --    注意書き自身に当たって、この migration が一度まるごとロールバックした）。
  --    ⚠️ `.claude/rules/ui-debugging.md` ⑱「計測の対象に、自分が書いた注意書きを
  --       混ぜない」と同じ形。**この regexp_replace を外さないこと。**
  if exists (
    select 1 from pg_proc
     where pronamespace='public'::regnamespace and proname='create_conversation'
       and regexp_replace(prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ '\mmentor\M'
  ) then
    raise exception 'create_conversation の本体に mentor が残っている（コメントは除く）';
  end if;

  raise notice 'mentor を含む制約 0本 / 関数にも無し / ACL: %', acl;
end $$;
