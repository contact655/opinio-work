-- ═══════════════════════════════════════════════════════════════════════════
-- 「その他〇〇」16件と、非IT大分類の代表職種22件を追加する
--
-- ── なぜ（2026-08-07）──────────────────────────────────────────────────────
-- ① 当てはまる子職種が無い人の**受け皿が無い**。
--    大分類そのものを選ばせることはできるが、
--    「営業の何か」なのか「当てはまるものが無い」のかが区別できない。
-- ② 非IT大分類7件は**業界名**で、選んでも職種が記録されない。
--    理学療法士の人が選べるのは「医療・介護・福祉」までだった。
--
-- ⚠️ 業界軸は ow_companies.industry に別で持っている。
--    **職種マスタに業界を持ち込まない**ので、大分類名はそのままにして
--    下に代表職種を足す形にする。
--
-- ⚠️ 非IT配下は is_it_saas = false。求人フォームには出さず、職歴入力にだけ出す
--    （/profile/edit の希望職種も is_it_saas = true で絞っているので出ない）。
--    「その他〇〇」は所属する大分類の is_it_saas に合わせる。
--
-- ── ⚠️ 衝突チェック（投入前に機械的に実施・全38件が通過）──────────────────
-- 新しく作る**職種名**が、既存職種の**別名**と一致すると、
-- D-3 で整理した「別名 vs 正式名の衝突」を自分で作ることになる。
--   例: 金融・保険 に「法人営業」を作ると、フィールドセールス の別名と衝突する
-- そのため「法人営業」は候補から外し、「個人営業・FP」にしてある。
-- 事後チェックでも b種の衝突が2件（意図した分）から増えていないことを確認する。
--
-- ⚠️ UNIQUE (name, parent_id) NULLS NOT DISTINCT があるので、
--    同じ親の下に同名は作れない。名前の全体一致は制約ではないが、
--    検索が混乱するので事前チェックでは**全体**で見ている。
--
-- ⚠️ 3階層は trg_ow_roles_two_levels（BEFORE INSERT OR UPDATE OF parent_id）が
--    DB 側で防ぐ。ここでは事後チェックで0件を確認するだけ。
--
-- ── 「公務・その他」に子を作らない理由 ──────────────────────────────────────
-- 「その他公務・その他」という名前になり読めない。大分類名そのものが既に
-- 受け皿の役割なので、子を持たせず**そのまま選べる形**にしてある。
-- 大分類名を変える案（例:「公務・団体」にして「その他公務・団体」を作る）もあるが、
-- 名前の変更は判断が要るので今回はしない。報告に所見を添える。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_roles int; v_alias int; v_bconf int;
BEGIN
  SELECT count(*) INTO v_roles FROM public.ow_roles;
  IF v_roles <> 105 THEN RAISE EXCEPTION 'ow_roles が % 件（想定105）。中止', v_roles; END IF;

  SELECT count(*) INTO v_alias FROM public.ow_role_aliases;
  IF v_alias <> 227 THEN RAISE EXCEPTION 'ow_role_aliases が % 件（想定227）。中止', v_alias; END IF;

  -- b種の衝突（別名 = 有効な職種の正式名）が意図した2件であること
  SELECT count(*) INTO v_bconf FROM public.ow_role_aliases a
    JOIN public.ow_roles rn ON rn.name = a.alias
   WHERE rn.id <> a.role_id AND rn.is_active;
  IF v_bconf <> 2 THEN RAISE EXCEPTION 'b種の衝突が % 件（想定2）。中止', v_bconf; END IF;
END $$;

-- ── ① 非IT大分類の代表職種（22件・is_it_saas = false）───────────────────────
-- ⚠️ 細かくしない。職歴を記録するための最小限にとどめる。
INSERT INTO public.ow_roles (name, slug, parent_id, level, is_active, is_it_saas, display_order)
SELECT v.name, v.slug, p.id, 2, true, false, v.ord
  FROM (VALUES
    ('医療・介護・福祉','医師',                 'doctor',        1),
    ('医療・介護・福祉','看護師',               'nurse',         2),
    ('医療・介護・福祉','薬剤師',               'pharmacist',    3),
    ('医療・介護・福祉','理学療法士・作業療法士', 'therapist',     4),
    ('医療・介護・福祉','介護福祉士',            'caregiver',     5),
    ('建設・不動産','施工管理',                 'construction-mgmt', 1),
    ('建設・不動産','建築設計',                 'architect-design',  2),
    ('建設・不動産','土木設計',                 'civil-design',      3),
    ('建設・不動産','不動産営業',               'realestate-sales',  4),
    ('製造・技術','研究・開発',                 'rnd',           1),
    ('製造・技術','生産技術',                   'process-eng',   2),
    ('製造・技術','生産管理',                   'production-mgmt', 3),
    ('製造・技術','品質管理',                   'quality-mgmt',  4),
    ('教育・研究','教員',                       'teacher',       1),
    ('教育・研究','講師・トレーナー',            'instructor',    2),
    ('教育・研究','研究員',                     'researcher',    3),
    ('販売・サービス','店長',                   'store-manager', 1),
    ('販売・サービス','店舗管理',               'store-ops',     2),
    ('販売・サービス','販売スタッフ',            'sales-staff',   3),
    ('金融・保険','個人営業・FP',               'retail-finance', 1),
    ('金融・保険','アナリスト',                 'analyst',       2),
    ('金融・保険','金融事務',                   'finance-admin', 3)
  ) AS v(parent_name, name, slug, ord)
  JOIN public.ow_roles p ON p.name = v.parent_name AND p.parent_id IS NULL AND p.is_active;

-- ── ② 「その他〇〇」（16件）─────────────────────────────────────────────────
-- ⚠️ display_order は各大分類の**末尾**。既存の最大値 + 10 にして、
--    後から子を足しても「その他」が最後に残るようにする。
-- ⚠️ 別名は付けない。
-- ⚠️ 「公務・その他」は対象外（上のコメント参照）。
INSERT INTO public.ow_roles (name, slug, parent_id, level, is_active, is_it_saas, display_order)
SELECT 'その他' || p.name, v.slug, p.id, 2, true, p.is_it_saas,
       coalesce((SELECT max(c.display_order) FROM public.ow_roles c WHERE c.parent_id = p.id), 0) + 10
  FROM (VALUES
    ('営業','other-sales'), ('カスタマーサクセス','other-cs'), ('マーケティング','other-marketing'),
    ('プロダクト','other-product'), ('デザイナー','other-design'), ('データ・AI','other-data-ai'),
    ('エンジニア','other-engineer'), ('コーポレート','other-corporate'), ('事業開発','other-bizdev'),
    ('経営・CxO','other-exec'),
    ('医療・介護・福祉','other-healthcare'), ('建設・不動産','other-construction'),
    ('製造・技術','other-manufacturing'), ('教育・研究','other-education'),
    ('販売・サービス','other-retail-service'), ('金融・保険','other-finance')
  ) AS v(parent_name, slug)
  JOIN public.ow_roles p ON p.name = v.parent_name AND p.parent_id IS NULL AND p.is_active;

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_roles int; v_other int; v_nonit int; v_depth int; v_adup text; v_bconf int;
  v_notlast text; v_alias int; v_kumu int;
BEGIN
  -- 件数: 105 + 22 + 16 = 143
  SELECT count(*) INTO v_roles FROM public.ow_roles;
  IF v_roles <> 143 THEN RAISE EXCEPTION 'ow_roles が % 件（想定143）。ロールバック', v_roles; END IF;

  SELECT count(*) INTO v_other FROM public.ow_roles WHERE name LIKE 'その他%' AND parent_id IS NOT NULL;
  IF v_other <> 16 THEN RAISE EXCEPTION '「その他〇〇」が % 件（想定16）。ロールバック', v_other; END IF;

  SELECT count(*) INTO v_nonit FROM public.ow_roles r
    JOIN public.ow_roles p ON p.id = r.parent_id
   WHERE NOT p.is_it_saas AND r.name NOT LIKE 'その他%';
  IF v_nonit <> 22 THEN RAISE EXCEPTION '非IT配下の代表職種が % 件（想定22）。ロールバック', v_nonit; END IF;

  -- ⚠️ 3階層が0件（トリガーが防いでいるはずだが実測する）
  SELECT count(*) INTO v_depth FROM public.ow_roles r
    JOIN public.ow_roles p ON p.id = r.parent_id WHERE p.parent_id IS NOT NULL;
  IF v_depth <> 0 THEN RAISE EXCEPTION '3階層の職種が % 件ある。ロールバック', v_depth; END IF;

  -- 「公務・その他」に子を作っていないこと
  SELECT count(*) INTO v_kumu FROM public.ow_roles c
    JOIN public.ow_roles p ON p.id = c.parent_id WHERE p.name = '公務・その他';
  IF v_kumu <> 0 THEN RAISE EXCEPTION '「公務・その他」に子が % 件できている。ロールバック', v_kumu; END IF;

  -- is_it_saas: 非IT配下がすべて false であること
  IF EXISTS (SELECT 1 FROM public.ow_roles r JOIN public.ow_roles p ON p.id = r.parent_id
              WHERE NOT p.is_it_saas AND r.is_it_saas) THEN
    RAISE EXCEPTION '非IT配下に is_it_saas = true の職種がある。ロールバック';
  END IF;

  -- ⚠️「その他〇〇」が各大分類の末尾に来ること
  SELECT string_agg(p.name, ', ') INTO v_notlast
    FROM public.ow_roles o JOIN public.ow_roles p ON p.id = o.parent_id
   WHERE o.name LIKE 'その他%'
     AND o.display_order < (SELECT max(c.display_order) FROM public.ow_roles c
                             WHERE c.parent_id = p.id AND c.id <> o.id);
  IF v_notlast IS NOT NULL THEN
    RAISE EXCEPTION '「その他〇〇」が末尾でない大分類がある（%）。ロールバック', v_notlast;
  END IF;

  -- 別名は増やしていないこと
  SELECT count(*) INTO v_alias FROM public.ow_role_aliases;
  IF v_alias <> 227 THEN RAISE EXCEPTION '別名が % 件（想定227・変更なし）。ロールバック', v_alias; END IF;

  -- a種: 同じ別名が2職種に付いていないこと（0件のまま）
  SELECT string_agg(alias, ', ') INTO v_adup FROM (
    SELECT alias FROM public.ow_role_aliases GROUP BY alias HAVING count(*) > 1) d;
  IF v_adup IS NOT NULL THEN RAISE EXCEPTION 'a種の重複が発生（%）。ロールバック', v_adup; END IF;

  -- b種: 別名 = 有効な職種の正式名 が2件のまま（新しい職種名が別名と衝突していないこと）
  SELECT count(*) INTO v_bconf FROM public.ow_role_aliases a
    JOIN public.ow_roles rn ON rn.name = a.alias
   WHERE rn.id <> a.role_id AND rn.is_active;
  IF v_bconf <> 2 THEN RAISE EXCEPTION 'b種の衝突が % 件に増えた（想定2）。ロールバック', v_bconf; END IF;

  RAISE NOTICE '完了: ow_roles % 件（+38）/ その他 % 件 / 非IT配下 % 件 / 3階層0件 / 別名 % 件は変更なし',
    v_roles, v_other, v_nonit, v_alias;
END $$;

COMMIT;
