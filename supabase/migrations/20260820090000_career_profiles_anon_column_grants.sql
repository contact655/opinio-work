-- ═══════════════════════════════════════════════════════════════════════════
-- ow_career_profiles の anon 露出を列単位 GRANT に置き換える（2026-08-20）
--
-- **`20260819100000_ow_users_anon_column_grants.sql` と同じ形の穴。**
--
-- ── 直す前（2026-08-19 実測）────────────────────────────────────────────
--   anon         : **テーブルレベル SELECT**（＝全9列。`birth_year` と `gender` を含む）
--   authenticated: 列単位 SELECT 7列（`birth_year` / `gender` だけ持たない）
--
--   RLS の `career_profiles_public_read`（`is_published` かつ本人が `visibility='public'`）は
--   roles=PUBLIC なので **anon にも適用される**。いまは public の人が0人なので0件だが、
--   **誰かが1人でも「公開」を選んだ瞬間に、その人の生年と性別が未ログインから読める。**
--   ow_users.birth_date を 2026-08-19 に塞いだが、**同じ個人情報が別テーブルに残っていた。**
--
-- ── ★単純な REVOKE にしない理由（前回と同じ）────────────────────────────
--   ポリシー式は**実行ユーザーの権限で評価される**（PostgreSQL: CREATE POLICY / Notes）。
--   ただし今回は、**`ow_career_profiles` を副問い合わせしているポリシーは0本**（実測）。
--   それでも列単位に揃えるのは、
--     ① `visibility='public'` の意味（公開プロフィールは未ログインにも見える）を変えないため
--     ② ow_users と同じ形にして、次に読む人が2つの表で違う考え方をしなくて済むため
--
--   ⚠️ **この表自身のポリシーは `ow_users` を副問い合わせしている。**
--      anon は ow_users の `id` / `visibility` を列単位で持っている（20260819100000）ので
--      ポリシーは評価できる。**ow_users 側の GRANT を狭めるときはここも壊れる。**
--
-- ── anon から落とす4列 ──────────────────────────────────────────────────
--   birth_year   … 生年。**本件の主目的**
--   gender       … 性別。公開プロフィールに出す項目ではない
--   created_at   … 内部時刻。anon 経路のどのクエリも読んでいない
--   updated_at   … 同上
--
--   残す5列: id / user_id / headline / years_of_experience / is_published
--   （`is_published` と `user_id` はこの表のポリシーが参照するので必須）
--
--   ⚠️ **`ow_career_profiles` を読むコードは src に1行も無い**（2026-08-20 grep 実測。
--      ヒットするのは「昔ここを見ていた」というコメントだけ）。
--      いま壊れるものは無いが、**将来この表を anon キーで読むときは
--      上の4列を select に入れないこと。** 1列でも入るとクエリが丸ごと403になり、
--      `?? []` で受けている呼び出し側では「0件」として静かに素通りする。
--
-- ── 生年月日の正は `ow_users.birth_date` ─────────────────────────────────
--   `ow_career_profiles.birth_year` は**プラットフォーム側の表示・集計から参照しない**
--   （2026-08-20 決定。CLAUDE.md に明記）。
--   ⚠️ 両方に値があり**年が食い違う実ユーザーが1人いる**が、**データは書き換えない**。
--      本人確認が要るので docs/todo.md に記録してある。
--
-- ⚠️ ポリシーは1本も触らない。authenticated の GRANT も触らない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_auth int; v_anon int;
BEGIN
  IF NOT has_table_privilege('anon','public.ow_career_profiles','SELECT') THEN
    RAISE EXCEPTION 'anon は既にテーブルレベル SELECT を持っていない。前提が違うので中止';
  END IF;

  SELECT count(*) INTO v_anon
    FROM pg_attribute a, aclexplode(a.attacl) ac, pg_roles r
   WHERE a.attrelid='public.ow_career_profiles'::regclass AND a.attnum>0 AND NOT a.attisdropped
     AND r.oid=ac.grantee AND r.rolname='anon' AND ac.privilege_type='SELECT';
  IF v_anon <> 0 THEN
    RAISE EXCEPTION 'anon の列単位 SELECT が既に % 列ある（想定0）。中止', v_anon;
  END IF;

  SELECT count(*) INTO v_auth
    FROM pg_attribute a, aclexplode(a.attacl) ac, pg_roles r
   WHERE a.attrelid='public.ow_career_profiles'::regclass AND a.attnum>0 AND NOT a.attisdropped
     AND r.oid=ac.grantee AND r.rolname='authenticated' AND ac.privilege_type='SELECT';
  IF v_auth <> 7 THEN
    RAISE EXCEPTION 'authenticated の列単位 SELECT が % 列（想定7）。中止', v_auth;
  END IF;

  RAISE NOTICE '適用前: anon=テーブルレベル / authenticated=7列';
END $$;

REVOKE SELECT ON public.ow_career_profiles FROM anon;

GRANT SELECT (id, user_id, headline, years_of_experience, is_published)
  ON public.ow_career_profiles TO anon;

DO $$
DECLARE
  v_expected text[] := ARRAY['headline','id','is_published','user_id','years_of_experience'];
  v_actual   text[];
  v_dropped  text[] := ARRAY['birth_year','gender','created_at','updated_at'];
  v_col text; v_auth int;
BEGIN
  IF has_table_privilege('anon','public.ow_career_profiles','SELECT') THEN
    RAISE EXCEPTION 'anon がまだテーブルレベル SELECT を持っている。中止';
  END IF;

  SELECT array_agg(a.attname::text ORDER BY a.attname) INTO v_actual
    FROM pg_attribute a, aclexplode(a.attacl) ac, pg_roles r
   WHERE a.attrelid='public.ow_career_profiles'::regclass AND a.attnum>0 AND NOT a.attisdropped
     AND r.oid=ac.grantee AND r.rolname='anon' AND ac.privilege_type='SELECT';
  IF v_actual IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'anon の列が想定と違う。実際=% / 想定=%', v_actual, v_expected;
  END IF;

  FOREACH v_col IN ARRAY v_dropped LOOP
    IF has_column_privilege('anon','public.ow_career_profiles',v_col,'SELECT') THEN
      RAISE EXCEPTION 'anon が % を読める。中止', v_col;
    END IF;
  END LOOP;

  SELECT count(*) INTO v_auth
    FROM pg_attribute a, aclexplode(a.attacl) ac, pg_roles r
   WHERE a.attrelid='public.ow_career_profiles'::regclass AND a.attnum>0 AND NOT a.attisdropped
     AND r.oid=ac.grantee AND r.rolname='authenticated' AND ac.privilege_type='SELECT';
  IF v_auth <> 7 THEN
    RAISE EXCEPTION 'authenticated が % 列に変わっている（想定7）。中止', v_auth;
  END IF;

  RAISE NOTICE '適用後: anon=5列 / birth_year・gender・created_at・updated_at は読めない';
END $$;

-- ═══ ★anon での実引きは、この migration の中では**やらない** ═════════════
--   ⚠️ **`SET LOCAL ROLE anon` を migration ファイルに書くと、Supabase CLI の
--      `supabase db push` が最後に打つ
--      `INSERT INTO supabase_migrations.schema_migrations` が 42501 で落ちる。**
--      GRANT 自体は COMMIT されるので、**適用されたのに記録だけ残らない**状態になる
--      （`supabase migration repair --status applied <version>` で直すことになる）。
--
--   ⚠️ **2026-08-19 の `20260819100000` で1回、2026-08-20 の本 migration で2回目。**
--      1回目は「DO $$ の中で RESET ROLE したのが悪い」と考えてトップレベルに移したが、
--      **トップレベルに `SET LOCAL ROLE` / `RESET ROLE` を書いても同じように落ちた**
--      （ブロック内の `current_user = session_user` アサートは通っているのに、である）。
--      **原因は特定できていない。分かっているのは「書くと落ちる」ことだけ。**
--      → **migration の中でロールを切り替えないこと。**
--
--   では権限の実効性はどこで確かめるか:
--     ① この migration の DO $$ が `has_column_privilege` で列を1つずつアサートする（上）
--     ② **適用後に anon キーで PostgREST を直接叩いて status を見る**（別途実施）
--          birth_year / gender を混ぜた select → 401 (42501)
--          残した5列だけの select         → 200
--   ⚠️ ②を省かないこと。①は catalog を見ているだけで、実際の応答は確かめていない。

COMMIT;
