-- ═══════════════════════════════════════════════════════════════════════════
-- 生活サービス系の職種を追加し、「物流・運輸」を大分類として新設する
--
-- ── なぜ（2026-08-12）──────────────────────────────────────────────────────
-- 経歴入力で「全てのキャリアを入れられる」ようにするため。
-- 実測で、美容師・調理飲食・ドライバー配送・警備清掃に**相当する職種が
-- 4つとも存在せず**、関連語も既存143職種のどこにも無かった（0ヒット）。
-- 非IT7大分類の配下は28件しかなく、対面サービスと物流が丸ごと抜けていた。
--
-- ── なぜ「物流・運輸」だけ大分類を新設するか ────────────────────────────────
-- 当初は9職種すべてを「販売・サービス」配下に置く案だったが、
-- **「販売・サービス」は対面サービスを指す**ので、トラックドライバーを入れると
-- 遷移の集計（A社→B社）で起点が誤って記録される。
-- 大分類を1つ増やすコストのほうが小さいと判断した。
--
-- ⚠️ 「公務・その他」には**子を作らない**。「その他公務・その他」という名前になり
--    読めないため、大分類名そのものを受け皿にしてある
--    （20260807101949 に理由が明記されている）。意図的な設計なので触らない。
--    ただし**末尾に残すため display_order だけ 17 → 18 に動かす**。
--
-- ── display_order の規則（実測で17大分類すべてに成立）────────────────────────
--   通常の子   … 1 から連番
--   「その他◯◯」… **通常の子の最大 + 10**
--     例: エンジニア 通常max16 → その他26 / 営業 13 → 23 / 販売・サービス 3 → 13
--
-- ⚠️ 販売・サービスに5件足すと通常max が 3 → 8 になるので、
--    規則を保つため **その他販売・サービス を 13 → 18 に UPDATE する**。
--    これは「既存データを触らない」の例外として承認済み（display_order のみ）。
--    事後チェックで**全17+1大分類**について規則が成立することを機械的に検証する。
--
-- ⚠️ 追加した職種の値は指示にあったものだけ。勝手に増やしていない。
--    is_it_saas = false（非IT）。level = 2（子）。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_roots int; v_roles int; v_alias int; v_dup int; v_conf int; v_names text;
BEGIN
  SELECT count(*) INTO v_roots FROM public.ow_roles WHERE parent_id IS NULL;
  IF v_roots <> 17 THEN RAISE EXCEPTION '大分類が % 件（想定17）。中止', v_roots; END IF;

  SELECT count(*) INTO v_roles FROM public.ow_roles;
  IF v_roles <> 143 THEN RAISE EXCEPTION 'ow_roles が % 件（想定143）。中止', v_roles; END IF;

  SELECT count(*) INTO v_alias FROM public.ow_role_aliases;
  IF v_alias <> 227 THEN RAISE EXCEPTION 'ow_role_aliases が % 件（想定227）。中止', v_alias; END IF;

  -- 適用前に別名の重複が無いこと
  SELECT count(*) INTO v_dup FROM (
    SELECT alias FROM public.ow_role_aliases GROUP BY alias HAVING count(*) > 1) d;
  IF v_dup <> 0 THEN RAISE EXCEPTION '適用前に別名の重複が % 件ある。中止', v_dup; END IF;

  -- 「物流・運輸」がまだ無いこと
  IF EXISTS (SELECT 1 FROM public.ow_roles WHERE slug = 'logistics-transport' OR name = '物流・運輸') THEN
    RAISE EXCEPTION '「物流・運輸」が既にある。中止';
  END IF;

  -- ⚠️ 追加する slug / 名前 / 別名が既存とぶつからないこと（投入直前の再突合）
  SELECT count(*), string_agg(DISTINCT x, ', ') INTO v_conf, v_names
    FROM (
      SELECT r.slug AS x FROM public.ow_roles r
       WHERE r.slug IN ('hairdresser','barber','beauty-therapist','chef','restaurant-service',
                        'driver','logistics','other-logistics-transport','security-guard','cleaning')
      UNION ALL
      SELECT r.name FROM public.ow_roles r
       WHERE r.name IN ('美容師','理容師','エステティシャン・ネイリスト','調理・製菓',
                        'ホール・接客（飲食）','ドライバー・配送','倉庫・物流管理','警備','清掃・ビルメンテナンス')
      UNION ALL
      SELECT a.alias FROM public.ow_role_aliases a
       WHERE a.alias IN ('ヘアスタイリスト','スタイリスト','美容室','床屋','バーバー','エステ','ネイリスト',
                         'セラピスト','まつげエクステ','調理師','シェフ','料理人','パティシエ','板前',
                         '飲食店ホール','ウェイター','ウェイトレス','サービススタッフ','運転手','配送員',
                         'トラックドライバー','タクシードライバー','宅配','物流','倉庫管理','入出荷',
                         'ピッキング','警備員','ガードマン','清掃員','ビルメン','ハウスクリーニング','設備管理')
    ) t;
  IF v_conf <> 0 THEN RAISE EXCEPTION '追加しようとした値が既存と衝突する（% 件: %）。中止', v_conf, v_names; END IF;

  RAISE NOTICE '適用前: 大分類 % / 職種 % / 別名 % / 重複 0 / 衝突 0', v_roots, v_roles, v_alias;
END $$;

-- ═══ ① 「公務・その他」を末尾へ退ける（display_order のみ）══════════════════
-- ⚠️ 中身は触らない。新しい大分類を 17 に入れるための場所空け。
UPDATE public.ow_roles SET display_order = 18
 WHERE parent_id IS NULL AND slug = 'other' AND display_order = 17;

-- ═══ ② 大分類「物流・運輸」を新設 ══════════════════════════════════════════
INSERT INTO public.ow_roles (id, parent_id, name, slug, level, display_order, is_it_saas, is_active)
VALUES (gen_random_uuid(), NULL, '物流・運輸', 'logistics-transport', 1, 17, false, true);

-- ═══ ③ 子職種の追加 ═══════════════════════════════════════════════════════
-- ⚠️ parent は slug から引く。手打ち UUID を使わない（引けなければ0行になり事後チェックで気づける）。
INSERT INTO public.ow_roles (name, slug, parent_id, level, is_active, is_it_saas, display_order)
SELECT v.name, v.slug, p.id, 2, true, false, v.ord
  FROM (VALUES
    -- ── 販売・サービス（対面サービス）: 通常max 3 → 8
    ('retail-service',      '美容師',                     'hairdresser',        4),
    ('retail-service',      '理容師',                     'barber',             5),
    ('retail-service',      'エステティシャン・ネイリスト', 'beauty-therapist',   6),
    ('retail-service',      '調理・製菓',                 'chef',               7),
    ('retail-service',      'ホール・接客（飲食）',        'restaurant-service', 8),
    -- ── 物流・運輸（新設）: 通常max 2
    ('logistics-transport', 'ドライバー・配送',            'driver',             1),
    ('logistics-transport', '倉庫・物流管理',              'logistics',          2)
  ) AS v(parent_slug, name, slug, ord)
  JOIN public.ow_roles p ON p.slug = v.parent_slug AND p.parent_id IS NULL;

-- ⚠️ 警備・清掃も「販売・サービス」配下ではなく対面サービスとして置く。
--    施設側の職種だが、建設・不動産（設計/施工/売買）には運営職が無いため。
INSERT INTO public.ow_roles (name, slug, parent_id, level, is_active, is_it_saas, display_order)
SELECT v.name, v.slug, p.id, 2, true, false, v.ord
  FROM (VALUES
    ('警備',                'security-guard',  9),
    ('清掃・ビルメンテナンス', 'cleaning',       10)
  ) AS v(name, slug, ord)
  JOIN public.ow_roles p ON p.slug = 'retail-service' AND p.parent_id IS NULL;

-- ═══ ④ 「その他物流・運輸」を規則どおり作る（通常max + 10）════════════════
INSERT INTO public.ow_roles (name, slug, parent_id, level, is_active, is_it_saas, display_order)
SELECT 'その他' || p.name, 'other-logistics-transport', p.id, 2, true, p.is_it_saas,
       coalesce((SELECT max(c.display_order) FROM public.ow_roles c WHERE c.parent_id = p.id), 0) + 10
  FROM public.ow_roles p
 WHERE p.slug = 'logistics-transport' AND p.parent_id IS NULL;

-- ═══ ⑤ 「その他販売・サービス」を規則に戻す（13 → 18）═══════════════════════
-- ⚠️ display_order のみの UPDATE。通常max が 3 → 10 に増えたため。
UPDATE public.ow_roles c
   SET display_order = (
     SELECT max(x.display_order) + 10 FROM public.ow_roles x
      WHERE x.parent_id = c.parent_id AND x.slug <> 'other-retail-service')
 WHERE c.slug = 'other-retail-service';

-- ═══ ⑥ 別名 ═══════════════════════════════════════════════════════════════
-- ⚠️ role_id は名前から引く。手打ちUUIDは使わない。
INSERT INTO public.ow_role_aliases (role_id, alias)
SELECT r.id, v.alias
  FROM (VALUES
    ('美容師','ヘアスタイリスト'), ('美容師','スタイリスト'), ('美容師','美容室'),
    ('理容師','床屋'), ('理容師','バーバー'),
    ('エステティシャン・ネイリスト','エステ'),
    ('エステティシャン・ネイリスト','ネイリスト'),
    ('エステティシャン・ネイリスト','セラピスト'),
    ('エステティシャン・ネイリスト','まつげエクステ'),
    ('調理・製菓','調理師'), ('調理・製菓','シェフ'), ('調理・製菓','料理人'),
    ('調理・製菓','パティシエ'), ('調理・製菓','板前'),
    ('ホール・接客（飲食）','飲食店ホール'), ('ホール・接客（飲食）','ウェイター'),
    ('ホール・接客（飲食）','ウェイトレス'), ('ホール・接客（飲食）','サービススタッフ'),
    ('ドライバー・配送','運転手'), ('ドライバー・配送','配送員'),
    ('ドライバー・配送','トラックドライバー'), ('ドライバー・配送','タクシードライバー'),
    ('ドライバー・配送','宅配'),
    ('倉庫・物流管理','物流'), ('倉庫・物流管理','倉庫管理'),
    ('倉庫・物流管理','入出荷'), ('倉庫・物流管理','ピッキング'),
    ('警備','警備員'), ('警備','ガードマン'),
    ('清掃・ビルメンテナンス','清掃員'), ('清掃・ビルメンテナンス','ビルメン'),
    ('清掃・ビルメンテナンス','ハウスクリーニング'), ('清掃・ビルメンテナンス','設備管理')
  ) AS v(role_name, alias)
  JOIN public.ow_roles r ON r.name = v.role_name AND r.parent_id IS NOT NULL;

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_roots int; v_roles int; v_alias int; v_dup int; v_bad int; v_names text;
  v_kumu int; v_lv3 int; v_last int;
BEGIN
  -- ① 大分類が18件、「物流・運輸」が1件
  SELECT count(*) INTO v_roots FROM public.ow_roles WHERE parent_id IS NULL;
  IF v_roots <> 18 THEN RAISE EXCEPTION '大分類が % 件（想定18）。ロールバック', v_roots; END IF;
  IF (SELECT count(*) FROM public.ow_roles WHERE slug='logistics-transport' AND parent_id IS NULL) <> 1 THEN
    RAISE EXCEPTION '「物流・運輸」が作られていない。ロールバック';
  END IF;

  -- ② 職種が 143 + 10（子）+ 1（新大分類）= 154
  SELECT count(*) INTO v_roles FROM public.ow_roles;
  IF v_roles <> 154 THEN RAISE EXCEPTION 'ow_roles が % 件（想定154）。ロールバック', v_roles; END IF;

  -- ③ 別名が 227 + 33 = 260、重複なし
  SELECT count(*) INTO v_alias FROM public.ow_role_aliases;
  IF v_alias <> 260 THEN RAISE EXCEPTION '別名が % 件（想定260）。ロールバック', v_alias; END IF;
  SELECT count(*) INTO v_dup FROM (
    SELECT alias FROM public.ow_role_aliases GROUP BY alias HAVING count(*) > 1) d;
  IF v_dup <> 0 THEN RAISE EXCEPTION '別名の重複が % 件できた。ロールバック', v_dup; END IF;

  -- ④ ⚠️ **「その他◯◯ = 通常の子の最大 + 10」が全大分類で成立すること**
  SELECT count(*), string_agg(p.name, ', ') INTO v_bad, v_names
    FROM public.ow_roles p
    JOIN public.ow_roles o ON o.parent_id = p.id AND o.name = 'その他' || p.name
   WHERE p.parent_id IS NULL
     AND o.display_order <> (
       SELECT max(c.display_order) + 10 FROM public.ow_roles c
        WHERE c.parent_id = p.id AND c.id <> o.id);
  IF v_bad <> 0 THEN
    RAISE EXCEPTION '「その他+10」の規則が崩れた大分類が % 件（%）。ロールバック', v_bad, v_names;
  END IF;

  -- ⑤ ⚠️ **「その他◯◯」が必ず配下の末尾にいること**（+10 規則の実効確認）
  SELECT count(*), string_agg(p.name, ', ') INTO v_bad, v_names
    FROM public.ow_roles p
    JOIN public.ow_roles o ON o.parent_id = p.id AND o.name = 'その他' || p.name
   WHERE p.parent_id IS NULL
     AND EXISTS (SELECT 1 FROM public.ow_roles c
                  WHERE c.parent_id = p.id AND c.id <> o.id
                    AND c.display_order >= o.display_order);
  IF v_bad <> 0 THEN
    RAISE EXCEPTION '「その他」が末尾でない大分類が % 件（%）。ロールバック', v_bad, v_names;
  END IF;

  -- ⑥ ⚠️ 「公務・その他」が大分類の末尾にいること（display_order を動かした確認）
  SELECT max(display_order) INTO v_last FROM public.ow_roles WHERE parent_id IS NULL;
  IF (SELECT display_order FROM public.ow_roles WHERE slug='other' AND parent_id IS NULL) <> v_last THEN
    RAISE EXCEPTION '「公務・その他」が大分類の末尾にいない。ロールバック';
  END IF;

  -- ⑦ 「公務・その他」に子を作っていないこと（意図的な設計を壊していない）
  SELECT count(*) INTO v_kumu FROM public.ow_roles c
    JOIN public.ow_roles p ON p.id = c.parent_id WHERE p.slug = 'other';
  IF v_kumu <> 0 THEN RAISE EXCEPTION '「公務・その他」に子が % 件できている。ロールバック', v_kumu; END IF;

  -- ⑧ 3階層になっていないこと
  SELECT count(*) INTO v_lv3 FROM public.ow_roles c
    JOIN public.ow_roles p ON p.id = c.parent_id WHERE p.parent_id IS NOT NULL;
  IF v_lv3 <> 0 THEN RAISE EXCEPTION '3階層が % 件できている。ロールバック', v_lv3; END IF;

  -- ⑨ 追加分がすべて is_it_saas = false / is_active = true
  SELECT count(*) INTO v_bad FROM public.ow_roles
   WHERE slug IN ('logistics-transport','hairdresser','barber','beauty-therapist','chef',
                  'restaurant-service','driver','logistics','other-logistics-transport',
                  'security-guard','cleaning')
     AND (is_it_saas IS DISTINCT FROM false OR is_active IS DISTINCT FROM true);
  IF v_bad <> 0 THEN RAISE EXCEPTION '追加分に is_it_saas/is_active の誤りが % 件。ロールバック', v_bad; END IF;

  -- ⑩ 既存の職種・別名を消していないこと（143→154 / 227→260 は上で確認済み）
  --    ここでは「既存の大分類17件が全部残っている」ことを名前で確認する
  SELECT count(*) INTO v_bad FROM (VALUES
    ('エンジニア'),('カスタマーサクセス'),('コーポレート'),('データ・AI'),('デザイナー'),
    ('プロダクト'),('マーケティング'),('事業開発'),('公務・その他'),('医療・介護・福祉'),
    ('営業'),('建設・不動産'),('教育・研究'),('経営・CxO'),('製造・技術'),
    ('販売・サービス'),('金融・保険')
  ) AS v(n)
  WHERE NOT EXISTS (SELECT 1 FROM public.ow_roles r WHERE r.parent_id IS NULL AND r.name = v.n);
  IF v_bad <> 0 THEN RAISE EXCEPTION '既存の大分類が % 件消えている。ロールバック', v_bad; END IF;

  RAISE NOTICE '完了: 大分類 %（物流・運輸を新設、公務・その他は末尾）/ 職種 % / 別名 %（重複0）/ 「その他+10」全大分類で成立',
    v_roots, v_roles, v_alias;
END $$;

COMMIT;
