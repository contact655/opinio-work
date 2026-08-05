-- ═══════════════════════════════════════════════════════════════════════════
-- 非IT系の大分類7件を追加する
--
-- ── なぜ（2026-08-06）──────────────────────────────────────────────────────
-- ユーザーの職歴には非IT職が入る。実データにも「みずほ証券（証券）」
-- 「海光電業（電設資材）」があり、いまは無理やり IT/SaaS 系の職種に寄せて登録されている。
--
-- ⚠️ 子職種は作らない。大分類だけ。細分化は実データが出てから決める。
--    先に細かく作ると、使われない職種が増えて統合の手間になる（現に98件中82件が未使用）。
-- ⚠️ is_it_saas = false。求人フォームには出さず、ユーザーの職歴入力にだけ出す。
-- ⚠️ UUID は gen_random_uuid()。手打ちUUID（a1b2c3d4-...）は3階層問題の原因なので使わない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_dup int; v_roots int;
BEGIN
  SELECT count(*) INTO v_dup FROM public.ow_roles
   WHERE slug IN ('healthcare','construction','manufacturing','education','retail-service','finance','other');
  IF v_dup <> 0 THEN
    RAISE EXCEPTION '追加しようとしている slug が既に % 件ある。中止', v_dup;
  END IF;

  SELECT count(*) INTO v_roots FROM public.ow_roles WHERE parent_id IS NULL;
  IF v_roots <> 10 THEN
    RAISE EXCEPTION '大分類が % 件（想定10）。中止', v_roots;
  END IF;

  -- display_order 11〜17 が空いていること
  IF EXISTS (SELECT 1 FROM public.ow_roles WHERE parent_id IS NULL AND display_order BETWEEN 11 AND 17) THEN
    RAISE EXCEPTION 'display_order 11〜17 に既存の大分類がある。中止';
  END IF;

  RAISE NOTICE '適用前: 大分類 % 件 / slug 重複 % 件', v_roots, v_dup;
END $$;

INSERT INTO public.ow_roles (id, parent_id, name, slug, level, display_order, is_it_saas, is_active)
VALUES
  (gen_random_uuid(), NULL, '医療・介護・福祉', 'healthcare',     1, 11, false, true),
  (gen_random_uuid(), NULL, '建設・不動産',     'construction',   1, 12, false, true),
  (gen_random_uuid(), NULL, '製造・技術',       'manufacturing',  1, 13, false, true),
  (gen_random_uuid(), NULL, '教育・研究',       'education',      1, 14, false, true),
  (gen_random_uuid(), NULL, '販売・サービス',   'retail-service', 1, 15, false, true),
  (gen_random_uuid(), NULL, '金融・保険',       'finance',        1, 16, false, true),
  (gen_random_uuid(), NULL, '公務・その他',     'other',          1, 17, false, true);

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_roots int; v_new int; v_gc int; v_bad int; v_names text;
BEGIN
  SELECT count(*) INTO v_roots FROM public.ow_roles WHERE parent_id IS NULL;
  IF v_roots <> 17 THEN RAISE EXCEPTION '大分類が % 件（想定17）。ロールバック', v_roots; END IF;

  SELECT count(*) INTO v_new FROM public.ow_roles
   WHERE slug IN ('healthcare','construction','manufacturing','education','retail-service','finance','other')
     AND parent_id IS NULL AND level = 1 AND is_active AND NOT is_it_saas;
  IF v_new <> 7 THEN RAISE EXCEPTION '追加した7件の値が想定と違う（% 件一致）。ロールバック', v_new; END IF;

  -- 2階層が壊れていないこと
  SELECT count(*) INTO v_gc FROM public.ow_roles r
    JOIN public.ow_roles p ON p.id=r.parent_id JOIN public.ow_roles g ON g.id=p.parent_id;
  IF v_gc <> 0 THEN RAISE EXCEPTION '3階層が % 件。ロールバック', v_gc; END IF;

  -- is_it_saas=false は「無効化済み6件」＋「今回の7件」だけであること
  SELECT count(*), string_agg(name, ' / ' ORDER BY name) INTO v_bad, v_names
    FROM public.ow_roles
   WHERE NOT is_it_saas
     AND is_active
     AND (slug IS NULL OR slug <> ALL (ARRAY['healthcare','construction','manufacturing','education','retail-service','finance','other']));
  IF v_bad <> 0 THEN
    RAISE EXCEPTION '想定外の is_it_saas=false が % 件（%）。ロールバック', v_bad, v_names;
  END IF;

  RAISE NOTICE '完了: 大分類 % 件（IT/SaaS 10 + 非IT 7）/ 3階層 0 件', v_roots;
END $$;

COMMIT;
