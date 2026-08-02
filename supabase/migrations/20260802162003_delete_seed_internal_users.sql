-- @seed.internal のシードユーザー90行を物理削除する。
--
-- 背景:
--   CLAUDE.md には「Migration 133 でテストデータを完全削除」と書かれていたが、実際には
--   90行（OB社員_001〜030 / 現役社員_001〜060、すべて 2026-05-01 作成）が残っていた。
--   実在メンバーで表示ロジックの確認が済んだため、ここで物理削除する。
--
-- ⚠️ 絞り込みは email LIKE '%@seed.internal' のみ。is_test では絞らない。
--    is_test = true は全108行あるが、残り18行（opinio.co.jp 15 / third-box.jp 2 / gmail.com 1）は
--    実 auth アカウント付きの社内・検証用アカウントであり、削除してはならない。
--
-- ⚠️ ow_users を参照する FK 45列のうち 29列が ON DELETE CASCADE（ow_experiences /
--    ow_company_members / ow_posts / ow_conversations / ow_bookmarks 等 28テーブル）。
--    つまり参照が存在しても DELETE はエラーにならず、関連行を黙って巻き込む。
--    エラーで止まるのは RESTRICT の ow_job_applications だけ。
--    そのため「削除前に参照0件であること」を migration 自身で検証してから消す。

DO $$
DECLARE
  v_target_count   int;
  v_bad_props      int;
  v_col            record;
  v_refs           bigint;
  v_total_refs     bigint := 0;
  v_cols_checked   int    := 0;
  v_deleted        int;
BEGIN
  -- ── 1. 対象件数の確認（想定と違えば中断） ──────────────────────────
  SELECT count(*) INTO v_target_count
  FROM ow_users WHERE email LIKE '%@seed.internal';

  IF v_target_count <> 90 THEN
    RAISE EXCEPTION
      '対象件数が想定と異なります: 期待 90 / 実際 % 。状況が変わっているため中断します。', v_target_count;
  END IF;

  -- ── 2. 対象の性質チェック（1件でも外れていれば中断） ────────────────
  SELECT count(*) INTO v_bad_props
  FROM ow_users
  WHERE email LIKE '%@seed.internal'
    AND (is_test IS NOT TRUE OR is_system IS TRUE OR auth_id IS NOT NULL);

  IF v_bad_props > 0 THEN
    RAISE EXCEPTION
      '想定外の行が対象に含まれています（is_test でない / is_system / auth_id あり）: % 件。中断します。', v_bad_props;
  END IF;

  -- ── 3. 参照0件の検証 ────────────────────────────────────────────
  -- ow_users を参照する全FK列 + FK制約の無い user_id 系 uuid 列を動的に走査する。
  -- CASCADE で黙って巻き込むのを防ぐため、1件でも参照があれば削除せず中断する。
  FOR v_col IN
    SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f' AND c.confrelid = 'public.ow_users'::regclass
    UNION ALL
    SELECT ('public.' || quote_ident(c.table_name)), c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.data_type = 'uuid'
      AND (c.column_name = 'user_id' OR c.column_name LIKE '%\_user\_id')
      AND NOT EXISTS (
        SELECT 1 FROM pg_constraint fk
        JOIN pg_attribute a ON a.attrelid = fk.conrelid AND a.attnum = ANY(fk.conkey)
        WHERE fk.contype = 'f' AND fk.confrelid = 'public.ow_users'::regclass
          AND fk.conrelid = (quote_ident(c.table_schema) || '.' || quote_ident(c.table_name))::regclass
          AND a.attname = c.column_name)
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM %s t WHERE t.%I IN (SELECT id FROM ow_users WHERE email LIKE ''%%@seed.internal'')',
      v_col.tbl, v_col.col
    ) INTO v_refs;

    v_cols_checked := v_cols_checked + 1;
    v_total_refs   := v_total_refs + v_refs;

    IF v_refs > 0 THEN
      RAISE EXCEPTION
        '参照が残っています: %.% に % 件。CASCADE で巻き込む恐れがあるため中断します。',
        v_col.tbl, v_col.col, v_refs;
    END IF;
  END LOOP;

  RAISE NOTICE '参照チェック完了: % 列を走査し、参照 % 件', v_cols_checked, v_total_refs;

  -- ── 4. 削除 ────────────────────────────────────────────────────
  DELETE FROM ow_users WHERE email LIKE '%@seed.internal';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted <> 90 THEN
    RAISE EXCEPTION '削除件数が想定と異なります: 期待 90 / 実際 % 。ロールバックします。', v_deleted;
  END IF;

  RAISE NOTICE 'ow_users から @seed.internal の % 行を削除しました', v_deleted;

  -- ── 5. 事後確認 ────────────────────────────────────────────────
  SELECT count(*) INTO v_target_count
  FROM ow_users WHERE email LIKE '%@seed.internal';

  IF v_target_count <> 0 THEN
    RAISE EXCEPTION '削除後も % 行残っています。ロールバックします。', v_target_count;
  END IF;
END $$;
