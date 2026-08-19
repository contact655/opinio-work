-- ═══════════════════════════════════════════════════════════════════════════
-- ow_users の anon 露出を列単位 GRANT に置き換える（2026-08-19）
--
-- ── 直す前（2026-08-19 実測）────────────────────────────────────────────
--   anon        : **テーブルレベル SELECT**（＝全32列。email と birth_date を含む）
--   authenticated: 列単位 SELECT 30列（email / birth_date だけ持たない）
--
--   RLS の `ow_users_public_read`（`visibility = 'public'`）は roles=PUBLIC なので
--   **anon にも適用される**。いまは public の行が0件（34件すべて login_only、
--   1件 private）なので実害は出ていないが、**誰かが1人でも「公開」を選んだ瞬間に、
--   その行の32列すべてが未ログインの PostgREST から読める**。
--   生年月日とメールアドレスが含まれる。ここを塞ぐ。
--
-- ── ★なぜ単純な REVOKE にしないか（今回の肝）──────────────────────────
--   `REVOKE SELECT ON ow_users FROM anon` だけだと、**ow_users とは無関係の表が
--   403 になる。**
--
--   PostgreSQL の CREATE POLICY / Notes:
--     "Since policy expressions are added to the user's query directly, they will be
--      run with the rights of the user running the overall query. Therefore, users
--      who are using a given policy must be able to access any tables or functions
--      referenced in the expression or they will simply receive a permission denied
--      error when attempting to query the table that has row-level security enabled."
--
--   つまり **ポリシー式は実行ユーザーの権限で評価される**。
--   anon が読める表のうち **15表**（下の v_tables）が、ポリシー式の中で
--   `ow_users` を副問い合わせしている。anon から SELECT 権限を丸ごと剥がすと、
--   その15表への anon のクエリが**表ごと permission denied になる**。
--
--   ⚠️ とりわけ **`ow_jobs`**（`ow_jobs_company_admin_manage` が FOR ALL / PUBLIC）。
--      `lib/search/companies.ts` `api/companies/batch` `lib/seo/featuredCompanies.ts`
--      の3箇所が anon キーで ow_jobs を読んでおり、**/companies の「募集中 N件」・
--      「募集あり」フィルタ・sitemap・LP** がここを通る。
--
--   ⚠️ しかも **画面は落ちない。** アプリは `data ?? []` で受けているので、
--      403 が**空配列として素通り**し、カードから「募集中 N件」が静かに消えるだけになる。
--
--   列単位 GRANT なら、ポリシーが参照する列（id / auth_id / visibility）の権限が
--   残るのでポリシーは評価でき、かつ機微列は返らない。
--   **authenticated が既にこの形で同じポリシー群を評価できている**（本番で実証済み）。
--
-- ── anon から落とす9列 ──────────────────────────────────────────────────
--   email, birth_date                      … 機微情報
--   statistics_opt_out                     … 規約13条の4第5項の停止請求の記録。
--                                             プロフィールの内容ではない
--   auth_linked_at                         … 監査列。運営が先に行を作ったことが読み取れる
--   profile_setup_at                       … 書き込む経路が無い未使用列
--   mentor_registered_at, is_system        … 内部の日時・区分
--   created_at, updated_at                 … 内部時刻。anon 経路のどのクエリも読んでいない
--
--   ⚠️ **anon キーの経路でこの9列を select しないこと。** 1列でも入ると
--      クエリが丸ごと403になり、上のとおり静かに空になる。
--      必要になったら「GRANT を足すか」を先に判断すること（CLAUDE.md に一般則あり）。
--
-- ── 恒久対応（今回はやらない）───────────────────────────────────────────
--   案A: 15表19ポリシーの `ow_users` 副問い合わせを SECURITY DEFINER 関数
--        （`public.auth_ow_user_id()` 等）に置き換え、anon から SELECT を完全に剥がす。
--        → docs/todo.md
--
-- ⚠️ **ポリシーは1本も触らない。** authenticated の GRANT も触らない。
--    visibility の仕様・同意文言も変えない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- anon に配る23列（＝ authenticated の30列 − 上の7列。email/birth_date は元から無い）
-- ⚠️ 事後チェックがこの並びと完全一致を要求する。増減させたら下の配列も直すこと。

DO $$
DECLARE v_auth_cols int; v_anon_cols int; v_anon_table boolean;
BEGIN
  -- ① anon が「テーブルレベル」SELECT を持っていること（これから剥がす対象）
  v_anon_table := has_table_privilege('anon','public.ow_users','SELECT');
  IF NOT v_anon_table THEN
    RAISE EXCEPTION 'anon は既にテーブルレベル SELECT を持っていない。前提が違うので中止';
  END IF;

  -- ② anon の列単位 GRANT は0であること（列単位が既にあるなら誰かが触っている）
  SELECT count(*) INTO v_anon_cols
    FROM pg_attribute a, aclexplode(a.attacl) ac, pg_roles r
   WHERE a.attrelid='public.ow_users'::regclass AND a.attnum>0 AND NOT a.attisdropped
     AND r.oid=ac.grantee AND r.rolname='anon' AND ac.privilege_type='SELECT';
  IF v_anon_cols <> 0 THEN
    RAISE EXCEPTION 'anon の列単位 SELECT が既に % 列ある（想定0）。中止', v_anon_cols;
  END IF;

  -- ③ authenticated の列単位 GRANT が30列であること（ここが違うなら前提が変わっている）
  SELECT count(*) INTO v_auth_cols
    FROM pg_attribute a, aclexplode(a.attacl) ac, pg_roles r
   WHERE a.attrelid='public.ow_users'::regclass AND a.attnum>0 AND NOT a.attisdropped
     AND r.oid=ac.grantee AND r.rolname='authenticated' AND ac.privilege_type='SELECT';
  IF v_auth_cols <> 30 THEN
    RAISE EXCEPTION 'authenticated の列単位 SELECT が % 列（想定30）。中止', v_auth_cols;
  END IF;

  RAISE NOTICE '適用前: anon=テーブルレベル / authenticated=30列';
END $$;

REVOKE SELECT ON public.ow_users FROM anon;

GRANT SELECT (
  id, auth_id, name,
  avatar_color, avatar_url, cover_color, cover_photo_url,
  about_me, headline, catchphrase, location, username,
  social_links, future_aspirations,
  visibility, is_open_to_work, can_casual_meeting,
  can_talk_to_candidates, can_talk_to_hr,
  is_mentor, is_active_mentor, mentor_themes,
  is_test
) ON public.ow_users TO anon;

DO $$
DECLARE
  v_expected text[] := ARRAY[
    'about_me','auth_id','avatar_color','avatar_url','can_casual_meeting',
    'can_talk_to_candidates','can_talk_to_hr','catchphrase','cover_color',
    'cover_photo_url','future_aspirations','headline','id','is_active_mentor',
    'is_mentor','is_open_to_work','is_test','location','mentor_themes','name',
    'social_links','username','visibility'
  ];
  v_actual  text[];
  v_dropped text[] := ARRAY[
    'email','birth_date','statistics_opt_out','auth_linked_at',
    'profile_setup_at','mentor_registered_at','is_system','created_at','updated_at'
  ];
  v_col text; v_auth_cols int;
BEGIN
  -- ① テーブルレベルは無くなったか
  IF has_table_privilege('anon','public.ow_users','SELECT') THEN
    RAISE EXCEPTION 'anon がまだテーブルレベル SELECT を持っている。中止';
  END IF;

  -- ② 列単位 GRANT が23列**ちょうど**で、リストと完全一致すること
  --    （「含まれていない」の確認だけにしない。1列増減しても検知する）
  SELECT array_agg(a.attname::text ORDER BY a.attname) INTO v_actual
    FROM pg_attribute a, aclexplode(a.attacl) ac, pg_roles r
   WHERE a.attrelid='public.ow_users'::regclass AND a.attnum>0 AND NOT a.attisdropped
     AND r.oid=ac.grantee AND r.rolname='anon' AND ac.privilege_type='SELECT';
  IF v_actual IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'anon の列が想定と違う。実際=% / 想定=%', v_actual, v_expected;
  END IF;

  -- ③ 落とした9列が本当に読めないこと（has_column_privilege はテーブルレベルも見る）
  FOREACH v_col IN ARRAY v_dropped LOOP
    IF has_column_privilege('anon','public.ow_users',v_col,'SELECT') THEN
      RAISE EXCEPTION 'anon が % を読める。中止', v_col;
    END IF;
  END LOOP;

  -- ④ authenticated は無傷（30列のまま）
  SELECT count(*) INTO v_auth_cols
    FROM pg_attribute a, aclexplode(a.attacl) ac, pg_roles r
   WHERE a.attrelid='public.ow_users'::regclass AND a.attnum>0 AND NOT a.attisdropped
     AND r.oid=ac.grantee AND r.rolname='authenticated' AND ac.privilege_type='SELECT';
  IF v_auth_cols <> 30 THEN
    RAISE EXCEPTION 'authenticated が % 列に変わっている（想定30）。中止', v_auth_cols;
  END IF;

  RAISE NOTICE '適用後: anon=23列 / 落とした9列は読めない';
END $$;

-- ═══ ★本番で実際に anon になって、15表すべてを引く ═══════════════════════
--   ポリシー式が ow_users を副問い合わせしている表を**全部**通す。1表だけにしない。
--   ここで permission denied が出れば、この migration ごとロールバックされる。
--
-- ⚠️ **ロールの切り替えと復帰は必ずトップレベルで書く。DO $$ の中でやらない。**
--    2026-08-19 に DO $$ の中で `SET LOCAL ROLE anon` → `RESET ROLE` と書いたところ、
--    ブロックを抜けても anon のままで、**CLI が最後に打つ
--    `INSERT INTO supabase_migrations.schema_migrations` が 42501 で落ちた**
--    （GRANT 自体は COMMIT 済みなのに、適用の記録だけが残らない状態になった）。
--    トップレベルの `RESET ROLE` なら PL/pgSQL の解釈が挟まらない。

SET LOCAL ROLE anon;

DO $$
DECLARE
  v_tables text[] := ARRAY[
    'ow_bookmarks','ow_career_profiles','ow_casual_meetings','ow_company_join_requests',
    'ow_company_posts','ow_conversation_messages','ow_conversation_participants',
    'ow_conversations','ow_job_applications','ow_jobs','ow_matches',
    'ow_mentor_reservations','ow_notifications','ow_user_follows','ow_user_recommendations'
  ];
  v_tbl text; v_n bigint;
BEGIN
  IF current_user <> 'anon' THEN
    RAISE EXCEPTION 'anon に切り替わっていない（current_user=%）。中止', current_user;
  END IF;
  FOREACH v_tbl IN ARRAY v_tables LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', v_tbl) INTO v_n;
    RAISE NOTICE 'anon: % → % 行', v_tbl, v_n;
  END LOOP;
  -- ow_users 自身も引けること（RLS で0行になるのが正しい。403 ではない）
  EXECUTE 'SELECT count(*) FROM public.ow_users' INTO v_n;
  RAISE NOTICE 'anon: ow_users → % 行（public が0件なので0が正しい）', v_n;
END $$;

RESET ROLE;

DO $$
BEGIN
  IF current_user <> session_user THEN
    RAISE EXCEPTION 'ロールが戻っていない（current_user=% / session_user=%）。中止',
      current_user, session_user;
  END IF;
  RAISE NOTICE '15表すべて anon で引けた。ロールも復帰';
END $$;

COMMIT;
