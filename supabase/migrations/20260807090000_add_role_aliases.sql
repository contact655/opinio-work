-- ═══════════════════════════════════════════════════════════════════════════
-- 別名を64件追加する（英語表記3件 ＋ 別名0件だった子職種31件への追加61件）
--
-- ── なぜ（2026-08-07）──────────────────────────────────────────────────────
-- 職種マスタ105件のうち、**別名を持つのは53職種だけ**だった。
-- 統合で件数を減らしても選びやすさは変わらないが、別名が増えれば検索で当たる。
-- 105件から目視で探すUIは 2026-08-06 に RoleSearchSelect へ置き換え済みで、
-- **いま辿り着けない原因は件数ではなく「正式名を知らないと検索に当たらない」こと。**
--
-- ── ⚠️ 別名の重複を作らないこと ──────────────────────────────────────────────
-- 同じ alias が2つの職種に付くと、検索上「同じもの」になり、
-- 統合すべきかの判断ができなくなる。2026-08-07 時点で重複は0件。
-- 事後チェックで0件を維持していることを確認する。
--
-- 提案から外したもの（衝突していたため）:
--   「テクニカルサポート」→ エンジニア配下の「テクニカルサポート・運用」に付けない。
--      既に CS 配下の「カスタマーサポート」の別名。どちらの職種に属させるかを
--      先に決める必要がある（今回は保留）
--   「インフラエンジニア」→「データベース・ネットワーク」に付けない。
--      既に「SRE/インフラ」の別名
--   「事業推進」「経営企画（事業）」→「事業企画」に付けない。
--      前者は既に「RevOps」の別名、後者は「経営企画・経営戦略」と紛らわしい。
--      代わりに「事業戦略」「事業計画」を入れた
--
-- ── 英語表記3件の根拠（ow_experiences.role_title に実在した値）──────────────
--   Account Executive               … 1件
--   Enterprise Account Executive    … 2件
--   Sales Development Representative … 1件（"Sales Development Representative（SDR）"）
-- ⚠️ SDR と BDR を取り違えないこと。SDR = Sales Development Representative（反響）、
--    BDR = Business Development Representative（新規開拓）。
--    既存の別名も SDR 側に「反響営業」、BDR 側に「新規開拓営業」で分かれている。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_alias int; v_dup int;
BEGIN
  SELECT count(*) INTO v_alias FROM public.ow_role_aliases;
  IF v_alias <> 118 THEN RAISE EXCEPTION 'ow_role_aliases が % 件（想定118）。中止', v_alias; END IF;

  SELECT count(*) INTO v_dup FROM (
    SELECT alias FROM public.ow_role_aliases GROUP BY alias HAVING count(*) > 1) d;
  IF v_dup <> 0 THEN RAISE EXCEPTION '適用前に別名の重複が % 件ある。中止', v_dup; END IF;

  RAISE NOTICE '適用前: 別名 % 件 / 重複 0 件', v_alias;
END $$;

-- ── 追加 ────────────────────────────────────────────────────────────────────
-- ⚠️ role_id は名前から引く。手打ちUUIDは使わない。
--    名前が1件も引けなければ INSERT が0行になるので、事後チェックの件数で気づける。
INSERT INTO public.ow_role_aliases (role_id, alias)
SELECT r.id, v.alias
  FROM (VALUES
    -- ── 英語表記（実データに存在した値）──
    ('アカウントエグゼクティブ','Account Executive'),
    ('エンタープライズセールス','Enterprise Account Executive'),
    ('SDR（反響・インバウンド）','Sales Development Representative'),
    -- ── 経営・CxO（9件とも別名0だった。略語が正式名なので日本語の言い換えを足す）──
    ('CEO・代表取締役','代表取締役社長'), ('CEO・代表取締役','社長'),
    ('COO','最高執行責任者'),             ('COO','執行役員（事業）'),
    ('CFO','最高財務責任者'),             ('CFO','財務責任者'),
    ('CTO','最高技術責任者'),             ('CTO','技術責任者'),
    ('CPO','最高プロダクト責任者'),        ('CPO','プロダクト責任者'),
    ('CRO','最高売上責任者'),             ('CRO','営業責任者'),
    ('CHRO','最高人事責任者'),            ('CHRO','人事責任者'),
    ('VPoE・VPoP','VPoE'), ('VPoE・VPoP','VPoP'), ('VPoE・VPoP','VP of Engineering'),
    ('取締役・執行役員','執行役員'),        ('取締役・執行役員','ボードメンバー'),
    -- ── 事業開発 ──
    ('事業企画','事業戦略'), ('事業企画','事業計画'),
    ('新規事業開発','新規事業'), ('新規事業開発','インキュベーション'),
    ('アライアンス・提携','業務提携'), ('アライアンス・提携','パートナーシップ'),
    -- ── マーケティング ──
    ('SEO・SEM','Webマーケティング'), ('SEO・SEM','検索広告'), ('SEO・SEM','リスティング'),
    ('広告運用','運用型広告'), ('広告運用','メディアバイイング'), ('広告運用','広告プランナー'),
    ('広報・PR','パブリックリレーションズ'), ('広報・PR','広報'), ('広報・PR','コーポレートPR'),
    -- ── プロダクト ──
    ('テクニカルPM','テクニカルプロダクトマネージャー'), ('テクニカルPM','TPM'),
    -- ── デザイナー ──
    ('Webデザイナー','Web制作'), ('Webデザイナー','LPデザイナー'),
    ('グラフィックデザイナー','DTPデザイナー'), ('グラフィックデザイナー','ビジュアルデザイナー'),
    ('動画・映像クリエイター','動画編集'), ('動画・映像クリエイター','映像ディレクター'),
    -- ── データ・AI ──
    ('AIプロダクトマネージャー','AI PdM'), ('AIプロダクトマネージャー','MLプロダクトマネージャー'),
    -- ── エンジニア（「インフラエンジニア」は SRE/インフラ の別名なので入れない）──
    ('データベース・ネットワーク','DBA'), ('データベース・ネットワーク','ネットワークエンジニア'),
    -- ── コーポレート ──
    ('労務','労務管理'), ('労務','人事労務'), ('労務','社会保険'),
    ('人事制度・組織開発','組織開発'), ('人事制度・組織開発','人事企画'),
    ('総務','総務・庶務'), ('総務','ファシリティ'),
    ('内部監査','内部統制'), ('内部監査','J-SOX'),
    ('IR','インベスターリレーションズ'), ('IR','投資家対応'),
    ('知財・特許','知的財産'), ('知財・特許','特許事務'),
    ('M&A','事業投資'), ('M&A','PMI')
  ) AS v(role_name, alias)
  JOIN public.ow_roles r ON r.name = v.role_name AND r.is_active;

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE v_alias int; v_dup int; v_roles int; v_noalias int; v_eng int;
BEGIN
  SELECT count(*) INTO v_alias FROM public.ow_role_aliases;
  IF v_alias <> 182 THEN RAISE EXCEPTION '別名が % 件（想定182 = 118 + 64）。ロールバック', v_alias; END IF;

  -- ⚠️ 別名の重複が0件のままであること（この migration の一番の眼目）
  SELECT count(*) INTO v_dup FROM (
    SELECT alias FROM public.ow_role_aliases GROUP BY alias HAVING count(*) > 1) d;
  IF v_dup <> 0 THEN RAISE EXCEPTION '別名の重複が % 件ある。ロールバック', v_dup; END IF;

  -- 別名が職種の正式名と衝突していないこと（大分類名を別名にしないため）
  IF EXISTS (SELECT 1 FROM public.ow_role_aliases a JOIN public.ow_roles rn ON rn.name = a.alias
              WHERE rn.id <> a.role_id AND rn.is_active) THEN
    RAISE EXCEPTION '有効な職種の正式名と同じ別名がある。ロールバック';
  END IF;

  -- 英語表記3件が意図した職種に付いたこと
  SELECT count(*) INTO v_eng FROM public.ow_role_aliases a JOIN public.ow_roles r ON r.id=a.role_id
   WHERE (a.alias='Account Executive'               AND r.name='アカウントエグゼクティブ')
      OR (a.alias='Enterprise Account Executive'    AND r.name='エンタープライズセールス')
      OR (a.alias='Sales Development Representative' AND r.name='SDR（反響・インバウンド）');
  IF v_eng <> 3 THEN RAISE EXCEPTION '英語表記の別名が % 件（想定3）。ロールバック', v_eng; END IF;

  -- ⚠️「テクニカルサポート」が2職種に付いていないこと
  IF (SELECT count(*) FROM public.ow_role_aliases WHERE alias='テクニカルサポート') <> 1 THEN
    RAISE EXCEPTION 'テクニカルサポートの別名が1件でない。ロールバック';
  END IF;

  -- 職種は触っていないこと
  SELECT count(*) INTO v_roles FROM public.ow_roles;
  IF v_roles <> 105 THEN RAISE EXCEPTION 'ow_roles が % 件（想定105）。ロールバック', v_roles; END IF;

  -- 別名0件の子職種が減ったこと（is_it_saas の子で確認）
  SELECT count(*) INTO v_noalias FROM public.ow_roles r
   WHERE r.is_active AND r.parent_id IS NOT NULL AND r.is_it_saas
     AND NOT EXISTS (SELECT 1 FROM public.ow_role_aliases a WHERE a.role_id = r.id);
  RAISE NOTICE '完了: 別名 % 件（+64）/ 重複0件 / 別名0件の子職種は残り % 件', v_alias, v_noalias;
END $$;

COMMIT;
