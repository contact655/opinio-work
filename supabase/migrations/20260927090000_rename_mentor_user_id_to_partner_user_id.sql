-- ★ow_conversations.mentor_user_id を partner_user_id に改名する（2026-09-27 / 柴さんの指示）
--
-- 列名だけがメンターの名残だった。中身は「`candidate_user_id`（始めた人）に対する**相手**」で、
--   kind='company'         → null（相手は company_id）
--   kind='direct_message'  → DM の相手
-- 実測（2026-09-27 / 本番）: 3件中2件が値を持つ **現役の列**。
--
-- ⚠️★**これは DROP ではない。動いている列の改名なので、本番が一時的に壊れる。**
--    適用した瞬間、デプロイ済みの古いコードが `mentor_user_id` を select して 400 を返す。
--    /mypage/conversations（一覧・詳細）と /api/dm/*（4本）が、
--    **新しいコードのデプロイが終わるまで**動かない。
--    → **この migration は、コードを push できる状態にしてから当てること。**
--
-- ⚠️ `create_conversation` RPC は**この migration の中で直している**ので、
--    応募・スカウト返信・カジュアル面談・根拠つき提案の紹介は影響を受けない。
--
-- ⚠️★**RENAME COLUMN が自動で追随するもの / しないもの**
--      追随する … CHECK（ow_conversations_kind_consistency）/ UNIQUE
--                 （ow_conversations_unique_per_relation）/ FK / RLS ポリシー
--                 （ow_conversations_select）/ 索引。**定義はパース済みで持つため。**
--                 ⚠️ ただし**名前は古い文字列のまま残る**ので、下で改名している。
--      追随しない … ★**関数の本文**（PL/pgSQL は本文がただのテキスト）。
--                 `create_conversation` が3箇所で参照しており、放置すると
--                 **呼ぶまで壊れたと分からない**（CLAUDE.md「関数の中で UPDATE ow_xxx と
--                 書いてあっても DROP TABLE は成功し、実際に呼ぶまで分からない」と同じ形）。
--
-- ⚠️★**引数名 `p_mentor_user_id` は変えない。** Postgres は `CREATE OR REPLACE` で
--    引数名を変えられない（cannot change name of input parameter）。
--    変えるには DROP が要るが、**`DROP FUNCTION` は禁止**（スカウト・応募・面談・提案が依存。
--    CLAUDE.md）。列名と引数名がずれるが、承知のうえ。
--
-- ⚠️★**関数の中身は列名以外いっさい変えていない。** 2026-09-21 に入れた
--    service_role の素通し（`auth.role()` を見る。`current_user` ではない）も、
--    kind='mentor' の分岐も**そのまま**。分岐の整理は別の判断。

do $$
declare
  n bigint;
begin
  -- ⚠️ 旧名が無ければ（＝既に当たっている）何もせず抜ける、ではなく**落とす**。
  --    二重適用に気づけないまま進むより、失敗させたい。
  if not exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='ow_conversations'
       and column_name='mentor_user_id'
  ) then
    raise exception 'ow_conversations.mentor_user_id が無い。既に改名されている可能性がある';
  end if;

  select count(*) into n from public.ow_conversations;
  raise notice 'ow_conversations の行数: %（改名しても行は動かない）', n;
end $$;

alter table public.ow_conversations rename column mentor_user_id to partner_user_id;

-- ⚠️ 定義は自動で追随するが、名前は古いままなので揃える。
alter table public.ow_conversations
  rename constraint ow_conversations_mentor_user_id_fkey to ow_conversations_partner_user_id_fkey;
alter index public.idx_ow_conversations_mentor_last_message
  rename to idx_ow_conversations_partner_last_message;

-- ★関数の本文を差し替える。⚠️ 列名3箇所だけを直してある（INSERT の列 / ON CONFLICT /
--    既存を引く WHERE）。引数名・エラーメッセージ・分岐は元のまま。
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
  -- ⚠️ 2026-09-27: mentor_user_id → partner_user_id（列名だけの変更）
  INSERT INTO ow_conversations (
    kind, stage, company_id, partner_user_id, candidate_user_id
  ) VALUES (
    p_kind, v_stage, p_company_id, p_mentor_user_id, p_candidate_user_id
  )
  ON CONFLICT (kind, company_id, partner_user_id, candidate_user_id) DO NOTHING
  RETURNING id INTO v_conversation_id;

  -- 既存対話あり(ON CONFLICT 発火)の場合、SELECT で取得
  IF v_conversation_id IS NULL THEN
    SELECT id INTO v_conversation_id
    FROM ow_conversations
    WHERE kind = p_kind
      AND company_id IS NOT DISTINCT FROM p_company_id
      AND partner_user_id IS NOT DISTINCT FROM p_mentor_user_id
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

comment on column public.ow_conversations.partner_user_id is
  '相手（candidate_user_id の反対側）。kind=company なら null（相手は company_id）、kind=direct_message なら DM の相手。2026-09-27 に mentor_user_id から改名（メンター機能は存在しない）。';
