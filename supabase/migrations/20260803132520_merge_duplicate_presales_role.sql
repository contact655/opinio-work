-- ═══════════════════════════════════════════════════════════════════════════
-- 重複したプリセールス系ロールを統合する
--
--   消す: 05cf4e21-8921-4f42-b9f1-fab9b709eb11  「セールスエンジニア・プリセールス」
--   残す: a1b2c3d4-0000-0000-0000-000000000001  「ソリューションエンジニア・プリセールス」
--
-- どちらも親は営業で、同じ概念が2つ存在していた。
-- 求人が紐づいているのは残す側（配下の セールスエンジニア / ソリューションエンジニア /
-- ソリューションズアーキテクト に published 7件）で、エイリアス3件は消す側に付いていた。
--
-- ── なぜ問題か ──────────────────────────────────────────────────────────────
-- 検索の辞書段は「まずエイリアスが指す職種そのもので当て、全滅したときだけ祖先へ広げる」
-- という2段構えだが、エイリアスの指す先が求人0件の側だったため第1段が原理的に当たらず、
-- 常に第2段（祖先＝営業）に落ちていた。
-- その結果「営業 エンジニア」で純粋な AE 求人まで巻き込んで13件返っていた。
--
-- エイリアス3件を残す側へ移せば、求人が持つ roleIds（具体職種＋祖先）に
-- 「ソリューションエンジニア・プリセールス」が含まれるため第1段が機能する。
--
-- ── 消す側は物理削除しない ──────────────────────────────────────────────────
-- ow_roles.merged_into_id（これまで全件 NULL の未使用列）に統合先を記録し、
-- is_active=false にする。統合の履歴を残すための列なので、その用途どおりに使う。
-- 物理削除すると ow_role_aliases が CASCADE で消え、
-- ow_experiences.role_category_id は NO ACTION なので削除自体がエラーになる。
--
-- ── 識別子も引き継ぐ ────────────────────────────────────────────────────────
-- 残す側は slug が NULL・display_order=99（末尾）で、消す側が slug='sales-eng'・
-- display_order=11 を持っていた。統合先が概念を引き継ぐ以上、識別子も移す。
-- slug を移さないと、非アクティブな行が 'sales-eng' を占有したままになり、
-- 別途起票済みの「slug 未設定6件を埋める」タスクとぶつかる。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  v_from uuid := '05cf4e21-8921-4f42-b9f1-fab9b709eb11';  -- 消す側
  v_to   uuid := 'a1b2c3d4-0000-0000-0000-000000000001';  -- 残す側
  r record;
  n bigint;
  v_unexpected text := '';
  v_alias_moved int;
  v_exp_moved   int;
  v_alias_after int;
  v_jobs_under_to int;
  v_from_slug text;
  v_from_order int;
BEGIN
  -- ── ① 対象2件が想定どおりか ──────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM ow_roles
     WHERE id = v_from AND name = 'セールスエンジニア・プリセールス' AND merged_into_id IS NULL
  ) THEN
    RAISE EXCEPTION '消す側が想定と異なる（名前が違う、または既に統合済み）。中止';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM ow_roles
     WHERE id = v_to AND name = 'ソリューションエンジニア・プリセールス' AND is_active
  ) THEN
    RAISE EXCEPTION '残す側が想定と異なる。中止';
  END IF;

  -- 親が同じであること（別の枝に付け替えてしまわないための確認）
  IF (SELECT parent_id FROM ow_roles WHERE id = v_from)
     IS DISTINCT FROM (SELECT parent_id FROM ow_roles WHERE id = v_to) THEN
    RAISE EXCEPTION '2つのロールの親が異なる。統合すると階層が変わるため中止';
  END IF;

  -- ── ② 残す側に求人がぶら下がっていること ─────────────────────────────────
  --    「求人が紐づいている側を残す」という判断の前提そのものを確認する。
  SELECT count(DISTINCT jr.job_id) INTO v_jobs_under_to
    FROM ow_job_roles jr
    JOIN ow_roles r2 ON r2.id = jr.role_id
   WHERE r2.parent_id = v_to OR r2.id = v_to;
  IF v_jobs_under_to = 0 THEN
    RAISE EXCEPTION '残す側の配下に求人が1件も無い。統合の前提が崩れているため中止';
  END IF;

  -- ── ③ 消す側への参照が「移せるもの」だけであること ───────────────────────
  --    ow_roles を参照する FK と role_id 系 uuid 列を適用時に列挙して検査する。
  --    ow_role_aliases / ow_experiences 以外から参照されていたら、
  --    移し漏れになるので止める。
  FOR r IN
    SELECT DISTINCT c.conrelid::regclass::text AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN unnest(c.conkey) WITH ORDINALITY k(attnum, ord) ON true
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
     WHERE c.contype = 'f' AND c.confrelid = 'public.ow_roles'::regclass
    UNION
    SELECT c.table_name, c.column_name
      FROM information_schema.columns c
     WHERE c.table_schema = 'public' AND c.data_type = 'uuid'
       AND (c.column_name LIKE '%role_id%' OR c.column_name LIKE '%role_category%')
  LOOP
    BEGIN
      EXECUTE format('SELECT count(*) FROM %I WHERE %I = %L', r.tbl, r.col, v_from) INTO n;
    EXCEPTION WHEN others THEN n := 0;
    END;
    IF n > 0 AND r.tbl NOT IN ('ow_role_aliases', 'ow_experiences') THEN
      v_unexpected := v_unexpected || format('%s.%s=%s ', r.tbl, r.col, n);
    END IF;
  END LOOP;
  IF v_unexpected <> '' THEN
    RAISE EXCEPTION '移し先を決めていない参照がある: %。中止', v_unexpected;
  END IF;

  -- ── ④ 参照を移す ────────────────────────────────────────────────────────
  --    UNIQUE (role_id, alias) があるため、残す側に同名エイリアスが既にある場合は
  --    移さず消す（重複を作らない）。現状 残す側のエイリアスは0件。
  DELETE FROM ow_role_aliases a
   WHERE a.role_id = v_from
     AND EXISTS (SELECT 1 FROM ow_role_aliases b WHERE b.role_id = v_to AND b.alias = a.alias);

  UPDATE ow_role_aliases SET role_id = v_to WHERE role_id = v_from;
  GET DIAGNOSTICS v_alias_moved = ROW_COUNT;

  UPDATE ow_experiences SET role_category_id = v_to WHERE role_category_id = v_from;
  GET DIAGNOSTICS v_exp_moved = ROW_COUNT;

  -- ── ⑤ 識別子を引き継ぎ、消す側を統合済みにする ──────────────────────────
  --    ⚠️ ow_roles.slug には UNIQUE 制約（ow_roles_slug_key）がある。
  --       先に統合先へ入れると一瞬だが2行が同じ slug を持ち 23505 になるので、
  --       必ず「消す側から外す → 統合先へ入れる」の順で行うこと。
  SELECT slug, display_order INTO v_from_slug, v_from_order FROM ow_roles WHERE id = v_from;

  UPDATE ow_roles SET slug = NULL WHERE id = v_from;

  UPDATE ow_roles
     SET slug = COALESCE(slug, v_from_slug),
         display_order = LEAST(display_order, v_from_order)
   WHERE id = v_to;

  UPDATE ow_roles
     SET merged_into_id = v_to,
         is_active = false
   WHERE id = v_from;

  -- ── ⑥ 事後チェック ──────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM ow_role_aliases WHERE role_id = v_from) THEN
    RAISE EXCEPTION 'エイリアスが消す側に残っている。ロールバック';
  END IF;
  IF EXISTS (SELECT 1 FROM ow_experiences WHERE role_category_id = v_from) THEN
    RAISE EXCEPTION '職歴が消す側を参照したまま。ロールバック';
  END IF;

  SELECT count(*) INTO v_alias_after FROM ow_role_aliases WHERE role_id = v_to;
  IF v_alias_after < 3 THEN
    RAISE EXCEPTION '残す側のエイリアスが % 件（想定3件以上）。ロールバック', v_alias_after;
  END IF;

  -- エイリアス総数が減っていないこと（重複削除が走った場合を除く）
  IF (SELECT count(*) FROM ow_role_aliases) <> 117 THEN
    RAISE EXCEPTION 'エイリアス総数が % 件（想定117件）。ロールバック',
      (SELECT count(*) FROM ow_role_aliases);
  END IF;

  -- 統合先が有効なままであること
  IF NOT EXISTS (SELECT 1 FROM ow_roles WHERE id = v_to AND is_active AND merged_into_id IS NULL) THEN
    RAISE EXCEPTION '統合先が無効になっている。ロールバック';
  END IF;

  RAISE NOTICE '完了: エイリアス % 件 / 職歴 % 件を統合先へ移動。統合先のエイリアスは % 件',
    v_alias_moved, v_exp_moved, v_alias_after;
END $$;

COMMIT;
