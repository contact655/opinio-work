-- このファイルは 2026-07-27 時点の本番スキーマのダンプです。
-- 用途: 今後の migration の起点（baseline）
-- 検証: Supabase Branch に適用し、本番との round-trip diff で
--       テーブル/RLSポリシー/インデックス/関数/トリガー/ビューの一致を確認済み
-- 既知の差分（許容）:
--   - ALTER SCHEMA "public" OWNER TO "postgres"
--   - GRANT USAGE ON SCHEMA "public" TO "postgres"
--     ／REVOKE USAGE ON SCHEMA "public" FROM PUBLIC
--   いずれも public スキーマのオーナー・権限メタ設定であり、
--   Supabase 環境が作成時に設定するもの
-- 注意: 災害復旧用の完全な復元アーティファクトとしては未検証。
--       スキーマレベルの権限設定は完全には再現されない
--
-- PostgreSQL database dump
--

-- \restrict PB5X0Jt3acttNdcKTLa5GnKI0belmK5dvSSeSSeP3FQ0iXXcA9sg5P7b43OobN0

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
-- SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "pg_stat_statements"; Type: COMMENT; Schema: -; Owner: 
--

-- COMMENT ON EXTENSION "pg_stat_statements" IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "pgcrypto"; Type: COMMENT; Schema: -; Owner: 
--

-- COMMENT ON EXTENSION "pgcrypto" IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";


--
-- Name: EXTENSION "supabase_vault"; Type: COMMENT; Schema: -; Owner: 
--

-- COMMENT ON EXTENSION "supabase_vault" IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

-- COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: engagement_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."engagement_status_enum" AS ENUM (
    'none',
    'verified',
    'contracted'
);


ALTER TYPE "public"."engagement_status_enum" OWNER TO "postgres";

--
-- Name: listing_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "public"."listing_status_enum" AS ENUM (
    'draft',
    'listed'
);


ALTER TYPE "public"."listing_status_enum" OWNER TO "postgres";

--
-- Name: approve_school_request("uuid", "text", "text", "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."approve_school_request"("p_request_id" "uuid", "p_logo_letter" "text", "p_logo_gradient" "text", "p_approved_by" "uuid") RETURNS TABLE("school_id" "uuid", "updated_educations_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_request       ow_school_requests%ROWTYPE;
  v_new_school_id uuid;
  v_updated_count integer;
  v_approver_id   uuid;  -- ow_users.id
BEGIN
  -- ── 1. リクエスト取得 (FOR UPDATE で排他ロック) ──────────────────────────
  SELECT *
  INTO   v_request
  FROM   ow_school_requests
  WHERE  id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found: %', p_request_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Request is not pending (current status: %)', v_request.status
      USING ERRCODE = 'P0002';
  END IF;

  -- ── 2. 承認者の ow_users.id を解決 ──────────────────────────────────────
  --    auth.users.id → ow_users.id (一致しない場合は NULL のまま許容)
  SELECT id
  INTO   v_approver_id
  FROM   ow_users
  WHERE  auth_id = p_approved_by
  LIMIT  1;

  -- ── 3. ow_schools に INSERT ──────────────────────────────────────────────
  INSERT INTO ow_schools (
    name,
    name_kana,
    logo_letter,
    logo_gradient,
    country,
    type
  )
  VALUES (
    v_request.school_name,
    v_request.school_name_kana,
    p_logo_letter,
    p_logo_gradient,
    'JP',
    'university'
  )
  RETURNING id INTO v_new_school_id;

  -- ── 4. ow_school_requests を承認済みに更新 ───────────────────────────────
  UPDATE ow_school_requests
  SET
    status             = 'approved',
    approved_school_id = v_new_school_id,
    approved_at        = now(),
    approved_by        = v_approver_id
  WHERE id = p_request_id;

  -- ── 5. 同名学校の ow_user_educations.school_id を一括更新 ────────────────
  --    school テキストが完全一致 かつ school_id が未設定の行を対象
  UPDATE ow_user_educations
  SET    school_id = v_new_school_id
  WHERE  school    = v_request.school_name
    AND  school_id IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- ── 6. 結果を返す ─────────────────────────────────────────────────────────
  RETURN QUERY
    SELECT v_new_school_id AS school_id, v_updated_count AS updated_educations_count;
END;
$$;


ALTER FUNCTION "public"."approve_school_request"("p_request_id" "uuid", "p_logo_letter" "text", "p_logo_gradient" "text", "p_approved_by" "uuid") OWNER TO "postgres";

--
-- Name: auth_is_admin(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."auth_is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ow_user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;


ALTER FUNCTION "public"."auth_is_admin"() OWNER TO "postgres";

--
-- Name: auth_is_company_admin("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."auth_is_company_admin"("target_company_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ow_company_admins ca
    JOIN public.ow_users u ON u.id = ca.user_id
    WHERE ca.company_id = target_company_id
      AND u.auth_id = auth.uid()
      AND ca.permission = 'admin'
      AND ca.is_active = true
  );
$$;


ALTER FUNCTION "public"."auth_is_company_admin"("target_company_id" "uuid") OWNER TO "postgres";

--
-- Name: auth_is_company_member("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."auth_is_company_member"("target_company_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ow_company_admins ca
    JOIN public.ow_users u ON u.id = ca.user_id
    WHERE ca.company_id = target_company_id
      AND u.auth_id = auth.uid()
      AND ca.is_active = true
  );
$$;


ALTER FUNCTION "public"."auth_is_company_member"("target_company_id" "uuid") OWNER TO "postgres";

--
-- Name: block_solicitation_on_scout(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."block_solicitation_on_scout"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if is_solicitation_blocked(new.candidate_id) then
    raise exception
      '転職勧奨の禁止期間中の候補者にはスカウトを送信できません（職業安定法・許可条件）'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."block_solicitation_on_scout"() OWNER TO "postgres";

--
-- Name: FUNCTION "block_solicitation_on_scout"(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."block_solicitation_on_scout"() IS '転職勧奨禁止期間中の候補者へのスカウト送信をDB層でブロックする。';


--
-- Name: can_send_scout("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."can_send_scout"("p_company_id" "uuid", "p_candidate_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    -- 1. スカウトを受け取る設定になっている（null = 未選択は false 扱い）
    coalesce(
      (select scout_enabled from ow_profiles where user_id = p_candidate_id),
      false
    )

    -- 2. その企業に在籍したことがない
    --    company_id で紐づいている場合
    and not exists (
      select 1 from ow_experiences e
      where e.user_id = p_candidate_id
        and e.company_id = p_company_id
    )

    --    company_id が NULL で、会社名の自由入力のみの場合
    --    正規化した名前で突き合わせる
    and not exists (
      select 1
      from ow_experiences e
      join ow_companies c on c.id = p_company_id
      where e.user_id = p_candidate_id
        and e.company_id is null
        and e.company_text is not null
        and normalize_company_name(e.company_text) = normalize_company_name(c.name)
    )

    -- 3. 手動ブロックされていない
    and not exists (
      select 1 from ow_scout_blocks
      where candidate_id = p_candidate_id
        and company_id = p_company_id
    )

    -- 4. 転職勧奨の禁止期間中でない
    and not is_solicitation_blocked(p_candidate_id);
$$;


ALTER FUNCTION "public"."can_send_scout"("p_company_id" "uuid", "p_candidate_id" "uuid") OWNER TO "postgres";

--
-- Name: FUNCTION "can_send_scout"("p_company_id" "uuid", "p_candidate_id" "uuid"); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."can_send_scout"("p_company_id" "uuid", "p_candidate_id" "uuid") IS 'スカウト送信の可否。在籍企業は company_id と company_text（正規化して突合）の両方で判定する。';


--
-- Name: consume_scout_quota("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."consume_scout_quota"("p_company_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_quota ow_scout_quotas%rowtype;
  v_current_period date := date_trunc('month', current_date)::date;
begin
  -- 枠がなければデフォルトで作る
  insert into ow_scout_quotas (company_id)
  values (p_company_id)
  on conflict (company_id) do nothing;

  select * into v_quota
  from ow_scout_quotas
  where company_id = p_company_id
  for update;

  -- 月が変わっていたらリセット
  if v_quota.period_start < v_current_period then
    update ow_scout_quotas
    set used_this_month = 0,
        period_start = v_current_period,
        updated_at = now()
    where company_id = p_company_id
    returning * into v_quota;
  end if;

  -- 月次枠が残っている
  if v_quota.used_this_month < v_quota.monthly_limit then
    update ow_scout_quotas
    set used_this_month = used_this_month + 1,
        updated_at = now()
    where company_id = p_company_id;
    return true;
  end if;

  -- 月次枠を使い切ったが、運営付与のボーナス枠が残っている
  if v_quota.bonus_credits > 0 then
    update ow_scout_quotas
    set bonus_credits = bonus_credits - 1,
        updated_at = now()
    where company_id = p_company_id;
    return true;
  end if;

  -- 枠なし
  return false;
end;
$$;


ALTER FUNCTION "public"."consume_scout_quota"("p_company_id" "uuid") OWNER TO "postgres";

--
-- Name: FUNCTION "consume_scout_quota"("p_company_id" "uuid"); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."consume_scout_quota"("p_company_id" "uuid") IS 'スカウト送信枠を1消費する。月次枠→ボーナス枠の順に消費。枠がなければ false。';


--
-- Name: create_conversation("text", "uuid", "uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."create_conversation"("p_kind" "text", "p_candidate_user_id" "uuid", "p_company_id" "uuid" DEFAULT NULL::"uuid", "p_mentor_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("conversation_id" "uuid", "created" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_conversation_id UUID;
  v_created         BOOLEAN;
  v_stage           text;
BEGIN
  -- 再認証チェック
  IF NOT EXISTS (
    SELECT 1 FROM ow_users
    WHERE id = p_candidate_user_id
      AND auth_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'unauthorized: candidate_user_id does not match auth.uid()'
      USING ERRCODE = '42501';
  END IF;

  -- 引数整合性チェック
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

  -- ============================================================
  -- 修正箇所: テーブル別名 p を追加して列参照を明確化
  -- ============================================================
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
$$;


ALTER FUNCTION "public"."create_conversation"("p_kind" "text", "p_candidate_user_id" "uuid", "p_company_id" "uuid", "p_mentor_user_id" "uuid") OWNER TO "postgres";

--
-- Name: FUNCTION "create_conversation"("p_kind" "text", "p_candidate_user_id" "uuid", "p_company_id" "uuid", "p_mentor_user_id" "uuid"); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."create_conversation"("p_kind" "text", "p_candidate_user_id" "uuid", "p_company_id" "uuid", "p_mentor_user_id" "uuid") IS 'Phase ν-3 Step 1: 求職者の応募/カジュアル面談時に対話を生成する RPC。SECURITY DEFINER で RLS バイパス、関数内で auth.uid() 再認証実施。Phase ν-5 で kind=mentor の呼び出しが追加される予定。§4-8: ow_conversation_participants の RLS 根本修正は Phase ν-3 Step 3 で実施。migration 065: ow_conversation_participants にテーブル別名 p を追加して列参照曖昧解消。';


--
-- Name: get_blocked_companies("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_blocked_companies"("p_candidate_id" "uuid") RETURNS TABLE("company_id" "uuid", "company_name" "text", "block_reason" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  -- 在籍企業（company_id で紐づいている）
  select distinct
    c.id,
    c.name,
    'experience'::text
  from ow_experiences e
  join ow_companies c on c.id = e.company_id
  where e.user_id = p_candidate_id

  union

  -- 在籍企業（会社名の自由入力から突合）
  select distinct
    c.id,
    c.name,
    'experience'::text
  from ow_experiences e
  join ow_companies c
    on normalize_company_name(e.company_text) = normalize_company_name(c.name)
  where e.user_id = p_candidate_id
    and e.company_id is null
    and e.company_text is not null

  union

  -- 手動ブロック
  select
    c.id,
    c.name,
    'manual'::text
  from ow_scout_blocks b
  join ow_companies c on c.id = b.company_id
  where b.candidate_id = p_candidate_id;
$$;


ALTER FUNCTION "public"."get_blocked_companies"("p_candidate_id" "uuid") OWNER TO "postgres";

--
-- Name: FUNCTION "get_blocked_companies"("p_candidate_id" "uuid"); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."get_blocked_companies"("p_candidate_id" "uuid") IS '候補者がブロックしている企業の一覧。block_reason: experience(在籍企業・自動) / manual(手動)';


--
-- Name: get_public_career_steps("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_public_career_steps"("p_user_id" "uuid") RETURNS TABLE("id" "uuid", "user_id" "uuid", "company_id" "uuid", "company_text" "text", "company_anonymized" "text", "role_category_id" "uuid", "role_title" "text", "started_at" "date", "ended_at" "date", "is_current" boolean, "description" "text", "display_order" integer, "join_reason" "text", "employment_type" "text", "salary_man" integer, "visibility_company" "text", "visibility_salary" boolean, "visibility_reason" boolean, "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller_is_owner BOOLEAN := false;
  v_caller_is_admin BOOLEAN := false;
BEGIN
  -- 本人判定
  SELECT EXISTS (
    SELECT 1 FROM ow_users u
    WHERE u.id = p_user_id AND u.auth_id = auth.uid()
  ) INTO v_caller_is_owner;

  -- admin 判定
  SELECT EXISTS (
    SELECT 1 FROM ow_user_roles r
    JOIN ow_users u ON u.id = r.user_id
    WHERE u.auth_id = auth.uid() AND r.role = 'admin'
  ) INTO v_caller_is_admin;

  IF v_caller_is_owner OR v_caller_is_admin THEN
    -- 本人 / admin: 全カラムを返す（hidden 行含む）
    -- is_published チェックなし（下書き状態でも編集・確認できる）
    RETURN QUERY
      SELECT
        e.id, e.user_id, e.company_id, e.company_text, e.company_anonymized,
        e.role_category_id, e.role_title, e.started_at, e.ended_at, e.is_current,
        e.description, e.display_order, e.join_reason, e.employment_type,
        e.salary_man,
        e.visibility_company, e.visibility_salary, e.visibility_reason,
        e.created_at, e.updated_at
      FROM ow_experiences e
      WHERE e.user_id = p_user_id
      ORDER BY e.display_order;

  ELSE
    -- 公開ユーザー向け:
    --   [ガード 1] ow_career_profiles.is_published = true が存在すること
    --   [ガード 2] ow_users.visibility が公開可
    --   [ガード 3] visibility_company='hidden' 行を除外
    --   [マスク]   company は visibility_company に従い実名/匿名/NULL
    --              salary_man は visibility_salary=true の時のみ実数、false は NULL
    --              join_reason は visibility_reason=true の時のみ実テキスト、false は NULL
    RETURN QUERY
      SELECT
        e.id,
        e.user_id,
        CASE WHEN e.visibility_company = 'real' THEN e.company_id    ELSE NULL::UUID END,
        CASE WHEN e.visibility_company = 'real' THEN e.company_text  ELSE NULL::TEXT END,
        e.company_anonymized,
        e.role_category_id,
        e.role_title,
        e.started_at,
        e.ended_at,
        e.is_current,
        e.description,
        e.display_order,
        CASE WHEN e.visibility_reason   THEN e.join_reason ELSE NULL::TEXT END,
        e.employment_type,
        CASE WHEN e.visibility_salary   THEN e.salary_man  ELSE NULL::INT  END,  -- 修正
        e.visibility_company,
        e.visibility_salary,
        e.visibility_reason,
        e.created_at,
        e.updated_at
      FROM ow_experiences e
      JOIN ow_users u ON u.id = e.user_id
      WHERE e.user_id = p_user_id
        -- ガード 1: is_published=true のプロフィールが存在すること
        AND EXISTS (
          SELECT 1 FROM ow_career_profiles cp
          WHERE cp.user_id = p_user_id
            AND cp.is_published = true
        )
        -- ガード 2: ow_users.visibility
        AND (
          u.visibility = 'public'
          OR (auth.uid() IS NOT NULL AND u.visibility = 'login_only')
        )
        -- ガード 3: hidden ステップを除外
        AND e.visibility_company <> 'hidden'
      ORDER BY e.display_order;
  END IF;
END;
$$;


ALTER FUNCTION "public"."get_public_career_steps"("p_user_id" "uuid") OWNER TO "postgres";

--
-- Name: get_tenant_id(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_tenant_id"() RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT tenant_id FROM agents WHERE auth_user_id = auth.uid() LIMIT 1;
$$;


ALTER FUNCTION "public"."get_tenant_id"() OWNER TO "postgres";

--
-- Name: grant_review_access_on_post(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."grant_review_access_on_post"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_existing_expires timestamptz;
begin
  -- 既に有効な閲覧権があるなら、期限を延長する
  select max(expires_at) into v_existing_expires
  from ow_review_access
  where user_id = new.user_id
    and revoked_at is null;

  -- 既存の期限が1年後より先なら、何もしない（延長しすぎを防ぐ）
  if v_existing_expires is not null
     and v_existing_expires > (now() + interval '1 year') then
    return new;
  end if;

  insert into ow_review_access (
    user_id,
    expires_at,
    granted_by_review_id,
    granted_by_salary_id
  ) values (
    new.user_id,
    now() + interval '1 year',
    case when tg_table_name = 'ow_company_reviews' then new.id else null end,
    case when tg_table_name = 'ow_salary_reports'  then new.id else null end
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."grant_review_access_on_post"() OWNER TO "postgres";

--
-- Name: FUNCTION "grant_review_access_on_post"(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."grant_review_access_on_post"() IS '口コミ・給与を投稿した瞬間に1年間の閲覧権を付与する。承認は待たない。「投稿したのに見られない」を防ぐため。';


--
-- Name: guard_member_consent(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."guard_member_consent"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- 同意状態が変更されようとしている
  if new.display_consent is distinct from old.display_consent then
    -- 本人以外は変更できない
    if new.user_id <> auth.uid() then
      -- ただし OPINIO の admin は例外（サポート対応のため）
      if not exists (
        select 1 from ow_user_roles
        where ow_user_roles.user_id = auth.uid()
          and ow_user_roles.role = 'admin'
      ) then
        raise exception '面談対応者の公開同意は、本人のみが変更できます'
          using errcode = 'P0003';
      end if;
    end if;

    -- 同意した場合は日時を記録する
    if new.display_consent = true then
      new.consent_at := now();
    else
      new.consent_at := null;
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."guard_member_consent"() OWNER TO "postgres";

--
-- Name: FUNCTION "guard_member_consent"(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."guard_member_consent"() IS '面談対応者の公開同意（display_consent）は本人のみが変更できる。企業が勝手に同意済みにすることを防ぐ。';


--
-- Name: guard_review_insert(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."guard_review_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- user_id が必須（匿名投稿を許さない）
  if new.user_id is null then
    raise exception '口コミの投稿にはログインが必要です'
      using errcode = 'P0004';
  end if;

  -- 在籍したことがある企業にしか書けない
  if not has_worked_at_company(new.user_id, new.company_id) then
    raise exception '在籍または在籍経験のある企業にのみ口コミを投稿できます。職務経歴に登録してください。'
      using errcode = 'P0005';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."guard_review_insert"() OWNER TO "postgres";

--
-- Name: FUNCTION "guard_review_insert"(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."guard_review_insert"() IS '口コミ投稿の在籍確認をDB層で強制する。職歴にない企業には書けない。';


--
-- Name: guard_salary_insert(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."guard_salary_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.user_id is null then
    raise exception '給与情報の投稿にはログインが必要です'
      using errcode = 'P0004';
  end if;

  if not has_worked_at_company(new.user_id, new.company_id) then
    raise exception '在籍または在籍経験のある企業にのみ給与情報を投稿できます。職務経歴に登録してください。'
      using errcode = 'P0005';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."guard_salary_insert"() OWNER TO "postgres";

--
-- Name: guard_scout_insert(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."guard_scout_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- 転職勧奨の禁止（既存トリガーと重複するが、メッセージを分けるため個別に判定）
  if is_solicitation_blocked(new.candidate_id) then
    raise exception 'この候補者にはスカウトを送信できません'
      using errcode = 'P0001';
  end if;

  -- 受け取り設定・在籍企業・手動ブロック
  if not can_send_scout(new.company_id, new.candidate_id) then
    raise exception 'この候補者にはスカウトを送信できません'
      using errcode = 'P0001';
  end if;

  -- 送信枠
  if not consume_scout_quota(new.company_id) then
    raise exception 'スカウトの送信枠が不足しています'
      using errcode = 'P0002';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."guard_scout_insert"() OWNER TO "postgres";

--
-- Name: handle_new_ow_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."handle_new_ow_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.ow_users (
    auth_id, email, name, visibility, created_at, updated_at
  )
  VALUES (
    NEW.id, NEW.email,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      split_part(NEW.email, '@', 1)
    ),
    'public', NOW(), NOW()
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_ow_user"() OWNER TO "postgres";

--
-- Name: has_review_access("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."has_review_access"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from ow_review_access
    where user_id = p_user_id
      and expires_at > now()
      and revoked_at is null
  );
$$;


ALTER FUNCTION "public"."has_review_access"("p_user_id" "uuid") OWNER TO "postgres";

--
-- Name: FUNCTION "has_review_access"("p_user_id" "uuid"); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."has_review_access"("p_user_id" "uuid") IS '口コミの閲覧権があるか。引数は ow_users.id（auth.users.id ではない）。投稿から1年以内かつ剥奪されていない場合に true。';


--
-- Name: has_worked_at_company("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."has_worked_at_company"("p_user_id" "uuid", "p_company_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    -- company_id で紐づいている職歴がある
    exists (
      select 1 from ow_experiences e
      where e.user_id = p_user_id
        and e.company_id = p_company_id
    )
    -- または、会社名の自由入力が一致する職歴がある
    or exists (
      select 1
      from ow_experiences e
      join ow_companies c on c.id = p_company_id
      where e.user_id = p_user_id
        and e.company_id is null
        and e.company_text is not null
        and normalize_company_name(e.company_text) = normalize_company_name(c.name)
    );
$$;


ALTER FUNCTION "public"."has_worked_at_company"("p_user_id" "uuid", "p_company_id" "uuid") OWNER TO "postgres";

--
-- Name: FUNCTION "has_worked_at_company"("p_user_id" "uuid", "p_company_id" "uuid"); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."has_worked_at_company"("p_user_id" "uuid", "p_company_id" "uuid") IS '職務経歴に基づき、その企業に在籍したことがあるかを判定する。口コミ投稿の在籍確認に使う。';


--
-- Name: increment_mentor_consultations(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."increment_mentor_consultations"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE mentors
  SET total_consultations = total_consultations + 1
  WHERE id = NEW.mentor_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_mentor_consultations"() OWNER TO "postgres";

--
-- Name: is_solicitation_blocked("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."is_solicitation_blocked"("p_candidate_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from ow_placements
    where candidate_id = p_candidate_id
      and resigned_at is null
      and joined_at > (current_date - interval '2 years')
  );
$$;


ALTER FUNCTION "public"."is_solicitation_blocked"("p_candidate_id" "uuid") OWNER TO "postgres";

--
-- Name: FUNCTION "is_solicitation_blocked"("p_candidate_id" "uuid"); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."is_solicitation_blocked"("p_candidate_id" "uuid") IS '転職勧奨禁止期間中かを判定する。Opinioの紹介で就職し、2年以内かつ在職中なら true。';


--
-- Name: normalize_company_name("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."normalize_company_name"("p_name" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select nullif(
    lower(
      regexp_replace(
        regexp_replace(
          coalesce(p_name, ''),
          '(株式会社|有限会社|合同会社|合資会社|合名会社|一般社団法人|一般財団法人|\(株\)|（株）|㈱|\(有\)|（有）|㈲)',
          '',
          'g'
        ),
        '[[:space:]　]',
        '',
        'g'
      )
    ),
    ''
  );
$$;


ALTER FUNCTION "public"."normalize_company_name"("p_name" "text") OWNER TO "postgres";

--
-- Name: FUNCTION "normalize_company_name"("p_name" "text"); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."normalize_company_name"("p_name" "text") IS '会社名の表記揺れを吸収する。法人格・空白を除去し小文字化する。';


--
-- Name: ow_career_profiles_set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."ow_career_profiles_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ow_career_profiles_set_updated_at"() OWNER TO "postgres";

--
-- Name: ow_conversation_messages_update_last_message_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."ow_conversation_messages_update_last_message_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- last_message_at < NEW.sent_at の場合のみ更新(冪等性 + 古いメッセージ INSERT 時の保護)
  UPDATE ow_conversations
  SET last_message_at = NEW.sent_at
  WHERE id = NEW.conversation_id
    AND (last_message_at IS NULL OR last_message_at < NEW.sent_at);

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ow_conversation_messages_update_last_message_at"() OWNER TO "postgres";

--
-- Name: purge_old_page_views(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."purge_old_page_views"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  delete from ow_page_views
  where created_at < now() - interval '90 days';
$$;


ALTER FUNCTION "public"."purge_old_page_views"() OWNER TO "postgres";

--
-- Name: reject_school_request("uuid", "uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."reject_school_request"("p_request_id" "uuid", "p_approved_by" "uuid") RETURNS TABLE("rejected_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_request     ow_school_requests%ROWTYPE;
  v_approver_id uuid;
  v_now         timestamptz := now();
BEGIN
  -- ── 1. リクエスト取得 (FOR UPDATE で排他ロック) ──────────────────────────
  SELECT *
  INTO   v_request
  FROM   ow_school_requests
  WHERE  id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found: %', p_request_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Request is not pending (current status: %)', v_request.status
      USING ERRCODE = 'P0002';
  END IF;

  -- ── 2. 承認者(却下者)の ow_users.id を解決 ──────────────────────────────
  SELECT id
  INTO   v_approver_id
  FROM   ow_users
  WHERE  auth_id = p_approved_by
  LIMIT  1;

  -- ── 3. ow_school_requests を rejected に UPDATE ──────────────────────────
  UPDATE ow_school_requests
  SET
    status      = 'rejected',
    approved_at = v_now,      -- rejected_at として再利用
    approved_by = v_approver_id
  WHERE id = p_request_id;

  -- ── 4. 結果を返す ─────────────────────────────────────────────────────────
  RETURN QUERY
    SELECT v_now AS rejected_at;
END;
$$;


ALTER FUNCTION "public"."reject_school_request"("p_request_id" "uuid", "p_approved_by" "uuid") OWNER TO "postgres";

--
-- Name: set_candidate_portal_token(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."set_candidate_portal_token"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.portal_token IS NULL THEN
    NEW.portal_token := replace(encode(gen_random_uuid()::text::bytea, 'base64'), '/', '_');
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_candidate_portal_token"() OWNER TO "postgres";

--
-- Name: set_salary_reports_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."set_salary_reports_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_salary_reports_updated_at"() OWNER TO "postgres";

--
-- Name: update_career_agent_leads_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."update_career_agent_leads_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_career_agent_leads_updated_at"() OWNER TO "postgres";

--
-- Name: update_company_member_counts(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."update_company_member_counts"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  target_company_id UUID;
BEGIN
  -- INSERT / UPDATE / DELETE のいずれでも対象 company_id を特定
  target_company_id := COALESCE(NEW.company_id, OLD.company_id);

  IF target_company_id IS NOT NULL THEN
    UPDATE ow_companies
    SET
      current_member_count = COALESCE((
        SELECT COUNT(DISTINCT user_id)
        FROM ow_experiences
        WHERE company_id = target_company_id AND is_current = true
      ), 0),
      obog_count = COALESCE((
        SELECT COUNT(DISTINCT user_id)
        FROM ow_experiences
        WHERE company_id = target_company_id AND is_current = false
      ), 0)
    WHERE id = target_company_id;
  END IF;

  -- UPDATE で company_id が変わったケース（旧 company も再集計）
  IF TG_OP = 'UPDATE'
     AND OLD.company_id IS NOT NULL
     AND OLD.company_id IS DISTINCT FROM NEW.company_id THEN
    UPDATE ow_companies
    SET
      current_member_count = COALESCE((
        SELECT COUNT(DISTINCT user_id)
        FROM ow_experiences
        WHERE company_id = OLD.company_id AND is_current = true
      ), 0),
      obog_count = COALESCE((
        SELECT COUNT(DISTINCT user_id)
        FROM ow_experiences
        WHERE company_id = OLD.company_id AND is_current = false
      ), 0)
    WHERE id = OLD.company_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_company_member_counts"() OWNER TO "postgres";

--
-- Name: update_company_members_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."update_company_members_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_company_members_updated_at"() OWNER TO "postgres";

--
-- Name: update_mentor_reservations_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."update_mentor_reservations_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_mentor_reservations_updated_at"() OWNER TO "postgres";

--
-- Name: update_ow_agent_agencies_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."update_ow_agent_agencies_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_ow_agent_agencies_updated_at"() OWNER TO "postgres";

--
-- Name: update_ow_company_external_links_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."update_ow_company_external_links_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_ow_company_external_links_updated_at"() OWNER TO "postgres";

--
-- Name: update_ow_pipeline_stages_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."update_ow_pipeline_stages_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_ow_pipeline_stages_updated_at"() OWNER TO "postgres";

--
-- Name: update_placements_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."update_placements_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_placements_updated_at"() OWNER TO "postgres";

--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: agent_client_relations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."agent_client_relations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_tenant_id" "uuid",
    "hiring_tenant_id" "uuid",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."agent_client_relations" OWNER TO "postgres";

--
-- Name: agent_company_access; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."agent_company_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid"
);


ALTER TABLE "public"."agent_company_access" OWNER TO "postgres";

--
-- Name: agent_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."agent_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_tenant_id" "uuid",
    "user_id" "uuid",
    "email" "text" NOT NULL,
    "name" "text",
    "role" "text" DEFAULT 'member'::"text",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."agent_members" OWNER TO "postgres";

--
-- Name: agents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."agents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_user_id" "uuid",
    "email" "text" NOT NULL,
    "name" "text" NOT NULL,
    "company_name" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "tenant_id" "uuid",
    "role" "text" DEFAULT 'member'::"text",
    CONSTRAINT "agents_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'recruiter'::"text", 'interviewer'::"text"]))),
    CONSTRAINT "agents_status_check" CHECK (("status" = ANY (ARRAY['invited'::"text", 'active'::"text"])))
);


ALTER TABLE "public"."agents" OWNER TO "postgres";

--
-- Name: ai_interviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ai_interviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "job_id" "uuid",
    "interview_type" "text" DEFAULT 'screening'::"text" NOT NULL,
    "title" "text" DEFAULT 'AI面接'::"text" NOT NULL,
    "duration_minutes" integer DEFAULT 30 NOT NULL,
    "question_count" integer DEFAULT 5 NOT NULL,
    "token" "text" DEFAULT "replace"("encode"((("gen_random_uuid"())::"text")::"bytea", 'base64'::"text"), '/'::"text", '_'::"text") NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "questions" "jsonb" DEFAULT '[]'::"jsonb",
    "answers" "jsonb" DEFAULT '[]'::"jsonb",
    "scores" "jsonb",
    "report" "text",
    "created_by" "uuid",
    "created_by_name" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_interviews" OWNER TO "postgres";

--
-- Name: applications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "notes" "text",
    "motivation" "text",
    "agent_id" "uuid",
    "application_type" "text" DEFAULT 'direct'::"text" NOT NULL,
    "tenant_id" "uuid",
    CONSTRAINT "applications_application_type_check" CHECK (("application_type" = ANY (ARRAY['direct'::"text", 'agent'::"text", 'careers'::"text"]))),
    CONSTRAINT "applications_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'screening'::"text", 'interview_1'::"text", 'interview_2'::"text", 'technical_test'::"text", 'offer'::"text", 'hired'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."applications" OWNER TO "postgres";

--
-- Name: candidate_certifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."candidate_certifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."candidate_certifications" OWNER TO "postgres";

--
-- Name: candidate_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."candidate_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid",
    "file_name" "text" NOT NULL,
    "file_type" "text",
    "file_size" bigint,
    "storage_path" "text" NOT NULL,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid"
);


ALTER TABLE "public"."candidate_documents" OWNER TO "postgres";

--
-- Name: candidate_educations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."candidate_educations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "school" "text" DEFAULT ''::"text" NOT NULL,
    "faculty" "text" DEFAULT ''::"text",
    "end_year" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."candidate_educations" OWNER TO "postgres";

--
-- Name: candidate_hearings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."candidate_hearings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "application_id" "uuid",
    "stage" "text" DEFAULT ''::"text" NOT NULL,
    "motivation_score" integer NOT NULL,
    "concerns" "text",
    "other_companies" "text"[] DEFAULT '{}'::"text"[],
    "job_change_timing" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "candidate_hearings_motivation_score_check" CHECK ((("motivation_score" >= 1) AND ("motivation_score" <= 5)))
);


ALTER TABLE "public"."candidate_hearings" OWNER TO "postgres";

--
-- Name: candidate_job_activities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."candidate_job_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid",
    "tenant_id" "uuid",
    "company_name" "text" NOT NULL,
    "position" "text",
    "stage" "text" DEFAULT '応募済'::"text",
    "motivation" "text" DEFAULT 'その他'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."candidate_job_activities" OWNER TO "postgres";

--
-- Name: candidate_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."candidate_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid",
    "subject" "text",
    "body" "text",
    "type" "text" DEFAULT 'email'::"text",
    "sent_by" "uuid",
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid"
);


ALTER TABLE "public"."candidate_messages" OWNER TO "postgres";

--
-- Name: candidate_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."candidate_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid",
    "tenant_id" "uuid",
    "who" "text",
    "text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."candidate_notes" OWNER TO "postgres";

--
-- Name: candidate_timeline_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."candidate_timeline_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "tenant_id" "uuid",
    "event_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "interview_date" timestamp with time zone,
    "interview_location" "text",
    "interview_status" "text",
    "application_id" "uuid",
    "evaluation_id" "uuid",
    "created_by" "uuid",
    "created_by_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "interviewer_name" "text",
    "interview_url" "text",
    CONSTRAINT "candidate_timeline_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['applied'::"text", 'stage_changed'::"text", 'interview_scheduled'::"text", 'evaluation'::"text", 'memo'::"text", 'email_sent'::"text"]))),
    CONSTRAINT "candidate_timeline_events_interview_status_check" CHECK ((("interview_status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'completed'::"text"])) OR ("interview_status" IS NULL)))
);


ALTER TABLE "public"."candidate_timeline_events" OWNER TO "postgres";

--
-- Name: candidate_work_histories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."candidate_work_histories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "company" "text" DEFAULT ''::"text" NOT NULL,
    "position" "text" DEFAULT ''::"text",
    "start_date" "text",
    "end_date" "text",
    "description" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."candidate_work_histories" OWNER TO "postgres";

--
-- Name: candidates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."candidates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "current_company" "text",
    "current_title" "text",
    "years_of_experience" integer,
    "skills" "text"[] DEFAULT '{}'::"text"[],
    "resume_url" "text",
    "linkedin_url" "text",
    "github_url" "text",
    "notes" "text",
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "current_salary" integer,
    "desired_salary" integer,
    "minimum_salary" integer,
    "tenant_id" "uuid",
    "joining_timing" character varying,
    "nearest_station" character varying,
    "age" integer,
    "university_deviation_value" numeric,
    "priority_rank" integer,
    "portal_token" "text",
    "salary_hard_min" integer
);


ALTER TABLE "public"."candidates" OWNER TO "postgres";

--
-- Name: channels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sort_order" integer DEFAULT 0,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "tenant_id" "uuid"
);


ALTER TABLE "public"."channels" OWNER TO "postgres";

--
-- Name: companies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "logo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid"
);


ALTER TABLE "public"."companies" OWNER TO "postgres";

--
-- Name: competing_offers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."competing_offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid",
    "company_name" "text" NOT NULL,
    "stage" "text" DEFAULT '書類選考中'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid"
);


ALTER TABLE "public"."competing_offers" OWNER TO "postgres";

--
-- Name: concurrent_applications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."concurrent_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "company_name" "text" NOT NULL,
    "job_title" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "priority" integer,
    "memo" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "selection_stage" "text",
    CONSTRAINT "concurrent_applications_status_check" CHECK (("status" = ANY (ARRAY['screening'::"text", 'first_interview'::"text", 'second_interview'::"text", 'final_interview'::"text", 'offered'::"text", 'accepted'::"text", 'declined'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."concurrent_applications" OWNER TO "postgres";

--
-- Name: crm_activities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."crm_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "crm_candidate_id" "uuid" NOT NULL,
    "agent_tenant_id" "uuid" NOT NULL,
    "activity_type" "text" DEFAULT 'memo'::"text" NOT NULL,
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."crm_activities" OWNER TO "postgres";

--
-- Name: crm_applications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."crm_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "crm_candidate_id" "uuid",
    "agent_tenant_id" "uuid",
    "job_id" "uuid",
    "company_name" "text",
    "job_title" "text",
    "stage" "text" DEFAULT '推薦前'::"text",
    "status" "text" DEFAULT 'active'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."crm_applications" OWNER TO "postgres";

--
-- Name: crm_candidates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."crm_candidates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_tenant_id" "uuid",
    "last_name" "text" NOT NULL,
    "first_name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "current_company" "text",
    "current_position" "text",
    "experience_years" integer,
    "skills" "text"[],
    "desired_salary_min" integer,
    "desired_salary_max" integer,
    "desired_location" "text",
    "memo" "text",
    "tags" "text"[],
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "date_of_birth" "date",
    "gender" "text",
    "current_salary" integer
);


ALTER TABLE "public"."crm_candidates" OWNER TO "postgres";

--
-- Name: crm_client_companies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."crm_client_companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_tenant_id" "uuid" NOT NULL,
    "company_name" "text" NOT NULL,
    "industry" "text",
    "contact_name" "text",
    "contact_email" "text",
    "contact_phone" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."crm_client_companies" OWNER TO "postgres";

--
-- Name: crm_interviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."crm_interviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_tenant_id" "uuid" NOT NULL,
    "crm_candidate_id" "uuid" NOT NULL,
    "interview_type" "text" DEFAULT 'initial'::"text" NOT NULL,
    "scheduled_at" timestamp with time zone NOT NULL,
    "location" "text",
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "notes" "text",
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."crm_interviews" OWNER TO "postgres";

--
-- Name: employer_jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."employer_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employer_id" "uuid",
    "title" "text" NOT NULL,
    "job_type" "text",
    "employment_type" "text",
    "location" "text",
    "remote_type" "text",
    "description" "text",
    "requirements" "text",
    "preferred" "text",
    "products" "text"[],
    "salary_min" integer,
    "salary_max" integer,
    "benefits" "text",
    "selection_flow" "text",
    "status" "text" DEFAULT 'draft'::"text",
    "expires_at" timestamp with time zone,
    "view_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."employer_jobs" OWNER TO "postgres";

--
-- Name: employer_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."employer_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "company_name" "text" NOT NULL,
    "contact_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "company_url" "text",
    "industry" "text",
    "employee_count" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."employer_profiles" OWNER TO "postgres";

--
-- Name: evaluations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."evaluations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "application_id" "uuid",
    "tenant_id" "uuid",
    "evaluator_id" "uuid",
    "evaluator_name" "text",
    "score_technical" integer DEFAULT 3 NOT NULL,
    "score_communication" integer DEFAULT 3 NOT NULL,
    "score_culture_fit" integer DEFAULT 3 NOT NULL,
    "score_leadership" integer DEFAULT 3 NOT NULL,
    "score_growth" integer DEFAULT 3 NOT NULL,
    "average_score" numeric(2,1) GENERATED ALWAYS AS ((((((("score_technical" + "score_communication") + "score_culture_fit") + "score_leadership") + "score_growth"))::numeric / (5)::numeric)) STORED,
    "comment" "text",
    "evaluated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "evaluations_score_communication_check" CHECK ((("score_communication" >= 1) AND ("score_communication" <= 5))),
    CONSTRAINT "evaluations_score_culture_fit_check" CHECK ((("score_culture_fit" >= 1) AND ("score_culture_fit" <= 5))),
    CONSTRAINT "evaluations_score_growth_check" CHECK ((("score_growth" >= 1) AND ("score_growth" <= 5))),
    CONSTRAINT "evaluations_score_leadership_check" CHECK ((("score_leadership" >= 1) AND ("score_leadership" <= 5))),
    CONSTRAINT "evaluations_score_technical_check" CHECK ((("score_technical" >= 1) AND ("score_technical" <= 5)))
);


ALTER TABLE "public"."evaluations" OWNER TO "postgres";

--
-- Name: iv_companies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."iv_companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "jd_text" "text" DEFAULT ''::"text" NOT NULL,
    "axes" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "q_count" integer DEFAULT 5 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "iv_companies_q_count_check" CHECK ((("q_count" >= 3) AND ("q_count" <= 15)))
);


ALTER TABLE "public"."iv_companies" OWNER TO "postgres";

--
-- Name: iv_interviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."iv_interviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "candidate_name" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'waiting'::"text" NOT NULL,
    "score" numeric(3,1),
    "verdict" "text",
    "eval_json" "jsonb",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "iv_interviews_status_check" CHECK (("status" = ANY (ARRAY['waiting'::"text", 'active'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."iv_interviews" OWNER TO "postgres";

--
-- Name: iv_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."iv_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "interview_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "iv_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."iv_messages" OWNER TO "postgres";

--
-- Name: job_interests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."job_interests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid",
    "talent_user_id" "uuid",
    "interest_type" "text" DEFAULT 'interested'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."job_interests" OWNER TO "postgres";

--
-- Name: jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "department" "text" DEFAULT ''::"text" NOT NULL,
    "location" "text" DEFAULT ''::"text" NOT NULL,
    "job_type" "text" DEFAULT 'full_time'::"text" NOT NULL,
    "experience_level" "text" DEFAULT 'mid'::"text" NOT NULL,
    "salary_min" integer,
    "salary_max" integer,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "requirements" "text" DEFAULT ''::"text" NOT NULL,
    "tech_stack" "text"[] DEFAULT '{}'::"text"[],
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_published" boolean DEFAULT true NOT NULL,
    "company_id" "uuid",
    "category" "text",
    "headcount" integer DEFAULT 1,
    "position_level" "text",
    "expected_start" "text",
    "remote_type" "text" DEFAULT 'hybrid'::"text",
    "appeal" "text",
    "required_skills" "text",
    "preferred_skills" "text",
    "personality" "text",
    "selection_flow" "text",
    "team_info" "text",
    "probation_period" "text",
    "working_hours" "text",
    "holidays" "text",
    "insurance" "text",
    "benefits" "text",
    "target_count" integer DEFAULT 1,
    "hiring_deadline" "date",
    "tenant_id" "uuid",
    "selection_steps" integer,
    "opinio_comment" "text",
    CONSTRAINT "jobs_experience_level_check" CHECK (("experience_level" = ANY (ARRAY['junior'::"text", 'mid'::"text", 'senior'::"text", 'lead'::"text", 'executive'::"text"]))),
    CONSTRAINT "jobs_job_type_check" CHECK (("job_type" = ANY (ARRAY['full_time'::"text", 'contract'::"text", 'part_time'::"text", 'internship'::"text"]))),
    CONSTRAINT "jobs_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'open'::"text", 'closed'::"text", 'paused'::"text"])))
);


ALTER TABLE "public"."jobs" OWNER TO "postgres";

--
-- Name: nurturing_candidates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."nurturing_candidates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid",
    "reason" "text",
    "next_contact_at" "date",
    "contact_interval_months" integer DEFAULT 3,
    "memo" "text",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid"
);


ALTER TABLE "public"."nurturing_candidates" OWNER TO "postgres";

--
-- Name: offer_letters; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."offer_letters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "application_id" "uuid",
    "job_id" "uuid",
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "strengths" "text",
    "manager_message" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "responded_at" timestamp with time zone,
    "decline_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."offer_letters" OWNER TO "postgres";

--
-- Name: ow_activities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "actor_user_id" "uuid",
    "type" "text" NOT NULL,
    "description" "text",
    "target_type" "text",
    "target_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ow_activities" OWNER TO "postgres";

--
-- Name: ow_agent_agencies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_agent_agencies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "agency_name" "text" NOT NULL,
    "memo" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ow_agent_agencies" OWNER TO "postgres";

--
-- Name: ow_agent_contacts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_agent_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agency_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ow_agent_contacts" OWNER TO "postgres";

--
-- Name: ow_agent_jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_agent_jobs" (
    "agency_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ow_agent_jobs" OWNER TO "postgres";

--
-- Name: ow_applications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid",
    "job_id" "uuid",
    "status" "text" DEFAULT 'applied'::"text",
    "applied_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "message" "text",
    "first_round_at" timestamp with time zone,
    "second_round_at" timestamp with time zone,
    "offer_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "replied_at" timestamp with time zone
);


ALTER TABLE "public"."ow_applications" OWNER TO "postgres";

--
-- Name: ow_articles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_articles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "subtitle" "text",
    "eyecatch_gradient" "text",
    "read_min" integer DEFAULT 5,
    "company_id" "uuid",
    "company_slug" "text",
    "company_name_text" "text",
    "company_initial_text" "text",
    "company_gradient_text" "text",
    "subject_freeze" "jsonb",
    "subjects_freeze" "jsonb",
    "editor_note" "text",
    "body_blocks" "jsonb",
    "quote" "text",
    "qa_blocks" "jsonb",
    "themes_blocks" "jsonb",
    "chapters" "jsonb",
    "editor_outro" "text",
    "related_job_ids" "text"[] DEFAULT ARRAY[]::"text"[],
    "related_article_slugs" "text"[] DEFAULT ARRAY[]::"text"[],
    "is_published" boolean DEFAULT false,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    CONSTRAINT "ow_articles_type_check" CHECK (("type" = ANY (ARRAY['employee'::"text", 'mentor'::"text", 'ceo'::"text", 'report'::"text"])))
);


ALTER TABLE "public"."ow_articles" OWNER TO "postgres";

--
-- Name: ow_bookmarks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_bookmarks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ow_bookmarks_target_type_check" CHECK (("target_type" = ANY (ARRAY['article'::"text", 'company'::"text", 'job'::"text", 'mentor'::"text"])))
);


ALTER TABLE "public"."ow_bookmarks" OWNER TO "postgres";

--
-- Name: ow_job_views; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_job_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ow_job_views" OWNER TO "postgres";

--
-- Name: ow_jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "title" "text" NOT NULL,
    "job_category" "text",
    "employment_type" "text",
    "description" "text",
    "appeal" "text",
    "salary_min" integer,
    "salary_max" integer,
    "location" "text",
    "work_style" "text",
    "selection_process" "jsonb",
    "status" "text" DEFAULT 'draft'::"text",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "requirements" "text",
    "preferred" "text",
    "selection_flow" "text"[],
    "work_hours" "text",
    "trial_period" "text",
    "holidays" "text",
    "benefits" "text",
    "avg_overtime" "text",
    "positives" "text"[],
    "negatives" "text"[],
    "fit_positives" "jsonb",
    "fit_negatives" "jsonb",
    "main_image_url" "text",
    "catch_copy" "text",
    "one_liner" "text",
    "gradient_preset" "text" DEFAULT 'warm'::"text",
    "why_we_exist" "text",
    "what_youll_do_intro" "text",
    "who_we_want_intro" "text",
    "role_category_id" "uuid",
    "department" "text",
    "salary_note" "text",
    "remote_work_status" "text",
    "probation_period" "text",
    "description_markdown" "text",
    "message_to_candidates" "text",
    "required_skills" "text"[],
    "preferred_skills" "text"[],
    "culture_fit" "text",
    "selection_steps" "text"[],
    "selection_duration" "text",
    "start_date_preference" "text",
    "rejection_reason" "text",
    "rejection_date" timestamp with time zone,
    "rejection_reviewer" "text",
    "submitted_at" timestamp with time zone,
    "published_at" timestamp with time zone,
    "urgency" "text" DEFAULT 'open'::"text" NOT NULL,
    "why_hire" "text",
    "team_composition" "text",
    "first_90_days" "text",
    "business_model" "text",
    "ote_min" integer,
    "ote_max" integer,
    "sales_segment" "text"[],
    "sales_hunter_farmer" "text",
    "incentive_note" "text",
    "tech_stack" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "slug" "text",
    "department_id" "uuid",
    "company_job_role_id" "uuid",
    CONSTRAINT "ow_jobs_remote_work_status_check" CHECK ((("remote_work_status" IS NULL) OR ("remote_work_status" = ANY (ARRAY['full_remote'::"text", 'hybrid'::"text", 'on_site'::"text"])))),
    CONSTRAINT "ow_jobs_salary_range_check" CHECK ((("salary_min" IS NULL) OR ("salary_max" IS NULL) OR ("salary_max" >= "salary_min"))),
    CONSTRAINT "ow_jobs_urgency_check" CHECK (("urgency" = ANY (ARRAY['open'::"text", 'hot'::"text"])))
);


ALTER TABLE "public"."ow_jobs" OWNER TO "postgres";

--
-- Name: COLUMN "ow_jobs"."main_image_url"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_jobs"."main_image_url" IS 'カード/ヒーローのメイン画像URL。null の場合は gradient_preset を使用';


--
-- Name: COLUMN "ow_jobs"."catch_copy"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_jobs"."catch_copy" IS '募集のキャッチコピー。30〜45文字。一覧カードと詳細ヒーローで表示';


--
-- Name: COLUMN "ow_jobs"."one_liner"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_jobs"."one_liner" IS '募集の一言要約。50〜80文字。一覧カードのサブテキスト';


--
-- Name: COLUMN "ow_jobs"."gradient_preset"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_jobs"."gradient_preset" IS 'メイン画像が無い場合のグラデーションプリセット: warm/cool/green/purple/dark';


--
-- Name: COLUMN "ow_jobs"."why_we_exist"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_jobs"."why_we_exist" IS 'なぜこのポジションが必要か。物語調(150〜300文字)';


--
-- Name: COLUMN "ow_jobs"."what_youll_do_intro"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_jobs"."what_youll_do_intro" IS '仕事内容の冒頭文。1日の流れなど生活感のある描写(100〜200文字)';


--
-- Name: COLUMN "ow_jobs"."who_we_want_intro"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_jobs"."who_we_want_intro" IS '求める人物像の冒頭文。会社からのメッセージ(100〜200文字)';


--
-- Name: COLUMN "ow_jobs"."role_category_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_jobs"."role_category_id" IS '【非推奨】ow_job_roles に移行済み。新規コードでは ow_job_roles を使うこと。';


--
-- Name: COLUMN "ow_jobs"."why_hire"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_jobs"."why_hire" IS 'なぜ今採用するか：ビジネス背景・チームの課題';


--
-- Name: COLUMN "ow_jobs"."team_composition"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_jobs"."team_composition" IS 'チーム構成：人数・職種・雰囲気など';


--
-- Name: COLUMN "ow_jobs"."first_90_days"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_jobs"."first_90_days" IS '入社後90日でやること：最初のミッション';


--
-- Name: COLUMN "ow_jobs"."ote_min"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_jobs"."ote_min" IS 'OTE下限（万円）。job_category=営業のときのみ使用。インセンティブ込み想定年収。';


--
-- Name: COLUMN "ow_jobs"."ote_max"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_jobs"."ote_max" IS 'OTE上限（万円）。job_category=営業のときのみ使用。';


--
-- Name: COLUMN "ow_jobs"."sales_segment"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_jobs"."sales_segment" IS '担当セグメント配列。値: smb / mid / enterprise';


--
-- Name: COLUMN "ow_jobs"."sales_hunter_farmer"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_jobs"."sales_hunter_farmer" IS '新規/既存傾向。値: hunter（新規中心）/ farmer（既存中心）/ balanced（半々）';


--
-- Name: COLUMN "ow_jobs"."incentive_note"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_jobs"."incentive_note" IS 'インセンティブ・コミッション補足説明（任意自由記述）';


--
-- Name: ow_business_job_performance; Type: VIEW; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW "public"."ow_business_job_performance" AS
 SELECT "j"."id" AS "job_id",
    "j"."company_id" AS "tenant_id",
    "j"."title",
    "j"."status",
    "j"."created_at",
    (COALESCE("v"."view_count", (0)::bigint))::integer AS "view_count",
    (COALESCE("a"."application_count", (0)::bigint))::integer AS "application_count",
        CASE
            WHEN (COALESCE("v"."view_count", (0)::bigint) > 0) THEN "round"((((COALESCE("a"."application_count", (0)::bigint))::numeric / ("v"."view_count")::numeric) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "conversion_rate_pct"
   FROM (("public"."ow_jobs" "j"
     LEFT JOIN ( SELECT "ow_job_views"."job_id",
            "count"(*) AS "view_count"
           FROM "public"."ow_job_views"
          GROUP BY "ow_job_views"."job_id") "v" ON (("v"."job_id" = "j"."id")))
     LEFT JOIN ( SELECT "ow_applications"."job_id",
            "count"(*) AS "application_count"
           FROM "public"."ow_applications"
          GROUP BY "ow_applications"."job_id") "a" ON (("a"."job_id" = "j"."id")));


ALTER VIEW "public"."ow_business_job_performance" OWNER TO "postgres";

--
-- Name: ow_companies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "name_en" "text",
    "founded_at" "text",
    "employee_count" "text",
    "location" "text",
    "industry" "text",
    "phase" "text",
    "url" "text",
    "mission" "text",
    "description" "text",
    "logo_url" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "plan" "text" DEFAULT 'free'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "brand_color" "text",
    "avg_salary" "text",
    "remote_rate" integer,
    "avg_overtime" integer,
    "paid_leave_rate" integer,
    "avg_age" integer,
    "funding_total" "text",
    "founded_year" integer,
    "recruiter_name" "text",
    "recruiter_role" "text",
    "recruiter_message" "text",
    "recruiter_avatar_url" "text",
    "opinio_comment" "text",
    "company_features" "jsonb",
    "prev_career_note" "text",
    "english_frequency" "text",
    "autonomy_level" "text",
    "casual_interview_url" "text",
    "annual_hire_count" "text",
    "mid_career_ratio" integer,
    "avg_tenure" "text",
    "avg_selection_weeks" integer,
    "selection_count" integer,
    "selection_flow" "text"[],
    "has_stock_option" boolean DEFAULT false,
    "has_incentive" boolean DEFAULT false,
    "incentive_detail" "text",
    "bonus_times" integer,
    "salary_raise_frequency" "text",
    "evaluation_system" "text",
    "female_manager_ratio" integer,
    "maternity_leave_female" integer,
    "maternity_leave_male" integer,
    "top_down_ratio" integer,
    "official_language" "text" DEFAULT '日本語'::"text",
    "engineer_ratio" "text",
    "funding_stage" "text",
    "arr_scale" "text",
    "ceo_name" "text",
    "office_count" "text",
    "flex_time" boolean,
    "core_time" "text",
    "office_days_per_week" "text",
    "annual_holiday_days" integer,
    "side_job_ok" boolean,
    "salary_review_times" integer,
    "evaluation_cycle" "text",
    "has_book_allowance" boolean,
    "has_internal_transfer" boolean,
    "avg_tenure_years" "text",
    "turnover_rate" "text",
    "female_ratio" "text",
    "management_style" "text",
    "one_on_one_freq" "text",
    "childcare_leave_rate" "text",
    "has_housing_allowance" boolean,
    "has_meal_allowance" boolean,
    "has_learning_support" boolean,
    "has_health_support" boolean,
    "header_image_url" "text",
    "cover_color" "text" DEFAULT '#1d6fa5'::"text",
    "tagline" "text",
    "culture_description" "text",
    "why_join" "text",
    "logo_letter" "text",
    "logo_gradient" "text",
    "about_markdown" "text",
    "business_stage" "text",
    "established_at" "text",
    "gender_ratio" "text",
    "benefits" "text"[],
    "headquarters_address" "text",
    "nearest_station" "text",
    "remote_work_status" "text",
    "work_time_system" "text",
    "avg_overtime_hours" "text",
    "workstyle_description" "text",
    "is_published" boolean DEFAULT false NOT NULL,
    "accepting_casual_meetings" boolean DEFAULT true NOT NULL,
    "notification_emails" "text"[],
    "draft_data" "jsonb",
    "published_at" timestamp with time zone,
    "source" "text",
    "current_member_count" integer DEFAULT 0 NOT NULL,
    "obog_count" integer DEFAULT 0 NOT NULL,
    "fit_positives" "jsonb",
    "fit_negatives" "jsonb",
    "show_fit_negatives" boolean DEFAULT false NOT NULL,
    "numbers_updated_at" timestamp with time zone,
    "availability_days" "text"[] DEFAULT '{}'::"text"[],
    "availability_times" "text"[] DEFAULT '{}'::"text"[],
    "availability_notes" "text",
    "main_products" "text"[],
    "main_customers" "text"[],
    "listing_status" "public"."listing_status_enum" DEFAULT 'listed'::"public"."listing_status_enum" NOT NULL,
    "engagement_status" "public"."engagement_status_enum" DEFAULT 'none'::"public"."engagement_status_enum" NOT NULL,
    "jobs_public" boolean DEFAULT false NOT NULL,
    "verified_at" timestamp with time zone,
    "contracted_at" timestamp with time zone,
    "sort_order" integer DEFAULT 0,
    "x_url" "text",
    "linkedin_url" "text",
    "org_teams" "jsonb",
    "culture_keywords" "text"[],
    "customer_cases" "jsonb",
    "careers_url" "text",
    "brand_name" "text",
    "branch_locations" "text"[],
    "is_foreign" boolean DEFAULT false NOT NULL,
    "reality_disclosure" "jsonb" DEFAULT '{}'::"jsonb",
    "business_model" "text",
    "industry_id" "uuid",
    "saas_category_id" "uuid",
    "slug" "text",
    "is_approved" boolean DEFAULT false NOT NULL,
    CONSTRAINT "ow_companies_remote_work_status_check" CHECK ((("remote_work_status" IS NULL) OR ("remote_work_status" = ANY (ARRAY['full_remote'::"text", 'hybrid'::"text", 'on_site'::"text"]))))
);


ALTER TABLE "public"."ow_companies" OWNER TO "postgres";

--
-- Name: COLUMN "ow_companies"."industry"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_companies"."industry" IS '【非推奨】旧・業種テキスト。industry_id と saas_category_id に移行中。';


--
-- Name: COLUMN "ow_companies"."logo_url"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_companies"."logo_url" IS '企業ロゴ画像URL。運営が手動登録（Supabase Studio から直接 UPDATE）。null のとき logo_letter + logo_gradient でフォールバック表示。';


--
-- Name: COLUMN "ow_companies"."availability_days"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_companies"."availability_days" IS '面談受付曜日の配列（例: {"月","水","金"}）';


--
-- Name: COLUMN "ow_companies"."availability_times"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_companies"."availability_times" IS '面談受付時間帯の配列';


--
-- Name: COLUMN "ow_companies"."availability_notes"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_companies"."availability_notes" IS '面談に関する補足コメント（自由記述）';


--
-- Name: COLUMN "ow_companies"."listing_status"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_companies"."listing_status" IS '掲載状態: draft=非掲載, listed=事実情報として掲載（ディレクトリ）';


--
-- Name: COLUMN "ow_companies"."engagement_status"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_companies"."engagement_status" IS '企業との関係: none=未認証, verified=会社ドメイン認証済み, contracted=規約同意・求人公開中・成果報酬請求可';


--
-- Name: COLUMN "ow_companies"."jobs_public"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_companies"."jobs_public" IS '求人・面談OKを実際に表示するか（engagement_status = contracted のときのみ true 可）';


--
-- Name: COLUMN "ow_companies"."verified_at"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_companies"."verified_at" IS '会社ドメイン認証完了日時';


--
-- Name: COLUMN "ow_companies"."contracted_at"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_companies"."contracted_at" IS '規約同意 = 求人申込契約成立日時';


--
-- Name: COLUMN "ow_companies"."org_teams"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_companies"."org_teams" IS '組織体制・チーム情報 [{name, en_name, division, mission, description, roles[]}]';


--
-- Name: COLUMN "ow_companies"."reality_disclosure"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_companies"."reality_disclosure" IS 'リアル開示情報: { not_for: string, turnover_reasons: string[], onboarding_gaps: string }';


--
-- Name: COLUMN "ow_companies"."is_approved"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_companies"."is_approved" IS '運営が承認した企業のみ true。is_published=true にするには is_approved=true が前提。';


--
-- Name: ow_business_monthly_stats; Type: VIEW; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW "public"."ow_business_monthly_stats" AS
 SELECT "c"."id" AS "tenant_id",
    ("date_trunc"('month'::"text", "a"."applied_at"))::"date" AS "month",
    ("count"(*))::integer AS "applications",
    0 AS "scouts",
    ("count"(*) FILTER (WHERE (("a"."first_round_at" IS NOT NULL) OR ("a"."second_round_at" IS NOT NULL))))::integer AS "interviews",
    ("count"(*) FILTER (WHERE ("a"."offer_at" IS NOT NULL)))::integer AS "offers"
   FROM (("public"."ow_companies" "c"
     JOIN "public"."ow_jobs" "j" ON (("j"."company_id" = "c"."id")))
     LEFT JOIN "public"."ow_applications" "a" ON (("a"."job_id" = "j"."id")))
  WHERE ("a"."id" IS NOT NULL)
  GROUP BY "c"."id", ("date_trunc"('month'::"text", "a"."applied_at"));


ALTER VIEW "public"."ow_business_monthly_stats" OWNER TO "postgres";

--
-- Name: ow_business_todo_counts; Type: VIEW; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW "public"."ow_business_todo_counts" AS
 SELECT "c"."id" AS "tenant_id",
    (COALESCE("sum"(
        CASE
            WHEN (("a"."replied_at" IS NULL) AND ("a"."applied_at" < ("now"() - '5 days'::interval)) AND ("a"."status" = 'applied'::"text")) THEN 1
            ELSE 0
        END), (0)::bigint))::integer AS "reply_overdue",
    (COALESCE("sum"(
        CASE
            WHEN ("a"."applied_at" >= ("now"() - '24:00:00'::interval)) THEN 1
            ELSE 0
        END), (0)::bigint))::integer AS "new_applications",
    0 AS "scout_replies",
    0 AS "interviews_today"
   FROM (("public"."ow_companies" "c"
     LEFT JOIN "public"."ow_jobs" "j" ON (("j"."company_id" = "c"."id")))
     LEFT JOIN "public"."ow_applications" "a" ON (("a"."job_id" = "j"."id")))
  GROUP BY "c"."id";


ALTER VIEW "public"."ow_business_todo_counts" OWNER TO "postgres";

--
-- Name: ow_career_agent_leads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_career_agent_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "current_job" "text" NOT NULL,
    "timeline" "text" NOT NULL,
    "message" "text",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "admin_note" "text",
    "assigned_to" "text",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ow_career_agent_leads_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'contacted'::"text", 'meeting_scheduled'::"text", 'in_progress'::"text", 'closed'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."ow_career_agent_leads" OWNER TO "postgres";

--
-- Name: ow_career_follows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_career_follows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "follower_user_id" "uuid" NOT NULL,
    "target_profile_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ow_career_follows" OWNER TO "postgres";

--
-- Name: ow_career_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_career_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "headline" "text",
    "years_of_experience" integer,
    "is_published" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "gender" "text",
    "birth_year" integer
);


ALTER TABLE "public"."ow_career_profiles" OWNER TO "postgres";

--
-- Name: ow_casual_meetings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_casual_meetings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "job_id" "uuid",
    "share_profile" boolean DEFAULT true NOT NULL,
    "intent" "text",
    "interest_reason" "text",
    "questions" "text",
    "contact_email" "text" NOT NULL,
    "preferred_format" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "assignee_user_id" "uuid",
    "company_internal_memo" "text",
    "company_read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "conversation_id" "uuid",
    "completed_at" timestamp with time zone,
    CONSTRAINT "ow_casual_meetings_intent_check" CHECK (("intent" = ANY (ARRAY['info_gathering'::"text", 'good_opportunity'::"text", 'within_6'::"text", 'within_3'::"text"]))),
    CONSTRAINT "ow_casual_meetings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'company_contacted'::"text", 'scheduling'::"text", 'scheduled'::"text", 'completed'::"text", 'declined'::"text"])))
);


ALTER TABLE "public"."ow_casual_meetings" OWNER TO "postgres";

--
-- Name: COLUMN "ow_casual_meetings"."status"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_casual_meetings"."status" IS 'pending=新規受信, company_contacted=確認中, scheduling=日程調整中,
   scheduled=面談予定, completed=完了, declined=見送り';


--
-- Name: COLUMN "ow_casual_meetings"."conversation_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_casual_meetings"."conversation_id" IS '紐づく対話への参照 (Phase ν-1 で追加)。NULL = 対話未紐付け、まだ会話が始まっていない予約。';


--
-- Name: ow_company_admins; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_company_admins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "company_id" "uuid" NOT NULL,
    "department" "text",
    "role_title" "text",
    "permission" "text" DEFAULT 'member'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "invited_by_user_id" "uuid",
    "invitation_token" "text",
    "invited_email" "text",
    "invited_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "joined_at" timestamp with time zone,
    "is_default" boolean DEFAULT false NOT NULL,
    "is_ambassador" boolean DEFAULT false NOT NULL,
    "talk_themes" "text"[] DEFAULT '{}'::"text"[],
    "agreed_terms_business" boolean,
    "agreed_fee_15pct" boolean,
    "agreed_terms_version" "text",
    "agreed_at" timestamp with time zone,
    CONSTRAINT "ow_company_admins_permission_check" CHECK (("permission" = ANY (ARRAY['admin'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."ow_company_admins" OWNER TO "postgres";

--
-- Name: COLUMN "ow_company_admins"."is_ambassador"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_company_admins"."is_ambassador" IS '話せる人バッジ: true のメンバーは求職者向け /people ページに表示される（企業管理者が設定）';


--
-- Name: COLUMN "ow_company_admins"."agreed_terms_business"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_company_admins"."agreed_terms_business" IS '企業向け利用規約・プライバシーポリシーへの同意フラグ';


--
-- Name: COLUMN "ow_company_admins"."agreed_fee_15pct"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_company_admins"."agreed_fee_15pct" IS '成果報酬15%（理論年収ベース）への同意フラグ';


--
-- Name: COLUMN "ow_company_admins"."agreed_terms_version"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_company_admins"."agreed_terms_version" IS '同意時の規約バージョン（例: 2026-07）';


--
-- Name: COLUMN "ow_company_admins"."agreed_at"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_company_admins"."agreed_at" IS '同意日時';


--
-- Name: ow_company_culture_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_company_culture_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "tag_category" "text",
    "tag_value" "text"
);


ALTER TABLE "public"."ow_company_culture_tags" OWNER TO "postgres";

--
-- Name: ow_company_departments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_company_departments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "parent_id" "uuid",
    "name" "text" NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."ow_company_departments" OWNER TO "postgres";

--
-- Name: ow_company_domain_verifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_company_domain_verifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "domain" "text" NOT NULL,
    "token" "text" NOT NULL,
    "verified_at" timestamp with time zone,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ow_company_domain_verifications" OWNER TO "postgres";

--
-- Name: TABLE "ow_company_domain_verifications"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."ow_company_domain_verifications" IS '会社メールドメイン認証テーブル。認証完了で engagement_status を verified に更新する。';


--
-- Name: ow_company_employee_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_company_employee_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "role_id" "uuid",
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "custom_name" "text",
    "parent_role_id" "uuid",
    CONSTRAINT "ow_company_employee_categories_role_or_custom" CHECK ((("role_id" IS NOT NULL) OR ("custom_name" IS NOT NULL)))
);


ALTER TABLE "public"."ow_company_employee_categories" OWNER TO "postgres";

--
-- Name: TABLE "ow_company_employee_categories"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."ow_company_employee_categories" IS 'Phase Q: 企業ごとの現役社員カテゴリ表示設定。各企業がow_rolesから選択し、表示順を指定する。';


--
-- Name: ow_company_external_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_company_external_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "url" "text" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "thumbnail_url" "text",
    "source_name" "text",
    "published_at" timestamp with time zone,
    "created_by_role" "text" NOT NULL,
    "created_by_user_id" "uuid",
    "is_published" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ow_company_external_links_created_by_role_check" CHECK (("created_by_role" = ANY (ARRAY['company'::"text", 'editor'::"text"]))),
    CONSTRAINT "ow_company_external_links_type_check" CHECK (("type" = ANY (ARRAY['article'::"text", 'video'::"text", 'audio'::"text", 'social'::"text", 'event'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."ow_company_external_links" OWNER TO "postgres";

--
-- Name: TABLE "ow_company_external_links"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."ow_company_external_links" IS '企業発信リンク: 各企業に紐づく外部発信コンテンツ。BIZ admin と Opinio 編集部が独立して登録可能。';


--
-- Name: COLUMN "ow_company_external_links"."type"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_company_external_links"."type" IS 'article | video | audio | social | event | other';


--
-- Name: COLUMN "ow_company_external_links"."thumbnail_url"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_company_external_links"."thumbnail_url" IS 'OGP 画像 URL。元サイトの URL を直接保存 (Storage コピーは将来対応)';


--
-- Name: COLUMN "ow_company_external_links"."created_by_role"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_company_external_links"."created_by_role" IS 'company (BIZ admin が登録) | editor (Opinio 編集部が登録)';


--
-- Name: COLUMN "ow_company_external_links"."sort_order"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_company_external_links"."sort_order" IS '手動並び順。0 = デフォルト。published_at と組み合わせて表示順を制御';


--
-- Name: ow_company_follows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_company_follows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "follower_user_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ow_company_follows" OWNER TO "postgres";

--
-- Name: ow_company_genres; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_company_genres" (
    "company_id" "uuid" NOT NULL,
    "genre_id" "uuid" NOT NULL,
    "ai_confidence" numeric(3,2),
    "is_ai_suggested" boolean DEFAULT false NOT NULL,
    "is_human_approved" boolean DEFAULT false NOT NULL,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ow_company_genres" OWNER TO "postgres";

--
-- Name: ow_company_hidden_experiences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_company_hidden_experiences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "experience_id" "uuid" NOT NULL,
    "hidden_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hidden_by" "uuid"
);


ALTER TABLE "public"."ow_company_hidden_experiences" OWNER TO "postgres";

--
-- Name: ow_company_job_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_company_job_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "standard_role_id" "uuid",
    "display_order" integer DEFAULT 0 NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ow_company_job_roles" OWNER TO "postgres";

--
-- Name: ow_company_join_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_company_join_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "request_type" "text" NOT NULL,
    "target_company_id" "uuid",
    "new_company_name" "text",
    "new_company_url" "text",
    "new_company_description" "text",
    "requested_permission" "text" DEFAULT 'admin'::"text" NOT NULL,
    "request_message" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_request_type_data" CHECK (((("request_type" = 'join_existing'::"text") AND ("target_company_id" IS NOT NULL) AND ("new_company_name" IS NULL)) OR (("request_type" = 'create_new'::"text") AND ("target_company_id" IS NULL) AND ("new_company_name" IS NOT NULL)))),
    CONSTRAINT "ow_company_join_requests_request_type_check" CHECK (("request_type" = ANY (ARRAY['join_existing'::"text", 'create_new'::"text"]))),
    CONSTRAINT "ow_company_join_requests_requested_permission_check" CHECK (("requested_permission" = ANY (ARRAY['admin'::"text", 'member'::"text"]))),
    CONSTRAINT "ow_company_join_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."ow_company_join_requests" OWNER TO "postgres";

--
-- Name: ow_company_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_company_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "display_consent" boolean DEFAULT false NOT NULL,
    "consent_at" timestamp with time zone,
    "is_public" boolean DEFAULT false NOT NULL,
    "role_title" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "invite_token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invited_at" timestamp with time zone,
    "invited_by" "uuid",
    "talk_themes" "text"[],
    CONSTRAINT "check_public_requires_consent" CHECK ((("is_public" = false) OR ("display_consent" = true)))
);


ALTER TABLE "public"."ow_company_members" OWNER TO "postgres";

--
-- Name: TABLE "ow_company_members"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."ow_company_members" IS '社員アカウントの企業紐づけと本人同意管理';


--
-- Name: ow_company_office_photos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_company_office_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "image_url" "text" NOT NULL,
    "caption" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tagged_user_id" "uuid",
    CONSTRAINT "ow_company_office_photos_category_check" CHECK (("category" = ANY (ARRAY['workspace'::"text", 'meeting'::"text", 'welfare'::"text", 'event'::"text"])))
);


ALTER TABLE "public"."ow_company_office_photos" OWNER TO "postgres";

--
-- Name: ow_company_perspectives; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_company_perspectives" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "author" "text",
    "title" "text",
    "body_markdown" "text",
    "is_featured" boolean DEFAULT false NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ow_company_perspectives" OWNER TO "postgres";

--
-- Name: ow_company_posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_company_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "author_user_id" "uuid",
    "title" "text" NOT NULL,
    "body" "text" DEFAULT ''::"text" NOT NULL,
    "category" "text" DEFAULT 'culture'::"text" NOT NULL,
    "cover_image_url" "text",
    "is_published" boolean DEFAULT false NOT NULL,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ow_company_posts" OWNER TO "postgres";

--
-- Name: ow_company_reviews_archive_20260714; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_company_reviews_archive_20260714" (
    "id" "uuid",
    "company_id" "uuid",
    "user_id" "uuid",
    "content" "text",
    "role" "text",
    "rating" integer,
    "is_approved" boolean,
    "created_at" timestamp with time zone,
    "employment_status" "text",
    "rating_overall" smallint,
    "rating_culture" smallint,
    "rating_growth" smallint,
    "rating_wlb" smallint,
    "rating_compensation" smallint,
    "pros" "text",
    "cons" "text",
    "job_type" "text",
    "updated_at" timestamp with time zone,
    "rating_leadership" smallint,
    "rating_business" smallint,
    "rating_welfare" smallint
);


ALTER TABLE "public"."ow_company_reviews_archive_20260714" OWNER TO "postgres";

--
-- Name: ow_contact_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_contact_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "actor_user_id" "uuid",
    "candidate_user_id" "uuid",
    "job_id" "uuid",
    "action_type" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ow_contact_logs_action_type_check" CHECK (("action_type" = ANY (ARRAY['email_reveal'::"text", 'direct_message'::"text", 'job_apply_view'::"text", 'scout_view'::"text", 'profile_view'::"text"])))
);


ALTER TABLE "public"."ow_contact_logs" OWNER TO "postgres";

--
-- Name: ow_contact_submissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_contact_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action_type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "service" "text",
    "situation" "text",
    "message" "text",
    "ip" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ow_contact_submissions" OWNER TO "postgres";

--
-- Name: ow_conversation_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_conversation_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_participant_id" "uuid",
    "body" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "edited_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "ow_conversation_messages_body_length" CHECK ((("length"("body") >= 1) AND ("length"("body") <= 8000))),
    CONSTRAINT "ow_conversation_messages_deleted_after_sent" CHECK ((("deleted_at" IS NULL) OR ("deleted_at" >= "sent_at"))),
    CONSTRAINT "ow_conversation_messages_edited_after_sent" CHECK ((("edited_at" IS NULL) OR ("edited_at" >= "sent_at")))
);


ALTER TABLE "public"."ow_conversation_messages" OWNER TO "postgres";

--
-- Name: ow_conversation_participants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_conversation_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "role" "text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "left_at" timestamp with time zone,
    "last_read_at" timestamp with time zone,
    CONSTRAINT "ow_conversation_participants_left_after_joined" CHECK ((("left_at" IS NULL) OR ("left_at" >= "joined_at"))),
    CONSTRAINT "ow_conversation_participants_role_check" CHECK (("role" = ANY (ARRAY['candidate'::"text", 'company_admin'::"text", 'mentor'::"text", 'editor'::"text", 'operator'::"text"])))
);


ALTER TABLE "public"."ow_conversation_participants" OWNER TO "postgres";

--
-- Name: TABLE "ow_conversation_participants"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."ow_conversation_participants" IS '対話の参加者。動的参加モデルで、participant の追加・離脱を履歴として記録する。退会者(user_id IS NULL)の履歴も保持。Phase ν-1 で導入。';


--
-- Name: COLUMN "ow_conversation_participants"."user_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_conversation_participants"."user_id" IS '参加者の user_id。退会時は NULL に SET される(履歴保持、学び 70)。NULL の行は退会済みユーザーを意味する。';


--
-- Name: COLUMN "ow_conversation_participants"."role"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_conversation_participants"."role" IS '対話内ロール: candidate (求職者), company_admin (企業管理者), mentor (メンター), editor (編集部), operator (運営者・仲介役)。グローバルロールとは独立 (学び 69, M-5)。';


--
-- Name: COLUMN "ow_conversation_participants"."joined_at"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_conversation_participants"."joined_at" IS '参加開始時刻。再参加時は新規行が作られるので、その時の joined_at が記録される。';


--
-- Name: COLUMN "ow_conversation_participants"."left_at"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_conversation_participants"."left_at" IS '離脱時刻。NULL = アクティブ参加中。NOT NULL = 過去に離脱した(履歴保持)。学び 70 (運用優先): 削除せず履歴として残す。';


--
-- Name: COLUMN "ow_conversation_participants"."last_read_at"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_conversation_participants"."last_read_at" IS '最後にこの会話を既読にした日時。NULL = 一度も既読にしていない。B 画面アクセス時に now() で更新される。';


--
-- Name: ow_conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kind" "text" NOT NULL,
    "stage" "text" DEFAULT 'active'::"text" NOT NULL,
    "company_id" "uuid",
    "mentor_user_id" "uuid",
    "candidate_user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "last_message_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ow_conversations_kind_check" CHECK (("kind" = ANY (ARRAY['company'::"text", 'mentor'::"text", 'editor'::"text", 'direct_message'::"text"]))),
    CONSTRAINT "ow_conversations_kind_consistency" CHECK (((("kind" = 'company'::"text") AND ("company_id" IS NOT NULL) AND ("mentor_user_id" IS NULL)) OR (("kind" = 'mentor'::"text") AND ("company_id" IS NULL) AND ("mentor_user_id" IS NOT NULL)) OR (("kind" = 'editor'::"text") AND ("company_id" IS NULL) AND ("mentor_user_id" IS NULL)) OR (("kind" = 'direct_message'::"text") AND ("company_id" IS NULL) AND ("mentor_user_id" IS NOT NULL)))),
    CONSTRAINT "ow_conversations_stage_check" CHECK (("stage" = ANY (ARRAY['mediated'::"text", 'direct'::"text", 'active'::"text"]))),
    CONSTRAINT "ow_conversations_stage_consistency" CHECK (((("kind" = 'company'::"text") AND ("stage" = 'active'::"text")) OR (("kind" = 'mentor'::"text") AND ("stage" = ANY (ARRAY['mediated'::"text", 'direct'::"text"]))) OR (("kind" = 'editor'::"text") AND ("stage" = 'active'::"text")) OR (("kind" = 'direct_message'::"text") AND ("stage" = 'active'::"text")))),
    CONSTRAINT "ow_conversations_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."ow_conversations" OWNER TO "postgres";

--
-- Name: TABLE "ow_conversations"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."ow_conversations" IS 'Opinio 対話基盤の最上位テーブル。求職者と企業/メンター/編集部の対話を統一的に表現する。Phase ν-1 で導入。';


--
-- Name: COLUMN "ow_conversations"."kind"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_conversations"."kind" IS '対話種別: company (企業対話), mentor (メンター対話), editor (編集部対話)';


--
-- Name: COLUMN "ow_conversations"."stage"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_conversations"."stage" IS '対話フェーズ: mediated (運営者仲介中、kind=mentor のみ), direct (直接対話、kind=mentor のみ), active (kind=company/editor)';


--
-- Name: COLUMN "ow_conversations"."company_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_conversations"."company_id" IS 'kind=company の場合のみ NOT NULL。それ以外は NULL。';


--
-- Name: COLUMN "ow_conversations"."mentor_user_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_conversations"."mentor_user_id" IS 'kind=mentor の場合のみ NOT NULL。それ以外は NULL。';


--
-- Name: COLUMN "ow_conversations"."candidate_user_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_conversations"."candidate_user_id" IS '対話の主役(求職者)。全種別で必須。';


--
-- Name: COLUMN "ow_conversations"."last_message_at"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_conversations"."last_message_at" IS '最新メッセージの送信時刻。対話一覧の並べ替えに使用。新規作成時は NULL。';


--
-- Name: ow_experience_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_experience_roles" (
    "experience_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."ow_experience_roles" OWNER TO "postgres";

--
-- Name: ow_experience_stories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_experience_stories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "experience_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text",
    "description" "text",
    "image_url" "text",
    "video_url" "text",
    "link_url" "text",
    "period_start" "date",
    "period_end" "date",
    "sort_order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "section_id" "uuid",
    "og_image_url" "text",
    "og_title" "text",
    CONSTRAINT "ow_experience_stories_description_check" CHECK (("char_length"("description") <= 500)),
    CONSTRAINT "ow_experience_stories_image_url_check" CHECK (("char_length"("image_url") <= 1000)),
    CONSTRAINT "ow_experience_stories_link_url_check" CHECK (("char_length"("link_url") <= 1000)),
    CONSTRAINT "ow_experience_stories_title_check" CHECK (("char_length"("title") <= 100)),
    CONSTRAINT "ow_experience_stories_type_check" CHECK (("type" = ANY (ARRAY['image'::"text", 'card'::"text", 'video'::"text", 'link'::"text"]))),
    CONSTRAINT "ow_experience_stories_video_url_check" CHECK (("char_length"("video_url") <= 1000))
);


ALTER TABLE "public"."ow_experience_stories" OWNER TO "postgres";

--
-- Name: COLUMN "ow_experience_stories"."og_image_url"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_experience_stories"."og_image_url" IS 'Open Graph image URL fetched at save time. NULL if not fetched or fetch failed. Used for link type stories.';


--
-- Name: COLUMN "ow_experience_stories"."og_title"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_experience_stories"."og_title" IS 'Open Graph title fetched at save time. NULL if not fetched or fetch failed. Used for link type stories.';


--
-- Name: ow_experiences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_experiences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "company_id" "uuid",
    "company_text" "text",
    "company_anonymized" "text",
    "role_category_id" "uuid" NOT NULL,
    "role_title" "text",
    "started_at" "date" NOT NULL,
    "ended_at" "date",
    "is_current" boolean DEFAULT false NOT NULL,
    "description" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "join_reason" "text",
    "employment_type" "text",
    "salary_man" integer,
    "visibility_company" "text" DEFAULT 'masked'::"text" NOT NULL,
    "visibility_salary" boolean DEFAULT false NOT NULL,
    "visibility_reason" boolean DEFAULT true NOT NULL,
    "turning_point" "text",
    "exit_reason" "text",
    "rank" "text",
    "visibility_company_profile" "text" DEFAULT 'real'::"text" NOT NULL,
    "department" "text",
    "salary_base" integer,
    "salary_bonus" integer,
    "salary_stock" integer,
    "learnings" "text",
    "department_id" "uuid",
    CONSTRAINT "experience_company_xor" CHECK (((((("company_id" IS NOT NULL))::integer + (("company_text" IS NOT NULL))::integer) + (("company_anonymized" IS NOT NULL))::integer) = 1)),
    CONSTRAINT "ow_experiences_rank_check" CHECK (("rank" = ANY (ARRAY['none'::"text", 'leader'::"text", 'manager'::"text", 'general_manager'::"text", 'executive'::"text"]))),
    CONSTRAINT "ow_experiences_vc_profile_check" CHECK (("visibility_company_profile" = ANY (ARRAY['real'::"text", 'masked'::"text", 'hidden'::"text"]))),
    CONSTRAINT "ow_experiences_visibility_company_check" CHECK (("visibility_company" = ANY (ARRAY['real'::"text", 'masked'::"text", 'hidden'::"text"])))
);


ALTER TABLE "public"."ow_experiences" OWNER TO "postgres";

--
-- Name: COLUMN "ow_experiences"."role_category_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_experiences"."role_category_id" IS '【非推奨】ow_experience_roles に移行済み。新規コードでは ow_experience_roles を使うこと。';


--
-- Name: COLUMN "ow_experiences"."rank"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_experiences"."rank" IS '役職グレード: none=役職なし / leader=係長・リーダー / manager=課長・マネージャー / general_manager=部長・GM / executive=役員';


--
-- Name: COLUMN "ow_experiences"."visibility_company_profile"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_experiences"."visibility_company_profile" IS 'プロフィールページ (/u/[id]) での企業名表示制御: real=実名 / masked=業界・規模で表示 / hidden=この職歴を非表示';


--
-- Name: COLUMN "ow_experiences"."department"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_experiences"."department" IS '部署名（例: エンタープライズ営業本部、プロダクト開発部）';


--
-- Name: COLUMN "ow_experiences"."salary_base"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_experiences"."salary_base" IS '年収内訳: ベースの給与（基本給＋残業代等の合計、万円）';


--
-- Name: COLUMN "ow_experiences"."salary_bonus"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_experiences"."salary_bonus" IS '年収内訳: 賞与・インセンティブ（年間合計、万円）';


--
-- Name: COLUMN "ow_experiences"."salary_stock"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_experiences"."salary_stock" IS '年収内訳: 株式報酬（RSU/SO 年間換算額、万円）';


--
-- Name: ow_favorites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "target_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ow_favorites_target_type_check" CHECK (("target_type" = ANY (ARRAY['company'::"text", 'job'::"text"])))
);


ALTER TABLE "public"."ow_favorites" OWNER TO "postgres";

--
-- Name: ow_genres; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_genres" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ow_genres" OWNER TO "postgres";

--
-- Name: ow_industries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_industries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parent_id" "uuid",
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ow_industries" OWNER TO "postgres";

--
-- Name: TABLE "ow_industries"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."ow_industries" IS '業種マスタ。企業が属する産業。SaaSカテゴリ（何を売っているか）とは別軸。';


--
-- Name: ow_invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "amount" integer NOT NULL,
    "invoice_date" "date" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "related_candidate_id" "uuid",
    "related_job_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ow_invoices_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'refunded'::"text", 'void'::"text"])))
);


ALTER TABLE "public"."ow_invoices" OWNER TO "postgres";

--
-- Name: ow_job_applications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_job_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "message" "text",
    "resume_url" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "conversation_id" "uuid",
    "source" "text" DEFAULT 'opinio'::"text" NOT NULL,
    "agent_company" "text",
    "pipeline_stage_id" "uuid",
    "external_name" "text",
    "external_email" "text",
    "memo" "text",
    "agency_id" "uuid",
    "hired_confirmed_at" timestamp with time zone,
    "hired_salary" integer,
    "billing_status" "text" DEFAULT 'unpaid'::"text" NOT NULL,
    "billing_note" "text",
    "invoiced_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    CONSTRAINT "ow_job_applications_billing_status_check" CHECK (("billing_status" = ANY (ARRAY['unpaid'::"text", 'invoiced'::"text", 'paid'::"text"]))),
    CONSTRAINT "ow_job_applications_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewing'::"text", 'interview'::"text", 'accepted'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."ow_job_applications" OWNER TO "postgres";

--
-- Name: COLUMN "ow_job_applications"."conversation_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_job_applications"."conversation_id" IS '紐づく対話への参照 (Phase ν-1 で追加)。NULL = 対話未紐付け。';


--
-- Name: ow_job_assignees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_job_assignees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ow_job_assignees" OWNER TO "postgres";

--
-- Name: ow_job_favorites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_job_favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ow_job_favorites" OWNER TO "postgres";

--
-- Name: ow_job_matching_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_job_matching_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid",
    "tag_category" "text",
    "tag_value" "text"
);


ALTER TABLE "public"."ow_job_matching_tags" OWNER TO "postgres";

--
-- Name: ow_job_requirements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_job_requirements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid",
    "requirement_type" "text",
    "content" "text",
    "display_order" integer DEFAULT 0
);


ALTER TABLE "public"."ow_job_requirements" OWNER TO "postgres";

--
-- Name: ow_job_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_job_roles" (
    "job_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."ow_job_roles" OWNER TO "postgres";

--
-- Name: ow_match_scores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_match_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "overall_score" integer DEFAULT 0,
    "culture_score" integer DEFAULT 0,
    "skill_score" integer DEFAULT 0,
    "career_score" integer DEFAULT 0,
    "workstyle_score" integer DEFAULT 0,
    "match_reasons" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ow_match_scores" OWNER TO "postgres";

--
-- Name: ow_matches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "job_id" "uuid",
    "match_score" double precision,
    "match_reasons" "text"[],
    "viewed_by_company" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ow_matches" OWNER TO "postgres";

--
-- Name: ow_meeting_feedbacks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_meeting_feedbacks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "rating" smallint NOT NULL,
    "comment" "text",
    "helpful_tags" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ow_meeting_feedbacks_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."ow_meeting_feedbacks" OWNER TO "postgres";

--
-- Name: TABLE "ow_meeting_feedbacks"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."ow_meeting_feedbacks" IS 'カジュアル面談後のフィードバック（内部用）';


--
-- Name: ow_mentor_reservations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_mentor_reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "ambassador_id" "uuid",
    "ambassador_user_id" "uuid",
    "themes" "text"[],
    "current_situation" "text",
    "questions" "text",
    "background" "text",
    "preferred_days" "text"[],
    "preferred_times" "text"[],
    "contact_email" "text" NOT NULL,
    "preferred_platform" "text",
    "status" "text" DEFAULT 'pending_review'::"text" NOT NULL,
    "editor_note" "text",
    "mentor_note" "text",
    "scheduled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ow_mentor_reservations_status_check" CHECK (("status" = ANY (ARRAY['pending_review'::"text", 'approved'::"text", 'rejected'::"text", 'scheduled'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."ow_mentor_reservations" OWNER TO "postgres";

--
-- Name: ow_message_reads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_message_reads" (
    "message_id" "uuid" NOT NULL,
    "participant_id" "uuid" NOT NULL,
    "read_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ow_message_reads" OWNER TO "postgres";

--
-- Name: ow_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "sender_id" "uuid",
    "sender_type" "text" DEFAULT 'candidate'::"text",
    "content" "text" NOT NULL,
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ow_messages" OWNER TO "postgres";

--
-- Name: ow_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_user_id" "uuid" NOT NULL,
    "actor_user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "comment_id" "uuid",
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ow_notifications_type_check" CHECK (("type" = ANY (ARRAY['like'::"text", 'comment'::"text"])))
);


ALTER TABLE "public"."ow_notifications" OWNER TO "postgres";

--
-- Name: ow_page_views; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_page_views" (
    "id" bigint NOT NULL,
    "path" "text" NOT NULL,
    "referrer_host" "text",
    "page_type" "text",
    "target_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ow_page_views" OWNER TO "postgres";

--
-- Name: TABLE "ow_page_views"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."ow_page_views" IS '匿名ページビューログ。個人を特定できる情報（user_id / IP / User-Agent）は保存しない。90日で自動削除。';


--
-- Name: ow_page_views_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE IF NOT EXISTS "public"."ow_page_views_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ow_page_views_id_seq" OWNER TO "postgres";

--
-- Name: ow_page_views_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "public"."ow_page_views_id_seq" OWNED BY "public"."ow_page_views"."id";


--
-- Name: ow_pipeline_stages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_pipeline_stages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#64748B'::"text" NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "is_hired" boolean DEFAULT false NOT NULL,
    "is_rejected" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ow_pipeline_stages" OWNER TO "postgres";

--
-- Name: ow_placements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_placements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "job_id" "uuid",
    "joined_at" "date" NOT NULL,
    "channel" "text" NOT NULL,
    "annual_salary" integer,
    "fee_amount" integer,
    "resigned_at" "date",
    "resignation_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "previous_annual_salary" integer,
    "previous_role_id" "uuid",
    "current_role_id" "uuid",
    "previous_industry" "text",
    "years_of_experience" integer,
    CONSTRAINT "ow_placements_channel_check" CHECK (("channel" = ANY (ARRAY['platform'::"text", 'agent'::"text"]))),
    CONSTRAINT "ow_placements_resignation_reason_check" CHECK (("resignation_reason" = ANY (ARRAY['voluntary'::"text", 'company'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."ow_placements" OWNER TO "postgres";

--
-- Name: TABLE "ow_placements"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."ow_placements" IS 'Opinioの紹介による就職実績。職業安定法の許可条件（転職勧奨の禁止・2年間）の判定に使用する。';


--
-- Name: COLUMN "ow_placements"."joined_at"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_placements"."joined_at" IS '入社日。この日から2年間、当該候補者への転職勧奨（スカウト送信を含む）を行ってはならない。';


--
-- Name: ow_post_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_post_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ow_post_comments_content_check" CHECK ((("char_length"("content") >= 1) AND ("char_length"("content") <= 300)))
);


ALTER TABLE "public"."ow_post_comments" OWNER TO "postgres";

--
-- Name: TABLE "ow_post_comments"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."ow_post_comments" IS 'ow_posts へのコメント（1投稿あたり最大50件表示）';


--
-- Name: COLUMN "ow_post_comments"."content"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_post_comments"."content" IS '本文 1〜300文字';


--
-- Name: ow_post_hire_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_post_hire_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "company_id" "uuid",
    "months_after" integer NOT NULL,
    "culture_match" integer,
    "workstyle_match" integer,
    "salary_match" integer,
    "overall_satisfaction" integer,
    "good_points" "text",
    "concerns" "text",
    "gap_from_expectation" "text",
    "would_recommend" boolean,
    "is_published" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ow_post_hire_reports_culture_match_check" CHECK ((("culture_match" >= 1) AND ("culture_match" <= 5))),
    CONSTRAINT "ow_post_hire_reports_months_after_check" CHECK (("months_after" = ANY (ARRAY[3, 6, 12]))),
    CONSTRAINT "ow_post_hire_reports_overall_satisfaction_check" CHECK ((("overall_satisfaction" >= 1) AND ("overall_satisfaction" <= 5))),
    CONSTRAINT "ow_post_hire_reports_salary_match_check" CHECK ((("salary_match" >= 1) AND ("salary_match" <= 5))),
    CONSTRAINT "ow_post_hire_reports_workstyle_match_check" CHECK ((("workstyle_match" >= 1) AND ("workstyle_match" <= 5)))
);


ALTER TABLE "public"."ow_post_hire_reports" OWNER TO "postgres";

--
-- Name: ow_post_likes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_post_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ow_post_likes" OWNER TO "postgres";

--
-- Name: TABLE "ow_post_likes"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."ow_post_likes" IS 'ow_posts へのいいね（ユーザーごとに1回）';


--
-- Name: ow_posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "link_url" "text",
    "link_title" "text",
    "link_image_url" "text",
    "link_description" "text",
    "link_domain" "text",
    "post_type" "text" DEFAULT 'user_post'::"text" NOT NULL,
    "ref_company_id" "uuid",
    "ref_job_id" "uuid",
    "ref_article_id" "uuid",
    "ref_user_id" "uuid",
    "event_title" "text",
    "event_starts_at" timestamp with time zone,
    "event_location" "text",
    CONSTRAINT "ow_posts_content_check" CHECK ((("char_length"("content") >= 1) AND ("char_length"("content") <= 1000)))
);


ALTER TABLE "public"."ow_posts" OWNER TO "postgres";

--
-- Name: TABLE "ow_posts"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."ow_posts" IS 'ユーザーのアクティビティ投稿（LinkedIn/Wantedly スタイル）';


--
-- Name: COLUMN "ow_posts"."link_url"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_posts"."link_url" IS '投稿本文から抽出したリンクプレビュー対象URL（最初の1件）';


--
-- Name: COLUMN "ow_posts"."link_title"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_posts"."link_title" IS 'OGPから取得したページタイトル（og:title）';


--
-- Name: COLUMN "ow_posts"."link_image_url"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_posts"."link_image_url" IS 'OGPから取得したサムネイル画像URL（og:image）';


--
-- Name: COLUMN "ow_posts"."link_description"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_posts"."link_description" IS 'OGPから取得したページ説明（og:description）';


--
-- Name: COLUMN "ow_posts"."link_domain"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_posts"."link_domain" IS 'link_url から算出したホスト名（表示用）';


--
-- Name: ow_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text",
    "name_kana" "text",
    "location" "text",
    "job_type" "text",
    "experience_years" "text",
    "desired_salary_min" integer,
    "desired_salary_max" integer,
    "desired_work_style" "text",
    "desired_phase" "text"[],
    "transfer_timing" "text",
    "skills" "text"[],
    "tools" "text"[],
    "bio" "text",
    "photo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "onboarding_completed" boolean DEFAULT false,
    "worry" "text",
    "scout_enabled" boolean
);


ALTER TABLE "public"."ow_profiles" OWNER TO "postgres";

--
-- Name: COLUMN "ow_profiles"."scout_enabled"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_profiles"."scout_enabled" IS 'スカウトを受け取るか。null = 未選択（企業に非公開）。登録フローで必ず選択させる。';


--
-- Name: ow_role_aliases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_role_aliases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role_id" "uuid" NOT NULL,
    "alias" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ow_role_aliases" OWNER TO "postgres";

--
-- Name: TABLE "ow_role_aliases"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."ow_role_aliases" IS '職種の別名。検索時のシノニム展開に使う。例: バックエンド ← サーバーサイドエンジニア';


--
-- Name: ow_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parent_id" "uuid",
    "name" "text" NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "icon_color" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "level" smallint,
    "slug" "text",
    "name_en" "text",
    "is_it_saas" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "merged_into_id" "uuid"
);


ALTER TABLE "public"."ow_roles" OWNER TO "postgres";

--
-- Name: COLUMN "ow_roles"."level"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_roles"."level" IS '階層。1=大分類, 2=中分類, 3=小分類。IT/SaaS系のみ3層を使う。';


--
-- Name: COLUMN "ow_roles"."is_it_saas"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_roles"."is_it_saas" IS 'IT/SaaS系の職種か。検索の重み付け・3層判定に使う。';


--
-- Name: COLUMN "ow_roles"."merged_into_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_roles"."merged_into_id" IS '職種を統廃合した場合の統合先。物理削除せず、過去データの参照を壊さない。';


--
-- Name: ow_saas_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_saas_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ow_saas_categories" OWNER TO "postgres";

--
-- Name: TABLE "ow_saas_categories"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."ow_saas_categories" IS 'SaaSのプロダクトカテゴリ。HR Tech、FinTech等。業種（産業）とは別軸で、IT/SaaS企業のみが持つ。';


--
-- Name: ow_salary_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_salary_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "role_id" "uuid" NOT NULL,
    "years_of_experience" smallint,
    "annual_salary" integer,
    "employment_status" "text" NOT NULL,
    "prefecture" "text",
    "is_approved" boolean DEFAULT false NOT NULL,
    "is_flagged" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "base_salary" integer,
    "bonus_salary" integer,
    "incentive" integer,
    "stock_options" integer,
    "proxy_note" "text",
    "start_year_month" "text",
    "end_year_month" "text",
    "grade" "text",
    "ote" integer,
    "achievement_rate" integer,
    "allowances" integer,
    "fixed_overtime" integer,
    CONSTRAINT "ow_salary_reports_achievement_rate_check" CHECK ((("achievement_rate" IS NULL) OR (("achievement_rate" >= 0) AND ("achievement_rate" <= 500)))),
    CONSTRAINT "ow_salary_reports_annual_salary_check" CHECK ((("annual_salary" >= 1000000) AND ("annual_salary" <= 500000000))),
    CONSTRAINT "ow_salary_reports_employment_status_check" CHECK (("employment_status" = ANY (ARRAY['current'::"text", 'alumni'::"text"]))),
    CONSTRAINT "ow_salary_reports_end_ym_check" CHECK ((("end_year_month" IS NULL) OR ("end_year_month" ~ '^\d{4}-(0[1-9]|1[0-2])$'::"text"))),
    CONSTRAINT "ow_salary_reports_ote_check" CHECK ((("ote" IS NULL) OR (("ote" >= 1000000) AND ("ote" <= 500000000)))),
    CONSTRAINT "ow_salary_reports_start_ym_check" CHECK ((("start_year_month" IS NULL) OR ("start_year_month" ~ '^\d{4}-(0[1-9]|1[0-2])$'::"text"))),
    CONSTRAINT "ow_salary_reports_years_of_experience_check" CHECK ((("years_of_experience" >= 0) AND ("years_of_experience" <= 50)))
);


ALTER TABLE "public"."ow_salary_reports" OWNER TO "postgres";

--
-- Name: ow_salary_reports_archive_20260714; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_salary_reports_archive_20260714" (
    "id" "uuid",
    "company_id" "uuid",
    "user_id" "uuid",
    "job_type" "text",
    "years_of_experience" smallint,
    "annual_salary" integer,
    "employment_status" "text",
    "is_approved" boolean,
    "created_at" timestamp with time zone
);


ALTER TABLE "public"."ow_salary_reports_archive_20260714" OWNER TO "postgres";

--
-- Name: ow_saved_companies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_saved_companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "company_id" "uuid",
    "saved_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ow_saved_companies" OWNER TO "postgres";

--
-- Name: ow_saved_jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_saved_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "job_id" "uuid",
    "saved_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ow_saved_jobs" OWNER TO "postgres";

--
-- Name: ow_school_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_school_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requested_by" "uuid" NOT NULL,
    "school_name" "text" NOT NULL,
    "school_name_kana" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "approved_school_id" "uuid",
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ow_school_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."ow_school_requests" OWNER TO "postgres";

--
-- Name: ow_schools; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_schools" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "name_kana" "text",
    "logo_url" "text",
    "logo_gradient" "text",
    "logo_letter" "text",
    "country" "text" DEFAULT 'JP'::"text" NOT NULL,
    "type" "text" DEFAULT 'university'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ow_schools_type_check" CHECK (("type" = ANY (ARRAY['university'::"text", 'graduate_school'::"text", 'college'::"text", 'highschool'::"text", 'vocational'::"text"])))
);


ALTER TABLE "public"."ow_schools" OWNER TO "postgres";

--
-- Name: TABLE "ow_schools"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."ow_schools" IS 'School master table for education timeline logos. Read-only for authenticated users.';


--
-- Name: COLUMN "ow_schools"."logo_url"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_schools"."logo_url" IS 'Official school logo URL. NULL in stage 6-6, filled by admin per consent in stage 6-7+.';


--
-- Name: COLUMN "ow_schools"."logo_gradient"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_schools"."logo_gradient" IS '2-color CSS linear-gradient for letter fallback display.';


--
-- Name: COLUMN "ow_schools"."logo_letter"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_schools"."logo_letter" IS 'Single character (or short letters like "ICU") for fallback display.';


--
-- Name: ow_scout_blocks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_scout_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ow_scout_blocks" OWNER TO "postgres";

--
-- Name: TABLE "ow_scout_blocks"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."ow_scout_blocks" IS '求職者が手動でブロックした企業。在籍企業（ow_experiences）は自動ブロックされるため、ここに登録する必要はない。';


--
-- Name: ow_scout_quotas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_scout_quotas" (
    "company_id" "uuid" NOT NULL,
    "monthly_limit" integer DEFAULT 30 NOT NULL,
    "bonus_credits" integer DEFAULT 0 NOT NULL,
    "used_this_month" integer DEFAULT 0 NOT NULL,
    "period_start" "date" DEFAULT ("date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone))::"date" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ow_scout_quotas" OWNER TO "postgres";

--
-- Name: TABLE "ow_scout_quotas"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."ow_scout_quotas" IS '企業のスカウト送信枠。monthly_limit は毎月リセット、bonus_credits は運営が付与し繰り越される。';


--
-- Name: ow_scouts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_scouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "candidate_id" "uuid",
    "job_id" "uuid",
    "message" "text",
    "status" "text" DEFAULT 'sent'::"text",
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "conversation_id" "uuid",
    "replied_at" timestamp with time zone,
    CONSTRAINT "ow_scouts_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'read'::"text", 'interested'::"text", 'declined'::"text"])))
);


ALTER TABLE "public"."ow_scouts" OWNER TO "postgres";

--
-- Name: ow_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_settings" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ow_settings" OWNER TO "postgres";

--
-- Name: TABLE "ow_settings"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."ow_settings" IS '運営が切り替えられる設定値。review_gate_enabled で Give First の ON/OFF ができる。';


--
-- Name: ow_story_sections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_story_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "experience_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ow_story_sections_name_check" CHECK (("char_length"("name") <= 50))
);


ALTER TABLE "public"."ow_story_sections" OWNER TO "postgres";

--
-- Name: TABLE "ow_story_sections"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."ow_story_sections" IS '職歴ストーリーのセクション定義。1 職歴 = 0..N セクション。section_id=NULL のストーリーは「未分類」エリアに表示される。セクション削除時は stories の section_id が SET NULL となり未分類へ移動(stories は消えない)。';


--
-- Name: ow_tenant_plans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_tenant_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "plan_type" "text" NOT NULL,
    "monthly_fee" integer,
    "performance_rate" numeric(4,3),
    "started_at" timestamp with time zone DEFAULT "now"(),
    "ended_at" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ow_tenant_plans_plan_type_check" CHECK (("plan_type" = ANY (ARRAY['performance'::"text", 'saas_monthly'::"text", 'saas_yearly'::"text"]))),
    CONSTRAINT "ow_tenant_plans_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'ended'::"text"])))
);


ALTER TABLE "public"."ow_tenant_plans" OWNER TO "postgres";

--
-- Name: ow_terms_agreements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_terms_agreements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "company_id" "uuid",
    "terms_type" "text" NOT NULL,
    "terms_version" "text" NOT NULL,
    "agreed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ip_address" "inet",
    "user_agent" "text"
);


ALTER TABLE "public"."ow_terms_agreements" OWNER TO "postgres";

--
-- Name: ow_threads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'casual_requested'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "company_name" "text",
    "last_message" "text",
    "unread_count" integer DEFAULT 0
);


ALTER TABLE "public"."ow_threads" OWNER TO "postgres";

--
-- Name: ow_user_achievements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_user_achievements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "value" integer,
    "unit" "text",
    "description" "text",
    "period_start" "date",
    "period_end" "date",
    "sort_order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ow_user_achievements_description_check" CHECK (("char_length"("description") <= 500)),
    CONSTRAINT "ow_user_achievements_title_check" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 100))),
    CONSTRAINT "ow_user_achievements_unit_check" CHECK (("char_length"("unit") <= 20))
);


ALTER TABLE "public"."ow_user_achievements" OWNER TO "postgres";

--
-- Name: ow_user_awards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_user_awards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "issuer" "text",
    "awarded_at" "date",
    "description" "text",
    "sort_order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ow_user_awards_description_check" CHECK (("char_length"("description") <= 500)),
    CONSTRAINT "ow_user_awards_issuer_check" CHECK (("char_length"("issuer") <= 100)),
    CONSTRAINT "ow_user_awards_title_check" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 200)))
);


ALTER TABLE "public"."ow_user_awards" OWNER TO "postgres";

--
-- Name: ow_user_certifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_user_certifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ow_user_certifications_name_check" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 100)))
);


ALTER TABLE "public"."ow_user_certifications" OWNER TO "postgres";

--
-- Name: TABLE "ow_user_certifications"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."ow_user_certifications" IS '求職者の保有資格。1ユーザー = 0..N レコード、sort_order で表示順管理。';


--
-- Name: ow_user_content_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_user_content_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "url" "text" NOT NULL,
    "platform" "text",
    "title" "text",
    "description" "text",
    "thumbnail_url" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ow_user_content_links" OWNER TO "postgres";

--
-- Name: ow_user_educations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_user_educations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "school" "text" NOT NULL,
    "faculty" "text",
    "degree" "text",
    "enrolled_at" "date",
    "graduated_at" "date",
    "is_current" boolean DEFAULT false NOT NULL,
    "sort_order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "school_id" "uuid",
    CONSTRAINT "ow_user_educations_degree_check" CHECK (("degree" = ANY (ARRAY['高校卒'::"text", '専門卒'::"text", '短大卒'::"text", '学士'::"text", '修士'::"text", '博士'::"text", 'その他'::"text"]))),
    CONSTRAINT "ow_user_educations_faculty_check" CHECK (("char_length"("faculty") <= 100)),
    CONSTRAINT "ow_user_educations_school_check" CHECK ((("char_length"("school") >= 1) AND ("char_length"("school") <= 100)))
);


ALTER TABLE "public"."ow_user_educations" OWNER TO "postgres";

--
-- Name: TABLE "ow_user_educations"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."ow_user_educations" IS '求職者の学歴。1ユーザー = 0..N レコード、sort_order で表示順管理。';


--
-- Name: COLUMN "ow_user_educations"."school_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_user_educations"."school_id" IS 'Optional FK to ow_schools master. NULL for legacy data and free-text-only entries. Filled when user selects from master in EducationEditor.';


--
-- Name: ow_user_media_appearances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_user_media_appearances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "media_name" "text",
    "url" "text",
    "thumbnail_url" "text",
    "appeared_at" "date",
    "description" "text",
    "sort_order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ow_user_media_appearances_description_check" CHECK (("char_length"("description") <= 500)),
    CONSTRAINT "ow_user_media_appearances_media_name_check" CHECK (("char_length"("media_name") <= 100)),
    CONSTRAINT "ow_user_media_appearances_thumbnail_url_check" CHECK (("char_length"("thumbnail_url") <= 1000)),
    CONSTRAINT "ow_user_media_appearances_title_check" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 200))),
    CONSTRAINT "ow_user_media_appearances_url_check" CHECK (("char_length"("url") <= 1000))
);


ALTER TABLE "public"."ow_user_media_appearances" OWNER TO "postgres";

--
-- Name: ow_user_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_user_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "preferred_job_types" "text"[],
    "preferred_locations" "text"[],
    "salary_min" integer,
    "salary_max" integer,
    "work_style" "text",
    "experience_years" integer,
    "current_job_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ow_user_profiles" OWNER TO "postgres";

--
-- Name: ow_user_recommendations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_user_recommendations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "target_user_id" "uuid" NOT NULL,
    "recommender_user_id" "uuid",
    "recommender_name" "text" NOT NULL,
    "recommender_title" "text",
    "recommender_company" "text",
    "relationship" "text",
    "content" "text" NOT NULL,
    "is_visible" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ow_user_recommendations_content_check" CHECK ((("char_length"("content") >= 10) AND ("char_length"("content") <= 1000)))
);


ALTER TABLE "public"."ow_user_recommendations" OWNER TO "postgres";

--
-- Name: ow_user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid",
    CONSTRAINT "ow_user_roles_role_check" CHECK (("role" = ANY (ARRAY['candidate'::"text", 'company'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."ow_user_roles" OWNER TO "postgres";

--
-- Name: ow_user_skill_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_user_skill_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer NOT NULL,
    "master_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ow_user_skill_tags_label_length" CHECK ((("char_length"("label") >= 1) AND ("char_length"("label") <= 50)))
);


ALTER TABLE "public"."ow_user_skill_tags" OWNER TO "postgres";

--
-- Name: TABLE "ow_user_skill_tags"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."ow_user_skill_tags" IS 'ユーザーのスキルタグ。ν-8 では自由入力、ν-9 以降でマスタ化を検討（master_id 伏線）。';


--
-- Name: COLUMN "ow_user_skill_tags"."label"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_user_skill_tags"."label" IS 'タグ表示文字列。ν-8 では自由入力、1〜50字。';


--
-- Name: COLUMN "ow_user_skill_tags"."sort_order"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_user_skill_tags"."sort_order" IS '入力順を保持するための整数。フロントで上限15個ソフトリミット。';


--
-- Name: COLUMN "ow_user_skill_tags"."master_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_user_skill_tags"."master_id" IS 'ν-9 以降でスキルマスタ化したときの fk。ν-8 では常に null。';


--
-- Name: ow_user_socials; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_user_socials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "url" "text" NOT NULL,
    "username" "text",
    "custom_label" "text",
    "sort_order" integer NOT NULL,
    "verified" boolean DEFAULT false NOT NULL,
    "oauth_token" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ow_user_socials_platform_check" CHECK (("platform" = ANY (ARRAY['note'::"text", 'x'::"text", 'github'::"text", 'linkedin'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."ow_user_socials" OWNER TO "postgres";

--
-- Name: TABLE "ow_user_socials"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."ow_user_socials" IS 'ユーザーのSNS連携。ν-8 ではURL貼付のみ、ν-9 以降でOAuth連携を検討（verified/oauth_token 伏線）。';


--
-- Name: COLUMN "ow_user_socials"."platform"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_user_socials"."platform" IS 'プラットフォーム種別。note/x/github/linkedin の4種固定 + その他枠。';


--
-- Name: COLUMN "ow_user_socials"."url"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_user_socials"."url" IS '生 URL。ユーザーが直接貼り付け。';


--
-- Name: COLUMN "ow_user_socials"."username"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_user_socials"."username" IS '@hisato_shiba 等のハンドル。URLから自動抽出（フロント実装）。';


--
-- Name: COLUMN "ow_user_socials"."custom_label"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_user_socials"."custom_label" IS 'platform=other のときの表示名（任意）。例: Wantedly, YouTube';


--
-- Name: COLUMN "ow_user_socials"."sort_order"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_user_socials"."sort_order" IS '表示順制御。ν-8 では platform 固定順 + その他枠は入力順。';


--
-- Name: COLUMN "ow_user_socials"."verified"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_user_socials"."verified" IS 'ν-9 で OAuth 連携時に true。ν-8 では常に false。';


--
-- Name: COLUMN "ow_user_socials"."oauth_token"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_user_socials"."oauth_token" IS 'ν-9 以降で OAuth 連携時に保存。ν-8 では常に null。暗号化推奨。';


--
-- Name: ow_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ow_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_id" "uuid",
    "email" "text" NOT NULL,
    "name" "text" NOT NULL,
    "avatar_color" "text",
    "cover_color" "text",
    "about_me" "text",
    "location" "text",
    "social_links" "jsonb",
    "is_mentor" boolean DEFAULT false NOT NULL,
    "mentor_registered_at" timestamp with time zone,
    "mentor_themes" "text"[],
    "is_active_mentor" boolean DEFAULT false NOT NULL,
    "visibility" "text" DEFAULT 'login_only'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "future_aspirations" "text",
    "birth_date" "date",
    "cover_photo_url" "text",
    "avatar_url" "text",
    "is_open_to_work" boolean DEFAULT false NOT NULL,
    "can_casual_meeting" boolean DEFAULT false NOT NULL,
    "catchphrase" "text",
    "profile_setup_at" timestamp with time zone,
    "can_talk_to_candidates" boolean DEFAULT false NOT NULL,
    "can_talk_to_hr" boolean DEFAULT false NOT NULL,
    "statistics_opt_out" boolean DEFAULT false NOT NULL,
    "is_system" boolean DEFAULT false NOT NULL,
    "username" "text",
    "is_test" boolean DEFAULT false NOT NULL,
    CONSTRAINT "future_aspirations_length_check" CHECK (("char_length"("future_aspirations") <= 500)),
    CONSTRAINT "ow_users_visibility_check" CHECK (("visibility" = ANY (ARRAY['public'::"text", 'login_only'::"text", 'private'::"text"])))
);


ALTER TABLE "public"."ow_users" OWNER TO "postgres";

--
-- Name: COLUMN "ow_users"."about_me"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_users"."about_me" IS '自己紹介テキスト。200字推奨。/profile/edit 基本情報タブから編集。';


--
-- Name: COLUMN "ow_users"."visibility"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_users"."visibility" IS 'プロフィールの公開範囲。public = 誰でも閲覧可 / login_only = ログインユーザーのみ / private = 本人のみ。デフォルトは login_only（同意なき公開を防ぐため）。';


--
-- Name: COLUMN "ow_users"."future_aspirations"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_users"."future_aspirations" IS 'Wantedly 「この先やってみたいこと」相当。次に挑戦したいこと・実現したい未来を自由記述（上限500文字）。';


--
-- Name: COLUMN "ow_users"."birth_date"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_users"."birth_date" IS '生年月日。NULL の場合は年齢非公開扱い。サーバ側で年齢計算に使用、公開ページには直接渡さない（プライバシー保護）。';


--
-- Name: COLUMN "ow_users"."is_open_to_work"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_users"."is_open_to_work" IS '転職を検討中かどうかのフラグ。public プロフィールページに「転職検討中」バッジとして表示される。';


--
-- Name: COLUMN "ow_users"."can_casual_meeting"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_users"."can_casual_meeting" IS '人事または管理者が個別に設定。trueの人だけカジュアル面談ボタンが表示される。';


--
-- Name: COLUMN "ow_users"."can_talk_to_candidates"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_users"."can_talk_to_candidates" IS '本人が設定。他の候補者から話しかけられることを許可する意思表示フラグ。';


--
-- Name: COLUMN "ow_users"."can_talk_to_hr"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_users"."can_talk_to_hr" IS '本人が設定。企業の人事担当者から話しかけられることを許可する意思表示フラグ。将来 can_casual_meeting を統合予定。';


--
-- Name: COLUMN "ow_users"."statistics_opt_out"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."ow_users"."statistics_opt_out" IS 'true = ユーザーが統計利用の停止を請求済み。集計クエリでは必ず WHERE statistics_opt_out = false を付けること（規約第13条の4第5項）。';


--
-- Name: salary_viewers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."salary_viewers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid",
    "user_id" "uuid",
    "granted_by" "uuid",
    "granted_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid"
);


ALTER TABLE "public"."salary_viewers" OWNER TO "postgres";

--
-- Name: scout_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."scout_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "talent_pool_id" "uuid",
    "job_id" "uuid",
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "method" "text",
    "subject" "text",
    "body" "text",
    "opened_at" timestamp with time zone,
    "replied_at" timestamp with time zone,
    "result" "text",
    "tenant_id" "uuid"
);


ALTER TABLE "public"."scout_history" OWNER TO "postgres";

--
-- Name: scout_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."scout_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employer_id" "uuid",
    "talent_user_id" "uuid",
    "job_id" "uuid",
    "message" "text" NOT NULL,
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scout_messages" OWNER TO "postgres";

--
-- Name: selection_feedback; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."selection_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid",
    "application_id" "uuid",
    "job_id" "uuid",
    "interviewer_id" "uuid",
    "result" "text" NOT NULL,
    "rejection_reason" "text",
    "rejection_detail" "text",
    "strong_points" "text",
    "weak_points" "text",
    "reapply_eligible" boolean DEFAULT true,
    "reapply_after_months" integer DEFAULT 6,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid"
);


ALTER TABLE "public"."selection_feedback" OWNER TO "postgres";

--
-- Name: talent_pool; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."talent_pool" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid",
    "status" "text" DEFAULT 'active'::"text",
    "source" "text",
    "registered_at" timestamp with time zone DEFAULT "now"(),
    "last_contacted_at" timestamp with time zone,
    "next_contact_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid"
);


ALTER TABLE "public"."talent_pool" OWNER TO "postgres";

--
-- Name: talent_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."talent_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "location" "text",
    "job_type" "text",
    "company" "text",
    "current_salary" integer,
    "experience_years" integer,
    "new_arr" "text",
    "conversion_rate" numeric,
    "avg_deal_size" "text",
    "product_name" "text",
    "managed_accounts" integer,
    "renewal_rate" numeric,
    "nps_score" numeric,
    "products" "text"[] DEFAULT '{}'::"text"[],
    "intent" "text" DEFAULT 'exploring'::"text",
    "desired_salary" integer,
    "desired_job_type" "text",
    "desired_location" "text",
    "is_public" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."talent_profiles" OWNER TO "postgres";

--
-- Name: tenant_master_options; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."tenant_master_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "value" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tenant_master_options" OWNER TO "postgres";

--
-- Name: tenants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "plan" "text" DEFAULT 'free'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "type" "text" DEFAULT 'hiring_company'::"text"
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";

--
-- Name: work_histories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."work_histories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "role" "text" NOT NULL,
    "department" "text",
    "joined_year" integer NOT NULL,
    "left_year" integer,
    "good_points" "text",
    "hard_points" "text",
    "is_public" boolean DEFAULT true,
    CONSTRAINT "work_histories_status_check" CHECK (("status" = ANY (ARRAY['current'::"text", 'alumni'::"text"])))
);


ALTER TABLE "public"."work_histories" OWNER TO "postgres";

--
-- Name: ow_page_views id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_page_views" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ow_page_views_id_seq"'::"regclass");


--
-- Name: agent_client_relations agent_client_relations_agent_tenant_id_hiring_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."agent_client_relations"
    ADD CONSTRAINT "agent_client_relations_agent_tenant_id_hiring_tenant_id_key" UNIQUE ("agent_tenant_id", "hiring_tenant_id");


--
-- Name: agent_client_relations agent_client_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."agent_client_relations"
    ADD CONSTRAINT "agent_client_relations_pkey" PRIMARY KEY ("id");


--
-- Name: agent_company_access agent_company_access_agent_id_company_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."agent_company_access"
    ADD CONSTRAINT "agent_company_access_agent_id_company_id_key" UNIQUE ("agent_id", "company_id");


--
-- Name: agent_company_access agent_company_access_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."agent_company_access"
    ADD CONSTRAINT "agent_company_access_pkey" PRIMARY KEY ("id");


--
-- Name: agent_members agent_members_agent_tenant_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."agent_members"
    ADD CONSTRAINT "agent_members_agent_tenant_id_user_id_key" UNIQUE ("agent_tenant_id", "user_id");


--
-- Name: agent_members agent_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."agent_members"
    ADD CONSTRAINT "agent_members_pkey" PRIMARY KEY ("id");


--
-- Name: agents agents_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_auth_user_id_key" UNIQUE ("auth_user_id");


--
-- Name: agents agents_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_email_key" UNIQUE ("email");


--
-- Name: agents agents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_pkey" PRIMARY KEY ("id");


--
-- Name: ai_interviews ai_interviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_interviews"
    ADD CONSTRAINT "ai_interviews_pkey" PRIMARY KEY ("id");


--
-- Name: ai_interviews ai_interviews_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_interviews"
    ADD CONSTRAINT "ai_interviews_token_key" UNIQUE ("token");


--
-- Name: applications applications_job_id_candidate_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_job_id_candidate_id_key" UNIQUE ("job_id", "candidate_id");


--
-- Name: applications applications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_pkey" PRIMARY KEY ("id");


--
-- Name: candidate_certifications candidate_certifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidate_certifications"
    ADD CONSTRAINT "candidate_certifications_pkey" PRIMARY KEY ("id");


--
-- Name: candidate_documents candidate_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidate_documents"
    ADD CONSTRAINT "candidate_documents_pkey" PRIMARY KEY ("id");


--
-- Name: candidate_educations candidate_educations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidate_educations"
    ADD CONSTRAINT "candidate_educations_pkey" PRIMARY KEY ("id");


--
-- Name: candidate_hearings candidate_hearings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidate_hearings"
    ADD CONSTRAINT "candidate_hearings_pkey" PRIMARY KEY ("id");


--
-- Name: candidate_job_activities candidate_job_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidate_job_activities"
    ADD CONSTRAINT "candidate_job_activities_pkey" PRIMARY KEY ("id");


--
-- Name: candidate_messages candidate_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidate_messages"
    ADD CONSTRAINT "candidate_messages_pkey" PRIMARY KEY ("id");


--
-- Name: candidate_notes candidate_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidate_notes"
    ADD CONSTRAINT "candidate_notes_pkey" PRIMARY KEY ("id");


--
-- Name: candidate_timeline_events candidate_timeline_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidate_timeline_events"
    ADD CONSTRAINT "candidate_timeline_events_pkey" PRIMARY KEY ("id");


--
-- Name: candidate_work_histories candidate_work_histories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidate_work_histories"
    ADD CONSTRAINT "candidate_work_histories_pkey" PRIMARY KEY ("id");


--
-- Name: candidates candidates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidates"
    ADD CONSTRAINT "candidates_pkey" PRIMARY KEY ("id");


--
-- Name: candidates candidates_portal_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidates"
    ADD CONSTRAINT "candidates_portal_token_key" UNIQUE ("portal_token");


--
-- Name: channels channels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."channels"
    ADD CONSTRAINT "channels_pkey" PRIMARY KEY ("id");


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");


--
-- Name: companies companies_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_slug_key" UNIQUE ("slug");


--
-- Name: competing_offers competing_offers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."competing_offers"
    ADD CONSTRAINT "competing_offers_pkey" PRIMARY KEY ("id");


--
-- Name: concurrent_applications concurrent_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."concurrent_applications"
    ADD CONSTRAINT "concurrent_applications_pkey" PRIMARY KEY ("id");


--
-- Name: crm_activities crm_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_activities"
    ADD CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id");


--
-- Name: crm_applications crm_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_applications"
    ADD CONSTRAINT "crm_applications_pkey" PRIMARY KEY ("id");


--
-- Name: crm_candidates crm_candidates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_candidates"
    ADD CONSTRAINT "crm_candidates_pkey" PRIMARY KEY ("id");


--
-- Name: crm_client_companies crm_client_companies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_client_companies"
    ADD CONSTRAINT "crm_client_companies_pkey" PRIMARY KEY ("id");


--
-- Name: crm_interviews crm_interviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_interviews"
    ADD CONSTRAINT "crm_interviews_pkey" PRIMARY KEY ("id");


--
-- Name: employer_jobs employer_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."employer_jobs"
    ADD CONSTRAINT "employer_jobs_pkey" PRIMARY KEY ("id");


--
-- Name: employer_profiles employer_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."employer_profiles"
    ADD CONSTRAINT "employer_profiles_pkey" PRIMARY KEY ("id");


--
-- Name: evaluations evaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evaluations"
    ADD CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id");


--
-- Name: iv_companies iv_companies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."iv_companies"
    ADD CONSTRAINT "iv_companies_pkey" PRIMARY KEY ("id");


--
-- Name: iv_interviews iv_interviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."iv_interviews"
    ADD CONSTRAINT "iv_interviews_pkey" PRIMARY KEY ("id");


--
-- Name: iv_messages iv_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."iv_messages"
    ADD CONSTRAINT "iv_messages_pkey" PRIMARY KEY ("id");


--
-- Name: job_interests job_interests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."job_interests"
    ADD CONSTRAINT "job_interests_pkey" PRIMARY KEY ("id");


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");


--
-- Name: nurturing_candidates nurturing_candidates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."nurturing_candidates"
    ADD CONSTRAINT "nurturing_candidates_pkey" PRIMARY KEY ("id");


--
-- Name: offer_letters offer_letters_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."offer_letters"
    ADD CONSTRAINT "offer_letters_pkey" PRIMARY KEY ("id");


--
-- Name: ow_activities ow_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_activities"
    ADD CONSTRAINT "ow_activities_pkey" PRIMARY KEY ("id");


--
-- Name: ow_agent_agencies ow_agent_agencies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_agent_agencies"
    ADD CONSTRAINT "ow_agent_agencies_pkey" PRIMARY KEY ("id");


--
-- Name: ow_agent_contacts ow_agent_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_agent_contacts"
    ADD CONSTRAINT "ow_agent_contacts_pkey" PRIMARY KEY ("id");


--
-- Name: ow_agent_jobs ow_agent_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_agent_jobs"
    ADD CONSTRAINT "ow_agent_jobs_pkey" PRIMARY KEY ("agency_id", "job_id");


--
-- Name: ow_applications ow_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_applications"
    ADD CONSTRAINT "ow_applications_pkey" PRIMARY KEY ("id");


--
-- Name: ow_articles ow_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_articles"
    ADD CONSTRAINT "ow_articles_pkey" PRIMARY KEY ("id");


--
-- Name: ow_articles ow_articles_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_articles"
    ADD CONSTRAINT "ow_articles_slug_key" UNIQUE ("slug");


--
-- Name: ow_bookmarks ow_bookmarks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_bookmarks"
    ADD CONSTRAINT "ow_bookmarks_pkey" PRIMARY KEY ("id");


--
-- Name: ow_bookmarks ow_bookmarks_user_id_target_type_target_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_bookmarks"
    ADD CONSTRAINT "ow_bookmarks_user_id_target_type_target_id_key" UNIQUE ("user_id", "target_type", "target_id");


--
-- Name: ow_career_agent_leads ow_career_agent_leads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_career_agent_leads"
    ADD CONSTRAINT "ow_career_agent_leads_pkey" PRIMARY KEY ("id");


--
-- Name: ow_career_follows ow_career_follows_follower_user_id_target_profile_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_career_follows"
    ADD CONSTRAINT "ow_career_follows_follower_user_id_target_profile_id_key" UNIQUE ("follower_user_id", "target_profile_id");


--
-- Name: ow_career_follows ow_career_follows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_career_follows"
    ADD CONSTRAINT "ow_career_follows_pkey" PRIMARY KEY ("id");


--
-- Name: ow_career_profiles ow_career_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_career_profiles"
    ADD CONSTRAINT "ow_career_profiles_pkey" PRIMARY KEY ("id");


--
-- Name: ow_career_profiles ow_career_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_career_profiles"
    ADD CONSTRAINT "ow_career_profiles_user_id_key" UNIQUE ("user_id");


--
-- Name: ow_casual_meetings ow_casual_meetings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_casual_meetings"
    ADD CONSTRAINT "ow_casual_meetings_pkey" PRIMARY KEY ("id");


--
-- Name: ow_companies ow_companies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_companies"
    ADD CONSTRAINT "ow_companies_pkey" PRIMARY KEY ("id");


--
-- Name: ow_company_admins ow_company_admins_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_admins"
    ADD CONSTRAINT "ow_company_admins_pkey" PRIMARY KEY ("id");


--
-- Name: ow_company_admins ow_company_admins_user_id_company_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_admins"
    ADD CONSTRAINT "ow_company_admins_user_id_company_id_key" UNIQUE ("user_id", "company_id");


--
-- Name: ow_company_culture_tags ow_company_culture_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_culture_tags"
    ADD CONSTRAINT "ow_company_culture_tags_pkey" PRIMARY KEY ("id");


--
-- Name: ow_company_departments ow_company_departments_company_id_name_parent_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_departments"
    ADD CONSTRAINT "ow_company_departments_company_id_name_parent_id_key" UNIQUE ("company_id", "name", "parent_id");


--
-- Name: ow_company_departments ow_company_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_departments"
    ADD CONSTRAINT "ow_company_departments_pkey" PRIMARY KEY ("id");


--
-- Name: ow_company_domain_verifications ow_company_domain_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_domain_verifications"
    ADD CONSTRAINT "ow_company_domain_verifications_pkey" PRIMARY KEY ("id");


--
-- Name: ow_company_domain_verifications ow_company_domain_verifications_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_domain_verifications"
    ADD CONSTRAINT "ow_company_domain_verifications_token_key" UNIQUE ("token");


--
-- Name: ow_company_employee_categories ow_company_employee_categories_company_id_role_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_employee_categories"
    ADD CONSTRAINT "ow_company_employee_categories_company_id_role_id_key" UNIQUE ("company_id", "role_id");


--
-- Name: ow_company_employee_categories ow_company_employee_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_employee_categories"
    ADD CONSTRAINT "ow_company_employee_categories_pkey" PRIMARY KEY ("id");


--
-- Name: ow_company_external_links ow_company_external_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_external_links"
    ADD CONSTRAINT "ow_company_external_links_pkey" PRIMARY KEY ("id");


--
-- Name: ow_company_follows ow_company_follows_follower_user_id_company_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_follows"
    ADD CONSTRAINT "ow_company_follows_follower_user_id_company_id_key" UNIQUE ("follower_user_id", "company_id");


--
-- Name: ow_company_follows ow_company_follows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_follows"
    ADD CONSTRAINT "ow_company_follows_pkey" PRIMARY KEY ("id");


--
-- Name: ow_company_genres ow_company_genres_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_genres"
    ADD CONSTRAINT "ow_company_genres_pkey" PRIMARY KEY ("company_id", "genre_id");


--
-- Name: ow_company_hidden_experiences ow_company_hidden_experiences_company_id_experience_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_hidden_experiences"
    ADD CONSTRAINT "ow_company_hidden_experiences_company_id_experience_id_key" UNIQUE ("company_id", "experience_id");


--
-- Name: ow_company_hidden_experiences ow_company_hidden_experiences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_hidden_experiences"
    ADD CONSTRAINT "ow_company_hidden_experiences_pkey" PRIMARY KEY ("id");


--
-- Name: ow_company_job_roles ow_company_job_roles_company_id_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_job_roles"
    ADD CONSTRAINT "ow_company_job_roles_company_id_name_key" UNIQUE ("company_id", "name");


--
-- Name: ow_company_job_roles ow_company_job_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_job_roles"
    ADD CONSTRAINT "ow_company_job_roles_pkey" PRIMARY KEY ("id");


--
-- Name: ow_company_join_requests ow_company_join_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_join_requests"
    ADD CONSTRAINT "ow_company_join_requests_pkey" PRIMARY KEY ("id");


--
-- Name: ow_company_members ow_company_members_company_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_members"
    ADD CONSTRAINT "ow_company_members_company_id_user_id_key" UNIQUE ("company_id", "user_id");


--
-- Name: ow_company_members ow_company_members_invite_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_members"
    ADD CONSTRAINT "ow_company_members_invite_token_key" UNIQUE ("invite_token");


--
-- Name: ow_company_members ow_company_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_members"
    ADD CONSTRAINT "ow_company_members_pkey" PRIMARY KEY ("id");


--
-- Name: ow_company_office_photos ow_company_office_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_office_photos"
    ADD CONSTRAINT "ow_company_office_photos_pkey" PRIMARY KEY ("id");


--
-- Name: ow_company_perspectives ow_company_perspectives_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_perspectives"
    ADD CONSTRAINT "ow_company_perspectives_pkey" PRIMARY KEY ("id");


--
-- Name: ow_company_posts ow_company_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_posts"
    ADD CONSTRAINT "ow_company_posts_pkey" PRIMARY KEY ("id");


--
-- Name: ow_contact_logs ow_contact_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_contact_logs"
    ADD CONSTRAINT "ow_contact_logs_pkey" PRIMARY KEY ("id");


--
-- Name: ow_contact_submissions ow_contact_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_contact_submissions"
    ADD CONSTRAINT "ow_contact_submissions_pkey" PRIMARY KEY ("id");


--
-- Name: ow_conversation_messages ow_conversation_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_conversation_messages"
    ADD CONSTRAINT "ow_conversation_messages_pkey" PRIMARY KEY ("id");


--
-- Name: ow_conversation_participants ow_conversation_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_conversation_participants"
    ADD CONSTRAINT "ow_conversation_participants_pkey" PRIMARY KEY ("id");


--
-- Name: ow_conversations ow_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_conversations"
    ADD CONSTRAINT "ow_conversations_pkey" PRIMARY KEY ("id");


--
-- Name: ow_conversations ow_conversations_unique_per_relation; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_conversations"
    ADD CONSTRAINT "ow_conversations_unique_per_relation" UNIQUE NULLS NOT DISTINCT ("kind", "company_id", "mentor_user_id", "candidate_user_id");


--
-- Name: ow_experience_roles ow_experience_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_experience_roles"
    ADD CONSTRAINT "ow_experience_roles_pkey" PRIMARY KEY ("experience_id", "role_id");


--
-- Name: ow_experience_stories ow_experience_stories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_experience_stories"
    ADD CONSTRAINT "ow_experience_stories_pkey" PRIMARY KEY ("id");


--
-- Name: ow_experiences ow_experiences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_experiences"
    ADD CONSTRAINT "ow_experiences_pkey" PRIMARY KEY ("id");


--
-- Name: ow_favorites ow_favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_favorites"
    ADD CONSTRAINT "ow_favorites_pkey" PRIMARY KEY ("id");


--
-- Name: ow_favorites ow_favorites_user_id_target_type_target_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_favorites"
    ADD CONSTRAINT "ow_favorites_user_id_target_type_target_id_key" UNIQUE ("user_id", "target_type", "target_id");


--
-- Name: ow_genres ow_genres_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_genres"
    ADD CONSTRAINT "ow_genres_pkey" PRIMARY KEY ("id");


--
-- Name: ow_genres ow_genres_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_genres"
    ADD CONSTRAINT "ow_genres_slug_key" UNIQUE ("slug");


--
-- Name: ow_industries ow_industries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_industries"
    ADD CONSTRAINT "ow_industries_pkey" PRIMARY KEY ("id");


--
-- Name: ow_industries ow_industries_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_industries"
    ADD CONSTRAINT "ow_industries_slug_key" UNIQUE ("slug");


--
-- Name: ow_invoices ow_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_invoices"
    ADD CONSTRAINT "ow_invoices_pkey" PRIMARY KEY ("id");


--
-- Name: ow_job_applications ow_job_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_job_applications"
    ADD CONSTRAINT "ow_job_applications_pkey" PRIMARY KEY ("id");


--
-- Name: ow_job_applications ow_job_applications_user_job_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_job_applications"
    ADD CONSTRAINT "ow_job_applications_user_job_unique" UNIQUE ("user_id", "job_id");


--
-- Name: ow_job_assignees ow_job_assignees_job_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_job_assignees"
    ADD CONSTRAINT "ow_job_assignees_job_id_user_id_key" UNIQUE ("job_id", "user_id");


--
-- Name: ow_job_assignees ow_job_assignees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_job_assignees"
    ADD CONSTRAINT "ow_job_assignees_pkey" PRIMARY KEY ("id");


--
-- Name: ow_job_favorites ow_job_favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_job_favorites"
    ADD CONSTRAINT "ow_job_favorites_pkey" PRIMARY KEY ("id");


--
-- Name: ow_job_favorites ow_job_favorites_user_id_job_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_job_favorites"
    ADD CONSTRAINT "ow_job_favorites_user_id_job_id_key" UNIQUE ("user_id", "job_id");


--
-- Name: ow_job_matching_tags ow_job_matching_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_job_matching_tags"
    ADD CONSTRAINT "ow_job_matching_tags_pkey" PRIMARY KEY ("id");


--
-- Name: ow_job_requirements ow_job_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_job_requirements"
    ADD CONSTRAINT "ow_job_requirements_pkey" PRIMARY KEY ("id");


--
-- Name: ow_job_roles ow_job_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_job_roles"
    ADD CONSTRAINT "ow_job_roles_pkey" PRIMARY KEY ("job_id", "role_id");


--
-- Name: ow_job_views ow_job_views_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_job_views"
    ADD CONSTRAINT "ow_job_views_pkey" PRIMARY KEY ("id");


--
-- Name: ow_jobs ow_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_jobs"
    ADD CONSTRAINT "ow_jobs_pkey" PRIMARY KEY ("id");


--
-- Name: ow_match_scores ow_match_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_match_scores"
    ADD CONSTRAINT "ow_match_scores_pkey" PRIMARY KEY ("id");


--
-- Name: ow_match_scores ow_match_scores_user_id_company_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_match_scores"
    ADD CONSTRAINT "ow_match_scores_user_id_company_id_key" UNIQUE ("user_id", "company_id");


--
-- Name: ow_matches ow_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_matches"
    ADD CONSTRAINT "ow_matches_pkey" PRIMARY KEY ("id");


--
-- Name: ow_meeting_feedbacks ow_meeting_feedbacks_meeting_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_meeting_feedbacks"
    ADD CONSTRAINT "ow_meeting_feedbacks_meeting_id_user_id_key" UNIQUE ("meeting_id", "user_id");


--
-- Name: ow_meeting_feedbacks ow_meeting_feedbacks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_meeting_feedbacks"
    ADD CONSTRAINT "ow_meeting_feedbacks_pkey" PRIMARY KEY ("id");


--
-- Name: ow_mentor_reservations ow_mentor_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_mentor_reservations"
    ADD CONSTRAINT "ow_mentor_reservations_pkey" PRIMARY KEY ("id");


--
-- Name: ow_message_reads ow_message_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_message_reads"
    ADD CONSTRAINT "ow_message_reads_pkey" PRIMARY KEY ("message_id", "participant_id");


--
-- Name: ow_messages ow_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_messages"
    ADD CONSTRAINT "ow_messages_pkey" PRIMARY KEY ("id");


--
-- Name: ow_notifications ow_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_notifications"
    ADD CONSTRAINT "ow_notifications_pkey" PRIMARY KEY ("id");


--
-- Name: ow_page_views ow_page_views_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_page_views"
    ADD CONSTRAINT "ow_page_views_pkey" PRIMARY KEY ("id");


--
-- Name: ow_pipeline_stages ow_pipeline_stages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_pipeline_stages"
    ADD CONSTRAINT "ow_pipeline_stages_pkey" PRIMARY KEY ("id");


--
-- Name: ow_placements ow_placements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_placements"
    ADD CONSTRAINT "ow_placements_pkey" PRIMARY KEY ("id");


--
-- Name: ow_post_comments ow_post_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_post_comments"
    ADD CONSTRAINT "ow_post_comments_pkey" PRIMARY KEY ("id");


--
-- Name: ow_post_hire_reports ow_post_hire_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_post_hire_reports"
    ADD CONSTRAINT "ow_post_hire_reports_pkey" PRIMARY KEY ("id");


--
-- Name: ow_post_likes ow_post_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_post_likes"
    ADD CONSTRAINT "ow_post_likes_pkey" PRIMARY KEY ("id");


--
-- Name: ow_post_likes ow_post_likes_post_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_post_likes"
    ADD CONSTRAINT "ow_post_likes_post_id_user_id_key" UNIQUE ("post_id", "user_id");


--
-- Name: ow_posts ow_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_posts"
    ADD CONSTRAINT "ow_posts_pkey" PRIMARY KEY ("id");


--
-- Name: ow_profiles ow_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_profiles"
    ADD CONSTRAINT "ow_profiles_pkey" PRIMARY KEY ("id");


--
-- Name: ow_role_aliases ow_role_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_role_aliases"
    ADD CONSTRAINT "ow_role_aliases_pkey" PRIMARY KEY ("id");


--
-- Name: ow_role_aliases ow_role_aliases_role_id_alias_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_role_aliases"
    ADD CONSTRAINT "ow_role_aliases_role_id_alias_key" UNIQUE ("role_id", "alias");


--
-- Name: ow_roles ow_roles_name_parent_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_roles"
    ADD CONSTRAINT "ow_roles_name_parent_id_key" UNIQUE NULLS NOT DISTINCT ("name", "parent_id");


--
-- Name: ow_roles ow_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_roles"
    ADD CONSTRAINT "ow_roles_pkey" PRIMARY KEY ("id");


--
-- Name: ow_saas_categories ow_saas_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_saas_categories"
    ADD CONSTRAINT "ow_saas_categories_pkey" PRIMARY KEY ("id");


--
-- Name: ow_saas_categories ow_saas_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_saas_categories"
    ADD CONSTRAINT "ow_saas_categories_slug_key" UNIQUE ("slug");


--
-- Name: ow_salary_reports ow_salary_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_salary_reports"
    ADD CONSTRAINT "ow_salary_reports_pkey" PRIMARY KEY ("id");


--
-- Name: ow_saved_companies ow_saved_companies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_saved_companies"
    ADD CONSTRAINT "ow_saved_companies_pkey" PRIMARY KEY ("id");


--
-- Name: ow_saved_companies ow_saved_companies_user_id_company_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_saved_companies"
    ADD CONSTRAINT "ow_saved_companies_user_id_company_id_key" UNIQUE ("user_id", "company_id");


--
-- Name: ow_saved_jobs ow_saved_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_saved_jobs"
    ADD CONSTRAINT "ow_saved_jobs_pkey" PRIMARY KEY ("id");


--
-- Name: ow_saved_jobs ow_saved_jobs_user_id_job_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_saved_jobs"
    ADD CONSTRAINT "ow_saved_jobs_user_id_job_id_key" UNIQUE ("user_id", "job_id");


--
-- Name: ow_school_requests ow_school_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_school_requests"
    ADD CONSTRAINT "ow_school_requests_pkey" PRIMARY KEY ("id");


--
-- Name: ow_schools ow_schools_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_schools"
    ADD CONSTRAINT "ow_schools_pkey" PRIMARY KEY ("id");


--
-- Name: ow_scout_blocks ow_scout_blocks_candidate_id_company_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_scout_blocks"
    ADD CONSTRAINT "ow_scout_blocks_candidate_id_company_id_key" UNIQUE ("candidate_id", "company_id");


--
-- Name: ow_scout_blocks ow_scout_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_scout_blocks"
    ADD CONSTRAINT "ow_scout_blocks_pkey" PRIMARY KEY ("id");


--
-- Name: ow_scout_quotas ow_scout_quotas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_scout_quotas"
    ADD CONSTRAINT "ow_scout_quotas_pkey" PRIMARY KEY ("company_id");


--
-- Name: ow_scouts ow_scouts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_scouts"
    ADD CONSTRAINT "ow_scouts_pkey" PRIMARY KEY ("id");


--
-- Name: ow_settings ow_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_settings"
    ADD CONSTRAINT "ow_settings_pkey" PRIMARY KEY ("key");


--
-- Name: ow_story_sections ow_story_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_story_sections"
    ADD CONSTRAINT "ow_story_sections_pkey" PRIMARY KEY ("id");


--
-- Name: ow_tenant_plans ow_tenant_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_tenant_plans"
    ADD CONSTRAINT "ow_tenant_plans_pkey" PRIMARY KEY ("id");


--
-- Name: ow_terms_agreements ow_terms_agreements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_terms_agreements"
    ADD CONSTRAINT "ow_terms_agreements_pkey" PRIMARY KEY ("id");


--
-- Name: ow_threads ow_threads_company_id_candidate_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_threads"
    ADD CONSTRAINT "ow_threads_company_id_candidate_id_key" UNIQUE ("company_id", "candidate_id");


--
-- Name: ow_threads ow_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_threads"
    ADD CONSTRAINT "ow_threads_pkey" PRIMARY KEY ("id");


--
-- Name: ow_user_achievements ow_user_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_user_achievements"
    ADD CONSTRAINT "ow_user_achievements_pkey" PRIMARY KEY ("id");


--
-- Name: ow_user_awards ow_user_awards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_user_awards"
    ADD CONSTRAINT "ow_user_awards_pkey" PRIMARY KEY ("id");


--
-- Name: ow_user_certifications ow_user_certifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_user_certifications"
    ADD CONSTRAINT "ow_user_certifications_pkey" PRIMARY KEY ("id");


--
-- Name: ow_user_content_links ow_user_content_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_user_content_links"
    ADD CONSTRAINT "ow_user_content_links_pkey" PRIMARY KEY ("id");


--
-- Name: ow_user_educations ow_user_educations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_user_educations"
    ADD CONSTRAINT "ow_user_educations_pkey" PRIMARY KEY ("id");


--
-- Name: ow_user_media_appearances ow_user_media_appearances_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_user_media_appearances"
    ADD CONSTRAINT "ow_user_media_appearances_pkey" PRIMARY KEY ("id");


--
-- Name: ow_user_profiles ow_user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_user_profiles"
    ADD CONSTRAINT "ow_user_profiles_pkey" PRIMARY KEY ("id");


--
-- Name: ow_user_profiles ow_user_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_user_profiles"
    ADD CONSTRAINT "ow_user_profiles_user_id_key" UNIQUE ("user_id");


--
-- Name: ow_user_recommendations ow_user_recommendations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_user_recommendations"
    ADD CONSTRAINT "ow_user_recommendations_pkey" PRIMARY KEY ("id");


--
-- Name: ow_user_roles ow_user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_user_roles"
    ADD CONSTRAINT "ow_user_roles_pkey" PRIMARY KEY ("id");


--
-- Name: ow_user_roles ow_user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_user_roles"
    ADD CONSTRAINT "ow_user_roles_user_id_role_key" UNIQUE ("user_id", "role");


--
-- Name: ow_user_skill_tags ow_user_skill_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_user_skill_tags"
    ADD CONSTRAINT "ow_user_skill_tags_pkey" PRIMARY KEY ("id");


--
-- Name: ow_user_socials ow_user_socials_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_user_socials"
    ADD CONSTRAINT "ow_user_socials_pkey" PRIMARY KEY ("id");


--
-- Name: ow_users ow_users_auth_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_users"
    ADD CONSTRAINT "ow_users_auth_id_key" UNIQUE ("auth_id");


--
-- Name: ow_users ow_users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_users"
    ADD CONSTRAINT "ow_users_email_key" UNIQUE ("email");


--
-- Name: ow_users ow_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_users"
    ADD CONSTRAINT "ow_users_pkey" PRIMARY KEY ("id");


--
-- Name: salary_viewers salary_viewers_candidate_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."salary_viewers"
    ADD CONSTRAINT "salary_viewers_candidate_id_user_id_key" UNIQUE ("candidate_id", "user_id");


--
-- Name: salary_viewers salary_viewers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."salary_viewers"
    ADD CONSTRAINT "salary_viewers_pkey" PRIMARY KEY ("id");


--
-- Name: scout_history scout_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."scout_history"
    ADD CONSTRAINT "scout_history_pkey" PRIMARY KEY ("id");


--
-- Name: scout_messages scout_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."scout_messages"
    ADD CONSTRAINT "scout_messages_pkey" PRIMARY KEY ("id");


--
-- Name: selection_feedback selection_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."selection_feedback"
    ADD CONSTRAINT "selection_feedback_pkey" PRIMARY KEY ("id");


--
-- Name: talent_pool talent_pool_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."talent_pool"
    ADD CONSTRAINT "talent_pool_pkey" PRIMARY KEY ("id");


--
-- Name: talent_profiles talent_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."talent_profiles"
    ADD CONSTRAINT "talent_profiles_pkey" PRIMARY KEY ("id");


--
-- Name: tenant_master_options tenant_master_options_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."tenant_master_options"
    ADD CONSTRAINT "tenant_master_options_pkey" PRIMARY KEY ("id");


--
-- Name: tenant_master_options tenant_master_options_tenant_id_category_value_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."tenant_master_options"
    ADD CONSTRAINT "tenant_master_options_tenant_id_category_value_key" UNIQUE ("tenant_id", "category", "value");


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");


--
-- Name: tenants tenants_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_slug_key" UNIQUE ("slug");


--
-- Name: ow_pipeline_stages unique_hired_per_company; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_pipeline_stages"
    ADD CONSTRAINT "unique_hired_per_company" EXCLUDE USING "btree" ("company_id" WITH =) WHERE (("is_hired" = true));


--
-- Name: ow_pipeline_stages unique_rejected_per_company; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_pipeline_stages"
    ADD CONSTRAINT "unique_rejected_per_company" EXCLUDE USING "btree" ("company_id" WITH =) WHERE (("is_rejected" = true));


--
-- Name: work_histories work_histories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."work_histories"
    ADD CONSTRAINT "work_histories_pkey" PRIMARY KEY ("id");


--
-- Name: work_histories work_histories_user_id_company_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."work_histories"
    ADD CONSTRAINT "work_histories_user_id_company_id_key" UNIQUE ("user_id", "company_id");


--
-- Name: idx_agent_company_agent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_agent_company_agent" ON "public"."agent_company_access" USING "btree" ("agent_id");


--
-- Name: idx_agent_company_company; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_agent_company_company" ON "public"."agent_company_access" USING "btree" ("company_id");


--
-- Name: idx_agents_auth_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_agents_auth_user_id" ON "public"."agents" USING "btree" ("auth_user_id");


--
-- Name: idx_agents_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_agents_email" ON "public"."agents" USING "btree" ("email");


--
-- Name: idx_agents_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_agents_role" ON "public"."agents" USING "btree" ("role");


--
-- Name: idx_agents_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_agents_status" ON "public"."agents" USING "btree" ("status");


--
-- Name: idx_ai_interviews_candidate; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ai_interviews_candidate" ON "public"."ai_interviews" USING "btree" ("candidate_id");


--
-- Name: idx_ai_interviews_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ai_interviews_status" ON "public"."ai_interviews" USING "btree" ("status");


--
-- Name: idx_ai_interviews_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ai_interviews_tenant" ON "public"."ai_interviews" USING "btree" ("tenant_id");


--
-- Name: idx_ai_interviews_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ai_interviews_token" ON "public"."ai_interviews" USING "btree" ("token");


--
-- Name: idx_applications_agent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_applications_agent_id" ON "public"."applications" USING "btree" ("agent_id");


--
-- Name: idx_applications_candidate_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_applications_candidate_id" ON "public"."applications" USING "btree" ("candidate_id");


--
-- Name: idx_applications_job_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_applications_job_id" ON "public"."applications" USING "btree" ("job_id");


--
-- Name: idx_applications_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_applications_status" ON "public"."applications" USING "btree" ("status");


--
-- Name: idx_applications_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_applications_type" ON "public"."applications" USING "btree" ("application_type");


--
-- Name: idx_candidate_certifications_candidate; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_candidate_certifications_candidate" ON "public"."candidate_certifications" USING "btree" ("candidate_id");


--
-- Name: idx_candidate_educations_candidate; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_candidate_educations_candidate" ON "public"."candidate_educations" USING "btree" ("candidate_id");


--
-- Name: idx_candidate_hearings_cid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_candidate_hearings_cid" ON "public"."candidate_hearings" USING "btree" ("candidate_id");


--
-- Name: idx_candidate_hearings_tid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_candidate_hearings_tid" ON "public"."candidate_hearings" USING "btree" ("tenant_id");


--
-- Name: idx_candidate_notes_candidate; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_candidate_notes_candidate" ON "public"."candidate_notes" USING "btree" ("candidate_id");


--
-- Name: idx_candidate_notes_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_candidate_notes_tenant" ON "public"."candidate_notes" USING "btree" ("tenant_id");


--
-- Name: idx_candidate_work_histories_candidate; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_candidate_work_histories_candidate" ON "public"."candidate_work_histories" USING "btree" ("candidate_id");


--
-- Name: idx_candidates_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_candidates_email" ON "public"."candidates" USING "btree" ("email");


--
-- Name: idx_candidates_portal_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_candidates_portal_token" ON "public"."candidates" USING "btree" ("portal_token");


--
-- Name: idx_companies_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_companies_slug" ON "public"."companies" USING "btree" ("slug");


--
-- Name: idx_company_hidden_exp_company; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_company_hidden_exp_company" ON "public"."ow_company_hidden_experiences" USING "btree" ("company_id");


--
-- Name: idx_company_posts_company_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_company_posts_company_id" ON "public"."ow_company_posts" USING "btree" ("company_id");


--
-- Name: idx_company_posts_published; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_company_posts_published" ON "public"."ow_company_posts" USING "btree" ("is_published", "published_at" DESC);


--
-- Name: idx_concurrent_apps_candidate; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_concurrent_apps_candidate" ON "public"."concurrent_applications" USING "btree" ("candidate_id");


--
-- Name: idx_concurrent_apps_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_concurrent_apps_tenant" ON "public"."concurrent_applications" USING "btree" ("tenant_id");


--
-- Name: idx_crm_activities_candidate; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_crm_activities_candidate" ON "public"."crm_activities" USING "btree" ("crm_candidate_id");


--
-- Name: idx_crm_activities_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_crm_activities_tenant" ON "public"."crm_activities" USING "btree" ("agent_tenant_id");


--
-- Name: idx_crm_client_companies_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_crm_client_companies_tenant" ON "public"."crm_client_companies" USING "btree" ("agent_tenant_id");


--
-- Name: idx_crm_interviews_candidate; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_crm_interviews_candidate" ON "public"."crm_interviews" USING "btree" ("crm_candidate_id");


--
-- Name: idx_crm_interviews_scheduled; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_crm_interviews_scheduled" ON "public"."crm_interviews" USING "btree" ("scheduled_at");


--
-- Name: idx_crm_interviews_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_crm_interviews_tenant" ON "public"."crm_interviews" USING "btree" ("agent_tenant_id");


--
-- Name: idx_evaluations_application; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_evaluations_application" ON "public"."evaluations" USING "btree" ("application_id");


--
-- Name: idx_evaluations_candidate; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_evaluations_candidate" ON "public"."evaluations" USING "btree" ("candidate_id");


--
-- Name: idx_evaluations_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_evaluations_tenant" ON "public"."evaluations" USING "btree" ("tenant_id");


--
-- Name: idx_iv_interviews_company; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_iv_interviews_company" ON "public"."iv_interviews" USING "btree" ("company_id");


--
-- Name: idx_iv_interviews_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_iv_interviews_status" ON "public"."iv_interviews" USING "btree" ("status");


--
-- Name: idx_iv_messages_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_iv_messages_created" ON "public"."iv_messages" USING "btree" ("interview_id", "created_at");


--
-- Name: idx_iv_messages_interview; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_iv_messages_interview" ON "public"."iv_messages" USING "btree" ("interview_id");


--
-- Name: idx_jobs_company_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_jobs_company_id" ON "public"."jobs" USING "btree" ("company_id");


--
-- Name: idx_jobs_is_published; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_jobs_is_published" ON "public"."jobs" USING "btree" ("is_published");


--
-- Name: idx_jobs_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_jobs_status" ON "public"."jobs" USING "btree" ("status");


--
-- Name: idx_master_options_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_master_options_tenant" ON "public"."tenant_master_options" USING "btree" ("tenant_id", "category", "is_active");


--
-- Name: idx_offer_letters_cid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_offer_letters_cid" ON "public"."offer_letters" USING "btree" ("candidate_id");


--
-- Name: idx_offer_letters_tid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_offer_letters_tid" ON "public"."offer_letters" USING "btree" ("tenant_id");


--
-- Name: idx_ow_activities_company; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_activities_company" ON "public"."ow_activities" USING "btree" ("company_id", "created_at" DESC);


--
-- Name: idx_ow_activities_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_activities_type" ON "public"."ow_activities" USING "btree" ("type");


--
-- Name: idx_ow_articles_published; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_articles_published" ON "public"."ow_articles" USING "btree" ("published_at" DESC) WHERE ("is_published" = true);


--
-- Name: idx_ow_articles_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_articles_slug" ON "public"."ow_articles" USING "btree" ("slug");


--
-- Name: idx_ow_articles_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_articles_type" ON "public"."ow_articles" USING "btree" ("type");


--
-- Name: idx_ow_bookmarks_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_bookmarks_user" ON "public"."ow_bookmarks" USING "btree" ("user_id", "target_type");


--
-- Name: idx_ow_career_agent_leads_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_career_agent_leads_created" ON "public"."ow_career_agent_leads" USING "btree" ("created_at" DESC);


--
-- Name: idx_ow_career_agent_leads_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_career_agent_leads_email" ON "public"."ow_career_agent_leads" USING "btree" ("email");


--
-- Name: idx_ow_career_agent_leads_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_career_agent_leads_status" ON "public"."ow_career_agent_leads" USING "btree" ("status");


--
-- Name: idx_ow_casual_meetings_company; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_casual_meetings_company" ON "public"."ow_casual_meetings" USING "btree" ("company_id", "status");


--
-- Name: idx_ow_casual_meetings_conversation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_casual_meetings_conversation_id" ON "public"."ow_casual_meetings" USING "btree" ("conversation_id") WHERE ("conversation_id" IS NOT NULL);


--
-- Name: idx_ow_casual_meetings_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_casual_meetings_created" ON "public"."ow_casual_meetings" USING "btree" ("created_at" DESC);


--
-- Name: idx_ow_casual_meetings_job; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_casual_meetings_job" ON "public"."ow_casual_meetings" USING "btree" ("job_id") WHERE ("job_id" IS NOT NULL);


--
-- Name: idx_ow_casual_meetings_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_casual_meetings_user" ON "public"."ow_casual_meetings" USING "btree" ("user_id");


--
-- Name: idx_ow_companies_engagement; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_companies_engagement" ON "public"."ow_companies" USING "btree" ("engagement_status");


--
-- Name: idx_ow_companies_jobs_public; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_companies_jobs_public" ON "public"."ow_companies" USING "btree" ("jobs_public");


--
-- Name: idx_ow_companies_sort_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_companies_sort_order" ON "public"."ow_companies" USING "btree" ("sort_order");


--
-- Name: idx_ow_company_admins_company; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_company_admins_company" ON "public"."ow_company_admins" USING "btree" ("company_id");


--
-- Name: idx_ow_company_admins_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_company_admins_user" ON "public"."ow_company_admins" USING "btree" ("user_id");


--
-- Name: idx_ow_company_employee_categories_company_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_company_employee_categories_company_id" ON "public"."ow_company_employee_categories" USING "btree" ("company_id");


--
-- Name: idx_ow_company_employee_categories_display_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_company_employee_categories_display_order" ON "public"."ow_company_employee_categories" USING "btree" ("company_id", "display_order");


--
-- Name: idx_ow_company_external_links_company_published; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_company_external_links_company_published" ON "public"."ow_company_external_links" USING "btree" ("company_id", "is_published", "published_at" DESC NULLS LAST);


--
-- Name: idx_ow_company_external_links_published_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_company_external_links_published_at" ON "public"."ow_company_external_links" USING "btree" ("is_published", "published_at" DESC NULLS LAST) WHERE ("is_published" = true);


--
-- Name: idx_ow_company_genres_company; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_company_genres_company" ON "public"."ow_company_genres" USING "btree" ("company_id");


--
-- Name: idx_ow_company_genres_genre_approved; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_company_genres_genre_approved" ON "public"."ow_company_genres" USING "btree" ("genre_id", "is_human_approved") WHERE ("is_human_approved" = true);


--
-- Name: idx_ow_company_join_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_company_join_requests_status" ON "public"."ow_company_join_requests" USING "btree" ("status");


--
-- Name: idx_ow_company_join_requests_target_company_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_company_join_requests_target_company_id" ON "public"."ow_company_join_requests" USING "btree" ("target_company_id") WHERE ("target_company_id" IS NOT NULL);


--
-- Name: idx_ow_company_join_requests_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_company_join_requests_user_id" ON "public"."ow_company_join_requests" USING "btree" ("user_id");


--
-- Name: idx_ow_company_members_company; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_company_members_company" ON "public"."ow_company_members" USING "btree" ("company_id");


--
-- Name: idx_ow_company_members_invite_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_company_members_invite_token" ON "public"."ow_company_members" USING "btree" ("invite_token");


--
-- Name: idx_ow_company_members_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_company_members_user" ON "public"."ow_company_members" USING "btree" ("user_id");


--
-- Name: idx_ow_company_office_photos_company; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_company_office_photos_company" ON "public"."ow_company_office_photos" USING "btree" ("company_id", "category", "display_order");


--
-- Name: idx_ow_company_perspectives_company; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_company_perspectives_company" ON "public"."ow_company_perspectives" USING "btree" ("company_id");


--
-- Name: idx_ow_conversation_messages_conversation_all; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_conversation_messages_conversation_all" ON "public"."ow_conversation_messages" USING "btree" ("conversation_id", "sent_at");


--
-- Name: idx_ow_conversation_messages_conversation_sent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_conversation_messages_conversation_sent" ON "public"."ow_conversation_messages" USING "btree" ("conversation_id", "sent_at") WHERE ("deleted_at" IS NULL);


--
-- Name: idx_ow_conversation_messages_sender; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_conversation_messages_sender" ON "public"."ow_conversation_messages" USING "btree" ("sender_participant_id", "sent_at") WHERE ("sender_participant_id" IS NOT NULL);


--
-- Name: idx_ow_conversation_participants_conversation; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_conversation_participants_conversation" ON "public"."ow_conversation_participants" USING "btree" ("conversation_id", "user_id");


--
-- Name: idx_ow_conversation_participants_user_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_conversation_participants_user_active" ON "public"."ow_conversation_participants" USING "btree" ("user_id", "conversation_id") WHERE (("left_at" IS NULL) AND ("user_id" IS NOT NULL));


--
-- Name: idx_ow_conversations_candidate_last_message; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_conversations_candidate_last_message" ON "public"."ow_conversations" USING "btree" ("candidate_user_id", "last_message_at" DESC NULLS LAST);


--
-- Name: idx_ow_conversations_company_last_message; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_conversations_company_last_message" ON "public"."ow_conversations" USING "btree" ("company_id", "last_message_at" DESC NULLS LAST) WHERE ("company_id" IS NOT NULL);


--
-- Name: idx_ow_conversations_mentor_last_message; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_conversations_mentor_last_message" ON "public"."ow_conversations" USING "btree" ("mentor_user_id", "last_message_at" DESC NULLS LAST) WHERE ("mentor_user_id" IS NOT NULL);


--
-- Name: idx_ow_domain_verif_company; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_domain_verif_company" ON "public"."ow_company_domain_verifications" USING "btree" ("company_id");


--
-- Name: idx_ow_domain_verif_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_domain_verif_token" ON "public"."ow_company_domain_verifications" USING "btree" ("token");


--
-- Name: idx_ow_experiences_company; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_experiences_company" ON "public"."ow_experiences" USING "btree" ("company_id") WHERE ("company_id" IS NOT NULL);


--
-- Name: idx_ow_experiences_current; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_experiences_current" ON "public"."ow_experiences" USING "btree" ("user_id", "is_current") WHERE ("is_current" = true);


--
-- Name: idx_ow_experiences_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_experiences_role" ON "public"."ow_experiences" USING "btree" ("role_category_id");


--
-- Name: idx_ow_experiences_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_experiences_user" ON "public"."ow_experiences" USING "btree" ("user_id");


--
-- Name: idx_ow_genres_active_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_genres_active_order" ON "public"."ow_genres" USING "btree" ("is_active", "display_order") WHERE ("is_active" = true);


--
-- Name: idx_ow_invoices_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_invoices_date" ON "public"."ow_invoices" USING "btree" ("invoice_date" DESC);


--
-- Name: idx_ow_invoices_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_invoices_tenant" ON "public"."ow_invoices" USING "btree" ("tenant_id");


--
-- Name: idx_ow_job_applications_billing_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_job_applications_billing_status" ON "public"."ow_job_applications" USING "btree" ("billing_status") WHERE ("status" = 'hired'::"text");


--
-- Name: idx_ow_job_applications_conversation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_job_applications_conversation_id" ON "public"."ow_job_applications" USING "btree" ("conversation_id") WHERE ("conversation_id" IS NOT NULL);


--
-- Name: idx_ow_job_assignees_job; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_job_assignees_job" ON "public"."ow_job_assignees" USING "btree" ("job_id");


--
-- Name: idx_ow_job_assignees_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_job_assignees_user" ON "public"."ow_job_assignees" USING "btree" ("user_id");


--
-- Name: idx_ow_job_views_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_job_views_created" ON "public"."ow_job_views" USING "btree" ("created_at" DESC);


--
-- Name: idx_ow_job_views_job; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_job_views_job" ON "public"."ow_job_views" USING "btree" ("job_id");


--
-- Name: idx_ow_jobs_role_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_jobs_role_category" ON "public"."ow_jobs" USING "btree" ("role_category_id") WHERE ("role_category_id" IS NOT NULL);


--
-- Name: idx_ow_jobs_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_jobs_status" ON "public"."ow_jobs" USING "btree" ("status");


--
-- Name: idx_ow_matches_company; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_matches_company" ON "public"."ow_matches" USING "btree" ("company_id", "match_score" DESC);


--
-- Name: idx_ow_matches_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_matches_user" ON "public"."ow_matches" USING "btree" ("user_id");


--
-- Name: idx_ow_mentor_reservations_ambassador_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_mentor_reservations_ambassador_id" ON "public"."ow_mentor_reservations" USING "btree" ("ambassador_id");


--
-- Name: idx_ow_mentor_reservations_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_mentor_reservations_status" ON "public"."ow_mentor_reservations" USING "btree" ("status");


--
-- Name: idx_ow_mentor_reservations_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_mentor_reservations_user_id" ON "public"."ow_mentor_reservations" USING "btree" ("user_id");


--
-- Name: idx_ow_message_reads_participant_read; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_message_reads_participant_read" ON "public"."ow_message_reads" USING "btree" ("participant_id", "read_at" DESC);


--
-- Name: idx_ow_notifications_recipient; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_notifications_recipient" ON "public"."ow_notifications" USING "btree" ("recipient_user_id", "is_read", "created_at" DESC);


--
-- Name: idx_ow_post_comments_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_post_comments_created_at" ON "public"."ow_post_comments" USING "btree" ("created_at");


--
-- Name: idx_ow_post_comments_post_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_post_comments_post_id" ON "public"."ow_post_comments" USING "btree" ("post_id");


--
-- Name: idx_ow_post_likes_post_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_post_likes_post_id" ON "public"."ow_post_likes" USING "btree" ("post_id");


--
-- Name: idx_ow_posts_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_posts_created_at" ON "public"."ow_posts" USING "btree" ("created_at" DESC);


--
-- Name: idx_ow_posts_post_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_posts_post_type" ON "public"."ow_posts" USING "btree" ("post_type");


--
-- Name: idx_ow_posts_ref_article; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_posts_ref_article" ON "public"."ow_posts" USING "btree" ("ref_article_id") WHERE ("ref_article_id" IS NOT NULL);


--
-- Name: idx_ow_posts_ref_company; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_posts_ref_company" ON "public"."ow_posts" USING "btree" ("ref_company_id") WHERE ("ref_company_id" IS NOT NULL);


--
-- Name: idx_ow_posts_ref_job; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_posts_ref_job" ON "public"."ow_posts" USING "btree" ("ref_job_id") WHERE ("ref_job_id" IS NOT NULL);


--
-- Name: idx_ow_posts_unique_article; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "idx_ow_posts_unique_article" ON "public"."ow_posts" USING "btree" ("ref_article_id") WHERE (("ref_article_id" IS NOT NULL) AND ("post_type" = 'article_published'::"text"));


--
-- Name: idx_ow_posts_unique_company; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "idx_ow_posts_unique_company" ON "public"."ow_posts" USING "btree" ("ref_company_id") WHERE (("ref_company_id" IS NOT NULL) AND ("post_type" = 'company_joined'::"text"));


--
-- Name: idx_ow_posts_unique_job; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "idx_ow_posts_unique_job" ON "public"."ow_posts" USING "btree" ("ref_job_id") WHERE (("ref_job_id" IS NOT NULL) AND ("post_type" = 'job_posted'::"text"));


--
-- Name: idx_ow_posts_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_posts_user_id" ON "public"."ow_posts" USING "btree" ("user_id");


--
-- Name: idx_ow_roles_parent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_roles_parent" ON "public"."ow_roles" USING "btree" ("parent_id");


--
-- Name: idx_ow_tenant_plans_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_tenant_plans_tenant" ON "public"."ow_tenant_plans" USING "btree" ("tenant_id");


--
-- Name: idx_ow_user_roles_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_user_roles_tenant" ON "public"."ow_user_roles" USING "btree" ("tenant_id") WHERE ("tenant_id" IS NOT NULL);


--
-- Name: idx_ow_users_auth_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_users_auth_id" ON "public"."ow_users" USING "btree" ("auth_id");


--
-- Name: idx_ow_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_users_email" ON "public"."ow_users" USING "btree" ("email");


--
-- Name: idx_ow_users_is_mentor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_ow_users_is_mentor" ON "public"."ow_users" USING "btree" ("is_mentor") WHERE ("is_mentor" = true);


--
-- Name: idx_recommendations_recommender; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_recommendations_recommender" ON "public"."ow_user_recommendations" USING "btree" ("recommender_user_id");


--
-- Name: idx_recommendations_target; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_recommendations_target" ON "public"."ow_user_recommendations" USING "btree" ("target_user_id");


--
-- Name: idx_salary_reports_approved; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_salary_reports_approved" ON "public"."ow_salary_reports" USING "btree" ("is_approved") WHERE ("is_approved" = true);


--
-- Name: idx_salary_reports_company; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_salary_reports_company" ON "public"."ow_salary_reports" USING "btree" ("company_id");


--
-- Name: idx_salary_reports_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_salary_reports_role" ON "public"."ow_salary_reports" USING "btree" ("role_id");


--
-- Name: idx_talent_profiles_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_talent_profiles_email" ON "public"."talent_profiles" USING "btree" ("email");


--
-- Name: idx_talent_profiles_intent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_talent_profiles_intent" ON "public"."talent_profiles" USING "btree" ("intent");


--
-- Name: idx_talent_profiles_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_talent_profiles_user" ON "public"."talent_profiles" USING "btree" ("user_id");


--
-- Name: idx_timeline_events_candidate; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_timeline_events_candidate" ON "public"."candidate_timeline_events" USING "btree" ("candidate_id");


--
-- Name: idx_timeline_events_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_timeline_events_tenant" ON "public"."candidate_timeline_events" USING "btree" ("tenant_id");


--
-- Name: idx_timeline_events_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_timeline_events_type" ON "public"."candidate_timeline_events" USING "btree" ("event_type");


--
-- Name: ow_agent_agencies_company_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_agent_agencies_company_id_idx" ON "public"."ow_agent_agencies" USING "btree" ("company_id");


--
-- Name: ow_agent_contacts_agency_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_agent_contacts_agency_id_idx" ON "public"."ow_agent_contacts" USING "btree" ("agency_id");


--
-- Name: ow_agent_contacts_email_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_agent_contacts_email_idx" ON "public"."ow_agent_contacts" USING "btree" ("email");


--
-- Name: ow_agent_jobs_agency_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_agent_jobs_agency_id_idx" ON "public"."ow_agent_jobs" USING "btree" ("agency_id");


--
-- Name: ow_agent_jobs_job_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_agent_jobs_job_id_idx" ON "public"."ow_agent_jobs" USING "btree" ("job_id");


--
-- Name: ow_articles_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_articles_user_id_idx" ON "public"."ow_articles" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);


--
-- Name: ow_companies_industry_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_companies_industry_idx" ON "public"."ow_companies" USING "btree" ("industry_id") WHERE ("industry_id" IS NOT NULL);


--
-- Name: ow_companies_saas_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_companies_saas_category_idx" ON "public"."ow_companies" USING "btree" ("saas_category_id") WHERE ("saas_category_id" IS NOT NULL);


--
-- Name: ow_companies_slug_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ow_companies_slug_idx" ON "public"."ow_companies" USING "btree" ("slug") WHERE ("slug" IS NOT NULL);


--
-- Name: ow_company_employee_categories_custom_name_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ow_company_employee_categories_custom_name_unique" ON "public"."ow_company_employee_categories" USING "btree" ("company_id", "custom_name") WHERE ("custom_name" IS NOT NULL);


--
-- Name: ow_company_follows_follower_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_company_follows_follower_idx" ON "public"."ow_company_follows" USING "btree" ("follower_user_id");


--
-- Name: ow_contact_logs_candidate_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_contact_logs_candidate_user_id_idx" ON "public"."ow_contact_logs" USING "btree" ("candidate_user_id");


--
-- Name: ow_contact_logs_company_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_contact_logs_company_id_idx" ON "public"."ow_contact_logs" USING "btree" ("company_id");


--
-- Name: ow_contact_logs_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_contact_logs_created_at_idx" ON "public"."ow_contact_logs" USING "btree" ("created_at" DESC);


--
-- Name: ow_conversation_participants_active_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ow_conversation_participants_active_unique" ON "public"."ow_conversation_participants" USING "btree" ("conversation_id", "user_id", "role") WHERE (("left_at" IS NULL) AND ("user_id" IS NOT NULL));


--
-- Name: ow_experience_roles_primary_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ow_experience_roles_primary_key" ON "public"."ow_experience_roles" USING "btree" ("experience_id") WHERE ("is_primary" = true);


--
-- Name: ow_experience_roles_role_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_experience_roles_role_idx" ON "public"."ow_experience_roles" USING "btree" ("role_id");


--
-- Name: ow_experience_stories_experience_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_experience_stories_experience_id_idx" ON "public"."ow_experience_stories" USING "btree" ("experience_id");


--
-- Name: ow_experience_stories_section_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_experience_stories_section_id_idx" ON "public"."ow_experience_stories" USING "btree" ("section_id");


--
-- Name: ow_industries_parent_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_industries_parent_idx" ON "public"."ow_industries" USING "btree" ("parent_id", "display_order");


--
-- Name: ow_job_applications_agency_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_job_applications_agency_id_idx" ON "public"."ow_job_applications" USING "btree" ("agency_id");


--
-- Name: ow_job_applications_pipeline_stage_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_job_applications_pipeline_stage_idx" ON "public"."ow_job_applications" USING "btree" ("pipeline_stage_id");


--
-- Name: ow_job_applications_source_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_job_applications_source_idx" ON "public"."ow_job_applications" USING "btree" ("source");


--
-- Name: ow_job_roles_primary_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ow_job_roles_primary_key" ON "public"."ow_job_roles" USING "btree" ("job_id") WHERE ("is_primary" = true);


--
-- Name: ow_job_roles_role_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_job_roles_role_idx" ON "public"."ow_job_roles" USING "btree" ("role_id");


--
-- Name: ow_jobs_slug_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ow_jobs_slug_idx" ON "public"."ow_jobs" USING "btree" ("slug") WHERE ("slug" IS NOT NULL);


--
-- Name: ow_page_views_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_page_views_created_at_idx" ON "public"."ow_page_views" USING "btree" ("created_at" DESC);


--
-- Name: ow_page_views_referrer_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_page_views_referrer_idx" ON "public"."ow_page_views" USING "btree" ("referrer_host", "created_at" DESC) WHERE ("referrer_host" IS NOT NULL);


--
-- Name: ow_page_views_target_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_page_views_target_idx" ON "public"."ow_page_views" USING "btree" ("page_type", "target_id", "created_at" DESC) WHERE ("target_id" IS NOT NULL);


--
-- Name: ow_pipeline_stages_company_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_pipeline_stages_company_id_idx" ON "public"."ow_pipeline_stages" USING "btree" ("company_id");


--
-- Name: ow_pipeline_stages_order_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_pipeline_stages_order_idx" ON "public"."ow_pipeline_stages" USING "btree" ("company_id", "order_index");


--
-- Name: ow_placements_candidate_joined_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_placements_candidate_joined_idx" ON "public"."ow_placements" USING "btree" ("candidate_id", "joined_at" DESC);


--
-- Name: ow_placements_company_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_placements_company_idx" ON "public"."ow_placements" USING "btree" ("company_id", "joined_at" DESC);


--
-- Name: ow_role_aliases_alias_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_role_aliases_alias_idx" ON "public"."ow_role_aliases" USING "btree" ("alias");


--
-- Name: ow_roles_level_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_roles_level_idx" ON "public"."ow_roles" USING "btree" ("level", "display_order");


--
-- Name: ow_roles_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ow_roles_slug_key" ON "public"."ow_roles" USING "btree" ("slug") WHERE ("slug" IS NOT NULL);


--
-- Name: ow_school_requests_requested_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_school_requests_requested_by_idx" ON "public"."ow_school_requests" USING "btree" ("requested_by");


--
-- Name: ow_school_requests_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_school_requests_status_idx" ON "public"."ow_school_requests" USING "btree" ("status");


--
-- Name: ow_schools_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_schools_name_idx" ON "public"."ow_schools" USING "btree" ("name");


--
-- Name: ow_schools_name_kana_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_schools_name_kana_idx" ON "public"."ow_schools" USING "btree" ("name_kana");


--
-- Name: ow_scout_blocks_candidate_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_scout_blocks_candidate_idx" ON "public"."ow_scout_blocks" USING "btree" ("candidate_id");


--
-- Name: ow_story_sections_experience_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_story_sections_experience_id_idx" ON "public"."ow_story_sections" USING "btree" ("experience_id");


--
-- Name: ow_user_achievements_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_user_achievements_user_id_idx" ON "public"."ow_user_achievements" USING "btree" ("user_id");


--
-- Name: ow_user_awards_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_user_awards_user_id_idx" ON "public"."ow_user_awards" USING "btree" ("user_id");


--
-- Name: ow_user_certifications_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_user_certifications_user_id_idx" ON "public"."ow_user_certifications" USING "btree" ("user_id");


--
-- Name: ow_user_educations_school_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_user_educations_school_id_idx" ON "public"."ow_user_educations" USING "btree" ("school_id");


--
-- Name: ow_user_educations_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_user_educations_user_id_idx" ON "public"."ow_user_educations" USING "btree" ("user_id");


--
-- Name: ow_user_media_appearances_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_user_media_appearances_user_id_idx" ON "public"."ow_user_media_appearances" USING "btree" ("user_id");


--
-- Name: ow_user_skill_tags_label_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_user_skill_tags_label_idx" ON "public"."ow_user_skill_tags" USING "btree" ("label");


--
-- Name: ow_user_skill_tags_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_user_skill_tags_user_id_idx" ON "public"."ow_user_skill_tags" USING "btree" ("user_id");


--
-- Name: ow_user_socials_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ow_user_socials_user_id_idx" ON "public"."ow_user_socials" USING "btree" ("user_id");


--
-- Name: ow_users_username_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ow_users_username_unique" ON "public"."ow_users" USING "btree" ("username");


--
-- Name: uniq_default_company_per_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "uniq_default_company_per_user" ON "public"."ow_company_admins" USING "btree" ("user_id") WHERE (("is_default" = true) AND ("is_active" = true) AND ("user_id" IS NOT NULL));


--
-- Name: uniq_invitation_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "uniq_invitation_token" ON "public"."ow_company_admins" USING "btree" ("invitation_token") WHERE ("invitation_token" IS NOT NULL);


--
-- Name: uniq_pending_invite; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "uniq_pending_invite" ON "public"."ow_company_admins" USING "btree" ("company_id", "invited_email") WHERE (("user_id" IS NULL) AND ("invited_email" IS NOT NULL));


--
-- Name: uniq_salary_report_user_company_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "uniq_salary_report_user_company_role" ON "public"."ow_salary_reports" USING "btree" ("user_id", "company_id", "role_id");


--
-- Name: agents agents_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "agents_updated_at" BEFORE UPDATE ON "public"."agents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();


--
-- Name: applications applications_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "applications_updated_at" BEFORE UPDATE ON "public"."applications" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();


--
-- Name: candidates candidates_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "candidates_updated_at" BEFORE UPDATE ON "public"."candidates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();


--
-- Name: companies companies_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "companies_updated_at" BEFORE UPDATE ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();


--
-- Name: jobs jobs_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "jobs_updated_at" BEFORE UPDATE ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();


--
-- Name: ow_placements set_placements_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "set_placements_updated_at" BEFORE UPDATE ON "public"."ow_placements" FOR EACH ROW EXECUTE FUNCTION "public"."update_placements_updated_at"();


--
-- Name: ow_company_join_requests set_updated_at_ow_company_join_requests; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "set_updated_at_ow_company_join_requests" BEFORE UPDATE ON "public"."ow_company_join_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();


--
-- Name: ow_genres set_updated_at_ow_genres; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "set_updated_at_ow_genres" BEFORE UPDATE ON "public"."ow_genres" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();


--
-- Name: candidates trg_candidate_portal_token; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_candidate_portal_token" BEFORE INSERT ON "public"."candidates" FOR EACH ROW EXECUTE FUNCTION "public"."set_candidate_portal_token"();


--
-- Name: ow_career_agent_leads trg_career_agent_leads_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_career_agent_leads_updated_at" BEFORE UPDATE ON "public"."ow_career_agent_leads" FOR EACH ROW EXECUTE FUNCTION "public"."update_career_agent_leads_updated_at"();


--
-- Name: ow_company_members trg_company_members_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_company_members_updated_at" BEFORE UPDATE ON "public"."ow_company_members" FOR EACH ROW EXECUTE FUNCTION "public"."update_company_members_updated_at"();


--
-- Name: ow_company_members trg_guard_member_consent; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_guard_member_consent" BEFORE UPDATE ON "public"."ow_company_members" FOR EACH ROW EXECUTE FUNCTION "public"."guard_member_consent"();


--
-- Name: ow_scouts trg_guard_scout; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_guard_scout" BEFORE INSERT ON "public"."ow_scouts" FOR EACH ROW EXECUTE FUNCTION "public"."guard_scout_insert"();


--
-- Name: ow_mentor_reservations trg_mentor_reservations_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_mentor_reservations_updated_at" BEFORE UPDATE ON "public"."ow_mentor_reservations" FOR EACH ROW EXECUTE FUNCTION "public"."update_mentor_reservations_updated_at"();


--
-- Name: ow_agent_agencies trg_ow_agent_agencies_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_ow_agent_agencies_updated_at" BEFORE UPDATE ON "public"."ow_agent_agencies" FOR EACH ROW EXECUTE FUNCTION "public"."update_ow_agent_agencies_updated_at"();


--
-- Name: ow_career_profiles trg_ow_career_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_ow_career_profiles_updated_at" BEFORE UPDATE ON "public"."ow_career_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."ow_career_profiles_set_updated_at"();


--
-- Name: ow_pipeline_stages trg_ow_pipeline_stages_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_ow_pipeline_stages_updated_at" BEFORE UPDATE ON "public"."ow_pipeline_stages" FOR EACH ROW EXECUTE FUNCTION "public"."update_ow_pipeline_stages_updated_at"();


--
-- Name: ow_salary_reports trg_salary_reports_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_salary_reports_updated_at" BEFORE UPDATE ON "public"."ow_salary_reports" FOR EACH ROW EXECUTE FUNCTION "public"."set_salary_reports_updated_at"();


--
-- Name: ow_experiences trg_update_company_member_counts; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_update_company_member_counts" AFTER INSERT OR DELETE OR UPDATE ON "public"."ow_experiences" FOR EACH ROW EXECUTE FUNCTION "public"."update_company_member_counts"();


--
-- Name: ow_conversation_messages trg_update_last_message_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_update_last_message_at" AFTER INSERT ON "public"."ow_conversation_messages" FOR EACH ROW EXECUTE FUNCTION "public"."ow_conversation_messages_update_last_message_at"();


--
-- Name: ow_company_external_links trigger_update_ow_company_external_links_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trigger_update_ow_company_external_links_updated_at" BEFORE UPDATE ON "public"."ow_company_external_links" FOR EACH ROW EXECUTE FUNCTION "public"."update_ow_company_external_links_updated_at"();


--
-- Name: agent_client_relations agent_client_relations_agent_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."agent_client_relations"
    ADD CONSTRAINT "agent_client_relations_agent_tenant_id_fkey" FOREIGN KEY ("agent_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;


--
-- Name: agent_client_relations agent_client_relations_hiring_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."agent_client_relations"
    ADD CONSTRAINT "agent_client_relations_hiring_tenant_id_fkey" FOREIGN KEY ("hiring_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;


--
-- Name: agent_company_access agent_company_access_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."agent_company_access"
    ADD CONSTRAINT "agent_company_access_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;


--
-- Name: agent_company_access agent_company_access_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."agent_company_access"
    ADD CONSTRAINT "agent_company_access_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;


--
-- Name: agent_company_access agent_company_access_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."agent_company_access"
    ADD CONSTRAINT "agent_company_access_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: agent_members agent_members_agent_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."agent_members"
    ADD CONSTRAINT "agent_members_agent_tenant_id_fkey" FOREIGN KEY ("agent_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;


--
-- Name: agent_members agent_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."agent_members"
    ADD CONSTRAINT "agent_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: agents agents_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: agents agents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: ai_interviews ai_interviews_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_interviews"
    ADD CONSTRAINT "ai_interviews_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;


--
-- Name: ai_interviews ai_interviews_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_interviews"
    ADD CONSTRAINT "ai_interviews_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--
-- Name: ai_interviews ai_interviews_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_interviews"
    ADD CONSTRAINT "ai_interviews_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE SET NULL;


--
-- Name: ai_interviews ai_interviews_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_interviews"
    ADD CONSTRAINT "ai_interviews_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;


--
-- Name: applications applications_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE SET NULL;


--
-- Name: applications applications_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;


--
-- Name: applications applications_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;


--
-- Name: applications applications_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: candidate_certifications candidate_certifications_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidate_certifications"
    ADD CONSTRAINT "candidate_certifications_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;


--
-- Name: candidate_documents candidate_documents_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidate_documents"
    ADD CONSTRAINT "candidate_documents_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;


--
-- Name: candidate_documents candidate_documents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidate_documents"
    ADD CONSTRAINT "candidate_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: candidate_documents candidate_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidate_documents"
    ADD CONSTRAINT "candidate_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id");


--
-- Name: candidate_educations candidate_educations_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidate_educations"
    ADD CONSTRAINT "candidate_educations_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;


--
-- Name: candidate_hearings candidate_hearings_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidate_hearings"
    ADD CONSTRAINT "candidate_hearings_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE SET NULL;


--
-- Name: candidate_hearings candidate_hearings_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidate_hearings"
    ADD CONSTRAINT "candidate_hearings_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;


--
-- Name: candidate_hearings candidate_hearings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidate_hearings"
    ADD CONSTRAINT "candidate_hearings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;


--
-- Name: candidate_job_activities candidate_job_activities_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidate_job_activities"
    ADD CONSTRAINT "candidate_job_activities_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;


--
-- Name: candidate_messages candidate_messages_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidate_messages"
    ADD CONSTRAINT "candidate_messages_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id");


--
-- Name: candidate_messages candidate_messages_sent_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidate_messages"
    ADD CONSTRAINT "candidate_messages_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "auth"."users"("id");


--
-- Name: candidate_messages candidate_messages_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidate_messages"
    ADD CONSTRAINT "candidate_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: candidate_notes candidate_notes_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidate_notes"
    ADD CONSTRAINT "candidate_notes_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;


--
-- Name: candidate_notes candidate_notes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidate_notes"
    ADD CONSTRAINT "candidate_notes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE SET NULL;


--
-- Name: candidate_timeline_events candidate_timeline_events_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidate_timeline_events"
    ADD CONSTRAINT "candidate_timeline_events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE SET NULL;


--
-- Name: candidate_timeline_events candidate_timeline_events_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidate_timeline_events"
    ADD CONSTRAINT "candidate_timeline_events_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;


--
-- Name: candidate_timeline_events candidate_timeline_events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidate_timeline_events"
    ADD CONSTRAINT "candidate_timeline_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: candidate_timeline_events candidate_timeline_events_evaluation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidate_timeline_events"
    ADD CONSTRAINT "candidate_timeline_events_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE SET NULL;


--
-- Name: candidate_timeline_events candidate_timeline_events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidate_timeline_events"
    ADD CONSTRAINT "candidate_timeline_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;


--
-- Name: candidate_work_histories candidate_work_histories_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidate_work_histories"
    ADD CONSTRAINT "candidate_work_histories_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;


--
-- Name: candidates candidates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."candidates"
    ADD CONSTRAINT "candidates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: channels channels_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."channels"
    ADD CONSTRAINT "channels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: companies companies_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: competing_offers competing_offers_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."competing_offers"
    ADD CONSTRAINT "competing_offers_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;


--
-- Name: competing_offers competing_offers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."competing_offers"
    ADD CONSTRAINT "competing_offers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: concurrent_applications concurrent_applications_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."concurrent_applications"
    ADD CONSTRAINT "concurrent_applications_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;


--
-- Name: crm_activities crm_activities_agent_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_activities"
    ADD CONSTRAINT "crm_activities_agent_tenant_id_fkey" FOREIGN KEY ("agent_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;


--
-- Name: crm_activities crm_activities_crm_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_activities"
    ADD CONSTRAINT "crm_activities_crm_candidate_id_fkey" FOREIGN KEY ("crm_candidate_id") REFERENCES "public"."crm_candidates"("id") ON DELETE CASCADE;


--
-- Name: crm_applications crm_applications_agent_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_applications"
    ADD CONSTRAINT "crm_applications_agent_tenant_id_fkey" FOREIGN KEY ("agent_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;


--
-- Name: crm_applications crm_applications_crm_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_applications"
    ADD CONSTRAINT "crm_applications_crm_candidate_id_fkey" FOREIGN KEY ("crm_candidate_id") REFERENCES "public"."crm_candidates"("id") ON DELETE CASCADE;


--
-- Name: crm_applications crm_applications_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_applications"
    ADD CONSTRAINT "crm_applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");


--
-- Name: crm_candidates crm_candidates_agent_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_candidates"
    ADD CONSTRAINT "crm_candidates_agent_tenant_id_fkey" FOREIGN KEY ("agent_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;


--
-- Name: crm_client_companies crm_client_companies_agent_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_client_companies"
    ADD CONSTRAINT "crm_client_companies_agent_tenant_id_fkey" FOREIGN KEY ("agent_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;


--
-- Name: crm_interviews crm_interviews_agent_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_interviews"
    ADD CONSTRAINT "crm_interviews_agent_tenant_id_fkey" FOREIGN KEY ("agent_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;


--
-- Name: crm_interviews crm_interviews_crm_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."crm_interviews"
    ADD CONSTRAINT "crm_interviews_crm_candidate_id_fkey" FOREIGN KEY ("crm_candidate_id") REFERENCES "public"."crm_candidates"("id") ON DELETE CASCADE;


--
-- Name: employer_jobs employer_jobs_employer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."employer_jobs"
    ADD CONSTRAINT "employer_jobs_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employer_profiles"("id");


--
-- Name: employer_profiles employer_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."employer_profiles"
    ADD CONSTRAINT "employer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");


--
-- Name: evaluations evaluations_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evaluations"
    ADD CONSTRAINT "evaluations_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE SET NULL;


--
-- Name: evaluations evaluations_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evaluations"
    ADD CONSTRAINT "evaluations_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;


--
-- Name: evaluations evaluations_evaluator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evaluations"
    ADD CONSTRAINT "evaluations_evaluator_id_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: evaluations evaluations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."evaluations"
    ADD CONSTRAINT "evaluations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;


--
-- Name: iv_interviews iv_interviews_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."iv_interviews"
    ADD CONSTRAINT "iv_interviews_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."iv_companies"("id") ON DELETE CASCADE;


--
-- Name: iv_messages iv_messages_interview_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."iv_messages"
    ADD CONSTRAINT "iv_messages_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "public"."iv_interviews"("id") ON DELETE CASCADE;


--
-- Name: job_interests job_interests_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."job_interests"
    ADD CONSTRAINT "job_interests_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."employer_jobs"("id");


--
-- Name: job_interests job_interests_talent_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."job_interests"
    ADD CONSTRAINT "job_interests_talent_user_id_fkey" FOREIGN KEY ("talent_user_id") REFERENCES "auth"."users"("id");


--
-- Name: jobs jobs_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;


--
-- Name: jobs jobs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: nurturing_candidates nurturing_candidates_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."nurturing_candidates"
    ADD CONSTRAINT "nurturing_candidates_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id");


--
-- Name: nurturing_candidates nurturing_candidates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."nurturing_candidates"
    ADD CONSTRAINT "nurturing_candidates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: offer_letters offer_letters_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."offer_letters"
    ADD CONSTRAINT "offer_letters_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE SET NULL;


--
-- Name: offer_letters offer_letters_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."offer_letters"
    ADD CONSTRAINT "offer_letters_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;


--
-- Name: offer_letters offer_letters_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."offer_letters"
    ADD CONSTRAINT "offer_letters_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE SET NULL;


--
-- Name: offer_letters offer_letters_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."offer_letters"
    ADD CONSTRAINT "offer_letters_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;


--
-- Name: ow_activities ow_activities_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_activities"
    ADD CONSTRAINT "ow_activities_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."ow_users"("id") ON DELETE SET NULL;


--
-- Name: ow_activities ow_activities_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_activities"
    ADD CONSTRAINT "ow_activities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_agent_agencies ow_agent_agencies_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_agent_agencies"
    ADD CONSTRAINT "ow_agent_agencies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_agent_contacts ow_agent_contacts_agency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_agent_contacts"
    ADD CONSTRAINT "ow_agent_contacts_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."ow_agent_agencies"("id") ON DELETE CASCADE;


--
-- Name: ow_agent_jobs ow_agent_jobs_agency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_agent_jobs"
    ADD CONSTRAINT "ow_agent_jobs_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."ow_agent_agencies"("id") ON DELETE CASCADE;


--
-- Name: ow_agent_jobs ow_agent_jobs_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_agent_jobs"
    ADD CONSTRAINT "ow_agent_jobs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."ow_jobs"("id") ON DELETE CASCADE;


--
-- Name: ow_applications ow_applications_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_applications"
    ADD CONSTRAINT "ow_applications_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "auth"."users"("id");


--
-- Name: ow_applications ow_applications_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_applications"
    ADD CONSTRAINT "ow_applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."ow_jobs"("id");


--
-- Name: ow_articles ow_articles_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_articles"
    ADD CONSTRAINT "ow_articles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE SET NULL;


--
-- Name: ow_articles ow_articles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_articles"
    ADD CONSTRAINT "ow_articles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ow_users"("id") ON DELETE SET NULL;


--
-- Name: ow_bookmarks ow_bookmarks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_bookmarks"
    ADD CONSTRAINT "ow_bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ow_users"("id") ON DELETE CASCADE;


--
-- Name: ow_career_agent_leads ow_career_agent_leads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_career_agent_leads"
    ADD CONSTRAINT "ow_career_agent_leads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ow_users"("id") ON DELETE SET NULL;


--
-- Name: ow_career_follows ow_career_follows_follower_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_career_follows"
    ADD CONSTRAINT "ow_career_follows_follower_user_id_fkey" FOREIGN KEY ("follower_user_id") REFERENCES "public"."ow_users"("id") ON DELETE CASCADE;


--
-- Name: ow_career_follows ow_career_follows_target_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_career_follows"
    ADD CONSTRAINT "ow_career_follows_target_profile_id_fkey" FOREIGN KEY ("target_profile_id") REFERENCES "public"."ow_career_profiles"("id") ON DELETE CASCADE;


--
-- Name: ow_career_profiles ow_career_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_career_profiles"
    ADD CONSTRAINT "ow_career_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ow_users"("id") ON DELETE CASCADE;


--
-- Name: ow_casual_meetings ow_casual_meetings_assignee_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_casual_meetings"
    ADD CONSTRAINT "ow_casual_meetings_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."ow_users"("id") ON DELETE SET NULL;


--
-- Name: ow_casual_meetings ow_casual_meetings_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_casual_meetings"
    ADD CONSTRAINT "ow_casual_meetings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_casual_meetings ow_casual_meetings_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_casual_meetings"
    ADD CONSTRAINT "ow_casual_meetings_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."ow_conversations"("id") ON DELETE SET NULL;


--
-- Name: ow_casual_meetings ow_casual_meetings_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_casual_meetings"
    ADD CONSTRAINT "ow_casual_meetings_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."ow_jobs"("id") ON DELETE SET NULL;


--
-- Name: ow_casual_meetings ow_casual_meetings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_casual_meetings"
    ADD CONSTRAINT "ow_casual_meetings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ow_users"("id") ON DELETE CASCADE;


--
-- Name: ow_companies ow_companies_industry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_companies"
    ADD CONSTRAINT "ow_companies_industry_id_fkey" FOREIGN KEY ("industry_id") REFERENCES "public"."ow_industries"("id") ON DELETE SET NULL;


--
-- Name: ow_companies ow_companies_saas_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_companies"
    ADD CONSTRAINT "ow_companies_saas_category_id_fkey" FOREIGN KEY ("saas_category_id") REFERENCES "public"."ow_saas_categories"("id") ON DELETE SET NULL;


--
-- Name: ow_companies ow_companies_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_companies"
    ADD CONSTRAINT "ow_companies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");


--
-- Name: ow_company_admins ow_company_admins_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_admins"
    ADD CONSTRAINT "ow_company_admins_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_company_admins ow_company_admins_invited_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_admins"
    ADD CONSTRAINT "ow_company_admins_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."ow_users"("id") ON DELETE SET NULL;


--
-- Name: ow_company_admins ow_company_admins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_admins"
    ADD CONSTRAINT "ow_company_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ow_users"("id") ON DELETE CASCADE;


--
-- Name: ow_company_culture_tags ow_company_culture_tags_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_culture_tags"
    ADD CONSTRAINT "ow_company_culture_tags_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_company_departments ow_company_departments_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_departments"
    ADD CONSTRAINT "ow_company_departments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_company_departments ow_company_departments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_departments"
    ADD CONSTRAINT "ow_company_departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."ow_company_departments"("id") ON DELETE CASCADE;


--
-- Name: ow_company_domain_verifications ow_company_domain_verifications_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_domain_verifications"
    ADD CONSTRAINT "ow_company_domain_verifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_company_employee_categories ow_company_employee_categories_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_employee_categories"
    ADD CONSTRAINT "ow_company_employee_categories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_company_employee_categories ow_company_employee_categories_parent_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_employee_categories"
    ADD CONSTRAINT "ow_company_employee_categories_parent_role_id_fkey" FOREIGN KEY ("parent_role_id") REFERENCES "public"."ow_roles"("id") ON DELETE SET NULL;


--
-- Name: ow_company_employee_categories ow_company_employee_categories_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_employee_categories"
    ADD CONSTRAINT "ow_company_employee_categories_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."ow_roles"("id");


--
-- Name: ow_company_external_links ow_company_external_links_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_external_links"
    ADD CONSTRAINT "ow_company_external_links_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_company_external_links ow_company_external_links_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_external_links"
    ADD CONSTRAINT "ow_company_external_links_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: ow_company_follows ow_company_follows_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_follows"
    ADD CONSTRAINT "ow_company_follows_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_company_follows ow_company_follows_follower_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_follows"
    ADD CONSTRAINT "ow_company_follows_follower_user_id_fkey" FOREIGN KEY ("follower_user_id") REFERENCES "public"."ow_users"("id") ON DELETE CASCADE;


--
-- Name: ow_company_genres ow_company_genres_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_genres"
    ADD CONSTRAINT "ow_company_genres_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."ow_users"("id");


--
-- Name: ow_company_genres ow_company_genres_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_genres"
    ADD CONSTRAINT "ow_company_genres_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_company_genres ow_company_genres_genre_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_genres"
    ADD CONSTRAINT "ow_company_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "public"."ow_genres"("id") ON DELETE CASCADE;


--
-- Name: ow_company_hidden_experiences ow_company_hidden_experiences_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_hidden_experiences"
    ADD CONSTRAINT "ow_company_hidden_experiences_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_company_hidden_experiences ow_company_hidden_experiences_experience_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_hidden_experiences"
    ADD CONSTRAINT "ow_company_hidden_experiences_experience_id_fkey" FOREIGN KEY ("experience_id") REFERENCES "public"."ow_experiences"("id") ON DELETE CASCADE;


--
-- Name: ow_company_hidden_experiences ow_company_hidden_experiences_hidden_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_hidden_experiences"
    ADD CONSTRAINT "ow_company_hidden_experiences_hidden_by_fkey" FOREIGN KEY ("hidden_by") REFERENCES "public"."ow_company_admins"("id") ON DELETE SET NULL;


--
-- Name: ow_company_job_roles ow_company_job_roles_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_job_roles"
    ADD CONSTRAINT "ow_company_job_roles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_company_job_roles ow_company_job_roles_standard_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_job_roles"
    ADD CONSTRAINT "ow_company_job_roles_standard_role_id_fkey" FOREIGN KEY ("standard_role_id") REFERENCES "public"."ow_roles"("id") ON DELETE SET NULL;


--
-- Name: ow_company_join_requests ow_company_join_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_join_requests"
    ADD CONSTRAINT "ow_company_join_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."ow_users"("id") ON DELETE SET NULL;


--
-- Name: ow_company_join_requests ow_company_join_requests_target_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_join_requests"
    ADD CONSTRAINT "ow_company_join_requests_target_company_id_fkey" FOREIGN KEY ("target_company_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_company_join_requests ow_company_join_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_join_requests"
    ADD CONSTRAINT "ow_company_join_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ow_users"("id") ON DELETE CASCADE;


--
-- Name: ow_company_members ow_company_members_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_members"
    ADD CONSTRAINT "ow_company_members_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_company_members ow_company_members_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_members"
    ADD CONSTRAINT "ow_company_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: ow_company_members ow_company_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_members"
    ADD CONSTRAINT "ow_company_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ow_users"("id") ON DELETE CASCADE;


--
-- Name: ow_company_office_photos ow_company_office_photos_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_office_photos"
    ADD CONSTRAINT "ow_company_office_photos_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_company_office_photos ow_company_office_photos_tagged_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_office_photos"
    ADD CONSTRAINT "ow_company_office_photos_tagged_user_id_fkey" FOREIGN KEY ("tagged_user_id") REFERENCES "public"."ow_users"("id") ON DELETE SET NULL;


--
-- Name: ow_company_perspectives ow_company_perspectives_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_perspectives"
    ADD CONSTRAINT "ow_company_perspectives_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_company_posts ow_company_posts_author_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_posts"
    ADD CONSTRAINT "ow_company_posts_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "public"."ow_users"("id") ON DELETE SET NULL;


--
-- Name: ow_company_posts ow_company_posts_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_company_posts"
    ADD CONSTRAINT "ow_company_posts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_contact_logs ow_contact_logs_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_contact_logs"
    ADD CONSTRAINT "ow_contact_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_conversation_messages ow_conversation_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_conversation_messages"
    ADD CONSTRAINT "ow_conversation_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."ow_conversations"("id") ON DELETE CASCADE;


--
-- Name: ow_conversation_messages ow_conversation_messages_sender_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_conversation_messages"
    ADD CONSTRAINT "ow_conversation_messages_sender_participant_id_fkey" FOREIGN KEY ("sender_participant_id") REFERENCES "public"."ow_conversation_participants"("id") ON DELETE SET NULL;


--
-- Name: ow_conversation_participants ow_conversation_participants_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_conversation_participants"
    ADD CONSTRAINT "ow_conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."ow_conversations"("id") ON DELETE CASCADE;


--
-- Name: ow_conversation_participants ow_conversation_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_conversation_participants"
    ADD CONSTRAINT "ow_conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ow_users"("id") ON DELETE SET NULL;


--
-- Name: ow_conversations ow_conversations_candidate_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_conversations"
    ADD CONSTRAINT "ow_conversations_candidate_user_id_fkey" FOREIGN KEY ("candidate_user_id") REFERENCES "public"."ow_users"("id") ON DELETE CASCADE;


--
-- Name: ow_conversations ow_conversations_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_conversations"
    ADD CONSTRAINT "ow_conversations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_conversations ow_conversations_mentor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_conversations"
    ADD CONSTRAINT "ow_conversations_mentor_user_id_fkey" FOREIGN KEY ("mentor_user_id") REFERENCES "public"."ow_users"("id") ON DELETE SET NULL;


--
-- Name: ow_experience_roles ow_experience_roles_experience_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_experience_roles"
    ADD CONSTRAINT "ow_experience_roles_experience_id_fkey" FOREIGN KEY ("experience_id") REFERENCES "public"."ow_experiences"("id") ON DELETE CASCADE;


--
-- Name: ow_experience_roles ow_experience_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_experience_roles"
    ADD CONSTRAINT "ow_experience_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."ow_roles"("id") ON DELETE RESTRICT;


--
-- Name: ow_experience_stories ow_experience_stories_experience_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_experience_stories"
    ADD CONSTRAINT "ow_experience_stories_experience_id_fkey" FOREIGN KEY ("experience_id") REFERENCES "public"."ow_experiences"("id") ON DELETE CASCADE;


--
-- Name: ow_experience_stories ow_experience_stories_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_experience_stories"
    ADD CONSTRAINT "ow_experience_stories_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."ow_story_sections"("id") ON DELETE SET NULL;


--
-- Name: ow_experiences ow_experiences_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_experiences"
    ADD CONSTRAINT "ow_experiences_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE SET NULL;


--
-- Name: ow_experiences ow_experiences_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_experiences"
    ADD CONSTRAINT "ow_experiences_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."ow_company_departments"("id") ON DELETE SET NULL;


--
-- Name: ow_experiences ow_experiences_role_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_experiences"
    ADD CONSTRAINT "ow_experiences_role_category_id_fkey" FOREIGN KEY ("role_category_id") REFERENCES "public"."ow_roles"("id");


--
-- Name: ow_experiences ow_experiences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_experiences"
    ADD CONSTRAINT "ow_experiences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ow_users"("id") ON DELETE CASCADE;


--
-- Name: ow_favorites ow_favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_favorites"
    ADD CONSTRAINT "ow_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: ow_industries ow_industries_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_industries"
    ADD CONSTRAINT "ow_industries_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."ow_industries"("id") ON DELETE RESTRICT;


--
-- Name: ow_invoices ow_invoices_related_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_invoices"
    ADD CONSTRAINT "ow_invoices_related_candidate_id_fkey" FOREIGN KEY ("related_candidate_id") REFERENCES "auth"."users"("id");


--
-- Name: ow_invoices ow_invoices_related_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_invoices"
    ADD CONSTRAINT "ow_invoices_related_job_id_fkey" FOREIGN KEY ("related_job_id") REFERENCES "public"."ow_jobs"("id");


--
-- Name: ow_invoices ow_invoices_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_invoices"
    ADD CONSTRAINT "ow_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_job_applications ow_job_applications_agency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_job_applications"
    ADD CONSTRAINT "ow_job_applications_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."ow_agent_agencies"("id") ON DELETE SET NULL;


--
-- Name: ow_job_applications ow_job_applications_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_job_applications"
    ADD CONSTRAINT "ow_job_applications_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."ow_conversations"("id") ON DELETE SET NULL;


--
-- Name: ow_job_applications ow_job_applications_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_job_applications"
    ADD CONSTRAINT "ow_job_applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."ow_jobs"("id") ON DELETE CASCADE;


--
-- Name: ow_job_applications ow_job_applications_pipeline_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_job_applications"
    ADD CONSTRAINT "ow_job_applications_pipeline_stage_id_fkey" FOREIGN KEY ("pipeline_stage_id") REFERENCES "public"."ow_pipeline_stages"("id") ON DELETE SET NULL;


--
-- Name: ow_job_applications ow_job_applications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_job_applications"
    ADD CONSTRAINT "ow_job_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ow_users"("id") ON DELETE RESTRICT;


--
-- Name: ow_job_assignees ow_job_assignees_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_job_assignees"
    ADD CONSTRAINT "ow_job_assignees_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."ow_jobs"("id") ON DELETE CASCADE;


--
-- Name: ow_job_assignees ow_job_assignees_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_job_assignees"
    ADD CONSTRAINT "ow_job_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ow_users"("id") ON DELETE CASCADE;


--
-- Name: ow_job_favorites ow_job_favorites_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_job_favorites"
    ADD CONSTRAINT "ow_job_favorites_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."ow_jobs"("id") ON DELETE CASCADE;


--
-- Name: ow_job_favorites ow_job_favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_job_favorites"
    ADD CONSTRAINT "ow_job_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: ow_job_matching_tags ow_job_matching_tags_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_job_matching_tags"
    ADD CONSTRAINT "ow_job_matching_tags_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."ow_jobs"("id") ON DELETE CASCADE;


--
-- Name: ow_job_requirements ow_job_requirements_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_job_requirements"
    ADD CONSTRAINT "ow_job_requirements_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."ow_jobs"("id") ON DELETE CASCADE;


--
-- Name: ow_job_roles ow_job_roles_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_job_roles"
    ADD CONSTRAINT "ow_job_roles_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."ow_jobs"("id") ON DELETE CASCADE;


--
-- Name: ow_job_roles ow_job_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_job_roles"
    ADD CONSTRAINT "ow_job_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."ow_roles"("id") ON DELETE RESTRICT;


--
-- Name: ow_job_views ow_job_views_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_job_views"
    ADD CONSTRAINT "ow_job_views_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."ow_jobs"("id") ON DELETE CASCADE;


--
-- Name: ow_job_views ow_job_views_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_job_views"
    ADD CONSTRAINT "ow_job_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: ow_jobs ow_jobs_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_jobs"
    ADD CONSTRAINT "ow_jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_jobs ow_jobs_company_job_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_jobs"
    ADD CONSTRAINT "ow_jobs_company_job_role_id_fkey" FOREIGN KEY ("company_job_role_id") REFERENCES "public"."ow_company_job_roles"("id") ON DELETE SET NULL;


--
-- Name: ow_jobs ow_jobs_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_jobs"
    ADD CONSTRAINT "ow_jobs_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."ow_company_departments"("id") ON DELETE SET NULL;


--
-- Name: ow_jobs ow_jobs_role_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_jobs"
    ADD CONSTRAINT "ow_jobs_role_category_id_fkey" FOREIGN KEY ("role_category_id") REFERENCES "public"."ow_roles"("id");


--
-- Name: ow_matches ow_matches_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_matches"
    ADD CONSTRAINT "ow_matches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_matches ow_matches_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_matches"
    ADD CONSTRAINT "ow_matches_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."ow_jobs"("id") ON DELETE SET NULL;


--
-- Name: ow_matches ow_matches_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_matches"
    ADD CONSTRAINT "ow_matches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ow_users"("id") ON DELETE CASCADE;


--
-- Name: ow_mentor_reservations ow_mentor_reservations_ambassador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_mentor_reservations"
    ADD CONSTRAINT "ow_mentor_reservations_ambassador_id_fkey" FOREIGN KEY ("ambassador_id") REFERENCES "public"."ow_company_admins"("id") ON DELETE SET NULL;


--
-- Name: ow_mentor_reservations ow_mentor_reservations_ambassador_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_mentor_reservations"
    ADD CONSTRAINT "ow_mentor_reservations_ambassador_user_id_fkey" FOREIGN KEY ("ambassador_user_id") REFERENCES "public"."ow_users"("id") ON DELETE SET NULL;


--
-- Name: ow_mentor_reservations ow_mentor_reservations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_mentor_reservations"
    ADD CONSTRAINT "ow_mentor_reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ow_users"("id") ON DELETE CASCADE;


--
-- Name: ow_message_reads ow_message_reads_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_message_reads"
    ADD CONSTRAINT "ow_message_reads_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."ow_conversation_messages"("id") ON DELETE CASCADE;


--
-- Name: ow_message_reads ow_message_reads_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_message_reads"
    ADD CONSTRAINT "ow_message_reads_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "public"."ow_conversation_participants"("id") ON DELETE CASCADE;


--
-- Name: ow_notifications ow_notifications_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_notifications"
    ADD CONSTRAINT "ow_notifications_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."ow_users"("id") ON DELETE CASCADE;


--
-- Name: ow_notifications ow_notifications_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_notifications"
    ADD CONSTRAINT "ow_notifications_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."ow_post_comments"("id") ON DELETE CASCADE;


--
-- Name: ow_notifications ow_notifications_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_notifications"
    ADD CONSTRAINT "ow_notifications_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."ow_posts"("id") ON DELETE CASCADE;


--
-- Name: ow_notifications ow_notifications_recipient_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_notifications"
    ADD CONSTRAINT "ow_notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."ow_users"("id") ON DELETE CASCADE;


--
-- Name: ow_pipeline_stages ow_pipeline_stages_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_pipeline_stages"
    ADD CONSTRAINT "ow_pipeline_stages_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_placements ow_placements_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_placements"
    ADD CONSTRAINT "ow_placements_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: ow_placements ow_placements_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_placements"
    ADD CONSTRAINT "ow_placements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE RESTRICT;


--
-- Name: ow_placements ow_placements_current_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_placements"
    ADD CONSTRAINT "ow_placements_current_role_id_fkey" FOREIGN KEY ("current_role_id") REFERENCES "public"."ow_roles"("id") ON DELETE SET NULL;


--
-- Name: ow_placements ow_placements_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_placements"
    ADD CONSTRAINT "ow_placements_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."ow_jobs"("id") ON DELETE SET NULL;


--
-- Name: ow_placements ow_placements_previous_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_placements"
    ADD CONSTRAINT "ow_placements_previous_role_id_fkey" FOREIGN KEY ("previous_role_id") REFERENCES "public"."ow_roles"("id") ON DELETE SET NULL;


--
-- Name: ow_post_comments ow_post_comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_post_comments"
    ADD CONSTRAINT "ow_post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."ow_posts"("id") ON DELETE CASCADE;


--
-- Name: ow_post_comments ow_post_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_post_comments"
    ADD CONSTRAINT "ow_post_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ow_users"("id") ON DELETE CASCADE;


--
-- Name: ow_post_hire_reports ow_post_hire_reports_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_post_hire_reports"
    ADD CONSTRAINT "ow_post_hire_reports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_post_hire_reports ow_post_hire_reports_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_post_hire_reports"
    ADD CONSTRAINT "ow_post_hire_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: ow_post_likes ow_post_likes_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_post_likes"
    ADD CONSTRAINT "ow_post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."ow_posts"("id") ON DELETE CASCADE;


--
-- Name: ow_post_likes ow_post_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_post_likes"
    ADD CONSTRAINT "ow_post_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ow_users"("id") ON DELETE CASCADE;


--
-- Name: ow_posts ow_posts_ref_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_posts"
    ADD CONSTRAINT "ow_posts_ref_article_id_fkey" FOREIGN KEY ("ref_article_id") REFERENCES "public"."ow_articles"("id") ON DELETE SET NULL;


--
-- Name: ow_posts ow_posts_ref_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_posts"
    ADD CONSTRAINT "ow_posts_ref_company_id_fkey" FOREIGN KEY ("ref_company_id") REFERENCES "public"."ow_companies"("id") ON DELETE SET NULL;


--
-- Name: ow_posts ow_posts_ref_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_posts"
    ADD CONSTRAINT "ow_posts_ref_job_id_fkey" FOREIGN KEY ("ref_job_id") REFERENCES "public"."ow_jobs"("id") ON DELETE SET NULL;


--
-- Name: ow_posts ow_posts_ref_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_posts"
    ADD CONSTRAINT "ow_posts_ref_user_id_fkey" FOREIGN KEY ("ref_user_id") REFERENCES "public"."ow_users"("id") ON DELETE SET NULL;


--
-- Name: ow_posts ow_posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_posts"
    ADD CONSTRAINT "ow_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ow_users"("id") ON DELETE CASCADE;


--
-- Name: ow_profiles ow_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_profiles"
    ADD CONSTRAINT "ow_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: ow_role_aliases ow_role_aliases_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_role_aliases"
    ADD CONSTRAINT "ow_role_aliases_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."ow_roles"("id") ON DELETE CASCADE;


--
-- Name: ow_roles ow_roles_merged_into_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_roles"
    ADD CONSTRAINT "ow_roles_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "public"."ow_roles"("id") ON DELETE SET NULL;


--
-- Name: ow_roles ow_roles_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_roles"
    ADD CONSTRAINT "ow_roles_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."ow_roles"("id");


--
-- Name: ow_salary_reports ow_salary_reports_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_salary_reports"
    ADD CONSTRAINT "ow_salary_reports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_salary_reports ow_salary_reports_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_salary_reports"
    ADD CONSTRAINT "ow_salary_reports_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."ow_roles"("id") ON DELETE RESTRICT;


--
-- Name: ow_salary_reports ow_salary_reports_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_salary_reports"
    ADD CONSTRAINT "ow_salary_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ow_users"("id") ON DELETE CASCADE;


--
-- Name: ow_saved_companies ow_saved_companies_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_saved_companies"
    ADD CONSTRAINT "ow_saved_companies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id");


--
-- Name: ow_saved_companies ow_saved_companies_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_saved_companies"
    ADD CONSTRAINT "ow_saved_companies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");


--
-- Name: ow_saved_jobs ow_saved_jobs_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_saved_jobs"
    ADD CONSTRAINT "ow_saved_jobs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."ow_jobs"("id");


--
-- Name: ow_saved_jobs ow_saved_jobs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_saved_jobs"
    ADD CONSTRAINT "ow_saved_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");


--
-- Name: ow_school_requests ow_school_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_school_requests"
    ADD CONSTRAINT "ow_school_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."ow_users"("id") ON DELETE SET NULL;


--
-- Name: ow_school_requests ow_school_requests_approved_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_school_requests"
    ADD CONSTRAINT "ow_school_requests_approved_school_id_fkey" FOREIGN KEY ("approved_school_id") REFERENCES "public"."ow_schools"("id") ON DELETE SET NULL;


--
-- Name: ow_school_requests ow_school_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_school_requests"
    ADD CONSTRAINT "ow_school_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."ow_users"("id") ON DELETE CASCADE;


--
-- Name: ow_scout_blocks ow_scout_blocks_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_scout_blocks"
    ADD CONSTRAINT "ow_scout_blocks_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: ow_scout_blocks ow_scout_blocks_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_scout_blocks"
    ADD CONSTRAINT "ow_scout_blocks_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_scout_quotas ow_scout_quotas_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_scout_quotas"
    ADD CONSTRAINT "ow_scout_quotas_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_scouts ow_scouts_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_scouts"
    ADD CONSTRAINT "ow_scouts_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "auth"."users"("id");


--
-- Name: ow_scouts ow_scouts_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_scouts"
    ADD CONSTRAINT "ow_scouts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id");


--
-- Name: ow_scouts ow_scouts_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_scouts"
    ADD CONSTRAINT "ow_scouts_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."ow_conversations"("id") ON DELETE SET NULL;


--
-- Name: ow_scouts ow_scouts_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_scouts"
    ADD CONSTRAINT "ow_scouts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."ow_jobs"("id");


--
-- Name: ow_story_sections ow_story_sections_experience_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_story_sections"
    ADD CONSTRAINT "ow_story_sections_experience_id_fkey" FOREIGN KEY ("experience_id") REFERENCES "public"."ow_experiences"("id") ON DELETE CASCADE;


--
-- Name: ow_tenant_plans ow_tenant_plans_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_tenant_plans"
    ADD CONSTRAINT "ow_tenant_plans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_terms_agreements ow_terms_agreements_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_terms_agreements"
    ADD CONSTRAINT "ow_terms_agreements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE SET NULL;


--
-- Name: ow_terms_agreements ow_terms_agreements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_terms_agreements"
    ADD CONSTRAINT "ow_terms_agreements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: ow_user_achievements ow_user_achievements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_user_achievements"
    ADD CONSTRAINT "ow_user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ow_users"("id") ON DELETE CASCADE;


--
-- Name: ow_user_awards ow_user_awards_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_user_awards"
    ADD CONSTRAINT "ow_user_awards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ow_users"("id") ON DELETE CASCADE;


--
-- Name: ow_user_certifications ow_user_certifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_user_certifications"
    ADD CONSTRAINT "ow_user_certifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ow_users"("id") ON DELETE CASCADE;


--
-- Name: ow_user_content_links ow_user_content_links_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_user_content_links"
    ADD CONSTRAINT "ow_user_content_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ow_users"("id") ON DELETE CASCADE;


--
-- Name: ow_user_educations ow_user_educations_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_user_educations"
    ADD CONSTRAINT "ow_user_educations_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."ow_schools"("id") ON DELETE SET NULL;


--
-- Name: ow_user_educations ow_user_educations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_user_educations"
    ADD CONSTRAINT "ow_user_educations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ow_users"("id") ON DELETE CASCADE;


--
-- Name: ow_user_media_appearances ow_user_media_appearances_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_user_media_appearances"
    ADD CONSTRAINT "ow_user_media_appearances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ow_users"("id") ON DELETE CASCADE;


--
-- Name: ow_user_profiles ow_user_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_user_profiles"
    ADD CONSTRAINT "ow_user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: ow_user_recommendations ow_user_recommendations_recommender_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_user_recommendations"
    ADD CONSTRAINT "ow_user_recommendations_recommender_user_id_fkey" FOREIGN KEY ("recommender_user_id") REFERENCES "public"."ow_users"("id") ON DELETE SET NULL;


--
-- Name: ow_user_recommendations ow_user_recommendations_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_user_recommendations"
    ADD CONSTRAINT "ow_user_recommendations_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "public"."ow_users"("id") ON DELETE CASCADE;


--
-- Name: ow_user_roles ow_user_roles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_user_roles"
    ADD CONSTRAINT "ow_user_roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: ow_user_roles ow_user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_user_roles"
    ADD CONSTRAINT "ow_user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: ow_user_skill_tags ow_user_skill_tags_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_user_skill_tags"
    ADD CONSTRAINT "ow_user_skill_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ow_users"("id") ON DELETE CASCADE;


--
-- Name: ow_user_socials ow_user_socials_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_user_socials"
    ADD CONSTRAINT "ow_user_socials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."ow_users"("id") ON DELETE CASCADE;


--
-- Name: ow_users ow_users_auth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ow_users"
    ADD CONSTRAINT "ow_users_auth_id_fkey" FOREIGN KEY ("auth_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: salary_viewers salary_viewers_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."salary_viewers"
    ADD CONSTRAINT "salary_viewers_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;


--
-- Name: salary_viewers salary_viewers_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."salary_viewers"
    ADD CONSTRAINT "salary_viewers_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "auth"."users"("id");


--
-- Name: salary_viewers salary_viewers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."salary_viewers"
    ADD CONSTRAINT "salary_viewers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: salary_viewers salary_viewers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."salary_viewers"
    ADD CONSTRAINT "salary_viewers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: scout_history scout_history_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."scout_history"
    ADD CONSTRAINT "scout_history_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");


--
-- Name: scout_history scout_history_talent_pool_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."scout_history"
    ADD CONSTRAINT "scout_history_talent_pool_id_fkey" FOREIGN KEY ("talent_pool_id") REFERENCES "public"."talent_pool"("id");


--
-- Name: scout_history scout_history_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."scout_history"
    ADD CONSTRAINT "scout_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: scout_messages scout_messages_employer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."scout_messages"
    ADD CONSTRAINT "scout_messages_employer_id_fkey" FOREIGN KEY ("employer_id") REFERENCES "public"."employer_profiles"("id");


--
-- Name: scout_messages scout_messages_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."scout_messages"
    ADD CONSTRAINT "scout_messages_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."employer_jobs"("id");


--
-- Name: scout_messages scout_messages_talent_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."scout_messages"
    ADD CONSTRAINT "scout_messages_talent_user_id_fkey" FOREIGN KEY ("talent_user_id") REFERENCES "auth"."users"("id");


--
-- Name: selection_feedback selection_feedback_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."selection_feedback"
    ADD CONSTRAINT "selection_feedback_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id");


--
-- Name: selection_feedback selection_feedback_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."selection_feedback"
    ADD CONSTRAINT "selection_feedback_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id");


--
-- Name: selection_feedback selection_feedback_interviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."selection_feedback"
    ADD CONSTRAINT "selection_feedback_interviewer_id_fkey" FOREIGN KEY ("interviewer_id") REFERENCES "auth"."users"("id");


--
-- Name: selection_feedback selection_feedback_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."selection_feedback"
    ADD CONSTRAINT "selection_feedback_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");


--
-- Name: selection_feedback selection_feedback_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."selection_feedback"
    ADD CONSTRAINT "selection_feedback_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: talent_pool talent_pool_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."talent_pool"
    ADD CONSTRAINT "talent_pool_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id");


--
-- Name: talent_pool talent_pool_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."talent_pool"
    ADD CONSTRAINT "talent_pool_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");


--
-- Name: talent_profiles talent_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."talent_profiles"
    ADD CONSTRAINT "talent_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");


--
-- Name: work_histories work_histories_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."work_histories"
    ADD CONSTRAINT "work_histories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."ow_companies"("id") ON DELETE CASCADE;


--
-- Name: work_histories work_histories_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."work_histories"
    ADD CONSTRAINT "work_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: ow_company_join_requests Admins can update all join requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update all join requests" ON "public"."ow_company_join_requests" FOR UPDATE USING ("public"."auth_is_admin"());


--
-- Name: ow_company_join_requests Admins can view all join requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all join requests" ON "public"."ow_company_join_requests" FOR SELECT USING ("public"."auth_is_admin"());


--
-- Name: agents Agents can read own record; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Agents can read own record" ON "public"."agents" FOR SELECT USING (("auth"."uid"() = "auth_user_id"));


--
-- Name: agent_company_access Allow all access to agent_company_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow all access to agent_company_access" ON "public"."agent_company_access" USING (true) WITH CHECK (true);


--
-- Name: applications Allow all access to applications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow all access to applications" ON "public"."applications" USING (true) WITH CHECK (true);


--
-- Name: jobs Allow all access to jobs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow all access to jobs" ON "public"."jobs" USING (true) WITH CHECK (true);


--
-- Name: agents Allow authenticated full access on agents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow authenticated full access on agents" ON "public"."agents" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));


--
-- Name: companies Allow authenticated full access on companies; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow authenticated full access on companies" ON "public"."companies" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));


--
-- Name: candidate_messages Allow authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow authenticated users" ON "public"."candidate_messages" USING (("auth"."uid"() IS NOT NULL));


--
-- Name: competing_offers Allow authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow authenticated users" ON "public"."competing_offers" USING (("auth"."uid"() IS NOT NULL));


--
-- Name: salary_viewers Allow authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow authenticated users" ON "public"."salary_viewers" USING (("auth"."uid"() IS NOT NULL));


--
-- Name: companies Allow public read on companies; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow public read on companies" ON "public"."companies" FOR SELECT USING (true);


--
-- Name: ow_genres Anyone can read active genres; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can read active genres" ON "public"."ow_genres" FOR SELECT USING (("is_active" = true));


--
-- Name: ow_company_genres Anyone can read approved company genres; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can read approved company genres" ON "public"."ow_company_genres" FOR SELECT USING (("is_human_approved" = true));


--
-- Name: nurturing_candidates Authenticated users can manage nurturing_candidates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can manage nurturing_candidates" ON "public"."nurturing_candidates" TO "authenticated" USING (true) WITH CHECK (true);


--
-- Name: scout_history Authenticated users can manage scout_history; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can manage scout_history" ON "public"."scout_history" TO "authenticated" USING (true) WITH CHECK (true);


--
-- Name: selection_feedback Authenticated users can manage selection_feedback; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can manage selection_feedback" ON "public"."selection_feedback" TO "authenticated" USING (true) WITH CHECK (true);


--
-- Name: talent_pool Authenticated users can manage talent_pool; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can manage talent_pool" ON "public"."talent_pool" TO "authenticated" USING (true) WITH CHECK (true);


--
-- Name: ow_company_join_requests Company admins can update requests to their company; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Company admins can update requests to their company" ON "public"."ow_company_join_requests" FOR UPDATE USING ((("request_type" = 'join_existing'::"text") AND ("target_company_id" IS NOT NULL) AND "public"."auth_is_company_admin"("target_company_id")));


--
-- Name: ow_company_join_requests Company admins can view requests to their company; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Company admins can view requests to their company" ON "public"."ow_company_join_requests" FOR SELECT USING ((("request_type" = 'join_existing'::"text") AND ("target_company_id" IS NOT NULL) AND "public"."auth_is_company_admin"("target_company_id")));


--
-- Name: ow_post_hire_reports Public reports are readable; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public reports are readable" ON "public"."ow_post_hire_reports" FOR SELECT USING (("is_published" = true));


--
-- Name: ow_company_join_requests Users can cancel their own pending requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can cancel their own pending requests" ON "public"."ow_company_join_requests" FOR UPDATE USING ((("auth"."uid"() = ( SELECT "ow_users"."auth_id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."id" = "ow_company_join_requests"."user_id")
 LIMIT 1)) AND ("status" = 'pending'::"text"))) WITH CHECK (("status" = 'cancelled'::"text"));


--
-- Name: ow_company_join_requests Users can create their own join requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create their own join requests" ON "public"."ow_company_join_requests" FOR INSERT WITH CHECK (("auth"."uid"() = ( SELECT "ow_users"."auth_id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."id" = "ow_company_join_requests"."user_id")
 LIMIT 1)));


--
-- Name: ow_job_favorites Users can delete own job favorites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete own job favorites" ON "public"."ow_job_favorites" FOR DELETE USING (("auth"."uid"() = "user_id"));


--
-- Name: ow_job_favorites Users can insert own job favorites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own job favorites" ON "public"."ow_job_favorites" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: ow_post_hire_reports Users can insert own reports; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own reports" ON "public"."ow_post_hire_reports" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: ow_favorites Users can manage own favorites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can manage own favorites" ON "public"."ow_favorites" USING (("auth"."uid"() = "user_id"));


--
-- Name: ow_post_hire_reports Users can manage own reports; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can manage own reports" ON "public"."ow_post_hire_reports" USING (("auth"."uid"() = "user_id"));


--
-- Name: ow_job_favorites Users can view own job favorites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own job favorites" ON "public"."ow_job_favorites" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: ow_company_join_requests Users can view their own join requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own join requests" ON "public"."ow_company_join_requests" FOR SELECT USING (("auth"."uid"() = ( SELECT "ow_users"."auth_id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."id" = "ow_company_join_requests"."user_id")
 LIMIT 1)));


--
-- Name: ow_career_agent_leads admin can manage career agent leads; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "admin can manage career agent leads" ON "public"."ow_career_agent_leads" USING ("public"."auth_is_admin"());


--
-- Name: ow_placements admin can manage placements; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "admin can manage placements" ON "public"."ow_placements" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."ow_user_roles"
  WHERE (("ow_user_roles"."user_id" = "auth"."uid"()) AND ("ow_user_roles"."role" = 'admin'::"text")))));


--
-- Name: ow_page_views admin can read page views; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "admin can read page views" ON "public"."ow_page_views" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."ow_user_roles"
  WHERE (("ow_user_roles"."user_id" = "auth"."uid"()) AND ("ow_user_roles"."role" = 'admin'::"text")))));


--
-- Name: ow_mentor_reservations admin can update all reservations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "admin can update all reservations" ON "public"."ow_mentor_reservations" FOR UPDATE USING ("public"."auth_is_admin"());


--
-- Name: ow_mentor_reservations admin can view all reservations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "admin can view all reservations" ON "public"."ow_mentor_reservations" FOR SELECT USING ("public"."auth_is_admin"());


--
-- Name: ow_scout_quotas admin manages quotas; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "admin manages quotas" ON "public"."ow_scout_quotas" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."ow_user_roles"
  WHERE (("ow_user_roles"."user_id" = "auth"."uid"()) AND ("ow_user_roles"."role" = 'admin'::"text")))));


--
-- Name: ow_terms_agreements admin read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "admin read" ON "public"."ow_terms_agreements" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."ow_user_roles"
  WHERE (("ow_user_roles"."user_id" = "auth"."uid"()) AND ("ow_user_roles"."role" = 'admin'::"text")))));


--
-- Name: ow_company_domain_verifications admin_full_access_domain_verif; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "admin_full_access_domain_verif" ON "public"."ow_company_domain_verifications" USING ((EXISTS ( SELECT 1
   FROM "public"."ow_user_roles"
  WHERE (("ow_user_roles"."user_id" = "auth"."uid"()) AND ("ow_user_roles"."role" = 'admin'::"text")))));


--
-- Name: ow_company_members admin_full_access_members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "admin_full_access_members" ON "public"."ow_company_members" USING ((EXISTS ( SELECT 1
   FROM "public"."ow_user_roles"
  WHERE (("ow_user_roles"."user_id" = "auth"."uid"()) AND ("ow_user_roles"."role" = 'admin'::"text")))));


--
-- Name: ow_agent_agencies agent_agencies_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "agent_agencies_delete" ON "public"."ow_agent_agencies" FOR DELETE USING ("public"."auth_is_company_member"("company_id"));


--
-- Name: ow_agent_agencies agent_agencies_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "agent_agencies_insert" ON "public"."ow_agent_agencies" FOR INSERT WITH CHECK ("public"."auth_is_company_member"("company_id"));


--
-- Name: ow_agent_agencies agent_agencies_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "agent_agencies_select" ON "public"."ow_agent_agencies" FOR SELECT USING ("public"."auth_is_company_member"("company_id"));


--
-- Name: ow_agent_agencies agent_agencies_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "agent_agencies_update" ON "public"."ow_agent_agencies" FOR UPDATE USING ("public"."auth_is_company_member"("company_id")) WITH CHECK ("public"."auth_is_company_member"("company_id"));


--
-- Name: agent_client_relations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."agent_client_relations" ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_client_relations agent_client_relations_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "agent_client_relations_policy" ON "public"."agent_client_relations" TO "authenticated" USING (true) WITH CHECK (true);


--
-- Name: agent_company_access; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."agent_company_access" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_agent_contacts agent_contacts_company_member; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "agent_contacts_company_member" ON "public"."ow_agent_contacts" USING ((EXISTS ( SELECT 1
   FROM "public"."ow_agent_agencies" "a"
  WHERE (("a"."id" = "ow_agent_contacts"."agency_id") AND "public"."auth_is_company_member"("a"."company_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."ow_agent_agencies" "a"
  WHERE (("a"."id" = "ow_agent_contacts"."agency_id") AND "public"."auth_is_company_member"("a"."company_id")))));


--
-- Name: ow_agent_contacts agent_contacts_self_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "agent_contacts_self_select" ON "public"."ow_agent_contacts" FOR SELECT USING (("email" = (( SELECT "users"."email"
   FROM "auth"."users"
  WHERE ("users"."id" = "auth"."uid"())
 LIMIT 1))::"text"));


--
-- Name: ow_agent_jobs agent_jobs_agent_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "agent_jobs_agent_select" ON "public"."ow_agent_jobs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."ow_agent_contacts" "c"
  WHERE (("c"."agency_id" = "ow_agent_jobs"."agency_id") AND ("c"."email" = (( SELECT "users"."email"
           FROM "auth"."users"
          WHERE ("users"."id" = "auth"."uid"())
         LIMIT 1))::"text")))));


--
-- Name: ow_agent_jobs agent_jobs_company_member; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "agent_jobs_company_member" ON "public"."ow_agent_jobs" USING ((EXISTS ( SELECT 1
   FROM ("public"."ow_agent_agencies" "a"
     JOIN "public"."ow_jobs" "j" ON (("j"."id" = "ow_agent_jobs"."job_id")))
  WHERE (("a"."id" = "ow_agent_jobs"."agency_id") AND "public"."auth_is_company_member"("a"."company_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."ow_agent_agencies" "a"
  WHERE (("a"."id" = "ow_agent_jobs"."agency_id") AND "public"."auth_is_company_member"("a"."company_id")))));


--
-- Name: agent_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."agent_members" ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_members agent_members_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "agent_members_policy" ON "public"."agent_members" TO "authenticated" USING (true) WITH CHECK (true);


--
-- Name: agents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."agents" ENABLE ROW LEVEL SECURITY;

--
-- Name: agents agents_read_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "agents_read_own" ON "public"."agents" FOR SELECT USING (("auth_user_id" = "auth"."uid"()));


--
-- Name: ai_interviews; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ai_interviews" ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_interviews ai_interviews_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ai_interviews_all" ON "public"."ai_interviews" USING (true) WITH CHECK (true);


--
-- Name: candidate_documents allow_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "allow_all" ON "public"."candidate_documents" USING (true) WITH CHECK (true);


--
-- Name: ow_page_views anyone can insert page views; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "anyone can insert page views" ON "public"."ow_page_views" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);


--
-- Name: ow_job_views anyone can log views; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "anyone can log views" ON "public"."ow_job_views" FOR INSERT WITH CHECK (true);


--
-- Name: applications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."applications" ENABLE ROW LEVEL SECURITY;

--
-- Name: candidate_job_activities authenticated_users_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "authenticated_users_all" ON "public"."candidate_job_activities" TO "authenticated" USING (true) WITH CHECK (true);


--
-- Name: ow_placements candidate can read own placement; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "candidate can read own placement" ON "public"."ow_placements" FOR SELECT TO "authenticated" USING (("candidate_id" = "auth"."uid"()));


--
-- Name: ow_scout_blocks candidate manages own blocks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "candidate manages own blocks" ON "public"."ow_scout_blocks" TO "authenticated" USING (("candidate_id" = "auth"."uid"())) WITH CHECK (("candidate_id" = "auth"."uid"()));


--
-- Name: candidate_certifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."candidate_certifications" ENABLE ROW LEVEL SECURITY;

--
-- Name: candidate_certifications candidate_certifications_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "candidate_certifications_all" ON "public"."candidate_certifications" USING (true) WITH CHECK (true);


--
-- Name: candidate_documents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."candidate_documents" ENABLE ROW LEVEL SECURITY;

--
-- Name: candidate_educations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."candidate_educations" ENABLE ROW LEVEL SECURITY;

--
-- Name: candidate_educations candidate_educations_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "candidate_educations_all" ON "public"."candidate_educations" USING (true) WITH CHECK (true);


--
-- Name: candidate_hearings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."candidate_hearings" ENABLE ROW LEVEL SECURITY;

--
-- Name: candidate_hearings candidate_hearings_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "candidate_hearings_all" ON "public"."candidate_hearings" USING (true) WITH CHECK (true);


--
-- Name: candidate_job_activities; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."candidate_job_activities" ENABLE ROW LEVEL SECURITY;

--
-- Name: candidate_messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."candidate_messages" ENABLE ROW LEVEL SECURITY;

--
-- Name: candidate_notes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."candidate_notes" ENABLE ROW LEVEL SECURITY;

--
-- Name: candidate_notes candidate_notes_tenant_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "candidate_notes_tenant_isolation" ON "public"."candidate_notes" USING (true) WITH CHECK (true);


--
-- Name: candidate_timeline_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."candidate_timeline_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: candidate_work_histories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."candidate_work_histories" ENABLE ROW LEVEL SECURITY;

--
-- Name: candidate_work_histories candidate_work_histories_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "candidate_work_histories_all" ON "public"."candidate_work_histories" USING (true) WITH CHECK (true);


--
-- Name: candidates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."candidates" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_career_follows career_follows_own_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "career_follows_own_manage" ON "public"."ow_career_follows" USING (("follower_user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"())))) WITH CHECK (("follower_user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_career_follows career_follows_read_published; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "career_follows_read_published" ON "public"."ow_career_follows" FOR SELECT USING (("target_profile_id" IN ( SELECT "cp"."id"
   FROM ("public"."ow_career_profiles" "cp"
     JOIN "public"."ow_users" "u" ON (("u"."id" = "cp"."user_id")))
  WHERE (("cp"."is_published" = true) AND ("u"."visibility" = 'public'::"text")))));


--
-- Name: ow_career_profiles career_profiles_admin_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "career_profiles_admin_all" ON "public"."ow_career_profiles" USING ((EXISTS ( SELECT 1
   FROM ("public"."ow_user_roles" "r"
     JOIN "public"."ow_users" "u" ON (("u"."id" = "r"."user_id")))
  WHERE (("u"."auth_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."ow_user_roles" "r"
     JOIN "public"."ow_users" "u" ON (("u"."id" = "r"."user_id")))
  WHERE (("u"."auth_id" = "auth"."uid"()) AND ("r"."role" = 'admin'::"text")))));


--
-- Name: ow_career_profiles career_profiles_login_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "career_profiles_login_read" ON "public"."ow_career_profiles" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND ("is_published" = true) AND ("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."visibility" = ANY (ARRAY['public'::"text", 'login_only'::"text"]))))));


--
-- Name: ow_career_profiles career_profiles_own_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "career_profiles_own_manage" ON "public"."ow_career_profiles" USING (("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"())))) WITH CHECK (("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_career_profiles career_profiles_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "career_profiles_public_read" ON "public"."ow_career_profiles" FOR SELECT USING ((("is_published" = true) AND ("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."visibility" = 'public'::"text")))));


--
-- Name: channels; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."channels" ENABLE ROW LEVEL SECURITY;

--
-- Name: channels channels_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "channels_delete" ON "public"."channels" FOR DELETE TO "authenticated" USING (true);


--
-- Name: channels channels_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "channels_insert" ON "public"."channels" FOR INSERT TO "authenticated" WITH CHECK (true);


--
-- Name: channels channels_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "channels_select" ON "public"."channels" FOR SELECT TO "authenticated" USING (true);


--
-- Name: channels channels_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "channels_update" ON "public"."channels" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);


--
-- Name: companies; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_contact_logs company admins can view own contact logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "company admins can view own contact logs" ON "public"."ow_contact_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."ow_company_admins" "ca"
  WHERE (("ca"."company_id" = "ow_contact_logs"."company_id") AND ("ca"."user_id" = "auth"."uid"())))));


--
-- Name: ow_company_departments company admins manage departments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "company admins manage departments" ON "public"."ow_company_departments" USING ("public"."auth_is_company_admin"("company_id"));


--
-- Name: ow_company_job_roles company admins manage job roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "company admins manage job roles" ON "public"."ow_company_job_roles" USING ("public"."auth_is_company_admin"("company_id"));


--
-- Name: ow_scout_quotas company reads own quota; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "company reads own quota" ON "public"."ow_scout_quotas" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."ow_company_admins"
  WHERE (("ow_company_admins"."company_id" = "ow_scout_quotas"."company_id") AND ("ow_company_admins"."user_id" = "auth"."uid"())))));


--
-- Name: ow_company_posts company_admin_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "company_admin_all" ON "public"."ow_company_posts" USING ((EXISTS ( SELECT 1
   FROM ("public"."ow_company_admins" "ca"
     JOIN "public"."ow_users" "ou" ON (("ou"."id" = "ca"."user_id")))
  WHERE (("ou"."auth_id" = "auth"."uid"()) AND ("ca"."company_id" = "ow_company_posts"."company_id") AND ("ca"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."ow_company_admins" "ca"
     JOIN "public"."ow_users" "ou" ON (("ou"."id" = "ca"."user_id")))
  WHERE (("ou"."auth_id" = "auth"."uid"()) AND ("ca"."company_id" = "ow_company_posts"."company_id") AND ("ca"."is_active" = true)))));


--
-- Name: ow_company_members company_admin_invite_member; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "company_admin_invite_member" ON "public"."ow_company_members" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."ow_company_admins"
  WHERE (("ow_company_admins"."company_id" = "ow_company_members"."company_id") AND ("ow_company_admins"."user_id" = "auth"."uid"())))) AND ("display_consent" = false)));


--
-- Name: POLICY "company_admin_invite_member" ON "ow_company_members"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON POLICY "company_admin_invite_member" ON "public"."ow_company_members" IS '企業の管理者は自社の社員を指名できるが、display_consent = false（未同意）でしか作成できない。同意は本人だけが行える。';


--
-- Name: ow_company_hidden_experiences company_admin_manage_own_hidden; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "company_admin_manage_own_hidden" ON "public"."ow_company_hidden_experiences" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."ow_company_admins" "ca"
     JOIN "public"."ow_users" "u" ON (("u"."id" = "ca"."user_id")))
  WHERE (("u"."auth_id" = "auth"."uid"()) AND ("ca"."company_id" = "ow_company_hidden_experiences"."company_id") AND ("ca"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."ow_company_admins" "ca"
     JOIN "public"."ow_users" "u" ON (("u"."id" = "ca"."user_id")))
  WHERE (("u"."auth_id" = "auth"."uid"()) AND ("ca"."company_id" = "ow_company_hidden_experiences"."company_id") AND ("ca"."is_active" = true)))));


--
-- Name: ow_company_members company_admin_read_members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "company_admin_read_members" ON "public"."ow_company_members" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."ow_company_admins"
  WHERE (("ow_company_admins"."company_id" = "ow_company_members"."company_id") AND ("ow_company_admins"."user_id" = "auth"."uid"())))));


--
-- Name: ow_company_members company_admin_update_member; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "company_admin_update_member" ON "public"."ow_company_members" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."ow_company_admins"
  WHERE (("ow_company_admins"."company_id" = "ow_company_members"."company_id") AND ("ow_company_admins"."user_id" = "auth"."uid"())))));


--
-- Name: ow_job_applications company_admins_read_applications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "company_admins_read_applications" ON "public"."ow_job_applications" FOR SELECT USING (("job_id" IN ( SELECT "ow_jobs"."id"
   FROM "public"."ow_jobs"
  WHERE ("ow_jobs"."company_id" IN ( SELECT "ow_company_admins"."company_id"
           FROM "public"."ow_company_admins"
          WHERE (("ow_company_admins"."user_id" IN ( SELECT "ow_users"."id"
                   FROM "public"."ow_users"
                  WHERE ("ow_users"."auth_id" = "auth"."uid"()))) AND ("ow_company_admins"."is_active" = true)))))));


--
-- Name: ow_job_applications company_admins_update_applications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "company_admins_update_applications" ON "public"."ow_job_applications" FOR UPDATE USING (("job_id" IN ( SELECT "ow_jobs"."id"
   FROM "public"."ow_jobs"
  WHERE ("ow_jobs"."company_id" IN ( SELECT "ow_company_admins"."company_id"
           FROM "public"."ow_company_admins"
          WHERE (("ow_company_admins"."user_id" IN ( SELECT "ow_users"."id"
                   FROM "public"."ow_users"
                  WHERE ("ow_users"."auth_id" = "auth"."uid"()))) AND ("ow_company_admins"."is_active" = true))))))) WITH CHECK (("job_id" IN ( SELECT "ow_jobs"."id"
   FROM "public"."ow_jobs"
  WHERE ("ow_jobs"."company_id" IN ( SELECT "ow_company_admins"."company_id"
           FROM "public"."ow_company_admins"
          WHERE (("ow_company_admins"."user_id" IN ( SELECT "ow_users"."id"
                   FROM "public"."ow_users"
                  WHERE ("ow_users"."auth_id" = "auth"."uid"()))) AND ("ow_company_admins"."is_active" = true)))))));


--
-- Name: ow_company_external_links company_external_links_company_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "company_external_links_company_manage" ON "public"."ow_company_external_links" USING ("public"."auth_is_company_admin"("company_id")) WITH CHECK ("public"."auth_is_company_admin"("company_id"));


--
-- Name: ow_company_external_links company_external_links_editor_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "company_external_links_editor_manage" ON "public"."ow_company_external_links" USING ("public"."auth_is_admin"()) WITH CHECK ("public"."auth_is_admin"());


--
-- Name: ow_company_external_links company_external_links_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "company_external_links_public_read" ON "public"."ow_company_external_links" FOR SELECT USING (("is_published" = true));


--
-- Name: competing_offers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."competing_offers" ENABLE ROW LEVEL SECURITY;

--
-- Name: concurrent_applications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."concurrent_applications" ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_activities; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."crm_activities" ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_applications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."crm_applications" ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_applications crm_applications_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "crm_applications_isolation" ON "public"."crm_applications" TO "authenticated" USING (true) WITH CHECK (true);


--
-- Name: crm_candidates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."crm_candidates" ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_candidates crm_candidates_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "crm_candidates_isolation" ON "public"."crm_candidates" TO "authenticated" USING (true) WITH CHECK (true);


--
-- Name: crm_client_companies; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."crm_client_companies" ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_interviews; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."crm_interviews" ENABLE ROW LEVEL SECURITY;

--
-- Name: employer_jobs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."employer_jobs" ENABLE ROW LEVEL SECURITY;

--
-- Name: employer_profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."employer_profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: evaluations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."evaluations" ENABLE ROW LEVEL SECURITY;

--
-- Name: evaluations evaluations_tenant_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "evaluations_tenant_isolation" ON "public"."evaluations" USING (("tenant_id" IN ( SELECT "agents"."tenant_id"
   FROM "public"."agents"
  WHERE ("agents"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "agents"."tenant_id"
   FROM "public"."agents"
  WHERE ("agents"."auth_user_id" = "auth"."uid"()))));


--
-- Name: ow_experience_roles experience_roles_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "experience_roles_public_read" ON "public"."ow_experience_roles" FOR SELECT USING (true);


--
-- Name: ow_industries industries_admin_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "industries_admin_write" ON "public"."ow_industries" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."ow_user_roles"
  WHERE (("ow_user_roles"."user_id" = "auth"."uid"()) AND ("ow_user_roles"."role" = 'admin'::"text")))));


--
-- Name: ow_industries industries_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "industries_public_read" ON "public"."ow_industries" FOR SELECT USING (("is_active" = true));


--
-- Name: job_interests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."job_interests" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_job_roles job_roles_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "job_roles_public_read" ON "public"."ow_job_roles" FOR SELECT USING (true);


--
-- Name: jobs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_company_members member_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "member_delete" ON "public"."ow_company_members" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."ow_company_admins"
  WHERE (("ow_company_admins"."company_id" = "ow_company_members"."company_id") AND ("ow_company_admins"."user_id" = "auth"."uid"()))))));


--
-- Name: ow_notifications notifications_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "notifications_select_own" ON "public"."ow_notifications" FOR SELECT USING (("recipient_user_id" = ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"())
 LIMIT 1)));


--
-- Name: ow_notifications notifications_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "notifications_update_own" ON "public"."ow_notifications" FOR UPDATE USING (("recipient_user_id" = ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"())
 LIMIT 1))) WITH CHECK (("recipient_user_id" = ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"())
 LIMIT 1)));


--
-- Name: nurturing_candidates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."nurturing_candidates" ENABLE ROW LEVEL SECURITY;

--
-- Name: offer_letters; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."offer_letters" ENABLE ROW LEVEL SECURITY;

--
-- Name: offer_letters offer_letters_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "offer_letters_all" ON "public"."offer_letters" USING (true) WITH CHECK (true);


--
-- Name: ow_activities; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_activities" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_activities ow_activities_company_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_activities_company_insert" ON "public"."ow_activities" FOR INSERT WITH CHECK ("public"."auth_is_company_member"("company_id"));


--
-- Name: ow_activities ow_activities_company_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_activities_company_read" ON "public"."ow_activities" FOR SELECT USING ("public"."auth_is_company_member"("company_id"));


--
-- Name: ow_agent_agencies; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_agent_agencies" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_agent_contacts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_agent_contacts" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_agent_jobs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_agent_jobs" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_applications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_applications" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_applications ow_applications_candidate_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_applications_candidate_insert" ON "public"."ow_applications" FOR INSERT WITH CHECK (("auth"."uid"() = "candidate_id"));


--
-- Name: ow_applications ow_applications_candidate_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_applications_candidate_read" ON "public"."ow_applications" FOR SELECT USING (("auth"."uid"() = "candidate_id"));


--
-- Name: ow_articles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_articles" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_articles ow_articles_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_articles_public_read" ON "public"."ow_articles" FOR SELECT USING (true);


--
-- Name: ow_bookmarks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_bookmarks" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_bookmarks ow_bookmarks_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_bookmarks_own" ON "public"."ow_bookmarks" USING (("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_career_agent_leads; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_career_agent_leads" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_career_follows; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_career_follows" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_career_profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_career_profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_casual_meetings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_casual_meetings" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_casual_meetings ow_casual_meetings_company_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_casual_meetings_company_read" ON "public"."ow_casual_meetings" FOR SELECT USING (("company_id" IN ( SELECT "ow_company_admins"."company_id"
   FROM "public"."ow_company_admins"
  WHERE (("ow_company_admins"."user_id" IN ( SELECT "ow_users"."id"
           FROM "public"."ow_users"
          WHERE ("ow_users"."auth_id" = "auth"."uid"()))) AND ("ow_company_admins"."is_active" = true)))));


--
-- Name: ow_casual_meetings ow_casual_meetings_company_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_casual_meetings_company_update" ON "public"."ow_casual_meetings" FOR UPDATE USING (("company_id" IN ( SELECT "ow_company_admins"."company_id"
   FROM "public"."ow_company_admins"
  WHERE (("ow_company_admins"."user_id" IN ( SELECT "ow_users"."id"
           FROM "public"."ow_users"
          WHERE ("ow_users"."auth_id" = "auth"."uid"()))) AND ("ow_company_admins"."is_active" = true)))));


--
-- Name: ow_casual_meetings ow_casual_meetings_seeker_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_casual_meetings_seeker_insert" ON "public"."ow_casual_meetings" FOR INSERT WITH CHECK (("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_casual_meetings ow_casual_meetings_seeker_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_casual_meetings_seeker_read" ON "public"."ow_casual_meetings" FOR SELECT USING (("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_companies; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_companies" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_companies ow_companies_admin_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_companies_admin_read" ON "public"."ow_companies" FOR SELECT TO "authenticated" USING ("public"."auth_is_admin"());


--
-- Name: ow_companies ow_companies_member_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_companies_member_select" ON "public"."ow_companies" FOR SELECT USING ("public"."auth_is_company_member"("id"));


--
-- Name: ow_companies ow_companies_own_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_companies_own_delete" ON "public"."ow_companies" FOR DELETE USING (("auth"."uid"() = "user_id"));


--
-- Name: ow_companies ow_companies_own_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_companies_own_insert" ON "public"."ow_companies" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: ow_companies ow_companies_own_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_companies_own_select" ON "public"."ow_companies" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: ow_companies ow_companies_own_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_companies_own_update" ON "public"."ow_companies" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: ow_companies ow_companies_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_companies_public_read" ON "public"."ow_companies" FOR SELECT USING (("status" = 'active'::"text"));


--
-- Name: ow_companies ow_companies_published_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_companies_published_read" ON "public"."ow_companies" FOR SELECT USING ((("is_published" = true) OR ("status" = 'active'::"text")));


--
-- Name: ow_company_admins; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_company_admins" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_company_admins ow_company_admins_admin_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_company_admins_admin_manage" ON "public"."ow_company_admins" USING ("public"."auth_is_company_admin"("company_id")) WITH CHECK ("public"."auth_is_company_admin"("company_id"));


--
-- Name: ow_company_admins ow_company_admins_member_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_company_admins_member_read" ON "public"."ow_company_admins" FOR SELECT USING ("public"."auth_is_company_member"("company_id"));


--
-- Name: ow_company_culture_tags; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_company_culture_tags" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_company_culture_tags ow_company_culture_tags_own_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_company_culture_tags_own_delete" ON "public"."ow_company_culture_tags" FOR DELETE USING (("company_id" IN ( SELECT "ow_companies"."id"
   FROM "public"."ow_companies"
  WHERE ("ow_companies"."user_id" = "auth"."uid"()))));


--
-- Name: ow_company_culture_tags ow_company_culture_tags_own_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_company_culture_tags_own_insert" ON "public"."ow_company_culture_tags" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "ow_companies"."id"
   FROM "public"."ow_companies"
  WHERE ("ow_companies"."user_id" = "auth"."uid"()))));


--
-- Name: ow_company_culture_tags ow_company_culture_tags_own_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_company_culture_tags_own_select" ON "public"."ow_company_culture_tags" FOR SELECT USING (("company_id" IN ( SELECT "ow_companies"."id"
   FROM "public"."ow_companies"
  WHERE ("ow_companies"."user_id" = "auth"."uid"()))));


--
-- Name: ow_company_culture_tags ow_company_culture_tags_own_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_company_culture_tags_own_update" ON "public"."ow_company_culture_tags" FOR UPDATE USING (("company_id" IN ( SELECT "ow_companies"."id"
   FROM "public"."ow_companies"
  WHERE ("ow_companies"."user_id" = "auth"."uid"()))));


--
-- Name: ow_company_culture_tags ow_company_culture_tags_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_company_culture_tags_public_read" ON "public"."ow_company_culture_tags" FOR SELECT USING (true);


--
-- Name: ow_company_departments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_company_departments" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_company_domain_verifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_company_domain_verifications" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_company_external_links; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_company_external_links" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_company_follows; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_company_follows" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_company_genres; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_company_genres" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_company_hidden_experiences; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_company_hidden_experiences" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_company_job_roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_company_job_roles" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_company_join_requests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_company_join_requests" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_company_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_company_members" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_company_office_photos; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_company_office_photos" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_company_office_photos ow_company_office_photos_admin_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_company_office_photos_admin_manage" ON "public"."ow_company_office_photos" USING ("public"."auth_is_company_admin"("company_id")) WITH CHECK ("public"."auth_is_company_admin"("company_id"));


--
-- Name: ow_company_office_photos ow_company_office_photos_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_company_office_photos_public_read" ON "public"."ow_company_office_photos" FOR SELECT USING (true);


--
-- Name: ow_company_perspectives; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_company_perspectives" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_company_perspectives ow_company_perspectives_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_company_perspectives_public_read" ON "public"."ow_company_perspectives" FOR SELECT USING ((("published_at" IS NOT NULL) AND ("published_at" <= "now"())));


--
-- Name: ow_company_posts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_company_posts" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_contact_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_contact_logs" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_contact_submissions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_contact_submissions" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_conversation_messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_conversation_messages" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_conversation_messages ow_conversation_messages_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_conversation_messages_insert" ON "public"."ow_conversation_messages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."ow_conversation_participants"
  WHERE (("ow_conversation_participants"."id" = "ow_conversation_messages"."sender_participant_id") AND ("ow_conversation_participants"."user_id" IN ( SELECT "ow_users"."id"
           FROM "public"."ow_users"
          WHERE ("ow_users"."auth_id" = "auth"."uid"()))) AND ("ow_conversation_participants"."conversation_id" = "ow_conversation_messages"."conversation_id") AND ("ow_conversation_participants"."left_at" IS NULL)))));


--
-- Name: ow_conversation_messages ow_conversation_messages_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_conversation_messages_select" ON "public"."ow_conversation_messages" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."ow_conversation_participants"
  WHERE (("ow_conversation_participants"."conversation_id" = "ow_conversation_messages"."conversation_id") AND ("ow_conversation_participants"."user_id" IN ( SELECT "ow_users"."id"
           FROM "public"."ow_users"
          WHERE ("ow_users"."auth_id" = "auth"."uid"())))))) OR (EXISTS ( SELECT 1
   FROM "public"."ow_user_roles"
  WHERE (("ow_user_roles"."user_id" = "auth"."uid"()) AND ("ow_user_roles"."role" = 'admin'::"text"))))));


--
-- Name: ow_conversation_messages ow_conversation_messages_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_conversation_messages_update" ON "public"."ow_conversation_messages" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."ow_conversation_participants"
  WHERE (("ow_conversation_participants"."id" = "ow_conversation_messages"."sender_participant_id") AND ("ow_conversation_participants"."user_id" = "auth"."uid"()) AND ("ow_conversation_participants"."left_at" IS NULL)))) OR (EXISTS ( SELECT 1
   FROM "public"."ow_user_roles"
  WHERE (("ow_user_roles"."user_id" = "auth"."uid"()) AND ("ow_user_roles"."role" = 'admin'::"text"))))));


--
-- Name: ow_conversation_participants; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_conversation_participants" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_conversation_participants ow_conversation_participants_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_conversation_participants_insert" ON "public"."ow_conversation_participants" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM (("public"."ow_company_admins" "ca"
     JOIN "public"."ow_users" "u" ON (("u"."id" = "ca"."user_id")))
     JOIN "public"."ow_conversations" "c" ON (("c"."company_id" = "ca"."company_id")))
  WHERE (("c"."id" = "ow_conversation_participants"."conversation_id") AND ("u"."auth_id" = "auth"."uid"()) AND ("ca"."is_active" = true)))) OR (EXISTS ( SELECT 1
   FROM "public"."ow_user_roles"
  WHERE (("ow_user_roles"."user_id" = "auth"."uid"()) AND ("ow_user_roles"."role" = 'admin'::"text"))))));


--
-- Name: ow_conversation_participants ow_conversation_participants_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_conversation_participants_select" ON "public"."ow_conversation_participants" FOR SELECT USING ((("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM (("public"."ow_company_admins" "ca"
     JOIN "public"."ow_users" "u" ON (("u"."id" = "ca"."user_id")))
     JOIN "public"."ow_conversations" "c" ON (("c"."id" = "ow_conversation_participants"."conversation_id")))
  WHERE (("c"."company_id" = "ca"."company_id") AND ("u"."auth_id" = "auth"."uid"()) AND ("ca"."is_active" = true)))) OR (EXISTS ( SELECT 1
   FROM "public"."ow_user_roles"
  WHERE (("ow_user_roles"."user_id" = "auth"."uid"()) AND ("ow_user_roles"."role" = 'admin'::"text"))))));


--
-- Name: ow_conversation_participants ow_conversation_participants_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_conversation_participants_update" ON "public"."ow_conversation_participants" FOR UPDATE USING ((("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."ow_user_roles"
  WHERE (("ow_user_roles"."user_id" = "auth"."uid"()) AND ("ow_user_roles"."role" = 'admin'::"text")))))) WITH CHECK ((("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."ow_user_roles"
  WHERE (("ow_user_roles"."user_id" = "auth"."uid"()) AND ("ow_user_roles"."role" = 'admin'::"text"))))));


--
-- Name: ow_conversations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_conversations" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_conversations ow_conversations_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_conversations_insert" ON "public"."ow_conversations" FOR INSERT WITH CHECK ((("candidate_user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."ow_user_roles"
  WHERE (("ow_user_roles"."user_id" = "auth"."uid"()) AND ("ow_user_roles"."role" = 'admin'::"text"))))));


--
-- Name: ow_conversations ow_conversations_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_conversations_select" ON "public"."ow_conversations" FOR SELECT USING ((("candidate_user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))) OR ("mentor_user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))) OR (("company_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM ("public"."ow_company_admins" "ca"
     JOIN "public"."ow_users" "u" ON (("u"."id" = "ca"."user_id")))
  WHERE (("ca"."company_id" = "ow_conversations"."company_id") AND ("u"."auth_id" = "auth"."uid"()) AND ("ca"."is_active" = true))))) OR (EXISTS ( SELECT 1
   FROM "public"."ow_user_roles"
  WHERE (("ow_user_roles"."user_id" = "auth"."uid"()) AND ("ow_user_roles"."role" = 'admin'::"text"))))));


--
-- Name: ow_conversations ow_conversations_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_conversations_update" ON "public"."ow_conversations" FOR UPDATE USING ((("candidate_user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."ow_conversation_participants" "p"
  WHERE (("p"."conversation_id" = "ow_conversations"."id") AND ("p"."user_id" IN ( SELECT "ow_users"."id"
           FROM "public"."ow_users"
          WHERE ("ow_users"."auth_id" = "auth"."uid"()))) AND ("p"."left_at" IS NULL)))) OR (EXISTS ( SELECT 1
   FROM "public"."ow_user_roles"
  WHERE (("ow_user_roles"."user_id" = "auth"."uid"()) AND ("ow_user_roles"."role" = 'admin'::"text"))))));


--
-- Name: ow_experience_roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_experience_roles" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_experience_stories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_experience_stories" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_experience_stories ow_experience_stories_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_experience_stories_delete_own" ON "public"."ow_experience_stories" FOR DELETE USING (("experience_id" IN ( SELECT "ow_experiences"."id"
   FROM "public"."ow_experiences"
  WHERE ("ow_experiences"."user_id" IN ( SELECT "ow_users"."id"
           FROM "public"."ow_users"
          WHERE ("ow_users"."auth_id" = "auth"."uid"()))))));


--
-- Name: ow_experience_stories ow_experience_stories_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_experience_stories_insert_own" ON "public"."ow_experience_stories" FOR INSERT WITH CHECK (("experience_id" IN ( SELECT "ow_experiences"."id"
   FROM "public"."ow_experiences"
  WHERE ("ow_experiences"."user_id" IN ( SELECT "ow_users"."id"
           FROM "public"."ow_users"
          WHERE ("ow_users"."auth_id" = "auth"."uid"()))))));


--
-- Name: ow_experience_stories ow_experience_stories_select_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_experience_stories_select_all" ON "public"."ow_experience_stories" FOR SELECT USING (true);


--
-- Name: ow_experience_stories ow_experience_stories_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_experience_stories_update_own" ON "public"."ow_experience_stories" FOR UPDATE USING (("experience_id" IN ( SELECT "e"."id"
   FROM ("public"."ow_experiences" "e"
     JOIN "public"."ow_users" "u" ON (("u"."id" = "e"."user_id")))
  WHERE ("u"."auth_id" = "auth"."uid"())))) WITH CHECK ((("experience_id" IN ( SELECT "e"."id"
   FROM ("public"."ow_experiences" "e"
     JOIN "public"."ow_users" "u" ON (("u"."id" = "e"."user_id")))
  WHERE ("u"."auth_id" = "auth"."uid"()))) AND (("section_id" IS NULL) OR ("section_id" IN ( SELECT "s"."id"
   FROM (("public"."ow_story_sections" "s"
     JOIN "public"."ow_experiences" "e" ON (("e"."id" = "s"."experience_id")))
     JOIN "public"."ow_users" "u" ON (("u"."id" = "e"."user_id")))
  WHERE ("u"."auth_id" = "auth"."uid"()))))));


--
-- Name: ow_experiences; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_experiences" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_experiences ow_experiences_login_only_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_experiences_login_only_read" ON "public"."ow_experiences" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND ("visibility_company" <> 'hidden'::"text") AND ("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."visibility" = ANY (ARRAY['public'::"text", 'login_only'::"text"]))))));


--
-- Name: ow_experiences ow_experiences_own_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_experiences_own_manage" ON "public"."ow_experiences" USING (("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_experiences ow_experiences_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_experiences_public_read" ON "public"."ow_experiences" FOR SELECT USING ((("visibility_company" <> 'hidden'::"text") AND ("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."visibility" = 'public'::"text")))));


--
-- Name: ow_favorites; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_favorites" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_genres; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_genres" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_industries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_industries" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_invoices; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_invoices" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_job_applications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_job_applications" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_job_assignees; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_job_assignees" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_job_assignees ow_job_assignees_admin_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_job_assignees_admin_manage" ON "public"."ow_job_assignees" USING (("job_id" IN ( SELECT "j"."id"
   FROM ("public"."ow_jobs" "j"
     JOIN "public"."ow_company_admins" "ca" ON (("ca"."company_id" = "j"."company_id")))
  WHERE (("ca"."user_id" IN ( SELECT "ow_users"."id"
           FROM "public"."ow_users"
          WHERE ("ow_users"."auth_id" = "auth"."uid"()))) AND ("ca"."is_active" = true)))));


--
-- Name: ow_job_assignees ow_job_assignees_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_job_assignees_public_read" ON "public"."ow_job_assignees" FOR SELECT USING (true);


--
-- Name: ow_job_favorites; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_job_favorites" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_job_matching_tags; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_job_matching_tags" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_job_matching_tags ow_job_matching_tags_own_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_job_matching_tags_own_delete" ON "public"."ow_job_matching_tags" FOR DELETE USING (("job_id" IN ( SELECT "ow_jobs"."id"
   FROM "public"."ow_jobs"
  WHERE ("ow_jobs"."company_id" IN ( SELECT "ow_companies"."id"
           FROM "public"."ow_companies"
          WHERE ("ow_companies"."user_id" = "auth"."uid"()))))));


--
-- Name: ow_job_matching_tags ow_job_matching_tags_own_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_job_matching_tags_own_insert" ON "public"."ow_job_matching_tags" FOR INSERT WITH CHECK (("job_id" IN ( SELECT "ow_jobs"."id"
   FROM "public"."ow_jobs"
  WHERE ("ow_jobs"."company_id" IN ( SELECT "ow_companies"."id"
           FROM "public"."ow_companies"
          WHERE ("ow_companies"."user_id" = "auth"."uid"()))))));


--
-- Name: ow_job_matching_tags ow_job_matching_tags_own_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_job_matching_tags_own_select" ON "public"."ow_job_matching_tags" FOR SELECT USING (("job_id" IN ( SELECT "ow_jobs"."id"
   FROM "public"."ow_jobs"
  WHERE ("ow_jobs"."company_id" IN ( SELECT "ow_companies"."id"
           FROM "public"."ow_companies"
          WHERE ("ow_companies"."user_id" = "auth"."uid"()))))));


--
-- Name: ow_job_matching_tags ow_job_matching_tags_own_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_job_matching_tags_own_update" ON "public"."ow_job_matching_tags" FOR UPDATE USING (("job_id" IN ( SELECT "ow_jobs"."id"
   FROM "public"."ow_jobs"
  WHERE ("ow_jobs"."company_id" IN ( SELECT "ow_companies"."id"
           FROM "public"."ow_companies"
          WHERE ("ow_companies"."user_id" = "auth"."uid"()))))));


--
-- Name: ow_job_matching_tags ow_job_matching_tags_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_job_matching_tags_public_read" ON "public"."ow_job_matching_tags" FOR SELECT USING (true);


--
-- Name: ow_job_requirements; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_job_requirements" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_job_requirements ow_job_requirements_own_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_job_requirements_own_delete" ON "public"."ow_job_requirements" FOR DELETE USING (("job_id" IN ( SELECT "ow_jobs"."id"
   FROM "public"."ow_jobs"
  WHERE ("ow_jobs"."company_id" IN ( SELECT "ow_companies"."id"
           FROM "public"."ow_companies"
          WHERE ("ow_companies"."user_id" = "auth"."uid"()))))));


--
-- Name: ow_job_requirements ow_job_requirements_own_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_job_requirements_own_insert" ON "public"."ow_job_requirements" FOR INSERT WITH CHECK (("job_id" IN ( SELECT "ow_jobs"."id"
   FROM "public"."ow_jobs"
  WHERE ("ow_jobs"."company_id" IN ( SELECT "ow_companies"."id"
           FROM "public"."ow_companies"
          WHERE ("ow_companies"."user_id" = "auth"."uid"()))))));


--
-- Name: ow_job_requirements ow_job_requirements_own_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_job_requirements_own_select" ON "public"."ow_job_requirements" FOR SELECT USING (("job_id" IN ( SELECT "ow_jobs"."id"
   FROM "public"."ow_jobs"
  WHERE ("ow_jobs"."company_id" IN ( SELECT "ow_companies"."id"
           FROM "public"."ow_companies"
          WHERE ("ow_companies"."user_id" = "auth"."uid"()))))));


--
-- Name: ow_job_requirements ow_job_requirements_own_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_job_requirements_own_update" ON "public"."ow_job_requirements" FOR UPDATE USING (("job_id" IN ( SELECT "ow_jobs"."id"
   FROM "public"."ow_jobs"
  WHERE ("ow_jobs"."company_id" IN ( SELECT "ow_companies"."id"
           FROM "public"."ow_companies"
          WHERE ("ow_companies"."user_id" = "auth"."uid"()))))));


--
-- Name: ow_job_requirements ow_job_requirements_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_job_requirements_public_read" ON "public"."ow_job_requirements" FOR SELECT USING (true);


--
-- Name: ow_job_roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_job_roles" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_job_views; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_job_views" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_jobs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_jobs" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_jobs ow_jobs_company_admin_manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_jobs_company_admin_manage" ON "public"."ow_jobs" USING (("company_id" IN ( SELECT "ow_company_admins"."company_id"
   FROM "public"."ow_company_admins"
  WHERE (("ow_company_admins"."user_id" IN ( SELECT "ow_users"."id"
           FROM "public"."ow_users"
          WHERE ("ow_users"."auth_id" = "auth"."uid"()))) AND ("ow_company_admins"."is_active" = true)))));


--
-- Name: POLICY "ow_jobs_company_admin_manage" ON "ow_jobs"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON POLICY "ow_jobs_company_admin_manage" ON "public"."ow_jobs" IS 'Company admins (incl. owners auto-migrated from owner-only policy) 
   can manage jobs. Replaces ow_jobs_own_manage from migration 001.
   Owner records auto-migrated by Step 1 of this migration.';


--
-- Name: ow_jobs ow_jobs_own_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_jobs_own_delete" ON "public"."ow_jobs" FOR DELETE USING (("company_id" IN ( SELECT "ow_companies"."id"
   FROM "public"."ow_companies"
  WHERE ("ow_companies"."user_id" = "auth"."uid"()))));


--
-- Name: ow_jobs ow_jobs_own_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_jobs_own_insert" ON "public"."ow_jobs" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "ow_companies"."id"
   FROM "public"."ow_companies"
  WHERE ("ow_companies"."user_id" = "auth"."uid"()))));


--
-- Name: ow_jobs ow_jobs_own_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_jobs_own_select" ON "public"."ow_jobs" FOR SELECT USING (("company_id" IN ( SELECT "ow_companies"."id"
   FROM "public"."ow_companies"
  WHERE ("ow_companies"."user_id" = "auth"."uid"()))));


--
-- Name: ow_jobs ow_jobs_own_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_jobs_own_update" ON "public"."ow_jobs" FOR UPDATE USING (("company_id" IN ( SELECT "ow_companies"."id"
   FROM "public"."ow_companies"
  WHERE ("ow_companies"."user_id" = "auth"."uid"()))));


--
-- Name: ow_jobs ow_jobs_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_jobs_public_read" ON "public"."ow_jobs" FOR SELECT USING (("status" = 'active'::"text"));


--
-- Name: ow_jobs ow_jobs_published_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_jobs_published_read" ON "public"."ow_jobs" FOR SELECT USING (("status" = ANY (ARRAY['active'::"text", 'published'::"text"])));


--
-- Name: ow_match_scores; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_match_scores" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_matches; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_matches" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_matches ow_matches_company_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_matches_company_read" ON "public"."ow_matches" FOR SELECT USING (("company_id" IN ( SELECT "ow_company_admins"."company_id"
   FROM "public"."ow_company_admins"
  WHERE (("ow_company_admins"."user_id" IN ( SELECT "ow_users"."id"
           FROM "public"."ow_users"
          WHERE ("ow_users"."auth_id" = "auth"."uid"()))) AND ("ow_company_admins"."is_active" = true)))));


--
-- Name: ow_matches ow_matches_company_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_matches_company_update" ON "public"."ow_matches" FOR UPDATE USING (("company_id" IN ( SELECT "ow_company_admins"."company_id"
   FROM "public"."ow_company_admins"
  WHERE (("ow_company_admins"."user_id" IN ( SELECT "ow_users"."id"
           FROM "public"."ow_users"
          WHERE ("ow_users"."auth_id" = "auth"."uid"()))) AND ("ow_company_admins"."is_active" = true)))));


--
-- Name: ow_meeting_feedbacks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_meeting_feedbacks" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_mentor_reservations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_mentor_reservations" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_message_reads; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_message_reads" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_message_reads ow_message_reads_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_message_reads_insert" ON "public"."ow_message_reads" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."ow_conversation_participants"
  WHERE (("ow_conversation_participants"."id" = "ow_message_reads"."participant_id") AND ("ow_conversation_participants"."user_id" = "auth"."uid"()) AND ("ow_conversation_participants"."left_at" IS NULL)))));


--
-- Name: ow_message_reads ow_message_reads_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_message_reads_select" ON "public"."ow_message_reads" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."ow_conversation_participants"
  WHERE (("ow_conversation_participants"."id" = "ow_message_reads"."participant_id") AND ("ow_conversation_participants"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."ow_user_roles"
  WHERE (("ow_user_roles"."user_id" = "auth"."uid"()) AND ("ow_user_roles"."role" = 'admin'::"text"))))));


--
-- Name: ow_messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_messages" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_notifications" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_page_views; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_page_views" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_pipeline_stages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_pipeline_stages" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_placements; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_placements" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_post_comments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_post_comments" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_post_hire_reports; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_post_hire_reports" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_post_likes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_post_likes" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_posts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_posts" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_profiles ow_profiles_admin_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_profiles_admin_read" ON "public"."ow_profiles" FOR SELECT USING ("public"."auth_is_admin"());


--
-- Name: ow_profiles ow_profiles_own_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_profiles_own_delete" ON "public"."ow_profiles" FOR DELETE USING (("auth"."uid"() = "user_id"));


--
-- Name: ow_profiles ow_profiles_own_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_profiles_own_insert" ON "public"."ow_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: ow_profiles ow_profiles_own_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_profiles_own_read" ON "public"."ow_profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: ow_profiles ow_profiles_own_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_profiles_own_update" ON "public"."ow_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));


--
-- Name: ow_role_aliases; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_role_aliases" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_roles" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_roles ow_roles_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_roles_public_read" ON "public"."ow_roles" FOR SELECT USING (true);


--
-- Name: ow_saas_categories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_saas_categories" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_salary_reports; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_salary_reports" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_saved_companies; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_saved_companies" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_saved_companies ow_saved_companies_own_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_saved_companies_own_delete" ON "public"."ow_saved_companies" FOR DELETE USING (("auth"."uid"() = "user_id"));


--
-- Name: ow_saved_companies ow_saved_companies_own_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_saved_companies_own_insert" ON "public"."ow_saved_companies" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: ow_saved_companies ow_saved_companies_own_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_saved_companies_own_select" ON "public"."ow_saved_companies" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: ow_saved_jobs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_saved_jobs" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_saved_jobs ow_saved_jobs_own_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_saved_jobs_own_delete" ON "public"."ow_saved_jobs" FOR DELETE USING (("auth"."uid"() = "user_id"));


--
-- Name: ow_saved_jobs ow_saved_jobs_own_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_saved_jobs_own_insert" ON "public"."ow_saved_jobs" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: ow_saved_jobs ow_saved_jobs_own_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_saved_jobs_own_select" ON "public"."ow_saved_jobs" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: ow_school_requests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_school_requests" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_school_requests ow_school_requests_insert_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_school_requests_insert_authenticated" ON "public"."ow_school_requests" FOR INSERT TO "authenticated" WITH CHECK (("requested_by" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_school_requests ow_school_requests_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_school_requests_select_own" ON "public"."ow_school_requests" FOR SELECT TO "authenticated" USING (("requested_by" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_schools; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_schools" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_schools ow_schools_authenticated_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_schools_authenticated_select" ON "public"."ow_schools" FOR SELECT TO "authenticated" USING (true);


--
-- Name: ow_scout_blocks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_scout_blocks" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_scout_quotas; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_scout_quotas" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_scouts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_scouts" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_scouts ow_scouts_candidate_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_scouts_candidate_read" ON "public"."ow_scouts" FOR SELECT USING (("auth"."uid"() = "candidate_id"));


--
-- Name: ow_scouts ow_scouts_company_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_scouts_company_insert" ON "public"."ow_scouts" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "ow_companies"."id"
   FROM "public"."ow_companies"
  WHERE ("ow_companies"."user_id" = "auth"."uid"()))));


--
-- Name: ow_scouts ow_scouts_company_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_scouts_company_select" ON "public"."ow_scouts" FOR SELECT USING (("company_id" IN ( SELECT "ow_companies"."id"
   FROM "public"."ow_companies"
  WHERE ("ow_companies"."user_id" = "auth"."uid"()))));


--
-- Name: ow_scouts ow_scouts_company_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_scouts_company_update" ON "public"."ow_scouts" FOR UPDATE USING (("company_id" IN ( SELECT "ow_companies"."id"
   FROM "public"."ow_companies"
  WHERE ("ow_companies"."user_id" = "auth"."uid"()))));


--
-- Name: ow_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_settings" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_story_sections; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_story_sections" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_story_sections ow_story_sections_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_story_sections_delete_own" ON "public"."ow_story_sections" FOR DELETE USING (("experience_id" IN ( SELECT "e"."id"
   FROM ("public"."ow_experiences" "e"
     JOIN "public"."ow_users" "u" ON (("u"."id" = "e"."user_id")))
  WHERE ("u"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_story_sections ow_story_sections_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_story_sections_insert_own" ON "public"."ow_story_sections" FOR INSERT WITH CHECK (("experience_id" IN ( SELECT "e"."id"
   FROM ("public"."ow_experiences" "e"
     JOIN "public"."ow_users" "u" ON (("u"."id" = "e"."user_id")))
  WHERE ("u"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_story_sections ow_story_sections_select_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_story_sections_select_all" ON "public"."ow_story_sections" FOR SELECT USING (true);


--
-- Name: ow_story_sections ow_story_sections_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_story_sections_update_own" ON "public"."ow_story_sections" FOR UPDATE USING (("experience_id" IN ( SELECT "e"."id"
   FROM ("public"."ow_experiences" "e"
     JOIN "public"."ow_users" "u" ON (("u"."id" = "e"."user_id")))
  WHERE ("u"."auth_id" = "auth"."uid"())))) WITH CHECK (("experience_id" IN ( SELECT "e"."id"
   FROM ("public"."ow_experiences" "e"
     JOIN "public"."ow_users" "u" ON (("u"."id" = "e"."user_id")))
  WHERE ("u"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_tenant_plans; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_tenant_plans" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_terms_agreements; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_terms_agreements" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_threads; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_threads" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_user_content_links ow_ucl_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_ucl_delete_own" ON "public"."ow_user_content_links" FOR DELETE USING (("user_id" = ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_user_content_links ow_ucl_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_ucl_insert_own" ON "public"."ow_user_content_links" FOR INSERT WITH CHECK (("user_id" = ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_user_content_links ow_ucl_select_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_ucl_select_all" ON "public"."ow_user_content_links" FOR SELECT USING (true);


--
-- Name: ow_user_content_links ow_ucl_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_ucl_update_own" ON "public"."ow_user_content_links" FOR UPDATE USING (("user_id" = ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_user_achievements; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_user_achievements" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_user_achievements ow_user_achievements_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_achievements_delete_own" ON "public"."ow_user_achievements" FOR DELETE USING (("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_user_achievements ow_user_achievements_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_achievements_insert_own" ON "public"."ow_user_achievements" FOR INSERT WITH CHECK (("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_user_achievements ow_user_achievements_select_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_achievements_select_all" ON "public"."ow_user_achievements" FOR SELECT USING (true);


--
-- Name: ow_user_achievements ow_user_achievements_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_achievements_update_own" ON "public"."ow_user_achievements" FOR UPDATE USING (("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_user_awards; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_user_awards" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_user_awards ow_user_awards_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_awards_delete_own" ON "public"."ow_user_awards" FOR DELETE USING (("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_user_awards ow_user_awards_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_awards_insert_own" ON "public"."ow_user_awards" FOR INSERT WITH CHECK (("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_user_awards ow_user_awards_select_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_awards_select_all" ON "public"."ow_user_awards" FOR SELECT USING (true);


--
-- Name: ow_user_awards ow_user_awards_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_awards_update_own" ON "public"."ow_user_awards" FOR UPDATE USING (("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_user_certifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_user_certifications" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_user_certifications ow_user_certifications_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_certifications_delete_own" ON "public"."ow_user_certifications" FOR DELETE USING (("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_user_certifications ow_user_certifications_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_certifications_insert_own" ON "public"."ow_user_certifications" FOR INSERT WITH CHECK (("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_user_certifications ow_user_certifications_select_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_certifications_select_all" ON "public"."ow_user_certifications" FOR SELECT USING (true);


--
-- Name: ow_user_certifications ow_user_certifications_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_certifications_update_own" ON "public"."ow_user_certifications" FOR UPDATE USING (("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_user_content_links; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_user_content_links" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_user_educations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_user_educations" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_user_educations ow_user_educations_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_educations_delete_own" ON "public"."ow_user_educations" FOR DELETE USING (("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_user_educations ow_user_educations_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_educations_insert_own" ON "public"."ow_user_educations" FOR INSERT WITH CHECK (("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_user_educations ow_user_educations_select_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_educations_select_all" ON "public"."ow_user_educations" FOR SELECT USING (true);


--
-- Name: ow_user_educations ow_user_educations_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_educations_update_own" ON "public"."ow_user_educations" FOR UPDATE USING (("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_user_media_appearances; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_user_media_appearances" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_user_media_appearances ow_user_media_appearances_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_media_appearances_delete_own" ON "public"."ow_user_media_appearances" FOR DELETE USING (("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_user_media_appearances ow_user_media_appearances_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_media_appearances_insert_own" ON "public"."ow_user_media_appearances" FOR INSERT WITH CHECK (("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_user_media_appearances ow_user_media_appearances_select_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_media_appearances_select_all" ON "public"."ow_user_media_appearances" FOR SELECT USING (true);


--
-- Name: ow_user_media_appearances ow_user_media_appearances_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_media_appearances_update_own" ON "public"."ow_user_media_appearances" FOR UPDATE USING (("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_user_profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_user_profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_user_recommendations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_user_recommendations" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_user_roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_user_roles" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_user_roles ow_user_roles_admin_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_roles_admin_read" ON "public"."ow_user_roles" FOR SELECT USING ("public"."auth_is_admin"());


--
-- Name: ow_user_roles ow_user_roles_own_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_roles_own_delete" ON "public"."ow_user_roles" FOR DELETE USING (("auth"."uid"() = "user_id"));


--
-- Name: ow_user_roles ow_user_roles_own_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_roles_own_insert" ON "public"."ow_user_roles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: ow_user_roles ow_user_roles_own_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_roles_own_read" ON "public"."ow_user_roles" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: ow_user_roles ow_user_roles_own_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_roles_own_update" ON "public"."ow_user_roles" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: ow_user_skill_tags; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_user_skill_tags" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_user_skill_tags ow_user_skill_tags_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_skill_tags_delete_own" ON "public"."ow_user_skill_tags" FOR DELETE USING (("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_user_skill_tags ow_user_skill_tags_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_skill_tags_insert_own" ON "public"."ow_user_skill_tags" FOR INSERT WITH CHECK (("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_user_skill_tags ow_user_skill_tags_select_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_skill_tags_select_all" ON "public"."ow_user_skill_tags" FOR SELECT USING (true);


--
-- Name: ow_user_skill_tags ow_user_skill_tags_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_skill_tags_update_own" ON "public"."ow_user_skill_tags" FOR UPDATE USING (("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_user_socials; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_user_socials" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_user_socials ow_user_socials_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_socials_delete_own" ON "public"."ow_user_socials" FOR DELETE USING (("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_user_socials ow_user_socials_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_socials_insert_own" ON "public"."ow_user_socials" FOR INSERT WITH CHECK (("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_user_socials ow_user_socials_select_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_socials_select_all" ON "public"."ow_user_socials" FOR SELECT USING (true);


--
-- Name: ow_user_socials ow_user_socials_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_user_socials_update_own" ON "public"."ow_user_socials" FOR UPDATE USING (("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_users; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ow_users" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_users ow_users_login_only_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_users_login_only_read" ON "public"."ow_users" FOR SELECT USING ((("visibility" = 'login_only'::"text") AND ("auth"."uid"() IS NOT NULL)));


--
-- Name: ow_users ow_users_own_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_users_own_insert" ON "public"."ow_users" FOR INSERT WITH CHECK (("auth_id" = "auth"."uid"()));


--
-- Name: ow_users ow_users_own_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_users_own_read" ON "public"."ow_users" FOR SELECT USING (("auth_id" = "auth"."uid"()));


--
-- Name: ow_users ow_users_own_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_users_own_update" ON "public"."ow_users" FOR UPDATE USING (("auth_id" = "auth"."uid"()));


--
-- Name: ow_users ow_users_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ow_users_public_read" ON "public"."ow_users" FOR SELECT USING (("visibility" = 'public'::"text"));


--
-- Name: ow_terms_agreements own insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "own insert" ON "public"."ow_terms_agreements" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: ow_terms_agreements own read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "own read" ON "public"."ow_terms_agreements" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: ow_company_members own_member_consent; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "own_member_consent" ON "public"."ow_company_members" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: ow_company_members own_member_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "own_member_read" ON "public"."ow_company_members" FOR SELECT USING (("user_id" = "auth"."uid"()));


--
-- Name: ow_match_scores own_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "own_read" ON "public"."ow_match_scores" FOR SELECT USING (("auth"."uid"() = "user_id"));


--
-- Name: ow_pipeline_stages pipeline_stages_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "pipeline_stages_delete" ON "public"."ow_pipeline_stages" FOR DELETE USING (("public"."auth_is_company_member"("company_id") AND ("is_hired" = false) AND ("is_rejected" = false)));


--
-- Name: ow_pipeline_stages pipeline_stages_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "pipeline_stages_insert" ON "public"."ow_pipeline_stages" FOR INSERT WITH CHECK ("public"."auth_is_company_member"("company_id"));


--
-- Name: ow_pipeline_stages pipeline_stages_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "pipeline_stages_select" ON "public"."ow_pipeline_stages" FOR SELECT USING ("public"."auth_is_company_member"("company_id"));


--
-- Name: ow_pipeline_stages pipeline_stages_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "pipeline_stages_update" ON "public"."ow_pipeline_stages" FOR UPDATE USING ("public"."auth_is_company_member"("company_id")) WITH CHECK ("public"."auth_is_company_member"("company_id"));


--
-- Name: ow_post_comments post_comments_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "post_comments_delete_own" ON "public"."ow_post_comments" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"())
 LIMIT 1)));


--
-- Name: ow_post_comments post_comments_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "post_comments_insert_own" ON "public"."ow_post_comments" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"())
 LIMIT 1)));


--
-- Name: ow_post_comments post_comments_select_public; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "post_comments_select_public" ON "public"."ow_post_comments" FOR SELECT USING (true);


--
-- Name: ow_post_likes post_likes_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "post_likes_delete_own" ON "public"."ow_post_likes" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"())
 LIMIT 1)));


--
-- Name: ow_post_likes post_likes_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "post_likes_insert_own" ON "public"."ow_post_likes" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"())
 LIMIT 1)));


--
-- Name: ow_post_likes post_likes_select_public; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "post_likes_select_public" ON "public"."ow_post_likes" FOR SELECT USING (true);


--
-- Name: ow_posts posts_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "posts_delete_own" ON "public"."ow_posts" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"())
 LIMIT 1)));


--
-- Name: ow_posts posts_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "posts_insert_own" ON "public"."ow_posts" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"())
 LIMIT 1)));


--
-- Name: ow_posts posts_select_public; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "posts_select_public" ON "public"."ow_posts" FOR SELECT USING (true);


--
-- Name: ow_company_departments public read published departments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "public read published departments" ON "public"."ow_company_departments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."ow_companies"
  WHERE (("ow_companies"."id" = "ow_company_departments"."company_id") AND ("ow_companies"."is_published" = true)))));


--
-- Name: ow_company_members public_members_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "public_members_read" ON "public"."ow_company_members" FOR SELECT USING ((("is_public" = true) AND ("display_consent" = true)));


--
-- Name: POLICY "public_members_read" ON "ow_company_members"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON POLICY "public_members_read" ON "public"."ow_company_members" IS '公開条件は「企業が公開ON（is_public）」かつ「本人が同意済み（display_consent）」の両方。片方だけでは公開されない。';


--
-- Name: ow_company_posts public_read_published_posts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "public_read_published_posts" ON "public"."ow_company_posts" FOR SELECT USING (("is_published" = true));


--
-- Name: ow_user_recommendations recommendations_auth_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "recommendations_auth_insert" ON "public"."ow_user_recommendations" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));


--
-- Name: ow_user_recommendations recommendations_author_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "recommendations_author_delete" ON "public"."ow_user_recommendations" FOR DELETE USING (("auth"."uid"() = ( SELECT "ow_users"."auth_id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."id" = "ow_user_recommendations"."recommender_user_id")
 LIMIT 1)));


--
-- Name: ow_user_recommendations recommendations_owner_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "recommendations_owner_delete" ON "public"."ow_user_recommendations" FOR DELETE USING (("auth"."uid"() = ( SELECT "ow_users"."auth_id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."id" = "ow_user_recommendations"."target_user_id")
 LIMIT 1)));


--
-- Name: ow_user_recommendations recommendations_owner_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "recommendations_owner_read" ON "public"."ow_user_recommendations" FOR SELECT USING (("auth"."uid"() = ( SELECT "ow_users"."auth_id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."id" = "ow_user_recommendations"."target_user_id")
 LIMIT 1)));


--
-- Name: ow_user_recommendations recommendations_owner_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "recommendations_owner_update" ON "public"."ow_user_recommendations" FOR UPDATE USING (("auth"."uid"() = ( SELECT "ow_users"."auth_id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."id" = "ow_user_recommendations"."target_user_id")
 LIMIT 1)));


--
-- Name: ow_user_recommendations recommendations_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "recommendations_public_read" ON "public"."ow_user_recommendations" FOR SELECT USING (("is_visible" = true));


--
-- Name: ow_role_aliases role_aliases_admin_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "role_aliases_admin_write" ON "public"."ow_role_aliases" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."ow_user_roles"
  WHERE (("ow_user_roles"."user_id" = "auth"."uid"()) AND ("ow_user_roles"."role" = 'admin'::"text")))));


--
-- Name: ow_role_aliases role_aliases_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "role_aliases_public_read" ON "public"."ow_role_aliases" FOR SELECT USING (true);


--
-- Name: ow_saas_categories saas_categories_admin_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "saas_categories_admin_write" ON "public"."ow_saas_categories" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."ow_user_roles"
  WHERE (("ow_user_roles"."user_id" = "auth"."uid"()) AND ("ow_user_roles"."role" = 'admin'::"text")))));


--
-- Name: ow_saas_categories saas_categories_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "saas_categories_public_read" ON "public"."ow_saas_categories" FOR SELECT USING (("is_active" = true));


--
-- Name: ow_salary_reports salary_reports_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "salary_reports_own" ON "public"."ow_salary_reports" USING (("user_id" = ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"())
 LIMIT 1))) WITH CHECK (("user_id" = ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"())
 LIMIT 1)));


--
-- Name: salary_viewers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."salary_viewers" ENABLE ROW LEVEL SECURITY;

--
-- Name: scout_history; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."scout_history" ENABLE ROW LEVEL SECURITY;

--
-- Name: scout_messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."scout_messages" ENABLE ROW LEVEL SECURITY;

--
-- Name: selection_feedback; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."selection_feedback" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_contact_submissions service_role full access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role full access" ON "public"."ow_contact_submissions" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: ow_contact_logs service_role full access to contact logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role full access to contact logs" ON "public"."ow_contact_logs" USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: ow_company_hidden_experiences service_role_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_all" ON "public"."ow_company_hidden_experiences" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: ow_match_scores service_role_all_match; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_all_match" ON "public"."ow_match_scores" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: ow_messages service_role_all_messages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_all_messages" ON "public"."ow_messages" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: ow_threads service_role_all_threads; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "service_role_all_threads" ON "public"."ow_threads" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: ow_settings settings_admin_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "settings_admin_write" ON "public"."ow_settings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."ow_user_roles"
  WHERE (("ow_user_roles"."user_id" = "auth"."uid"()) AND ("ow_user_roles"."role" = 'admin'::"text")))));


--
-- Name: ow_settings settings_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "settings_public_read" ON "public"."ow_settings" FOR SELECT USING (true);


--
-- Name: talent_pool; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."talent_pool" ENABLE ROW LEVEL SECURITY;

--
-- Name: talent_profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."talent_profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_invoices tenant members read invoice; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tenant members read invoice" ON "public"."ow_invoices" FOR SELECT USING (("tenant_id" IN ( SELECT "ow_user_roles"."tenant_id"
   FROM "public"."ow_user_roles"
  WHERE (("ow_user_roles"."user_id" = "auth"."uid"()) AND ("ow_user_roles"."role" = 'company'::"text") AND ("ow_user_roles"."tenant_id" IS NOT NULL)))));


--
-- Name: ow_tenant_plans tenant members read plan; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tenant members read plan" ON "public"."ow_tenant_plans" FOR SELECT USING (("tenant_id" IN ( SELECT "ow_user_roles"."tenant_id"
   FROM "public"."ow_user_roles"
  WHERE (("ow_user_roles"."user_id" = "auth"."uid"()) AND ("ow_user_roles"."role" = 'company'::"text") AND ("ow_user_roles"."tenant_id" IS NOT NULL)))));


--
-- Name: agent_company_access tenant_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tenant_isolation" ON "public"."agent_company_access" USING (("tenant_id" = "public"."get_tenant_id"()));


--
-- Name: applications tenant_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tenant_isolation" ON "public"."applications" USING (("tenant_id" = "public"."get_tenant_id"()));


--
-- Name: candidate_documents tenant_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tenant_isolation" ON "public"."candidate_documents" USING (("tenant_id" = "public"."get_tenant_id"()));


--
-- Name: candidate_messages tenant_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tenant_isolation" ON "public"."candidate_messages" USING (("tenant_id" = "public"."get_tenant_id"()));


--
-- Name: candidates tenant_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tenant_isolation" ON "public"."candidates" USING (("tenant_id" = "public"."get_tenant_id"()));


--
-- Name: channels tenant_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tenant_isolation" ON "public"."channels" USING (("tenant_id" = "public"."get_tenant_id"()));


--
-- Name: companies tenant_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tenant_isolation" ON "public"."companies" USING (("tenant_id" = "public"."get_tenant_id"()));


--
-- Name: competing_offers tenant_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tenant_isolation" ON "public"."competing_offers" USING (("tenant_id" = "public"."get_tenant_id"()));


--
-- Name: concurrent_applications tenant_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tenant_isolation" ON "public"."concurrent_applications" USING (("tenant_id" IN ( SELECT "agents"."tenant_id"
   FROM "public"."agents"
  WHERE ("agents"."auth_user_id" = "auth"."uid"()))));


--
-- Name: jobs tenant_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tenant_isolation" ON "public"."jobs" USING (("tenant_id" = "public"."get_tenant_id"()));


--
-- Name: nurturing_candidates tenant_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tenant_isolation" ON "public"."nurturing_candidates" USING (("tenant_id" = "public"."get_tenant_id"()));


--
-- Name: salary_viewers tenant_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tenant_isolation" ON "public"."salary_viewers" USING (("tenant_id" = "public"."get_tenant_id"()));


--
-- Name: scout_history tenant_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tenant_isolation" ON "public"."scout_history" USING (("tenant_id" = "public"."get_tenant_id"()));


--
-- Name: selection_feedback tenant_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tenant_isolation" ON "public"."selection_feedback" USING (("tenant_id" = "public"."get_tenant_id"()));


--
-- Name: talent_pool tenant_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tenant_isolation" ON "public"."talent_pool" USING (("tenant_id" = "public"."get_tenant_id"()));


--
-- Name: tenant_master_options tenant_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "tenant_isolation" ON "public"."tenant_master_options" USING (("tenant_id" IN ( SELECT "agents"."tenant_id"
   FROM "public"."agents"
  WHERE ("agents"."auth_user_id" = "auth"."uid"()))));


--
-- Name: tenant_master_options; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."tenant_master_options" ENABLE ROW LEVEL SECURITY;

--
-- Name: tenants; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;

--
-- Name: ow_messages thread_participants_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "thread_participants_read" ON "public"."ow_messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."ow_threads"
  WHERE (("ow_threads"."id" = "ow_messages"."thread_id") AND ("ow_threads"."candidate_id" = "auth"."uid"())))));


--
-- Name: candidate_timeline_events timeline_events_tenant_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "timeline_events_tenant_isolation" ON "public"."candidate_timeline_events" USING (("tenant_id" IN ( SELECT "agents"."tenant_id"
   FROM "public"."agents"
  WHERE ("agents"."auth_user_id" = "auth"."uid"())))) WITH CHECK (("tenant_id" IN ( SELECT "agents"."tenant_id"
   FROM "public"."agents"
  WHERE ("agents"."auth_user_id" = "auth"."uid"()))));


--
-- Name: ow_mentor_reservations user can manage own reservations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "user can manage own reservations" ON "public"."ow_mentor_reservations" USING ((EXISTS ( SELECT 1
   FROM "public"."ow_users"
  WHERE (("ow_users"."id" = "ow_mentor_reservations"."user_id") AND ("ow_users"."auth_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."ow_users"
  WHERE (("ow_users"."id" = "ow_mentor_reservations"."user_id") AND ("ow_users"."auth_id" = "auth"."uid"())))));


--
-- Name: ow_job_applications users can insert own applications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "users can insert own applications" ON "public"."ow_job_applications" FOR INSERT WITH CHECK (("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_meeting_feedbacks users can insert own feedback; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "users can insert own feedback" ON "public"."ow_meeting_feedbacks" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = ( SELECT "ow_users"."auth_id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."id" = "ow_meeting_feedbacks"."user_id"))));


--
-- Name: ow_user_profiles users can manage own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "users can manage own profile" ON "public"."ow_user_profiles" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: ow_job_applications users can read own applications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "users can read own applications" ON "public"."ow_job_applications" FOR SELECT USING (("user_id" IN ( SELECT "ow_users"."id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."auth_id" = "auth"."uid"()))));


--
-- Name: ow_meeting_feedbacks users can read own feedback; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "users can read own feedback" ON "public"."ow_meeting_feedbacks" FOR SELECT TO "authenticated" USING (("auth"."uid"() = ( SELECT "ow_users"."auth_id"
   FROM "public"."ow_users"
  WHERE ("ow_users"."id" = "ow_meeting_feedbacks"."user_id"))));


--
-- Name: ow_messages users_insert_messages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "users_insert_messages" ON "public"."ow_messages" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."ow_threads"
  WHERE (("ow_threads"."id" = "ow_messages"."thread_id") AND ("ow_threads"."candidate_id" = "auth"."uid"())))));


--
-- Name: ow_threads users_insert_threads; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "users_insert_threads" ON "public"."ow_threads" FOR INSERT TO "authenticated" WITH CHECK (("candidate_id" = "auth"."uid"()));


--
-- Name: ow_threads users_own_threads; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "users_own_threads" ON "public"."ow_threads" FOR SELECT TO "authenticated" USING (("candidate_id" = "auth"."uid"()));


--
-- Name: ow_threads users_update_threads; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "users_update_threads" ON "public"."ow_threads" FOR UPDATE TO "authenticated" USING (("candidate_id" = "auth"."uid"())) WITH CHECK (("candidate_id" = "auth"."uid"()));


--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: postgres
--

-- CREATE PUBLICATION "supabase_realtime" WITH (publish = 'insert, update, delete, truncate');


ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

--
-- Name: supabase_realtime_messages_publication; Type: PUBLICATION; Schema: -; Owner: supabase_admin
--

-- CREATE PUBLICATION "supabase_realtime_messages_publication" WITH (publish = 'insert, update, delete, truncate');


-- ALTER PUBLICATION "supabase_realtime_messages_publication" OWNER TO "supabase_admin";

--
-- Name: supabase_realtime ow_messages; Type: PUBLICATION TABLE; Schema: public; Owner: postgres
--

ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."ow_messages";


--
-- Name: SCHEMA "public"; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


--
-- Name: FUNCTION "armor"("bytea"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."armor"("bytea") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."armor"("bytea") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."armor"("bytea") TO "dashboard_user";


--
-- Name: FUNCTION "armor"("bytea", "text"[], "text"[]); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."armor"("bytea", "text"[], "text"[]) FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."armor"("bytea", "text"[], "text"[]) TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."armor"("bytea", "text"[], "text"[]) TO "dashboard_user";


--
-- Name: FUNCTION "crypt"("text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."crypt"("text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."crypt"("text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."crypt"("text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "dearmor"("text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."dearmor"("text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."dearmor"("text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."dearmor"("text") TO "dashboard_user";


--
-- Name: FUNCTION "decrypt"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."decrypt"("bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."decrypt"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."decrypt"("bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "decrypt_iv"("bytea", "bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."decrypt_iv"("bytea", "bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."decrypt_iv"("bytea", "bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."decrypt_iv"("bytea", "bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "digest"("bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."digest"("bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."digest"("bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."digest"("bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "digest"("text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."digest"("text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."digest"("text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."digest"("text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "encrypt"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."encrypt"("bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."encrypt"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."encrypt"("bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "encrypt_iv"("bytea", "bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."encrypt_iv"("bytea", "bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."encrypt_iv"("bytea", "bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."encrypt_iv"("bytea", "bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "gen_random_bytes"(integer); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."gen_random_bytes"(integer) FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."gen_random_bytes"(integer) TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."gen_random_bytes"(integer) TO "dashboard_user";


--
-- Name: FUNCTION "gen_random_uuid"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."gen_random_uuid"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."gen_random_uuid"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."gen_random_uuid"() TO "dashboard_user";


--
-- Name: FUNCTION "gen_salt"("text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."gen_salt"("text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."gen_salt"("text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."gen_salt"("text") TO "dashboard_user";


--
-- Name: FUNCTION "gen_salt"("text", integer); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."gen_salt"("text", integer) FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."gen_salt"("text", integer) TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."gen_salt"("text", integer) TO "dashboard_user";


--
-- Name: FUNCTION "hmac"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."hmac"("bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."hmac"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."hmac"("bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "hmac"("text", "text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."hmac"("text", "text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."hmac"("text", "text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."hmac"("text", "text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pg_stat_statements"("showtext" boolean, OUT "userid" "oid", OUT "dbid" "oid", OUT "toplevel" boolean, OUT "queryid" bigint, OUT "query" "text", OUT "plans" bigint, OUT "total_plan_time" double precision, OUT "min_plan_time" double precision, OUT "max_plan_time" double precision, OUT "mean_plan_time" double precision, OUT "stddev_plan_time" double precision, OUT "calls" bigint, OUT "total_exec_time" double precision, OUT "min_exec_time" double precision, OUT "max_exec_time" double precision, OUT "mean_exec_time" double precision, OUT "stddev_exec_time" double precision, OUT "rows" bigint, OUT "shared_blks_hit" bigint, OUT "shared_blks_read" bigint, OUT "shared_blks_dirtied" bigint, OUT "shared_blks_written" bigint, OUT "local_blks_hit" bigint, OUT "local_blks_read" bigint, OUT "local_blks_dirtied" bigint, OUT "local_blks_written" bigint, OUT "temp_blks_read" bigint, OUT "temp_blks_written" bigint, OUT "shared_blk_read_time" double precision, OUT "shared_blk_write_time" double precision, OUT "local_blk_read_time" double precision, OUT "local_blk_write_time" double precision, OUT "temp_blk_read_time" double precision, OUT "temp_blk_write_time" double precision, OUT "wal_records" bigint, OUT "wal_fpi" bigint, OUT "wal_bytes" numeric, OUT "jit_functions" bigint, OUT "jit_generation_time" double precision, OUT "jit_inlining_count" bigint, OUT "jit_inlining_time" double precision, OUT "jit_optimization_count" bigint, OUT "jit_optimization_time" double precision, OUT "jit_emission_count" bigint, OUT "jit_emission_time" double precision, OUT "jit_deform_count" bigint, OUT "jit_deform_time" double precision, OUT "stats_since" timestamp with time zone, OUT "minmax_stats_since" timestamp with time zone); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pg_stat_statements"("showtext" boolean, OUT "userid" "oid", OUT "dbid" "oid", OUT "toplevel" boolean, OUT "queryid" bigint, OUT "query" "text", OUT "plans" bigint, OUT "total_plan_time" double precision, OUT "min_plan_time" double precision, OUT "max_plan_time" double precision, OUT "mean_plan_time" double precision, OUT "stddev_plan_time" double precision, OUT "calls" bigint, OUT "total_exec_time" double precision, OUT "min_exec_time" double precision, OUT "max_exec_time" double precision, OUT "mean_exec_time" double precision, OUT "stddev_exec_time" double precision, OUT "rows" bigint, OUT "shared_blks_hit" bigint, OUT "shared_blks_read" bigint, OUT "shared_blks_dirtied" bigint, OUT "shared_blks_written" bigint, OUT "local_blks_hit" bigint, OUT "local_blks_read" bigint, OUT "local_blks_dirtied" bigint, OUT "local_blks_written" bigint, OUT "temp_blks_read" bigint, OUT "temp_blks_written" bigint, OUT "shared_blk_read_time" double precision, OUT "shared_blk_write_time" double precision, OUT "local_blk_read_time" double precision, OUT "local_blk_write_time" double precision, OUT "temp_blk_read_time" double precision, OUT "temp_blk_write_time" double precision, OUT "wal_records" bigint, OUT "wal_fpi" bigint, OUT "wal_bytes" numeric, OUT "jit_functions" bigint, OUT "jit_generation_time" double precision, OUT "jit_inlining_count" bigint, OUT "jit_inlining_time" double precision, OUT "jit_optimization_count" bigint, OUT "jit_optimization_time" double precision, OUT "jit_emission_count" bigint, OUT "jit_emission_time" double precision, OUT "jit_deform_count" bigint, OUT "jit_deform_time" double precision, OUT "stats_since" timestamp with time zone, OUT "minmax_stats_since" timestamp with time zone) FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements"("showtext" boolean, OUT "userid" "oid", OUT "dbid" "oid", OUT "toplevel" boolean, OUT "queryid" bigint, OUT "query" "text", OUT "plans" bigint, OUT "total_plan_time" double precision, OUT "min_plan_time" double precision, OUT "max_plan_time" double precision, OUT "mean_plan_time" double precision, OUT "stddev_plan_time" double precision, OUT "calls" bigint, OUT "total_exec_time" double precision, OUT "min_exec_time" double precision, OUT "max_exec_time" double precision, OUT "mean_exec_time" double precision, OUT "stddev_exec_time" double precision, OUT "rows" bigint, OUT "shared_blks_hit" bigint, OUT "shared_blks_read" bigint, OUT "shared_blks_dirtied" bigint, OUT "shared_blks_written" bigint, OUT "local_blks_hit" bigint, OUT "local_blks_read" bigint, OUT "local_blks_dirtied" bigint, OUT "local_blks_written" bigint, OUT "temp_blks_read" bigint, OUT "temp_blks_written" bigint, OUT "shared_blk_read_time" double precision, OUT "shared_blk_write_time" double precision, OUT "local_blk_read_time" double precision, OUT "local_blk_write_time" double precision, OUT "temp_blk_read_time" double precision, OUT "temp_blk_write_time" double precision, OUT "wal_records" bigint, OUT "wal_fpi" bigint, OUT "wal_bytes" numeric, OUT "jit_functions" bigint, OUT "jit_generation_time" double precision, OUT "jit_inlining_count" bigint, OUT "jit_inlining_time" double precision, OUT "jit_optimization_count" bigint, OUT "jit_optimization_time" double precision, OUT "jit_emission_count" bigint, OUT "jit_emission_time" double precision, OUT "jit_deform_count" bigint, OUT "jit_deform_time" double precision, OUT "stats_since" timestamp with time zone, OUT "minmax_stats_since" timestamp with time zone) TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements"("showtext" boolean, OUT "userid" "oid", OUT "dbid" "oid", OUT "toplevel" boolean, OUT "queryid" bigint, OUT "query" "text", OUT "plans" bigint, OUT "total_plan_time" double precision, OUT "min_plan_time" double precision, OUT "max_plan_time" double precision, OUT "mean_plan_time" double precision, OUT "stddev_plan_time" double precision, OUT "calls" bigint, OUT "total_exec_time" double precision, OUT "min_exec_time" double precision, OUT "max_exec_time" double precision, OUT "mean_exec_time" double precision, OUT "stddev_exec_time" double precision, OUT "rows" bigint, OUT "shared_blks_hit" bigint, OUT "shared_blks_read" bigint, OUT "shared_blks_dirtied" bigint, OUT "shared_blks_written" bigint, OUT "local_blks_hit" bigint, OUT "local_blks_read" bigint, OUT "local_blks_dirtied" bigint, OUT "local_blks_written" bigint, OUT "temp_blks_read" bigint, OUT "temp_blks_written" bigint, OUT "shared_blk_read_time" double precision, OUT "shared_blk_write_time" double precision, OUT "local_blk_read_time" double precision, OUT "local_blk_write_time" double precision, OUT "temp_blk_read_time" double precision, OUT "temp_blk_write_time" double precision, OUT "wal_records" bigint, OUT "wal_fpi" bigint, OUT "wal_bytes" numeric, OUT "jit_functions" bigint, OUT "jit_generation_time" double precision, OUT "jit_inlining_count" bigint, OUT "jit_inlining_time" double precision, OUT "jit_optimization_count" bigint, OUT "jit_optimization_time" double precision, OUT "jit_emission_count" bigint, OUT "jit_emission_time" double precision, OUT "jit_deform_count" bigint, OUT "jit_deform_time" double precision, OUT "stats_since" timestamp with time zone, OUT "minmax_stats_since" timestamp with time zone) TO "dashboard_user";


--
-- Name: FUNCTION "pg_stat_statements_info"(OUT "dealloc" bigint, OUT "stats_reset" timestamp with time zone); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pg_stat_statements_info"(OUT "dealloc" bigint, OUT "stats_reset" timestamp with time zone) FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements_info"(OUT "dealloc" bigint, OUT "stats_reset" timestamp with time zone) TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements_info"(OUT "dealloc" bigint, OUT "stats_reset" timestamp with time zone) TO "dashboard_user";


--
-- Name: FUNCTION "pg_stat_statements_reset"("userid" "oid", "dbid" "oid", "queryid" bigint, "minmax_only" boolean); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pg_stat_statements_reset"("userid" "oid", "dbid" "oid", "queryid" bigint, "minmax_only" boolean) FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements_reset"("userid" "oid", "dbid" "oid", "queryid" bigint, "minmax_only" boolean) TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements_reset"("userid" "oid", "dbid" "oid", "queryid" bigint, "minmax_only" boolean) TO "dashboard_user";


--
-- Name: FUNCTION "pgp_armor_headers"("text", OUT "key" "text", OUT "value" "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_armor_headers"("text", OUT "key" "text", OUT "value" "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_armor_headers"("text", OUT "key" "text", OUT "value" "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_armor_headers"("text", OUT "key" "text", OUT "value" "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_key_id"("bytea"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_key_id"("bytea") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_key_id"("bytea") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_key_id"("bytea") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_decrypt"("bytea", "bytea"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_decrypt"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_decrypt"("bytea", "bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_decrypt_bytea"("bytea", "bytea"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_decrypt_bytea"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_decrypt_bytea"("bytea", "bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_encrypt"("text", "bytea"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_encrypt"("text", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_encrypt_bytea"("bytea", "bytea"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_encrypt_bytea"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_decrypt"("bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_decrypt"("bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_decrypt_bytea"("bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_decrypt_bytea"("bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_encrypt"("text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_encrypt"("text", "text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_encrypt_bytea"("bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_encrypt_bytea"("bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "uuid_generate_v1"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_generate_v1"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v1"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v1"() TO "dashboard_user";


--
-- Name: FUNCTION "uuid_generate_v1mc"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_generate_v1mc"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v1mc"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v1mc"() TO "dashboard_user";


--
-- Name: FUNCTION "uuid_generate_v3"("namespace" "uuid", "name" "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_generate_v3"("namespace" "uuid", "name" "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v3"("namespace" "uuid", "name" "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v3"("namespace" "uuid", "name" "text") TO "dashboard_user";


--
-- Name: FUNCTION "uuid_generate_v4"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_generate_v4"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v4"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v4"() TO "dashboard_user";


--
-- Name: FUNCTION "uuid_generate_v5"("namespace" "uuid", "name" "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_generate_v5"("namespace" "uuid", "name" "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v5"("namespace" "uuid", "name" "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v5"("namespace" "uuid", "name" "text") TO "dashboard_user";


--
-- Name: FUNCTION "uuid_nil"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_nil"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_nil"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_nil"() TO "dashboard_user";


--
-- Name: FUNCTION "uuid_ns_dns"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_ns_dns"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_dns"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_dns"() TO "dashboard_user";


--
-- Name: FUNCTION "uuid_ns_oid"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_ns_oid"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_oid"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_oid"() TO "dashboard_user";


--
-- Name: FUNCTION "uuid_ns_url"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_ns_url"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_url"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_url"() TO "dashboard_user";


--
-- Name: FUNCTION "uuid_ns_x500"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_ns_x500"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_x500"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_x500"() TO "dashboard_user";


--
-- Name: FUNCTION "approve_school_request"("p_request_id" "uuid", "p_logo_letter" "text", "p_logo_gradient" "text", "p_approved_by" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."approve_school_request"("p_request_id" "uuid", "p_logo_letter" "text", "p_logo_gradient" "text", "p_approved_by" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."approve_school_request"("p_request_id" "uuid", "p_logo_letter" "text", "p_logo_gradient" "text", "p_approved_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_school_request"("p_request_id" "uuid", "p_logo_letter" "text", "p_logo_gradient" "text", "p_approved_by" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."approve_school_request"("p_request_id" "uuid", "p_logo_letter" "text", "p_logo_gradient" "text", "p_approved_by" "uuid") TO "authenticated";


--
-- Name: FUNCTION "auth_is_admin"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."auth_is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_is_admin"() TO "service_role";


--
-- Name: FUNCTION "auth_is_company_admin"("target_company_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."auth_is_company_admin"("target_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."auth_is_company_admin"("target_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_is_company_admin"("target_company_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "auth_is_company_member"("target_company_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."auth_is_company_member"("target_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."auth_is_company_member"("target_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_is_company_member"("target_company_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "block_solicitation_on_scout"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."block_solicitation_on_scout"() TO "anon";
GRANT ALL ON FUNCTION "public"."block_solicitation_on_scout"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."block_solicitation_on_scout"() TO "service_role";


--
-- Name: FUNCTION "can_send_scout"("p_company_id" "uuid", "p_candidate_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."can_send_scout"("p_company_id" "uuid", "p_candidate_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_send_scout"("p_company_id" "uuid", "p_candidate_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_send_scout"("p_company_id" "uuid", "p_candidate_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "consume_scout_quota"("p_company_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."consume_scout_quota"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."consume_scout_quota"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."consume_scout_quota"("p_company_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "create_conversation"("p_kind" "text", "p_candidate_user_id" "uuid", "p_company_id" "uuid", "p_mentor_user_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."create_conversation"("p_kind" "text", "p_candidate_user_id" "uuid", "p_company_id" "uuid", "p_mentor_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_conversation"("p_kind" "text", "p_candidate_user_id" "uuid", "p_company_id" "uuid", "p_mentor_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_conversation"("p_kind" "text", "p_candidate_user_id" "uuid", "p_company_id" "uuid", "p_mentor_user_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "get_blocked_companies"("p_candidate_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."get_blocked_companies"("p_candidate_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_blocked_companies"("p_candidate_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_blocked_companies"("p_candidate_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "get_public_career_steps"("p_user_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."get_public_career_steps"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_career_steps"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_career_steps"("p_user_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "get_tenant_id"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."get_tenant_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tenant_id"() TO "service_role";


--
-- Name: FUNCTION "grant_review_access_on_post"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."grant_review_access_on_post"() TO "anon";
GRANT ALL ON FUNCTION "public"."grant_review_access_on_post"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."grant_review_access_on_post"() TO "service_role";


--
-- Name: FUNCTION "guard_member_consent"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."guard_member_consent"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_member_consent"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_member_consent"() TO "service_role";


--
-- Name: FUNCTION "guard_review_insert"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."guard_review_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_review_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_review_insert"() TO "service_role";


--
-- Name: FUNCTION "guard_salary_insert"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."guard_salary_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_salary_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_salary_insert"() TO "service_role";


--
-- Name: FUNCTION "guard_scout_insert"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."guard_scout_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_scout_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_scout_insert"() TO "service_role";


--
-- Name: FUNCTION "handle_new_ow_user"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."handle_new_ow_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_ow_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_ow_user"() TO "service_role";


--
-- Name: FUNCTION "has_review_access"("p_user_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."has_review_access"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_review_access"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_review_access"("p_user_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "has_worked_at_company"("p_user_id" "uuid", "p_company_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."has_worked_at_company"("p_user_id" "uuid", "p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_worked_at_company"("p_user_id" "uuid", "p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_worked_at_company"("p_user_id" "uuid", "p_company_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "increment_mentor_consultations"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."increment_mentor_consultations"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_mentor_consultations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_mentor_consultations"() TO "service_role";


--
-- Name: FUNCTION "is_solicitation_blocked"("p_candidate_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."is_solicitation_blocked"("p_candidate_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_solicitation_blocked"("p_candidate_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_solicitation_blocked"("p_candidate_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "normalize_company_name"("p_name" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."normalize_company_name"("p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_company_name"("p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_company_name"("p_name" "text") TO "service_role";


--
-- Name: FUNCTION "ow_career_profiles_set_updated_at"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."ow_career_profiles_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."ow_career_profiles_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ow_career_profiles_set_updated_at"() TO "service_role";


--
-- Name: FUNCTION "ow_conversation_messages_update_last_message_at"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."ow_conversation_messages_update_last_message_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."ow_conversation_messages_update_last_message_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ow_conversation_messages_update_last_message_at"() TO "service_role";


--
-- Name: FUNCTION "purge_old_page_views"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."purge_old_page_views"() TO "anon";
GRANT ALL ON FUNCTION "public"."purge_old_page_views"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."purge_old_page_views"() TO "service_role";


--
-- Name: FUNCTION "reject_school_request"("p_request_id" "uuid", "p_approved_by" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."reject_school_request"("p_request_id" "uuid", "p_approved_by" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reject_school_request"("p_request_id" "uuid", "p_approved_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_school_request"("p_request_id" "uuid", "p_approved_by" "uuid") TO "service_role";


--
-- Name: FUNCTION "set_candidate_portal_token"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."set_candidate_portal_token"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_candidate_portal_token"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_candidate_portal_token"() TO "service_role";


--
-- Name: FUNCTION "set_salary_reports_updated_at"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."set_salary_reports_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_salary_reports_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_salary_reports_updated_at"() TO "service_role";


--
-- Name: FUNCTION "update_career_agent_leads_updated_at"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."update_career_agent_leads_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_career_agent_leads_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_career_agent_leads_updated_at"() TO "service_role";


--
-- Name: FUNCTION "update_company_member_counts"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."update_company_member_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_company_member_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_company_member_counts"() TO "service_role";


--
-- Name: FUNCTION "update_company_members_updated_at"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."update_company_members_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_company_members_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_company_members_updated_at"() TO "service_role";


--
-- Name: FUNCTION "update_mentor_reservations_updated_at"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."update_mentor_reservations_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_mentor_reservations_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_mentor_reservations_updated_at"() TO "service_role";


--
-- Name: FUNCTION "update_ow_agent_agencies_updated_at"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."update_ow_agent_agencies_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_ow_agent_agencies_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ow_agent_agencies_updated_at"() TO "service_role";


--
-- Name: FUNCTION "update_ow_company_external_links_updated_at"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."update_ow_company_external_links_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_ow_company_external_links_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ow_company_external_links_updated_at"() TO "service_role";


--
-- Name: FUNCTION "update_ow_pipeline_stages_updated_at"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."update_ow_pipeline_stages_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_ow_pipeline_stages_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ow_pipeline_stages_updated_at"() TO "service_role";


--
-- Name: FUNCTION "update_placements_updated_at"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."update_placements_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_placements_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_placements_updated_at"() TO "service_role";


--
-- Name: FUNCTION "update_updated_at"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";


--
-- Name: FUNCTION "_crypto_aead_det_decrypt"("message" "bytea", "additional" "bytea", "key_id" bigint, "context" "bytea", "nonce" "bytea"); Type: ACL; Schema: vault; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "vault"."_crypto_aead_det_decrypt"("message" "bytea", "additional" "bytea", "key_id" bigint, "context" "bytea", "nonce" "bytea") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "vault"."_crypto_aead_det_decrypt"("message" "bytea", "additional" "bytea", "key_id" bigint, "context" "bytea", "nonce" "bytea") TO "service_role";


--
-- Name: FUNCTION "create_secret"("new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid"); Type: ACL; Schema: vault; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "vault"."create_secret"("new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "vault"."create_secret"("new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "update_secret"("secret_id" "uuid", "new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid"); Type: ACL; Schema: vault; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "vault"."update_secret"("secret_id" "uuid", "new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "vault"."update_secret"("secret_id" "uuid", "new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid") TO "service_role";


--
-- Name: TABLE "pg_stat_statements"; Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON TABLE "extensions"."pg_stat_statements" FROM "postgres";
-- GRANT ALL ON TABLE "extensions"."pg_stat_statements" TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON TABLE "extensions"."pg_stat_statements" TO "dashboard_user";


--
-- Name: TABLE "pg_stat_statements_info"; Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON TABLE "extensions"."pg_stat_statements_info" FROM "postgres";
-- GRANT ALL ON TABLE "extensions"."pg_stat_statements_info" TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON TABLE "extensions"."pg_stat_statements_info" TO "dashboard_user";


--
-- Name: TABLE "agent_client_relations"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."agent_client_relations" TO "anon";
GRANT ALL ON TABLE "public"."agent_client_relations" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_client_relations" TO "service_role";


--
-- Name: TABLE "agent_company_access"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."agent_company_access" TO "anon";
GRANT ALL ON TABLE "public"."agent_company_access" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_company_access" TO "service_role";


--
-- Name: TABLE "agent_members"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."agent_members" TO "anon";
GRANT ALL ON TABLE "public"."agent_members" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_members" TO "service_role";


--
-- Name: TABLE "agents"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."agents" TO "anon";
GRANT ALL ON TABLE "public"."agents" TO "authenticated";
GRANT ALL ON TABLE "public"."agents" TO "service_role";


--
-- Name: TABLE "ai_interviews"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ai_interviews" TO "anon";
GRANT ALL ON TABLE "public"."ai_interviews" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_interviews" TO "service_role";


--
-- Name: TABLE "applications"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."applications" TO "anon";
GRANT ALL ON TABLE "public"."applications" TO "authenticated";
GRANT ALL ON TABLE "public"."applications" TO "service_role";


--
-- Name: TABLE "candidate_certifications"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."candidate_certifications" TO "anon";
GRANT ALL ON TABLE "public"."candidate_certifications" TO "authenticated";
GRANT ALL ON TABLE "public"."candidate_certifications" TO "service_role";


--
-- Name: TABLE "candidate_documents"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."candidate_documents" TO "anon";
GRANT ALL ON TABLE "public"."candidate_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."candidate_documents" TO "service_role";


--
-- Name: TABLE "candidate_educations"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."candidate_educations" TO "anon";
GRANT ALL ON TABLE "public"."candidate_educations" TO "authenticated";
GRANT ALL ON TABLE "public"."candidate_educations" TO "service_role";


--
-- Name: TABLE "candidate_hearings"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."candidate_hearings" TO "anon";
GRANT ALL ON TABLE "public"."candidate_hearings" TO "authenticated";
GRANT ALL ON TABLE "public"."candidate_hearings" TO "service_role";


--
-- Name: TABLE "candidate_job_activities"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."candidate_job_activities" TO "anon";
GRANT ALL ON TABLE "public"."candidate_job_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."candidate_job_activities" TO "service_role";


--
-- Name: TABLE "candidate_messages"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."candidate_messages" TO "anon";
GRANT ALL ON TABLE "public"."candidate_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."candidate_messages" TO "service_role";


--
-- Name: TABLE "candidate_notes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."candidate_notes" TO "anon";
GRANT ALL ON TABLE "public"."candidate_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."candidate_notes" TO "service_role";


--
-- Name: TABLE "candidate_timeline_events"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."candidate_timeline_events" TO "anon";
GRANT ALL ON TABLE "public"."candidate_timeline_events" TO "authenticated";
GRANT ALL ON TABLE "public"."candidate_timeline_events" TO "service_role";


--
-- Name: TABLE "candidate_work_histories"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."candidate_work_histories" TO "anon";
GRANT ALL ON TABLE "public"."candidate_work_histories" TO "authenticated";
GRANT ALL ON TABLE "public"."candidate_work_histories" TO "service_role";


--
-- Name: TABLE "candidates"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."candidates" TO "anon";
GRANT ALL ON TABLE "public"."candidates" TO "authenticated";
GRANT ALL ON TABLE "public"."candidates" TO "service_role";


--
-- Name: TABLE "channels"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."channels" TO "anon";
GRANT ALL ON TABLE "public"."channels" TO "authenticated";
GRANT ALL ON TABLE "public"."channels" TO "service_role";


--
-- Name: TABLE "companies"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";


--
-- Name: TABLE "competing_offers"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."competing_offers" TO "anon";
GRANT ALL ON TABLE "public"."competing_offers" TO "authenticated";
GRANT ALL ON TABLE "public"."competing_offers" TO "service_role";


--
-- Name: TABLE "concurrent_applications"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."concurrent_applications" TO "anon";
GRANT ALL ON TABLE "public"."concurrent_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."concurrent_applications" TO "service_role";


--
-- Name: TABLE "crm_activities"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."crm_activities" TO "anon";
GRANT ALL ON TABLE "public"."crm_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_activities" TO "service_role";


--
-- Name: TABLE "crm_applications"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."crm_applications" TO "anon";
GRANT ALL ON TABLE "public"."crm_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_applications" TO "service_role";


--
-- Name: TABLE "crm_candidates"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."crm_candidates" TO "anon";
GRANT ALL ON TABLE "public"."crm_candidates" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_candidates" TO "service_role";


--
-- Name: TABLE "crm_client_companies"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."crm_client_companies" TO "anon";
GRANT ALL ON TABLE "public"."crm_client_companies" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_client_companies" TO "service_role";


--
-- Name: TABLE "crm_interviews"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."crm_interviews" TO "anon";
GRANT ALL ON TABLE "public"."crm_interviews" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_interviews" TO "service_role";


--
-- Name: TABLE "employer_jobs"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."employer_jobs" TO "anon";
GRANT ALL ON TABLE "public"."employer_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."employer_jobs" TO "service_role";


--
-- Name: TABLE "employer_profiles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."employer_profiles" TO "anon";
GRANT ALL ON TABLE "public"."employer_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."employer_profiles" TO "service_role";


--
-- Name: TABLE "evaluations"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."evaluations" TO "anon";
GRANT ALL ON TABLE "public"."evaluations" TO "authenticated";
GRANT ALL ON TABLE "public"."evaluations" TO "service_role";


--
-- Name: TABLE "iv_companies"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."iv_companies" TO "anon";
GRANT ALL ON TABLE "public"."iv_companies" TO "authenticated";
GRANT ALL ON TABLE "public"."iv_companies" TO "service_role";


--
-- Name: TABLE "iv_interviews"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."iv_interviews" TO "anon";
GRANT ALL ON TABLE "public"."iv_interviews" TO "authenticated";
GRANT ALL ON TABLE "public"."iv_interviews" TO "service_role";


--
-- Name: TABLE "iv_messages"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."iv_messages" TO "anon";
GRANT ALL ON TABLE "public"."iv_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."iv_messages" TO "service_role";


--
-- Name: TABLE "job_interests"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."job_interests" TO "anon";
GRANT ALL ON TABLE "public"."job_interests" TO "authenticated";
GRANT ALL ON TABLE "public"."job_interests" TO "service_role";


--
-- Name: TABLE "jobs"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."jobs" TO "anon";
GRANT ALL ON TABLE "public"."jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs" TO "service_role";


--
-- Name: TABLE "nurturing_candidates"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."nurturing_candidates" TO "anon";
GRANT ALL ON TABLE "public"."nurturing_candidates" TO "authenticated";
GRANT ALL ON TABLE "public"."nurturing_candidates" TO "service_role";


--
-- Name: TABLE "offer_letters"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."offer_letters" TO "anon";
GRANT ALL ON TABLE "public"."offer_letters" TO "authenticated";
GRANT ALL ON TABLE "public"."offer_letters" TO "service_role";


--
-- Name: TABLE "ow_activities"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_activities" TO "anon";
GRANT ALL ON TABLE "public"."ow_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_activities" TO "service_role";


--
-- Name: TABLE "ow_agent_agencies"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_agent_agencies" TO "anon";
GRANT ALL ON TABLE "public"."ow_agent_agencies" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_agent_agencies" TO "service_role";


--
-- Name: TABLE "ow_agent_contacts"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_agent_contacts" TO "anon";
GRANT ALL ON TABLE "public"."ow_agent_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_agent_contacts" TO "service_role";


--
-- Name: TABLE "ow_agent_jobs"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_agent_jobs" TO "anon";
GRANT ALL ON TABLE "public"."ow_agent_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_agent_jobs" TO "service_role";


--
-- Name: TABLE "ow_applications"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_applications" TO "anon";
GRANT ALL ON TABLE "public"."ow_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_applications" TO "service_role";


--
-- Name: TABLE "ow_articles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_articles" TO "anon";
GRANT ALL ON TABLE "public"."ow_articles" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_articles" TO "service_role";


--
-- Name: TABLE "ow_bookmarks"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_bookmarks" TO "anon";
GRANT ALL ON TABLE "public"."ow_bookmarks" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_bookmarks" TO "service_role";


--
-- Name: TABLE "ow_job_views"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_job_views" TO "anon";
GRANT ALL ON TABLE "public"."ow_job_views" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_job_views" TO "service_role";


--
-- Name: TABLE "ow_jobs"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_jobs" TO "anon";
GRANT ALL ON TABLE "public"."ow_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_jobs" TO "service_role";


--
-- Name: TABLE "ow_business_job_performance"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_business_job_performance" TO "anon";
GRANT ALL ON TABLE "public"."ow_business_job_performance" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_business_job_performance" TO "service_role";


--
-- Name: TABLE "ow_companies"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_companies" TO "anon";
GRANT ALL ON TABLE "public"."ow_companies" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_companies" TO "service_role";


--
-- Name: TABLE "ow_business_monthly_stats"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_business_monthly_stats" TO "anon";
GRANT ALL ON TABLE "public"."ow_business_monthly_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_business_monthly_stats" TO "service_role";


--
-- Name: TABLE "ow_business_todo_counts"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_business_todo_counts" TO "anon";
GRANT ALL ON TABLE "public"."ow_business_todo_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_business_todo_counts" TO "service_role";


--
-- Name: TABLE "ow_career_agent_leads"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_career_agent_leads" TO "anon";
GRANT ALL ON TABLE "public"."ow_career_agent_leads" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_career_agent_leads" TO "service_role";


--
-- Name: TABLE "ow_career_follows"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_career_follows" TO "anon";
GRANT ALL ON TABLE "public"."ow_career_follows" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_career_follows" TO "service_role";


--
-- Name: TABLE "ow_career_profiles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_career_profiles" TO "anon";
GRANT ALL ON TABLE "public"."ow_career_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_career_profiles" TO "service_role";


--
-- Name: TABLE "ow_casual_meetings"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_casual_meetings" TO "anon";
GRANT ALL ON TABLE "public"."ow_casual_meetings" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_casual_meetings" TO "service_role";


--
-- Name: TABLE "ow_company_admins"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_company_admins" TO "anon";
GRANT ALL ON TABLE "public"."ow_company_admins" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_company_admins" TO "service_role";


--
-- Name: TABLE "ow_company_culture_tags"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_company_culture_tags" TO "anon";
GRANT ALL ON TABLE "public"."ow_company_culture_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_company_culture_tags" TO "service_role";


--
-- Name: TABLE "ow_company_departments"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_company_departments" TO "anon";
GRANT ALL ON TABLE "public"."ow_company_departments" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_company_departments" TO "service_role";


--
-- Name: TABLE "ow_company_domain_verifications"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_company_domain_verifications" TO "anon";
GRANT ALL ON TABLE "public"."ow_company_domain_verifications" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_company_domain_verifications" TO "service_role";


--
-- Name: TABLE "ow_company_employee_categories"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_company_employee_categories" TO "anon";
GRANT ALL ON TABLE "public"."ow_company_employee_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_company_employee_categories" TO "service_role";


--
-- Name: TABLE "ow_company_external_links"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_company_external_links" TO "anon";
GRANT ALL ON TABLE "public"."ow_company_external_links" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_company_external_links" TO "service_role";


--
-- Name: TABLE "ow_company_follows"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_company_follows" TO "anon";
GRANT ALL ON TABLE "public"."ow_company_follows" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_company_follows" TO "service_role";


--
-- Name: TABLE "ow_company_genres"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_company_genres" TO "anon";
GRANT ALL ON TABLE "public"."ow_company_genres" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_company_genres" TO "service_role";


--
-- Name: TABLE "ow_company_hidden_experiences"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_company_hidden_experiences" TO "anon";
GRANT ALL ON TABLE "public"."ow_company_hidden_experiences" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_company_hidden_experiences" TO "service_role";


--
-- Name: TABLE "ow_company_job_roles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_company_job_roles" TO "anon";
GRANT ALL ON TABLE "public"."ow_company_job_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_company_job_roles" TO "service_role";


--
-- Name: TABLE "ow_company_join_requests"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_company_join_requests" TO "anon";
GRANT ALL ON TABLE "public"."ow_company_join_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_company_join_requests" TO "service_role";


--
-- Name: TABLE "ow_company_members"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_company_members" TO "anon";
GRANT ALL ON TABLE "public"."ow_company_members" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_company_members" TO "service_role";


--
-- Name: TABLE "ow_company_office_photos"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_company_office_photos" TO "anon";
GRANT ALL ON TABLE "public"."ow_company_office_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_company_office_photos" TO "service_role";


--
-- Name: TABLE "ow_company_perspectives"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_company_perspectives" TO "anon";
GRANT ALL ON TABLE "public"."ow_company_perspectives" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_company_perspectives" TO "service_role";


--
-- Name: TABLE "ow_company_posts"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_company_posts" TO "anon";
GRANT ALL ON TABLE "public"."ow_company_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_company_posts" TO "service_role";


--
-- Name: TABLE "ow_company_reviews_archive_20260714"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_company_reviews_archive_20260714" TO "anon";
GRANT ALL ON TABLE "public"."ow_company_reviews_archive_20260714" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_company_reviews_archive_20260714" TO "service_role";


--
-- Name: TABLE "ow_contact_logs"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_contact_logs" TO "anon";
GRANT ALL ON TABLE "public"."ow_contact_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_contact_logs" TO "service_role";


--
-- Name: TABLE "ow_contact_submissions"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_contact_submissions" TO "anon";
GRANT ALL ON TABLE "public"."ow_contact_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_contact_submissions" TO "service_role";


--
-- Name: TABLE "ow_conversation_messages"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_conversation_messages" TO "anon";
GRANT ALL ON TABLE "public"."ow_conversation_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_conversation_messages" TO "service_role";


--
-- Name: TABLE "ow_conversation_participants"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_conversation_participants" TO "anon";
GRANT ALL ON TABLE "public"."ow_conversation_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_conversation_participants" TO "service_role";


--
-- Name: TABLE "ow_conversations"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_conversations" TO "anon";
GRANT ALL ON TABLE "public"."ow_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_conversations" TO "service_role";


--
-- Name: TABLE "ow_experience_roles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_experience_roles" TO "anon";
GRANT ALL ON TABLE "public"."ow_experience_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_experience_roles" TO "service_role";


--
-- Name: TABLE "ow_experience_stories"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_experience_stories" TO "anon";
GRANT ALL ON TABLE "public"."ow_experience_stories" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_experience_stories" TO "service_role";


--
-- Name: TABLE "ow_experiences"; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."ow_experiences" TO "anon";
GRANT ALL ON TABLE "public"."ow_experiences" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_experiences" TO "service_role";


--
-- Name: COLUMN "ow_experiences"."id"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT("id") ON TABLE "public"."ow_experiences" TO "anon";


--
-- Name: COLUMN "ow_experiences"."user_id"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT("user_id") ON TABLE "public"."ow_experiences" TO "anon";


--
-- Name: COLUMN "ow_experiences"."company_id"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT("company_id") ON TABLE "public"."ow_experiences" TO "anon";


--
-- Name: COLUMN "ow_experiences"."company_text"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT("company_text") ON TABLE "public"."ow_experiences" TO "anon";


--
-- Name: COLUMN "ow_experiences"."company_anonymized"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT("company_anonymized") ON TABLE "public"."ow_experiences" TO "anon";


--
-- Name: COLUMN "ow_experiences"."role_category_id"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT("role_category_id") ON TABLE "public"."ow_experiences" TO "anon";


--
-- Name: COLUMN "ow_experiences"."role_title"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT("role_title") ON TABLE "public"."ow_experiences" TO "anon";


--
-- Name: COLUMN "ow_experiences"."started_at"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT("started_at") ON TABLE "public"."ow_experiences" TO "anon";


--
-- Name: COLUMN "ow_experiences"."ended_at"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT("ended_at") ON TABLE "public"."ow_experiences" TO "anon";


--
-- Name: COLUMN "ow_experiences"."is_current"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT("is_current") ON TABLE "public"."ow_experiences" TO "anon";


--
-- Name: COLUMN "ow_experiences"."description"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT("description") ON TABLE "public"."ow_experiences" TO "anon";


--
-- Name: COLUMN "ow_experiences"."display_order"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT("display_order") ON TABLE "public"."ow_experiences" TO "anon";


--
-- Name: COLUMN "ow_experiences"."created_at"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT("created_at") ON TABLE "public"."ow_experiences" TO "anon";


--
-- Name: COLUMN "ow_experiences"."updated_at"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT("updated_at") ON TABLE "public"."ow_experiences" TO "anon";


--
-- Name: COLUMN "ow_experiences"."join_reason"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT("join_reason") ON TABLE "public"."ow_experiences" TO "anon";


--
-- Name: COLUMN "ow_experiences"."employment_type"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT("employment_type") ON TABLE "public"."ow_experiences" TO "anon";


--
-- Name: COLUMN "ow_experiences"."visibility_company"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT("visibility_company") ON TABLE "public"."ow_experiences" TO "anon";


--
-- Name: COLUMN "ow_experiences"."visibility_salary"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT("visibility_salary") ON TABLE "public"."ow_experiences" TO "anon";


--
-- Name: COLUMN "ow_experiences"."visibility_reason"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT("visibility_reason") ON TABLE "public"."ow_experiences" TO "anon";


--
-- Name: TABLE "ow_favorites"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_favorites" TO "anon";
GRANT ALL ON TABLE "public"."ow_favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_favorites" TO "service_role";


--
-- Name: TABLE "ow_genres"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_genres" TO "anon";
GRANT ALL ON TABLE "public"."ow_genres" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_genres" TO "service_role";


--
-- Name: TABLE "ow_industries"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_industries" TO "anon";
GRANT ALL ON TABLE "public"."ow_industries" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_industries" TO "service_role";


--
-- Name: TABLE "ow_invoices"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_invoices" TO "anon";
GRANT ALL ON TABLE "public"."ow_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_invoices" TO "service_role";


--
-- Name: TABLE "ow_job_applications"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_job_applications" TO "anon";
GRANT ALL ON TABLE "public"."ow_job_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_job_applications" TO "service_role";


--
-- Name: TABLE "ow_job_assignees"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_job_assignees" TO "anon";
GRANT ALL ON TABLE "public"."ow_job_assignees" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_job_assignees" TO "service_role";


--
-- Name: TABLE "ow_job_favorites"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_job_favorites" TO "anon";
GRANT ALL ON TABLE "public"."ow_job_favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_job_favorites" TO "service_role";


--
-- Name: TABLE "ow_job_matching_tags"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_job_matching_tags" TO "anon";
GRANT ALL ON TABLE "public"."ow_job_matching_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_job_matching_tags" TO "service_role";


--
-- Name: TABLE "ow_job_requirements"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_job_requirements" TO "anon";
GRANT ALL ON TABLE "public"."ow_job_requirements" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_job_requirements" TO "service_role";


--
-- Name: TABLE "ow_job_roles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_job_roles" TO "anon";
GRANT ALL ON TABLE "public"."ow_job_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_job_roles" TO "service_role";


--
-- Name: TABLE "ow_match_scores"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_match_scores" TO "anon";
GRANT ALL ON TABLE "public"."ow_match_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_match_scores" TO "service_role";


--
-- Name: TABLE "ow_matches"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_matches" TO "anon";
GRANT ALL ON TABLE "public"."ow_matches" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_matches" TO "service_role";


--
-- Name: TABLE "ow_meeting_feedbacks"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_meeting_feedbacks" TO "anon";
GRANT ALL ON TABLE "public"."ow_meeting_feedbacks" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_meeting_feedbacks" TO "service_role";


--
-- Name: TABLE "ow_mentor_reservations"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_mentor_reservations" TO "anon";
GRANT ALL ON TABLE "public"."ow_mentor_reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_mentor_reservations" TO "service_role";


--
-- Name: TABLE "ow_message_reads"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_message_reads" TO "anon";
GRANT ALL ON TABLE "public"."ow_message_reads" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_message_reads" TO "service_role";


--
-- Name: TABLE "ow_messages"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_messages" TO "anon";
GRANT ALL ON TABLE "public"."ow_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_messages" TO "service_role";


--
-- Name: TABLE "ow_notifications"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_notifications" TO "anon";
GRANT ALL ON TABLE "public"."ow_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_notifications" TO "service_role";


--
-- Name: TABLE "ow_page_views"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_page_views" TO "anon";
GRANT ALL ON TABLE "public"."ow_page_views" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_page_views" TO "service_role";


--
-- Name: SEQUENCE "ow_page_views_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."ow_page_views_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ow_page_views_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ow_page_views_id_seq" TO "service_role";


--
-- Name: TABLE "ow_pipeline_stages"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_pipeline_stages" TO "anon";
GRANT ALL ON TABLE "public"."ow_pipeline_stages" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_pipeline_stages" TO "service_role";


--
-- Name: TABLE "ow_placements"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_placements" TO "anon";
GRANT ALL ON TABLE "public"."ow_placements" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_placements" TO "service_role";


--
-- Name: TABLE "ow_post_comments"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_post_comments" TO "anon";
GRANT ALL ON TABLE "public"."ow_post_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_post_comments" TO "service_role";


--
-- Name: TABLE "ow_post_hire_reports"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_post_hire_reports" TO "anon";
GRANT ALL ON TABLE "public"."ow_post_hire_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_post_hire_reports" TO "service_role";


--
-- Name: TABLE "ow_post_likes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_post_likes" TO "anon";
GRANT ALL ON TABLE "public"."ow_post_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_post_likes" TO "service_role";


--
-- Name: TABLE "ow_posts"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_posts" TO "anon";
GRANT ALL ON TABLE "public"."ow_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_posts" TO "service_role";


--
-- Name: TABLE "ow_profiles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_profiles" TO "anon";
GRANT ALL ON TABLE "public"."ow_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_profiles" TO "service_role";


--
-- Name: TABLE "ow_role_aliases"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_role_aliases" TO "anon";
GRANT ALL ON TABLE "public"."ow_role_aliases" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_role_aliases" TO "service_role";


--
-- Name: TABLE "ow_roles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_roles" TO "anon";
GRANT ALL ON TABLE "public"."ow_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_roles" TO "service_role";


--
-- Name: TABLE "ow_saas_categories"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_saas_categories" TO "anon";
GRANT ALL ON TABLE "public"."ow_saas_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_saas_categories" TO "service_role";


--
-- Name: TABLE "ow_salary_reports"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_salary_reports" TO "anon";
GRANT ALL ON TABLE "public"."ow_salary_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_salary_reports" TO "service_role";


--
-- Name: TABLE "ow_salary_reports_archive_20260714"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_salary_reports_archive_20260714" TO "anon";
GRANT ALL ON TABLE "public"."ow_salary_reports_archive_20260714" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_salary_reports_archive_20260714" TO "service_role";


--
-- Name: TABLE "ow_saved_companies"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_saved_companies" TO "anon";
GRANT ALL ON TABLE "public"."ow_saved_companies" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_saved_companies" TO "service_role";


--
-- Name: TABLE "ow_saved_jobs"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_saved_jobs" TO "anon";
GRANT ALL ON TABLE "public"."ow_saved_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_saved_jobs" TO "service_role";


--
-- Name: TABLE "ow_school_requests"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_school_requests" TO "anon";
GRANT ALL ON TABLE "public"."ow_school_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_school_requests" TO "service_role";


--
-- Name: TABLE "ow_schools"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_schools" TO "anon";
GRANT ALL ON TABLE "public"."ow_schools" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_schools" TO "service_role";


--
-- Name: TABLE "ow_scout_blocks"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_scout_blocks" TO "anon";
GRANT ALL ON TABLE "public"."ow_scout_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_scout_blocks" TO "service_role";


--
-- Name: TABLE "ow_scout_quotas"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_scout_quotas" TO "anon";
GRANT ALL ON TABLE "public"."ow_scout_quotas" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_scout_quotas" TO "service_role";


--
-- Name: TABLE "ow_scouts"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_scouts" TO "anon";
GRANT ALL ON TABLE "public"."ow_scouts" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_scouts" TO "service_role";


--
-- Name: TABLE "ow_settings"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_settings" TO "anon";
GRANT ALL ON TABLE "public"."ow_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_settings" TO "service_role";


--
-- Name: TABLE "ow_story_sections"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_story_sections" TO "anon";
GRANT ALL ON TABLE "public"."ow_story_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_story_sections" TO "service_role";


--
-- Name: TABLE "ow_tenant_plans"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_tenant_plans" TO "anon";
GRANT ALL ON TABLE "public"."ow_tenant_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_tenant_plans" TO "service_role";


--
-- Name: TABLE "ow_terms_agreements"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_terms_agreements" TO "anon";
GRANT ALL ON TABLE "public"."ow_terms_agreements" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_terms_agreements" TO "service_role";


--
-- Name: TABLE "ow_threads"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_threads" TO "anon";
GRANT ALL ON TABLE "public"."ow_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_threads" TO "service_role";


--
-- Name: TABLE "ow_user_achievements"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_user_achievements" TO "anon";
GRANT ALL ON TABLE "public"."ow_user_achievements" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_user_achievements" TO "service_role";


--
-- Name: TABLE "ow_user_awards"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_user_awards" TO "anon";
GRANT ALL ON TABLE "public"."ow_user_awards" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_user_awards" TO "service_role";


--
-- Name: TABLE "ow_user_certifications"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_user_certifications" TO "anon";
GRANT ALL ON TABLE "public"."ow_user_certifications" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_user_certifications" TO "service_role";


--
-- Name: TABLE "ow_user_content_links"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_user_content_links" TO "anon";
GRANT ALL ON TABLE "public"."ow_user_content_links" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_user_content_links" TO "service_role";


--
-- Name: TABLE "ow_user_educations"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_user_educations" TO "anon";
GRANT ALL ON TABLE "public"."ow_user_educations" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_user_educations" TO "service_role";


--
-- Name: TABLE "ow_user_media_appearances"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_user_media_appearances" TO "anon";
GRANT ALL ON TABLE "public"."ow_user_media_appearances" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_user_media_appearances" TO "service_role";


--
-- Name: TABLE "ow_user_profiles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."ow_user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_user_profiles" TO "service_role";


--
-- Name: TABLE "ow_user_recommendations"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_user_recommendations" TO "anon";
GRANT ALL ON TABLE "public"."ow_user_recommendations" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_user_recommendations" TO "service_role";


--
-- Name: TABLE "ow_user_roles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_user_roles" TO "anon";
GRANT ALL ON TABLE "public"."ow_user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_user_roles" TO "service_role";


--
-- Name: TABLE "ow_user_skill_tags"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_user_skill_tags" TO "anon";
GRANT ALL ON TABLE "public"."ow_user_skill_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_user_skill_tags" TO "service_role";


--
-- Name: TABLE "ow_user_socials"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_user_socials" TO "anon";
GRANT ALL ON TABLE "public"."ow_user_socials" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_user_socials" TO "service_role";


--
-- Name: TABLE "ow_users"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ow_users" TO "anon";
GRANT ALL ON TABLE "public"."ow_users" TO "authenticated";
GRANT ALL ON TABLE "public"."ow_users" TO "service_role";


--
-- Name: TABLE "salary_viewers"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."salary_viewers" TO "anon";
GRANT ALL ON TABLE "public"."salary_viewers" TO "authenticated";
GRANT ALL ON TABLE "public"."salary_viewers" TO "service_role";


--
-- Name: TABLE "scout_history"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."scout_history" TO "anon";
GRANT ALL ON TABLE "public"."scout_history" TO "authenticated";
GRANT ALL ON TABLE "public"."scout_history" TO "service_role";


--
-- Name: TABLE "scout_messages"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."scout_messages" TO "anon";
GRANT ALL ON TABLE "public"."scout_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."scout_messages" TO "service_role";


--
-- Name: TABLE "selection_feedback"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."selection_feedback" TO "anon";
GRANT ALL ON TABLE "public"."selection_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."selection_feedback" TO "service_role";


--
-- Name: TABLE "talent_pool"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."talent_pool" TO "anon";
GRANT ALL ON TABLE "public"."talent_pool" TO "authenticated";
GRANT ALL ON TABLE "public"."talent_pool" TO "service_role";


--
-- Name: TABLE "talent_profiles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."talent_profiles" TO "anon";
GRANT ALL ON TABLE "public"."talent_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."talent_profiles" TO "service_role";


--
-- Name: TABLE "tenant_master_options"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."tenant_master_options" TO "anon";
GRANT ALL ON TABLE "public"."tenant_master_options" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_master_options" TO "service_role";


--
-- Name: TABLE "tenants"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."tenants" TO "anon";
GRANT ALL ON TABLE "public"."tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."tenants" TO "service_role";


--
-- Name: TABLE "work_histories"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."work_histories" TO "anon";
GRANT ALL ON TABLE "public"."work_histories" TO "authenticated";
GRANT ALL ON TABLE "public"."work_histories" TO "service_role";


--
-- Name: TABLE "secrets"; Type: ACL; Schema: vault; Owner: supabase_admin
--

-- GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE "vault"."secrets" TO "postgres" WITH GRANT OPTION;
-- GRANT SELECT,DELETE ON TABLE "vault"."secrets" TO "service_role";


--
-- Name: TABLE "decrypted_secrets"; Type: ACL; Schema: vault; Owner: supabase_admin
--

-- GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE "vault"."decrypted_secrets" TO "postgres" WITH GRANT OPTION;
-- GRANT SELECT,DELETE ON TABLE "vault"."decrypted_secrets" TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "issue_graphql_placeholder" ON "sql_drop"
--          WHEN TAG IN ('DROP EXTENSION')
--    EXECUTE FUNCTION "extensions"."set_graphql_placeholder"();


-- ALTER EVENT TRIGGER "issue_graphql_placeholder" OWNER TO "supabase_admin";

--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "issue_pg_cron_access" ON "ddl_command_end"
--          WHEN TAG IN ('CREATE EXTENSION')
--    EXECUTE FUNCTION "extensions"."grant_pg_cron_access"();


-- ALTER EVENT TRIGGER "issue_pg_cron_access" OWNER TO "supabase_admin";

--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "issue_pg_graphql_access" ON "ddl_command_end"
--          WHEN TAG IN ('CREATE FUNCTION')
--    EXECUTE FUNCTION "extensions"."grant_pg_graphql_access"();


-- ALTER EVENT TRIGGER "issue_pg_graphql_access" OWNER TO "supabase_admin";

--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "issue_pg_net_access" ON "ddl_command_end"
--          WHEN TAG IN ('CREATE EXTENSION')
--    EXECUTE FUNCTION "extensions"."grant_pg_net_access"();


-- ALTER EVENT TRIGGER "issue_pg_net_access" OWNER TO "supabase_admin";

--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "pgrst_ddl_watch" ON "ddl_command_end"
--    EXECUTE FUNCTION "extensions"."pgrst_ddl_watch"();


-- ALTER EVENT TRIGGER "pgrst_ddl_watch" OWNER TO "supabase_admin";

--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "pgrst_drop_watch" ON "sql_drop"
--    EXECUTE FUNCTION "extensions"."pgrst_drop_watch"();


-- ALTER EVENT TRIGGER "pgrst_drop_watch" OWNER TO "supabase_admin";

--
-- PostgreSQL database dump complete
--

-- \unrestrict PB5X0Jt3acttNdcKTLa5GnKI0belmK5dvSSeSSeP3FQ0iXXcA9sg5P7b43OobN0

