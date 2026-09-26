-- ★create_conversation の引数 p_mentor_user_id を p_partner_user_id に改名する
--   （2026-09-27 / 柴さんの指示）
--
-- 列は 20260927090000 で mentor_user_id → partner_user_id に改名済み。
-- 引数名だけが残っていた。`CREATE OR REPLACE` では引数名を変えられない
-- （cannot change name of input parameter）ので、**DROP + CREATE が要る。**
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️★★CLAUDE.md の「`DROP FUNCTION` を使わない」の**例外**。理由を残す。
-- ═══════════════════════════════════════════════════════════════════════════
-- あの規則の根拠は2種類あり、**重さが違う**:
--   ① `handle_new_ow_user` … **トリガーが依存**。CASCADE で落とすと
--      `on_auth_user_created` ごと消え、**サインアップで ow_users が作られなくなる。**
--      → こちらは本当に落としてはいけない。
--   ② `create_conversation` … 「スカウト・応募・面談が依存」＝**呼び出し側**の話。
--      → DB オブジェクトの依存は実測で **0**（トリガー0 / 他の関数から0 / ビュー0）。
--        CASCADE で道連れになるものが無い。
-- 今回は②で、**1トランザクションの中で DROP → CREATE → GRANT 復元**まで行うので、
-- 関数が存在しない瞬間は外から観測されない。
--
-- ⚠️★**①（`handle_new_ow_user`）には、この例外を広げないこと。**
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️★★DROP すると GRANT が消える。**戻し忘れると全経路が 42501 になる。**
-- ═══════════════════════════════════════════════════════════════════════════
-- 落とす前の ACL（実測 2026-09-27）:
--   postgres=X/postgres | authenticated=X/postgres | service_role=X/postgres
--   ＝ **anon には EXECUTE が無い。**
-- ⚠️★さらに、**新しく作った関数は PUBLIC に EXECUTE が付く**（Postgres の既定）。
--    そのままだと anon も実行できてしまうので、**revoke してから grant し直す。**
--    （この関数は SECURITY DEFINER。中で auth.uid() を見るので anon なら弾かれるが、
--      **元の ACL と同じ形に戻すのが筋。**）
--
-- ⚠️★**本番に窓ができる。** 引数名は PostgREST の呼び出し契約なので、当てた瞬間
--    デプロイ済みの古いコードが `p_mentor_user_id` を送って **PGRST202** になる。
--    ⚠️ 前回（列の改名）と違い、**壊れ方が静か** ——応募・スカウト返信・カジュアル面談・
--       提案の紹介は、会話の作成を `try/catch` で握って本体は成功扱いにする方針なので、
--       窓のあいだは「応募はできたのに会話が無い」行が残りうる。
--    → **コードを commit できる状態にしてから当てること。**
--
-- ⚠️ 関数の中身は**引数名とエラー文言以外いっさい変えていない。**
--    2026-09-21 の service_role 素通し（`auth.role()` を見る。`current_user` ではない）も、
--    kind='mentor' の分岐もそのまま。分岐の整理は別の判断。

do $$
begin
  -- ⚠️★`pg_get_function_identity_arguments` は**引数名を含む**
  --    （'p_kind text, p_candidate_user_id uuid, …'）。型だけの文字列と比べると
  --    必ず外れる。**実際に一度これで止まった**ので、`regprocedure` で比べる。
  if not exists (
    select 1 from pg_proc p
     where p.pronamespace='public'::regnamespace
       and p.oid::regprocedure::text = 'create_conversation(text,uuid,uuid,uuid)'
       -- ⚠️ 旧引数名があることまで確かめる（二重適用に気づけないまま進まないため）
       and pg_get_function_identity_arguments(p.oid) ~ '\mp_mentor_user_id\M'
  ) then
    raise exception 'create_conversation(text,uuid,uuid,uuid) が p_mentor_user_id を持っていない。想定と違うので中止する';
  end if;

  -- ⚠️ DB オブジェクトの依存が増えていたら中止する（CASCADE で巻き込まないため）。
  if exists (
    select 1 from pg_trigger t
     join pg_proc p on p.oid = t.tgfoid
    where p.pronamespace='public'::regnamespace and p.proname='create_conversation'
  ) then
    raise exception 'create_conversation に依存するトリガーがある。DROP を中止する';
  end if;
end $$;

drop function public.create_conversation(text, uuid, uuid, uuid);

create function public.create_conversation(
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
  v_stage           text;
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
    IF p_partner_user_id IS NOT NULL THEN
      RAISE EXCEPTION 'partner_user_id must be null when kind=company' USING ERRCODE = '22023';
    END IF;
  ELSIF p_kind = 'mentor' THEN
    IF p_partner_user_id IS NULL THEN
      RAISE EXCEPTION 'partner_user_id must be set when kind=mentor' USING ERRCODE = '22023';
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
    kind, stage, company_id, partner_user_id, candidate_user_id
  ) VALUES (
    p_kind, v_stage, p_company_id, p_partner_user_id, p_candidate_user_id
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

-- ★★GRANT を元の形に戻す。⚠️ この3行を消さないこと。
--    revoke を先に書くのは、**新しい関数には PUBLIC の EXECUTE が既定で付く**ため。
revoke all on function public.create_conversation(text, uuid, uuid, uuid) from public;
grant execute on function public.create_conversation(text, uuid, uuid, uuid) to authenticated;
grant execute on function public.create_conversation(text, uuid, uuid, uuid) to service_role;

-- ⚠️ 戻し忘れを次の人が見つけられるように、ここで検算する。
do $$
declare
  acl text;
begin
  select coalesce(array_to_string(proacl, ' | '), '(既定のまま)') into acl
    from pg_proc
   where pronamespace='public'::regnamespace and proname='create_conversation';
  if acl not like '%authenticated=X%' or acl not like '%service_role=X%' then
    raise exception 'GRANT の復元に失敗した: %', acl;
  end if;
  if acl like '%=X/postgres | =X%' or acl like '%| =X/%' then
    raise exception 'PUBLIC に EXECUTE が残っている: %', acl;
  end if;
  raise notice 'create_conversation の ACL: %', acl;
end $$;
