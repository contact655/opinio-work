-- ═══════════════════════════════════════════════════════════════════════════
-- 別名の是正（前回投入分の差し戻し）＋ 英語の正式名を46件追加
--
-- ── なぜ（2026-08-07）──────────────────────────────────────────────────────
-- 20260807080000 / 20260807090000 で入れた内容のうち、
-- **判断が変わった4点**を戻す。あわせて英語の正式名を足す。
--
-- ① 「カスタマーサクセス」「事業開発」の別名を**復活させる**
--    大分類名が子職種の別名にもなっている状態を消したが、
--    粗い希望（大分類）と具体的な希望（子職種）の両方を拾えるのは**正しい挙動**。
--    ⚠️ 「重複」は2種類ある。取り違えないこと。
--       (a) 同じ alias が2つの職種に付く      … **常に0件**が不変条件
--       (b) alias が有効な職種の正式名と一致  … この2件だけ意図的に許す
--
-- ② 意味の広すぎる別名3件を**削除する**（機械的な文字列一致では弾けなかったもの）
--    COO ←「執行役員（事業）」  … 「取締役・執行役員」と紛れる
--    CRO ←「営業責任者」        … 広すぎる。営業配下のどの職種にも読める
--    SEO・SEM ←「Webマーケティング」… 「デジタルマーケティング」と紛れる
--
-- ③ 「テクニカルサポート」の付け先を移す
--    カスタマーサポート（CS配下）の別名だったが、
--    エンジニア配下に「テクニカルサポート・運用」という**正式職種が実在する**。
--    正式名が存在する語を別の職種の別名にしておくのは矛盾。
--
-- ④ 英語の正式名を46件追加
--    実データ（ow_experiences.role_title）に英語表記が入っており、
--    外資系・SaaS の求人票は英語のことが多い。
--    ⚠️ 「Site Reliability Engineer」は既に SRE/インフラ の別名なので入れない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_alias int; v_remove int; v_ts int;
BEGIN
  SELECT count(*) INTO v_alias FROM public.ow_role_aliases;
  IF v_alias <> 182 THEN RAISE EXCEPTION 'ow_role_aliases が % 件（想定182）。中止', v_alias; END IF;

  -- 削除対象3件がそれぞれ想定の職種に付いていること
  SELECT count(*) INTO v_remove FROM public.ow_role_aliases a JOIN public.ow_roles r ON r.id=a.role_id
   WHERE (a.alias='執行役員（事業）'   AND r.name='COO')
      OR (a.alias='営業責任者'         AND r.name='CRO')
      OR (a.alias='Webマーケティング' AND r.name='SEO・SEM');
  IF v_remove <> 3 THEN RAISE EXCEPTION '削除対象が % 件（想定3）。中止', v_remove; END IF;

  -- 「テクニカルサポート」が カスタマーサポート に1件だけ付いていること
  SELECT count(*) INTO v_ts FROM public.ow_role_aliases a JOIN public.ow_roles r ON r.id=a.role_id
   WHERE a.alias='テクニカルサポート' AND r.name='カスタマーサポート';
  IF v_ts <> 1 THEN RAISE EXCEPTION 'テクニカルサポートの付け先が想定と違う。中止'; END IF;

  -- 移設先の職種が存在すること
  IF NOT EXISTS (SELECT 1 FROM public.ow_roles WHERE name='テクニカルサポート・運用' AND is_active) THEN
    RAISE EXCEPTION '「テクニカルサポート・運用」が無い。中止';
  END IF;

  RAISE NOTICE '適用前: 別名 % 件 / 削除3件 / 移設1件', v_alias;
END $$;

-- ── ① 大分類名の別名を復活（意図的な重複）──────────────────────────────────
INSERT INTO public.ow_role_aliases (role_id, alias)
SELECT r.id, v.alias
  FROM (VALUES
    ('カスタマーサクセスマネージャー（CSM）','カスタマーサクセス'),
    ('事業開発（BizDev）','事業開発')
  ) AS v(role_name, alias)
  JOIN public.ow_roles r ON r.name = v.role_name AND r.is_active;

-- ── ② 意味の広すぎる別名を削除 ──────────────────────────────────────────────
DELETE FROM public.ow_role_aliases a USING public.ow_roles r
 WHERE r.id = a.role_id
   AND ((a.alias='執行役員（事業）'   AND r.name='COO')
     OR (a.alias='営業責任者'         AND r.name='CRO')
     OR (a.alias='Webマーケティング' AND r.name='SEO・SEM'));

-- ── ③ 「テクニカルサポート」を正式職種のほうへ移す ──────────────────────────
UPDATE public.ow_role_aliases a
   SET role_id = (SELECT id FROM public.ow_roles WHERE name='テクニカルサポート・運用' AND is_active)
  FROM public.ow_roles r
 WHERE r.id = a.role_id AND a.alias='テクニカルサポート' AND r.name='カスタマーサポート';

-- ── ④ 英語の正式名（衝突チェック済み46件）──────────────────────────────────
INSERT INTO public.ow_role_aliases (role_id, alias)
SELECT r.id, v.alias
  FROM (VALUES
    ('フィールドセールス','Field Sales'), ('インサイドセールス','Inside Sales'),
    ('BDR（新規開拓・アウトバウンド）','Business Development Representative'),
    ('アカウントマネージャー','Account Manager'),
    ('パートナーセールス・アライアンス','Partner Sales'),
    ('ソリューションエンジニア・プリセールス','Solutions Engineer'),
    ('ソリューションアーキテクト','Solutions Architect'),
    ('営業企画・Sales Ops','Sales Operations'),
    ('カスタマーサクセスマネージャー（CSM）','Customer Success Manager'),
    ('カスタマーサポート','Customer Support'),
    ('オンボーディングスペシャリスト','Onboarding Specialist'),
    ('テクニカルアカウントマネージャー（TAM）','Technical Account Manager'),
    ('リニューアルマネージャー','Renewal Manager'),
    ('CS Ops','Customer Success Operations'),
    ('プロダクトマネージャー','Product Manager'), ('PMM','Product Marketing Manager'),
    ('プロジェクトマネージャー','Project Manager'), ('グロースPM','Growth Product Manager'),
    ('テクニカルPM','Technical Product Manager'), ('UXリサーチャー','UX Researcher'),
    ('プロダクトデザイナー','Product Designer'), ('UI/UXデザイナー','UI/UX Designer'),
    ('Webデザイナー','Web Designer'), ('グラフィックデザイナー','Graphic Designer'),
    ('データサイエンティスト','Data Scientist'), ('データエンジニア','Data Engineer'),
    ('データアナリスト','Data Analyst'), ('AI・機械学習エンジニア','Machine Learning Engineer'),
    ('アナリティクスエンジニア','Analytics Engineer'),
    ('AIプロダクトマネージャー','AI Product Manager'),
    ('バックエンド','Backend Engineer'), ('フロントエンド','Frontend Engineer'),
    ('フルスタック','Full Stack Engineer'),
    ('QA/テストエンジニア','QA Engineer'), ('セキュリティエンジニア','Security Engineer'),
    ('エンジニアリングマネージャー','Engineering Manager'), ('テックリード・アーキテクト','Tech Lead'),
    ('デジタルマーケティング','Digital Marketing'), ('コンテンツマーケティング','Content Marketing'),
    ('マーケティングオペレーション','Marketing Operations'),
    ('採用','Recruiter'), ('HRBP','HR Business Partner'),
    ('経理・財務','Finance'), ('法務・コンプライアンス','Legal'),
    ('経営企画・経営戦略','Corporate Strategy'), ('RevOps','Revenue Operations')
  ) AS v(role_name, alias)
  JOIN public.ow_roles r ON r.name = v.role_name AND r.is_active;

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_alias int; v_dup text; v_ts int; v_gone int; v_roles int;
BEGIN
  -- 182 + 2（復活）- 3（削除）+ 46（英語）= 227
  SELECT count(*) INTO v_alias FROM public.ow_role_aliases;
  IF v_alias <> 227 THEN RAISE EXCEPTION '別名が % 件（想定227）。ロールバック', v_alias; END IF;

  /* ⚠️ ここでいう「重複」は2種類ある。取り違えないこと。
        (a) 同じ alias が2つの職種に付く … **常に0件**でなければならない
        (b) alias が有効な職種の正式名と一致 … 「カスタマーサクセス」「事業開発」の
            2件だけ意図的に許す（大分類でも子職種でも拾えるようにするため） */

  -- (a) 同じ alias が2つの職種に付いていないこと
  SELECT string_agg(alias, ', ') INTO v_dup FROM (
    SELECT alias FROM public.ow_role_aliases GROUP BY alias HAVING count(*) > 1) d;
  IF v_dup IS NOT NULL THEN
    RAISE EXCEPTION '同じ別名が複数の職種に付いている（%）。ロールバック', v_dup;
  END IF;

  -- (b) 職種の正式名と一致する別名は、意図した2件だけであること
  SELECT string_agg(a.alias, ', ') INTO v_dup
    FROM public.ow_role_aliases a JOIN public.ow_roles rn ON rn.name = a.alias
   WHERE rn.id <> a.role_id AND rn.is_active
     AND a.alias NOT IN ('カスタマーサクセス','事業開発');
  IF v_dup IS NOT NULL THEN
    RAISE EXCEPTION '意図しない「正式名と同じ別名」がある（%）。ロールバック', v_dup;
  END IF;
  IF (SELECT count(*) FROM public.ow_role_aliases a JOIN public.ow_roles rn ON rn.name = a.alias
       WHERE rn.id <> a.role_id AND rn.is_active) <> 2 THEN
    RAISE EXCEPTION '意図した2件（カスタマーサクセス / 事業開発）が揃っていない。ロールバック';
  END IF;

  -- 削除3件が消えたこと
  SELECT count(*) INTO v_gone FROM public.ow_role_aliases
   WHERE alias IN ('執行役員（事業）','営業責任者','Webマーケティング');
  IF v_gone <> 0 THEN RAISE EXCEPTION '削除対象が % 件残っている。ロールバック', v_gone; END IF;

  -- テクニカルサポートが移設先に1件だけ付いていること
  SELECT count(*) INTO v_ts FROM public.ow_role_aliases a JOIN public.ow_roles r ON r.id=a.role_id
   WHERE a.alias='テクニカルサポート' AND r.name='テクニカルサポート・運用';
  IF v_ts <> 1 THEN RAISE EXCEPTION 'テクニカルサポートの移設に失敗。ロールバック'; END IF;
  IF EXISTS (SELECT 1 FROM public.ow_role_aliases a JOIN public.ow_roles r ON r.id=a.role_id
              WHERE a.alias='テクニカルサポート' AND r.name='カスタマーサポート') THEN
    RAISE EXCEPTION 'テクニカルサポートが移設元に残っている。ロールバック';
  END IF;

  -- 職種は触っていないこと
  SELECT count(*) INTO v_roles FROM public.ow_roles;
  IF v_roles <> 105 THEN RAISE EXCEPTION 'ow_roles が % 件（想定105）。ロールバック', v_roles; END IF;

  RAISE NOTICE '完了: 別名 % 件 / 意図した重複2件のみ / テクニカルサポートを移設 / ow_roles % 件は変更なし',
    v_alias, v_roles;
END $$;

COMMIT;
