-- ═══════════════════════════════════════════════════════════════════════════
-- 出典URLを13社に入れる（2026-08-30 / `20260830040000` の続き）
--
-- ── なぜ別の migration にするか ────────────────────────────────────────────
-- 前の migration は**種別（登記 / 公式サイト / 不明）を機械的に**入れるところまで。
-- こちらは**個別URLを人が読んで拾う**作業で、性質が違う。
-- ⚠️ 混ぜると「どこまでが機械で、どこからが人の判断か」が分からなくなる。
--
-- ── 出所 ────────────────────────────────────────────────────────────────────
-- `official_site` の **30社のうち13社**は、投入時の migration のコメントに
-- 個別URLが書き残されていた。**それを転記するだけ**（新しく調べていない）。
--
-- | migration | 社数 | URLの記載 |
-- |---|---|---|
-- | `20260828150000_fill_headquarters_address_7.sql` | 7 | あり（社名→URLの表） |
-- | `20260829130000_fill_headquarters_address_6.sql` | 6 | あり（社名→URLの表） |
-- | `20260829140000_fill_headquarters_address_6b.sql` | 6 | **無い** |
-- | `20260813061500_fill_company_profile_9_companies.sql` | 9 | **ほぼ無い**（2件のみ・住所以外の出典） |
-- | `20260828070000_fill_hq_twilio_concur.sql` | 6 | **住所の出典としては特定できない** |
--
-- ⚠️★**残り17社は NULL のままにする。** 記録が無いものを推測で埋めない
--    （CLAUDE.md「値が無いことを、ある値に置き換えない」）。
--    NULL は「**URLが記録されていない**」という事実で、これ自体が次の作業の指示になる。
--
-- ⚠️ `20260829130000` の6社は**スキームが書かれていなかった**（`opinio.co.jp/company` の形）。
--    `https://` を補っている。**ドメインとパスは変えていない。**
--
-- ⚠️ Twilio の記録は `https://www.twilio.com/ja-jp/legal/tos`（利用規約ページ）で、
--    **住所の出典として妥当か判断できない**ので入れない。
--
-- ── ⚠️ URLの意味 ────────────────────────────────────────────────────────────
-- これは**住所を確認したページ**であって、企業の代表URL（`ow_companies.url`）ではない。
-- 再確認するときはこのページを開く。
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   作業前ダンプ: .dumps/20260830-0236-ow_companies.sql
--   ⚠️ 戻すなら `source_url = NULL` に戻すだけでよい（行は消さない）。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_site int; v_url int;
BEGIN
  SELECT count(*) INTO v_site FROM public.ow_company_data_sources WHERE source_kind = 'official_site';
  IF v_site <> 30 THEN RAISE EXCEPTION 'official_site が % 行（30 のはず）。中止', v_site; END IF;

  SELECT count(*) INTO v_url FROM public.ow_company_data_sources
   WHERE source_kind = 'official_site' AND source_url IS NOT NULL;
  IF v_url <> 0 THEN RAISE EXCEPTION '既にURLが % 行入っている（0 のはず）。中止', v_url; END IF;

  RAISE NOTICE '適用前: official_site % 行 / URLあり % 行', v_site, v_url;
END $$;

/* ⚠️ 対象は id で明示列挙し、`source_kind = 'official_site'` かつ
      `source_url IS NULL` のときだけ書く（登記の行を巻き込まない）。 */
UPDATE public.ow_company_data_sources s SET
  source_url = v.url, updated_at = now()
FROM (VALUES
  -- 20260828150000（社名指定だった7社）
  ('6c218a59-a951-44ee-9003-163956376554'::uuid, 'https://asana.com/ja/about'),              -- Asana Japan
  ('e7e9b0be-20c2-4434-afea-7a27c89332e2'::uuid, 'https://jp.indeed.com/about'),             -- Indeed Japan
  ('0d4734e0-0717-475e-a6d1-806aa2cd45ff'::uuid, 'https://newrelic.com/jp/about'),           -- New Relic
  ('f4a6aa23-3775-4548-981b-156e416ef6f6'::uuid, 'https://www.paloaltonetworks.jp/company'), -- パロアルトネットワークス
  ('478a9ede-ea0f-48c1-859c-d47f84d35b6b'::uuid, 'https://www.braze.com/ja/company'),        -- ブレイズ
  ('7baafcb1-d929-46c1-97be-b0fb580b480b'::uuid, 'https://www.pagerduty.co.jp/company'),     -- ページャーデューティー
  ('9ef65fa1-e04b-4098-a7b1-4ee3d535a23a'::uuid, 'https://www.ibm.com/jp-ja/about'),         -- 日本IBM
  -- 20260829130000（6社・スキームを補った）
  ('cf44d740-b835-454d-91a3-f1e2eddc7251'::uuid, 'https://opinio.co.jp/company'),            -- Opinio
  ('28b826eb-fb86-4124-aa08-c489cad662f1'::uuid, 'https://thinca.co.jp/about/outline/'),     -- シンカ
  ('2e54ff06-2f4d-420c-9a5c-9a80a85ca55a'::uuid, 'https://corp.timee.co.jp/about/outline/'), -- タイミー
  ('d1c26664-5643-42bc-84e4-6f0c940bb39d'::uuid, 'https://translead.jp/company'),            -- Translead
  ('63d390da-e8c4-464a-8c30-e112fcd2709c'::uuid, 'https://irodas.com/corporate/company'),    -- irodas
  ('dd76b17d-e3c1-44a9-b747-4ecde10b8cec'::uuid, 'https://www.zscaler.com/jp/company/contact') -- ゼットスケーラー
) AS v(company_id, url)
WHERE s.company_id = v.company_id
  AND s.field = 'headquarters_address'
  AND s.source_kind = 'official_site'
  AND s.source_url IS NULL;

DO $$
DECLARE v_url int; v_null int; v_reg int; v_total int;
BEGIN
  SELECT count(*) INTO v_url FROM public.ow_company_data_sources
   WHERE source_kind = 'official_site' AND source_url IS NOT NULL;
  IF v_url <> 13 THEN RAISE EXCEPTION 'URLが入ったのが % 行（13 のはず）。中止', v_url; END IF;

  -- ★残り17社は NULL のままであること（勝手に埋めていない）
  SELECT count(*) INTO v_null FROM public.ow_company_data_sources
   WHERE source_kind = 'official_site' AND source_url IS NULL;
  IF v_null <> 17 THEN RAISE EXCEPTION 'NULL が % 行（17 のはず）。中止', v_null; END IF;

  -- ★登記42行を巻き込んでいないこと
  SELECT count(*) INTO v_reg FROM public.ow_company_data_sources
   WHERE source_kind = 'registry' AND source_url = 'https://www.houjin-bangou.nta.go.jp/';
  IF v_reg <> 42 THEN RAISE EXCEPTION '登記が % 行（42 のはず）。中止', v_reg; END IF;

  SELECT count(*) INTO v_total FROM public.ow_company_data_sources;
  IF v_total <> 73 THEN RAISE EXCEPTION '合計 % 行（73 のはず）。中止', v_total; END IF;

  RAISE NOTICE '完了: 公式サイト URLあり % / URLなし % / 登記 % / 合計 %', v_url, v_null, v_reg, v_total;
END $$;

COMMIT;
