-- ═══════════════════════════════════════════════════════════════════════════
-- is_it_saas の意味を再定義し、コーポレートを true にする
--
-- ── なぜ（2026-08-06）──────────────────────────────────────────────────────
-- これまでの is_it_saas は「IT/SaaS **業界特有** の職種か」という意味で入っており、
-- コーポレート（大分類＋配下13件）が false だった。
-- 求人フォームに is_it_saas=true の絞り込みを入れると、SaaS/IT企業が実際に募集する
-- 人事・経理・法務・情シスが選べなくなる。
--
-- 意味を「**OPINIO の掲載企業（SaaS/IT）の求人で使う職種か**」に変える。
-- ⚠️ カラム名は変えない。型定義（types.ts）と参照コードへの波及が大きいため。
--    意味は COMMENT に残す。
--
-- ⚠️ 変更後に false で残るのは
--      ・無効化済みの6件（統合済み1 + 孫5）
--      ・このあと追加する非IT系の大分類7件（別 migration）
--    のみになる想定。事後チェックで検証する。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_corp uuid; v_false_before int; v_children int;
BEGIN
  SELECT id INTO v_corp FROM public.ow_roles WHERE slug = 'corporate';
  IF v_corp IS NULL THEN RAISE EXCEPTION 'slug=corporate が無い。中止'; END IF;

  SELECT count(*) INTO v_children FROM public.ow_roles WHERE parent_id = v_corp;
  IF v_children <> 12 THEN
    RAISE EXCEPTION 'コーポレート配下が % 件（想定12）。中止', v_children;
  END IF;

  SELECT count(*) INTO v_false_before FROM public.ow_roles WHERE NOT is_it_saas;
  RAISE NOTICE '適用前: is_it_saas=false が % 件 / コーポレート配下 % 件', v_false_before, v_children;
END $$;

-- コーポレート（大分類）＋配下を true に
UPDATE public.ow_roles
   SET is_it_saas = true
 WHERE slug = 'corporate'
    OR parent_id = (SELECT id FROM public.ow_roles WHERE slug = 'corporate');

-- ⚠️ ソリューションエンジニア・プリセールス（sales-eng）も true にする。
--    指示は「コーポレートを true に」だったが、事後チェックでこの1件が
--    「有効なのに is_it_saas=false」で引っかかり、最初の適用は全ロールバックした。
--    この職種は 2026-08-06 の階層是正で**公開求人7件の付け替え先**になっており、
--    false のままだと求人フォームの選択肢から消える。
--    「求人で使う職種か」という新しい定義に照らせば true 以外にならない。
--    （元が false だったのは、旧定義「IT/SaaS 業界特有か」で
--      孫5件と同じ手打ちUUIDの流れで入った行だったため）
UPDATE public.ow_roles SET is_it_saas = true WHERE slug = 'sales-eng';

COMMENT ON COLUMN public.ow_roles.is_it_saas IS
  'OPINIO の掲載企業（SaaS/IT）の求人で使う職種か。'
  ' true = 企業の求人フォームの選択肢に出す / false = 出さない。'
  ' ⚠️ 2026-08-06 に意味を変えた。それまでは「IT/SaaS 業界特有の職種か」で、'
  ' コーポレート（人事・経理・法務・情シス等）が false だった。SaaS/IT企業も'
  ' これらを募集するため、求人フォームから消えてしまう。'
  ' ⚠️ ユーザーの職歴入力ではこのフラグで絞らない。過去職歴には非IT職が入るため'
  ' （非IT系の大分類7件は false で登録してある）。';

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_bad int; v_true int; v_names text;
BEGIN
  -- 有効な職種で false が残っていないこと（この時点では非IT7件がまだ無い）
  SELECT count(*), string_agg(name, ' / ' ORDER BY name)
    INTO v_bad, v_names
    FROM public.ow_roles WHERE NOT is_it_saas AND is_active;
  IF v_bad <> 0 THEN
    RAISE EXCEPTION '有効なのに is_it_saas=false の職種が % 件残っている（%）。ロールバック', v_bad, v_names;
  END IF;

  SELECT count(*) INTO v_true FROM public.ow_roles WHERE is_it_saas;
  RAISE NOTICE '完了: is_it_saas=true % 件 / false は無効化済みの6件のみ', v_true;
END $$;

COMMIT;
