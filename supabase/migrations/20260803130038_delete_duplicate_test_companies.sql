-- ═══════════════════════════════════════════════════════════════════════════
-- 重複した「株式会社TEST」2件を削除する
--
--   1c5fc5fe-2354-4b5c-9481-6c4aca59a308  作成 2026-07-21
--   4039a638-229d-421c-b8be-c2835bf0b9c7  作成 2026-06-19
--
-- どちらも is_published=false / 求人0 / 紐づく職歴0 の動作確認用レコード。
-- 非公開なので求職者側には出ていないが、企業数の集計には入る。
--
-- ⚠️ ow_companies を参照する FK は 40列あり、うち 33列が ON DELETE CASCADE。
--    参照が残っていてもエラーで止まらず黙って巻き込む。
--    さらに ow_experiences.company_id は SET NULL なので、
--    職歴が紐づいていると「社名が消えた職歴」が静かに生き残る。
--    そのため削除前に全参照列を動的に走査して 0件 であることを確かめる。
--
-- 内訳（2026-08-03 実測）: CASCADE 33 / SET NULL 4 / NO ACTION 2 / RESTRICT 1
--
-- 消える参照（想定どおり消してよいもの）:
--   ow_company_admins              2件
--   ow_company_employee_categories 5件
--   ow_company_genres              2件
--
-- ⚠️ 副作用: contact+001@opinio.co.jp（is_test=true）は
--    この株式会社TEST の admin 行しか持っていないため、削除後は
--    所属企業が0になり biz 側で企業を選べなくなる。
--    テスト用アカウントなので許容する。
--    s.hisato1020@gmail.com は Third Box / Opinio が残るので影響なし。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  v_ids uuid[] := ARRAY[
    '1c5fc5fe-2354-4b5c-9481-6c4aca59a308'::uuid,
    '4039a638-229d-421c-b8be-c2835bf0b9c7'::uuid
  ];
  r record;
  n bigint;
  v_found int;
  v_unexpected text := '';
  v_deleted int;
  v_before int;
  v_after int;
  -- 消えてよい参照だけを列挙する。ここに無いテーブルから参照されていたら中止する。
  v_allowed text[] := ARRAY['ow_company_admins', 'ow_company_employee_categories', 'ow_company_genres'];
BEGIN
  -- ── ① 対象が想定どおりか（名前・非公開・件数）────────────────────────────
  SELECT count(*) INTO v_found
    FROM ow_companies
   WHERE id = ANY(v_ids) AND name = '株式会社TEST' AND is_published = false;
  IF v_found <> 2 THEN
    RAISE EXCEPTION '対象が想定と異なる（name=株式会社TEST かつ is_published=false が % 件、想定2件）。中止', v_found;
  END IF;

  -- 同名の企業が他にも増えていないか（増えていたら人手で確認すべき）
  SELECT count(*) INTO v_found FROM ow_companies WHERE name = '株式会社TEST';
  IF v_found <> 2 THEN
    RAISE EXCEPTION '「株式会社TEST」が % 件ある（想定2件）。中止', v_found;
  END IF;

  -- ── ② 公開物が紐づいていないこと（求人・記事・面談・会話）────────────────
  IF EXISTS (SELECT 1 FROM ow_jobs WHERE company_id = ANY(v_ids))
     OR EXISTS (SELECT 1 FROM ow_articles WHERE company_id = ANY(v_ids))
     OR EXISTS (SELECT 1 FROM ow_casual_meetings WHERE company_id = ANY(v_ids))
     OR EXISTS (SELECT 1 FROM ow_conversations WHERE company_id = ANY(v_ids)) THEN
    RAISE EXCEPTION '求人・記事・面談・会話のいずれかが紐づいている。中止';
  END IF;

  -- ── ③ 職歴・年収レポートが紐づいていないこと ────────────────────────────
  --    ow_experiences は SET NULL なので、残っていると社名を失った職歴になる。
  --    ow_salary_reports は CASCADE なので、残っていると黙って消える。
  IF EXISTS (SELECT 1 FROM ow_experiences WHERE company_id = ANY(v_ids)) THEN
    RAISE EXCEPTION '職歴が紐づいている（SET NULL で社名だけ失われる）。中止';
  END IF;
  IF EXISTS (SELECT 1 FROM ow_salary_reports WHERE company_id = ANY(v_ids)) THEN
    RAISE EXCEPTION '年収レポートが紐づいている（CASCADE で消える）。中止';
  END IF;

  -- ── ④ 全参照列を動的に走査し、許可した3テーブル以外の参照が無いこと ──────
  --    FK 40列 + FK制約の無い company_id 系 uuid 列を、適用時に列挙して検査する。
  --    テーブルが増えても自動で検査対象に入る。
  FOR r IN
    SELECT DISTINCT c.conrelid::regclass::text AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN unnest(c.conkey) WITH ORDINALITY k(attnum, ord) ON true
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
     WHERE c.contype = 'f' AND c.confrelid = 'public.ow_companies'::regclass
    UNION
    SELECT c.table_name, c.column_name
      FROM information_schema.columns c
     WHERE c.table_schema = 'public' AND c.data_type = 'uuid'
       AND c.column_name LIKE '%company_id%'
  LOOP
    BEGIN
      EXECUTE format('SELECT count(*) FROM %I WHERE %I = ANY($1)', r.tbl, r.col)
        USING v_ids INTO n;
    EXCEPTION WHEN others THEN
      n := 0; -- ビュー等で実行できない場合は飛ばす
    END;
    IF n > 0 AND NOT (r.tbl = ANY(v_allowed)) THEN
      v_unexpected := v_unexpected || format('%s.%s=%s ', r.tbl, r.col, n);
    END IF;
  END LOOP;

  IF v_unexpected <> '' THEN
    RAISE EXCEPTION '想定外の参照がある: %。中止', v_unexpected;
  END IF;

  -- ── ⑤ 削除 ──────────────────────────────────────────────────────────────
  SELECT count(*) INTO v_before FROM ow_companies;

  DELETE FROM ow_companies WHERE id = ANY(v_ids);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  SELECT count(*) INTO v_after FROM ow_companies;

  IF v_deleted <> 2 THEN
    RAISE EXCEPTION '削除件数が % 件（想定2件）。ロールバック', v_deleted;
  END IF;
  IF v_after <> v_before - 2 THEN
    RAISE EXCEPTION '企業数が % → %（想定 -2）。ロールバック', v_before, v_after;
  END IF;
  IF EXISTS (SELECT 1 FROM ow_companies WHERE name = '株式会社TEST') THEN
    RAISE EXCEPTION '「株式会社TEST」が残っている。ロールバック';
  END IF;

  RAISE NOTICE '完了: 株式会社TEST 2件を削除（企業数 % → %）', v_before, v_after;
END $$;

COMMIT;
