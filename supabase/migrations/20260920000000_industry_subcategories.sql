-- ═══════════════════════════════════════════════════════════════════════════
-- 業種の小分類を6つの大分類に足す（2026-09-20 / 柴さんの指示）
--
-- ── なぜ要るか ───────────────────────────────────────────────────────────
-- この選択肢は **`CompanyCreateDialog`**（オンボーディング step2 と職歴エディタ）が
-- 出しているもので、**利用者が自分の勤務先を企業マスタに登録するときの入力**。
-- 書き込み先は `ow_companies.industry_id`。
-- 実測（2026-09-20 / is_test を除く）で **IT・ソフトウェアに85社（掲載中22社）が集中**
-- しており、小分類が無いと分類のしようがなかった。小分類があったのは製造業だけ。
--
-- ⚠️★**「0件の選択肢を出さない」原則はここに当てない。**
--    あれは**掲載企業の分類**（`/companies` のチップ）に対する規則。ここは
--    **本人が自分の勤務先を分類する入力**で、選択肢が無いと正しく入力できない。
--    CLAUDE.md の都道府県・フェーズ・事業領域チップと同じ「例外」側。
--
-- ⚠️★**3階層にしない。** `<optgroup>` は入れ子にできず、業種の `<select>` を使う
--    3画面（/biz/companies/add/new・/biz/company・/admin/companies/[id]）が壊れる。
--    **大分類→小分類の2階層のまま値を増やすだけ。**
--
-- ⚠️★**`requires_business_domain` は親から引き継がれない。**
--    `lib/companies/publishable.ts` は**その企業の業種の列だけ**を見る（祖先を辿らない）。
--    IT・ソフトウェアは true なので、**子を false で作ると
--    「IT系なのに事業領域なしで公開できる」抜け道**ができる。
--    → **IT の子は全部 true。** 他の大分類の子は親に合わせて false。
--
-- ⚠️ slug はグローバル UNIQUE。**親の slug を前置き**して衝突を避ける。
-- ⚠️ `display_order` は**親ごとの相対順**（CLAUDE.md）。1 から振り直す。
-- ⚠️ 「顧客の業界」（`ow_company_target_industries`）の選択肢は
--    **実際に紐づいた業種だけ**から作られる（`fetchAvailableTargetIndustries`）ので、
--    ここで足しても勝手には出てこない。出したい日に運営が紐づける。
-- ⚠️ 既存の値は**1行も触らない**（物理削除もしない。FK は ON DELETE RESTRICT）。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前アサート。1つでも前提が崩れていたら中止する ──────────────────────
DO $$
DECLARE v int;
BEGIN
  -- ① 親6件が有効な大分類として実在すること
  SELECT count(*) INTO v FROM public.ow_industries
   WHERE parent_id IS NULL AND is_active
     AND slug IN ('it-software','finance-insurance','retail-distribution',
                  'media-advertising-entertainment','hr-services','consulting');
  IF v <> 6 THEN RAISE EXCEPTION '親の大分類が6件ない（実際 %）。中止', v; END IF;

  -- ② IT・ソフトウェアが requires_business_domain = true であること
  --    （子に引き継ぐ値の根拠。false になっていたら前提が変わっている）
  SELECT count(*) INTO v FROM public.ow_industries
   WHERE slug = 'it-software' AND requires_business_domain;
  IF v <> 1 THEN RAISE EXCEPTION 'it-software の requires_business_domain が true でない。中止'; END IF;

  -- ③ ★「全件」と「掲載中」の両方で、いまの分布が想定どおりであること
  SELECT count(*) INTO v FROM public.ow_companies c
    JOIN public.ow_industries i ON i.id = c.industry_id
   WHERE i.slug = 'it-software' AND c.is_test = false;
  IF v <> 85 THEN RAISE EXCEPTION 'IT・ソフトウェアの企業数が85でない（実際 %）。中止', v; END IF;

  SELECT count(*) INTO v FROM public.ow_companies c
    JOIN public.ow_industries i ON i.id = c.industry_id
   WHERE i.slug = 'it-software' AND c.is_test = false AND c.listing_status = 'listed';
  IF v <> 22 THEN RAISE EXCEPTION 'IT・ソフトウェアの掲載中が22でない（実際 %）。中止', v; END IF;

  -- ④ 小分類を持つ大分類が製造業だけであること（足す前の状態）
  SELECT count(DISTINCT parent_id) INTO v FROM public.ow_industries WHERE parent_id IS NOT NULL;
  IF v <> 1 THEN RAISE EXCEPTION '小分類を持つ大分類が1つでない（実際 %）。中止', v; END IF;

  RAISE NOTICE '事前アサート通過: 親6件 / it-software rbd=true / 全件85・掲載中22 / 小分類を持つ親は1つ';
END $$;

-- ── 追加 ─────────────────────────────────────────────────────────────────
-- ⚠️ 親の slug から id を引く。**id を直書きしない**（環境で変わる）。
INSERT INTO public.ow_industries (slug, name, parent_id, display_order, is_active, requires_business_domain)
SELECT x.slug, x.name, p.id, x.ord, true, x.rbd
  FROM (VALUES
    -- IT・ソフトウェア（★子も requires_business_domain = true）
    ('it-software','it-software-saas',            'SaaS・業務システム',     1, true),
    ('it-software','it-software-internet',        'インターネットサービス',  2, true),
    ('it-software','it-software-sier',            '受託開発・SIer',         3, true),
    ('it-software','it-software-digital-mkt',     'デジタルマーケティング',  4, true),
    ('it-software','it-software-hardware',        'ハードウェア・デバイス',  5, true),
    ('it-software','it-software-ai-data',         'AI・データ',             6, true),
    ('it-software','it-software-other',           'その他IT',               7, true),
    -- 金融・保険
    ('finance-insurance','finance-bank',          '銀行・信金',             1, false),
    ('finance-insurance','finance-securities',    '証券・投資',             2, false),
    ('finance-insurance','finance-insurance-sub', '保険',                   3, false),
    ('finance-insurance','finance-fintech',       'フィンテック',           4, false),
    ('finance-insurance','finance-other',         'その他金融',             5, false),
    -- 小売・流通
    ('retail-distribution','retail-ec',           'EC・ネット通販',         1, false),
    ('retail-distribution','retail-store',        '小売店舗',               2, false),
    ('retail-distribution','retail-wholesale',    '卸売・商社機能',         3, false),
    ('retail-distribution','retail-other',        'その他小売',             4, false),
    -- メディア・広告・エンタメ
    ('media-advertising-entertainment','media-ad-agency',  '広告代理店',    1, false),
    ('media-advertising-entertainment','media-publishing', 'メディア・出版', 2, false),
    ('media-advertising-entertainment','media-game',       'ゲーム',        3, false),
    ('media-advertising-entertainment','media-entertainment','エンタメ・映像・音楽', 4, false),
    ('media-advertising-entertainment','media-other',      'その他メディア', 5, false),
    -- 人材サービス
    ('hr-services','hr-agency',                   '人材紹介',               1, false),
    ('hr-services','hr-dispatch',                 '人材派遣',               2, false),
    ('hr-services','hr-media-tech',               '求人媒体・HRTech',       3, false),
    ('hr-services','hr-other',                    'その他人材',             4, false),
    -- コンサルティング
    ('consulting','consulting-strategy',          '戦略・経営',             1, false),
    ('consulting','consulting-it',                'IT・システム',           2, false),
    ('consulting','consulting-professional',      '会計・税務・法務',       3, false),
    ('consulting','consulting-other',             'その他コンサル',         4, false)
  ) AS x(parent_slug, slug, name, ord, rbd)
  JOIN public.ow_industries p ON p.slug = x.parent_slug AND p.parent_id IS NULL;

-- ── 事後アサート ─────────────────────────────────────────────────────────
DO $$
DECLARE v int; w int;
BEGIN
  SELECT count(*) INTO v FROM public.ow_industries WHERE parent_id IS NOT NULL;
  IF v <> 33 THEN RAISE EXCEPTION '小分類が33件でない（製造業4＋今回29／実際 %）。中止', v; END IF;

  -- ★IT の子が全部 requires_business_domain = true であること（公開ゲートの抜け道を作らない）
  SELECT count(*) INTO v FROM public.ow_industries c
    JOIN public.ow_industries p ON p.id = c.parent_id
   WHERE p.slug = 'it-software' AND NOT c.requires_business_domain;
  IF v <> 0 THEN RAISE EXCEPTION 'IT の子に requires_business_domain=false が % 件ある。中止', v; END IF;

  -- 既存の企業の割り当ては1件も動いていないこと（全件・掲載中の両方）
  SELECT count(*) INTO v FROM public.ow_companies c
    JOIN public.ow_industries i ON i.id = c.industry_id
   WHERE i.slug = 'it-software' AND c.is_test = false;
  SELECT count(*) INTO w FROM public.ow_companies c
    JOIN public.ow_industries i ON i.id = c.industry_id
   WHERE i.slug = 'it-software' AND c.is_test = false AND c.listing_status = 'listed';
  IF v <> 85 OR w <> 22 THEN RAISE EXCEPTION '既存の割り当てが動いた（全件 % / 掲載中 %）。中止', v, w; END IF;

  RAISE NOTICE '適用後: 小分類 33件 / IT の子は全部 rbd=true / 既存の割り当ては 85・22 のまま';
END $$;

COMMIT;
