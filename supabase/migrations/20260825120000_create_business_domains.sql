-- 事業領域（複数選択）の器を作る（2026-08-25 / 業種分類フェーズ1）
--
-- ── 2軸の役割分担 ──────────────────────────────────────────────────────────
--   業種（ow_industries・単一）  … 運営・企業側が使う。非IT企業の受け入れ先でもある
--   事業領域（この表・複数）      … **求職者側の絞り込みと表示はいずれこちらに移す**
--
--   掲載企業の9割が IT/SaaS なので、業種を求職者向けの絞り込みに置くと
--   76/87社が「IT・ソフトウェア」に集まり構造的に縮退する。これは一時的な状態ではない。
--
-- ⚠️ **今日は器を作って初期値を入れるだけ。** 企業への入力UIも、求職者側の
--    読み替えも行わない。読み手15箇所は `industry`(text) を読み続ける。
--
-- ── マスタに作る値の決め方（これ1本で判断する）────────────────────────────
--   **実データが1社以上ある値だけを作る。0社の値は作らない。**
--
--   帰結（2026-08-25 実測）:
--     ・ハードウェア・半導体 → **作る**（7社）。業種側にも「電子機器・半導体」を
--       置いたが、事業領域からも消すと7社が事業領域0件になり行き先が無くなる
--     ・ITサービス・受託     → **作らない**（受託開発・SI / ITコンサルティングとも **0社**）
--     ・コマース・EC         → **作らない**。2026-08-11 に「マーケットプレイス」へ
--       改名済みの旧値で、残る1社（アサヒビール）は IT/SaaS 企業ではないため付けない。
--       ⚠️ 副次的に `industryGroups.ts` の LEGACY_KEYS `ec: "marketplace"` とも
--          矛盾しなくなるので、**LEGACY_KEYS は触らない**
--     ・業種特化             → **作る**（2社）。⚠️ ただし軸2（対象業界）を入れる日に
--       解体して消す暫定値。`description` にその旨を書いてある
--
-- ⚠️ **slug は現行 `INDUSTRY_GROUPS` の key をそのまま使う**（ai / infra / crm …）。
--    求職者側の絞り込みが事業領域に移ったとき `?industry=<slug>` がそのまま効き、
--    既存の被リンク・ブックマークが生き残る。**綴りを変えないこと。**
--
-- ⚠️ **`ow_saas_categories` は使わない**（65/87社しか無く、2026-08-11 に人が
--    判断し直した `industry`(text) より古い）。初期値は `industry`(text) から作る。
--    列も値も残すが、編集経路は無くなる（COMMENT を付けてある）。

BEGIN;

-- ── 1. マスタ ──────────────────────────────────────────────────────────────
CREATE TABLE public.ow_business_domains (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  slug          text        NOT NULL,
  description   text,
  display_order integer     NOT NULL DEFAULT 0,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ow_business_domains_slug_key UNIQUE (slug),
  CONSTRAINT ow_business_domains_name_key UNIQUE (name)
);

COMMENT ON TABLE public.ow_business_domains IS
  '事業領域（複数選択）のマスタ。⚠️ 値を消すときは is_active = false の論理削除を正とし、物理DELETEは使わない（紐づけが ON DELETE RESTRICT で守られており、消せない側に倒してある）。⚠️ 実データが1社以上ある値だけを置く方針';

-- ── 2. 中間表 ──────────────────────────────────────────────────────────────
CREATE TABLE public.ow_company_business_domains (
  company_id    uuid        NOT NULL REFERENCES public.ow_companies(id)        ON DELETE CASCADE,
  domain_id     uuid        NOT NULL REFERENCES public.ow_business_domains(id) ON DELETE RESTRICT,
  is_primary    boolean     NOT NULL DEFAULT false,
  display_order integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- UNIQUE (company_id, domain_id) は複合主キーで満たす。`id` 列は作らない
  -- ⚠️ mutate.ts のヘルパーには { returning: "company_id" } を渡すこと
  CONSTRAINT ow_company_business_domains_pkey PRIMARY KEY (company_id, domain_id)
);

COMMENT ON TABLE public.ow_company_business_domains IS
  '企業 × 事業領域。⚠️ 1社あたりの上限（3件）は API 側で検証する。トリガーにすると運営が直せない場面が出る。⚠️ 主分類は is_primary（部分UNIQUEで1社1件をDBが担保）';

-- 「主は1社1件」を DB で担保する。
-- ⚠️ `ow_job_roles` はこれを持たずアプリ側の約束になっている。同じ形にしない。
CREATE UNIQUE INDEX ow_company_business_domains_one_primary
  ON public.ow_company_business_domains (company_id) WHERE is_primary;

-- ⚠️ `domain_id` 側のインデックスは**あえて張らない**。
--    この DB は既に過剰インデックス（ユーザーテーブル10MB中インデックスが6MB / 411本）で、
--    数十行の表では Seq Scan の方が速く、書き込みの Disk IO だけが増える
--    （2026-08-23 の Disk IO バジェット枯渇の件。CLAUDE.md 参照）。

-- ── 3. RLS ────────────────────────────────────────────────────────────────
--    ⚠️ **`FOR ALL` を使わない。** SELECT / INSERT / UPDATE / DELETE を個別に書き、
--       WITH CHECK も明示する（`ow_company_genres` は UPDATE ポリシーが1本も無く、
--       authenticated から UPDATE すると常に0行になる穴があった。同じ形にしない）。
ALTER TABLE public.ow_business_domains          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ow_company_business_domains  ENABLE ROW LEVEL SECURITY;

-- マスタ: 読み取り
-- ⚠️ `is_active = true` だけにしないこと。運営が無効化した事業領域を /admin から
--    一覧できず、戻すこともできなくなる（職種マスタで is_active の絞り込みが
--    画面ごとにバラついたのと同型の穴）。
CREATE POLICY business_domains_read ON public.ow_business_domains
  FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.auth_is_admin());

CREATE POLICY business_domains_admin_insert ON public.ow_business_domains
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_is_admin());

CREATE POLICY business_domains_admin_update ON public.ow_business_domains
  FOR UPDATE TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

CREATE POLICY business_domains_admin_delete ON public.ow_business_domains
  FOR DELETE TO authenticated
  USING (public.auth_is_admin());

-- 中間表: anon は**公開企業に限定**する（USING (true) にしない）
-- ⚠️ ポリシー式は実行ユーザーの権限で評価される。anon が ow_companies の
--    id / is_published / is_test を読めることは確認済み（2026-08-25 実測・4列とも true）。
CREATE POLICY company_business_domains_anon_read ON public.ow_company_business_domains
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.ow_companies c
     WHERE c.id = company_id AND c.is_published = true AND c.is_test = false
  ));

-- 中間表: ログイン済みは、公開企業に加えて「自社」と「運営」が見える
CREATE POLICY company_business_domains_auth_read ON public.ow_company_business_domains
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ow_companies c
       WHERE c.id = company_id AND c.is_published = true AND c.is_test = false
    )
    OR public.auth_is_company_admin(company_id)
    OR public.auth_is_admin()
  );

CREATE POLICY company_business_domains_write_insert ON public.ow_company_business_domains
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_is_company_admin(company_id) OR public.auth_is_admin());

CREATE POLICY company_business_domains_write_update ON public.ow_company_business_domains
  FOR UPDATE TO authenticated
  USING      (public.auth_is_company_admin(company_id) OR public.auth_is_admin())
  WITH CHECK (public.auth_is_company_admin(company_id) OR public.auth_is_admin());

CREATE POLICY company_business_domains_write_delete ON public.ow_company_business_domains
  FOR DELETE TO authenticated
  USING (public.auth_is_company_admin(company_id) OR public.auth_is_admin());

-- ── 4. GRANT（列単位にはしない）────────────────────────────────────────────
--    ⚠️ 新しいテーブルには既定で権限が付かない。書かないと anon も authenticated も読めない。
--    ⚠️ 運営も `authenticated` ロールで来る。authenticated に GRANT しないと
--       RLS まで到達せず、運営でも読めなくなる（2026-08-16 に ow_settings で踏んだ形）。
GRANT SELECT                         ON public.ow_business_domains         TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE         ON public.ow_business_domains         TO authenticated;
GRANT SELECT                         ON public.ow_company_business_domains TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE         ON public.ow_company_business_domains TO authenticated;

-- ── 5. マスタ12件 ──────────────────────────────────────────────────────────
--    display_order は現行 INDUSTRY_GROUPS の並び順をそのまま踏襲している
--    （ITサービス・受託だけ 0社のため落とした）。
INSERT INTO public.ow_business_domains (name, slug, display_order, description) VALUES
  ('AI・データ',           'ai',           1, NULL),
  ('クラウドインフラ',      'infra',        2, NULL),
  ('開発者ツール',          'devtools',     3, NULL),
  ('セキュリティ',          'security',     4, NULL),
  ('CRM・営業支援',        'crm',          5, NULL),
  ('コラボレーション',      'collab',       6, NULL),
  ('経理・財務',           'finance',      7, NULL),
  ('HR・人材',             'hr',           8, NULL),
  ('マーケティング',        'marketing',    9, NULL),
  ('ハードウェア・半導体',  'hardware',    10, NULL),
  ('マーケットプレイス',    'marketplace', 11, NULL),
  ('業種特化',             'vertical',    12,
     '⚠️ 暫定値。軸2（対象業界）を入れる日に解体して消す。いまは Ubie（ヘルスケア）と nCino（金融）の2社が入っているだけで、「どの業界向けか」を表せていない');

-- ── 6. 初期値（industry(text) から機械導出できるものだけ）──────────────────
--    ⚠️ 導出できないものには**付けない**（推測値を入れない）:
--         IT / SaaS（3社）… 粒度が粗すぎて事業領域を決められない
--         コマース・EC（1社・アサヒビール）… IT/SaaS 企業ではない
--         電設資材・卸売業（1社・海光電業）… 同上
--    初期値は1社1件なので is_primary は全て true（部分UNIQUEを満たす）。
INSERT INTO public.ow_company_business_domains (company_id, domain_id, is_primary, display_order)
SELECT c.id, d.id, true, 0
  FROM public.ow_companies c
  JOIN (VALUES
    ('AI・データ',           'ai'),
    ('クラウドインフラ',      'infra'),
    ('開発者ツール',          'devtools'),
    ('セキュリティ',          'security'),
    ('CRM・営業支援',        'crm'),
    ('コラボレーション',      'collab'),
    ('経理・財務',           'finance'),
    ('HR・人材',             'hr'),
    ('マーケティング',        'marketing'),
    ('ハードウェア・半導体',  'hardware'),
    ('マーケットプレイス',    'marketplace'),
    -- 対象業界が特定なだけで、売っているのは SaaS
    ('ヘルスケア',           'vertical'),
    ('金融',                'vertical')
  ) AS m(industry_text, slug) ON c.industry = m.industry_text
  JOIN public.ow_business_domains d ON d.slug = m.slug;

-- ── 7. 事後チェック ────────────────────────────────────────────────────────
DO $$
DECLARE
  v_master bigint; v_links bigint; v_companies bigint; v_multi bigint; v_noprimary bigint;
BEGIN
  SELECT count(*) INTO v_master FROM public.ow_business_domains;
  IF v_master <> 12 THEN
    RAISE EXCEPTION '事後チェック失敗: ow_business_domains が % 行（12行のはず）', v_master;
  END IF;

  SELECT count(*) INTO v_links FROM public.ow_company_business_domains;
  IF v_links <> 82 THEN
    RAISE EXCEPTION '事後チェック失敗: 紐づけが % 件（82件のはず）', v_links;
  END IF;

  SELECT count(DISTINCT company_id) INTO v_companies FROM public.ow_company_business_domains;
  IF v_companies <> 82 THEN
    RAISE EXCEPTION '事後チェック失敗: 事業領域を持つ企業が % 社（82社のはず）', v_companies;
  END IF;

  -- 初期値は1社1件のはず（2件以上ある企業がいたらマッピングが重複している）
  SELECT count(*) INTO v_multi FROM (
    SELECT company_id FROM public.ow_company_business_domains
     GROUP BY company_id HAVING count(*) > 1
  ) t;
  IF v_multi <> 0 THEN
    RAISE EXCEPTION '事後チェック失敗: 事業領域が2件以上ある企業が % 社ある', v_multi;
  END IF;

  -- 紐づけがあるのに主が無い企業が無いこと
  SELECT count(*) INTO v_noprimary FROM (
    SELECT company_id FROM public.ow_company_business_domains
     GROUP BY company_id HAVING count(*) FILTER (WHERE is_primary) <> 1
  ) t;
  IF v_noprimary <> 0 THEN
    RAISE EXCEPTION '事後チェック失敗: is_primary がちょうど1件でない企業が % 社ある', v_noprimary;
  END IF;
END $$;

-- ── 8. 旧・SaaSカテゴリ列に行き先を記録する ────────────────────────────────
--    ⚠️ 列も値（65社）も残す。編集UI（/biz/company）はこの migration と同じコミットで外す。
COMMENT ON COLUMN public.ow_companies.saas_category_id IS
  '事業領域(ow_business_domains)へ移行予定。2026-08-25 時点で編集経路なし';

COMMIT;
