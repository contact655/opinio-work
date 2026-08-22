-- ============================================================================
-- 旧ATSプロダクトの44表から anon / authenticated の権限を剥がす
--
-- 2026-08-23。届出のための調査（「同じ経路で作られた表の洗い出し」）で見つかった。
--
-- ── これは何の表か ──────────────────────────────────────────────────────
-- `ow_` 接頭辞を持たない44表は、**この Supabase プロジェクトを共有していた
-- 別アプリ（マルチテナント型のATS／人材紹介CRM）の名残**。
-- `tenants` / `tenant_id` を軸にした schema で、**このリポジトリの migration
-- 履歴には最初から存在しない**（baseline のダンプに初出）。
--
-- ⚠️ **このリポジトリの src からは1件も参照していない。**
--    543ファイルを走査し `.from("<表名>")` / `.rpc(...)` の出現が **0件**
--    （陽性対照: `.from("ow_jobs")` は61件ヒットするので検出は効いている）。
--    `types.ts` には44表とも型が載っているが、**自動生成なので参照ではない。**
--
-- ── 何が問題だったか（実測 2026-08-23）──────────────────────────────────
-- **anon が SELECT だけでなく INSERT / UPDATE / DELETE まで持っていた**
-- （41表。`iv_*` と `work_histories` の3表のみ anon 権限なし）。
-- RLS は全表で有効だが、ポリシーが anon にも開いており、
-- **未ログインで実際に行が返っていた**:
--   candidate_documents 2 / candidate_notes 2 / candidate_educations 1 /
--   candidate_certifications 1 / candidate_work_histories 1 /
--   applications 2 / ai_interviews 2 / companies 2 / jobs 2
-- ログイン済みの一般利用者（求職者）からも同じものが読めていた。
--
-- ⚠️ 返っていた中身自体はダミー（「ああああ」等）だった。
--    **ただし `candidates` は13行の実データを持つ**
--    （first_name / last_name / email / phone / current_salary / age など。
--     メール13件・電話7件）。この表は RLS が効いて0件だったが、
--    **ポリシーが1本変われば出る位置にあった。**
--    露出が確認された7表だけでなく**44表を一律に塞ぐ**のはこのため。
--
-- ── なぜ GRANT で塞ぎ、ポリシーを触らないか ────────────────────────────
-- CLAUDE.md「**誰にも読ませないは GRANT で、誰に読ませるかは RLS で書く**」。
-- ここは「誰にも読ませない」なので GRANT だけで足りる。
-- **ポリシーは1本も触らない。**
--   ・将来 DROP するか、別アプリ用に復活させるかを決めるまでの**記録**になる
--   ・消すと「元はどういう意図で開いていたか」が分からなくなる
--
-- ⚠️ **service_role は残す。** DROP の判断をする前に読める経路を消さないため。
--    運営が中身を確認するのも service_role 経由（`/admin` はすべて admin クライアント）。
--
-- ⚠️ **DROP は行わない。** 別アプリがこのプロジェクトをまだ使っていないことを
--    確認してから別タスクで判断する。**確認前に落とすと、そのアプリが壊れる。**
--
-- ── 巻き添えが無いことの事前確認 ────────────────────────────────────────
-- **44表のいずれかを副問い合わせしている `ow_` 側の RLS ポリシーは0本。**
-- （CLAUDE.md「ポリシー式は実行ユーザーの権限で評価される」——参照先から
--   SELECT を剥がすと無関係な表が丸ごと 403 になる罠。今回は該当なし。
--   陽性対照として `ow_users` を参照するポリシーは3本以上ヒットする）
--
-- ── 復元 ────────────────────────────────────────────────────────────────
-- 作業前ダンプ: .dumps/20260823-000[01]-*.sql （11ファイル / 計 149,474 バイト）
--   CREATE TABLE 44/44 表 / 実データ 129行（candidates 13行を含む）
--   ⚠️ `.gitignore` 済み。**コミットしない。**
-- 戻すなら: GRANT ALL ON TABLE <表名> TO anon, authenticated;
-- ============================================================================

-- ⚠️ **採番について（2026-08-23）**
--    最初 20260823040000 で書いたが、**別セッションが同じ番号を使っており**
--    （`member_self_apply`）、本体は流れたのに台帳への INSERT が 23505 で落ちた。
--    このファイルは**完全に冪等**（アサートと REVOKE のみ。REVOKE は
--    剥がし済みでも no-op）なので、`migration repair` は使わず
--    **採番し直して流し直した。**
--    ⚠️ 並行セッションでは採番が衝突しうる。db push の前に
--       `supabase_migrations.schema_migrations` の最大値を見ること。

-- ── ① 適用前の検算 ──────────────────────────────────────────────────────
DO $$
DECLARE
  v_tables int;
  v_anon   int;
BEGIN
  SELECT count(*) INTO v_tables FROM pg_class c
   WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'
     AND c.relname NOT LIKE 'ow\_%';

  SELECT count(*) INTO v_anon FROM pg_class c
   WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'
     AND c.relname NOT LIKE 'ow\_%'
     AND has_table_privilege('anon', c.oid, 'SELECT');

  -- 実測（適用前）: 44表中 40表で anon が SELECT を持つ（iv_* 3表と work_histories を除く）
  RAISE NOTICE '適用前: 旧ATSの表 %件 / うち anon が読める %件', v_tables, v_anon;

  -- ⚠️ 数が想定と違えば、対象が変わっている。止めて確認する
  IF v_tables <> 44 THEN
    RAISE EXCEPTION '旧ATSの表が44件ではない（%件）。対象を確認すること', v_tables;
  END IF;
END $$;

-- ── ② 権限を剥がす ──────────────────────────────────────────────────────
-- ⚠️ 表名をベタ書きせず、**接頭辞で回す**。44回書き写すと必ず1つ落とす。
--    `ow_` で始まる表には絶対に触れない条件を1箇所だけ書く。
DO $$
DECLARE
  r record;
  n int := 0;
BEGIN
  FOR r IN
    SELECT c.relname FROM pg_class c
     WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'
       AND c.relname NOT LIKE 'ow\_%'
     ORDER BY c.relname
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', r.relname);
    n := n + 1;
  END LOOP;
  RAISE NOTICE '% 表から anon / authenticated の権限を剥がした', n;
END $$;

-- ── ③ 適用後の検算 ──────────────────────────────────────────────────────
-- ⚠️ これは catalog を見ているだけ。**実際の応答は適用後に anon キーと
--    一般利用者のセッションで PostgREST を叩いて確かめること**（CLAUDE.md）。
DO $$
DECLARE
  r record;
  v_bad text := '';
  v_sr  int := 0;
BEGIN
  FOR r IN
    SELECT c.oid, c.relname FROM pg_class c
     WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'
       AND c.relname NOT LIKE 'ow\_%'
  LOOP
    IF has_table_privilege('anon', r.oid, 'SELECT')
       OR has_table_privilege('anon', r.oid, 'INSERT')
       OR has_table_privilege('authenticated', r.oid, 'SELECT')
       OR has_table_privilege('authenticated', r.oid, 'INSERT') THEN
      v_bad := v_bad || ' ' || r.relname;
    END IF;
    -- service_role は残っていること（DROP 判断まで読める経路を消さない）
    IF has_table_privilege('service_role', r.oid, 'SELECT') THEN
      v_sr := v_sr + 1;
    END IF;
  END LOOP;

  IF v_bad <> '' THEN
    RAISE EXCEPTION 'まだ権限が残っている表:%', v_bad;
  END IF;
  IF v_sr <> 44 THEN
    RAISE EXCEPTION 'service_role が読めない表がある（%/44）', v_sr;
  END IF;

  RAISE NOTICE '44表すべて anon/authenticated=なし / service_role=あり ✓';
END $$;

-- ── ④ ow_ 側を巻き込んでいないこと ──────────────────────────────────────
-- ⚠️ ②のループ条件を間違えると OPINIO 本体が丸ごと閉じる。必ず数える。
DO $$
DECLARE
  v_ow int;
BEGIN
  SELECT count(*) INTO v_ow FROM pg_class c
   WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'
     AND c.relname LIKE 'ow\_%'
     AND has_table_privilege('anon', c.oid, 'SELECT');

  -- 実測（2026-08-23 適用前）: ow_ は92表中 **72表**で anon が読める
  IF v_ow <> 72 THEN
    RAISE EXCEPTION
      'ow_ 側の anon 権限が適用前の72件と違う（%件）。巻き添えが起きている', v_ow;
  END IF;
  RAISE NOTICE 'ow_ 側は無傷: anon が読める表 %件', v_ow;
END $$;
