-- ═══════════════════════════════════════════════════════════════════════════
-- 出典URLを15社に入れ、OpenAI の1社は「探したが無かった」を記録する（2026-08-30）
--
-- ── 何をしたか ──────────────────────────────────────────────────────────────
-- `official_site` 由来のうち **URL が記録されていなかった17社**を、
-- **実際に各社の公式サイトを開いて**特定した（`20260830050000` で13社は転記済み）。
--
-- ⚠️★**転記ではなく、今回は現物を見に行った。** そのため
--    `verified_at` を **2026-08-30 に更新する**（前回は投入日のままだった）。
--
-- ── ★何をもって「一致」としたか ─────────────────────────────────────────────
-- 各社の住所から**建物名または番地**を取り、そのページ本文に**その断片が存在すること**を
-- 確認した。**全文照合ではない。**
--   例: Databricks は「日本橋三丁目スクエア」、Sansan は「渋谷サクラステージ」。
-- ⚠️ したがって「番地まで完全に正しい」ことまでは保証していない。
--    保証しているのは「**そのページに、その住所の特徴的な部分が載っている**」まで。
--
-- ── 15社 ────────────────────────────────────────────────────────────────────
-- | 会社 | ページ | 備考 |
-- |---|---|---|
-- | Sansan | `jp.corp-sansan.com/company/info/` | 会社概要 |
-- | HubSpot | `www.hubspot.jp/company/contact` | |
-- | ワークデイ | `www.workday.com/ja-jp/pages/company-information-jp.html` | |
-- | デル | `www.dell.com/ja-jp/lp/contact-us` | |
-- | Zendesk | `www.zendesk.co.jp/contact/` | |
-- | オクタ | `www.okta.com/jp/contact/` | |
-- | コンカー | `www.concur.co.jp/about` | |
-- | PKSHA | `www.pkshatech.com/company/about/` | |
-- | SmartHR | `smarthr.co.jp/company/` | |
-- | セールスフォース | `www.salesforce.com/jp/company/salesforce-japan/` | |
-- | Ubie | `ubie.life/about_ubie` | ⚠️ `/company` は404。`about_ubie` にある |
-- | Datadog | `www.datadoghq.com/ja/about/contact/` | ⚠️ **英語表記**（`JP Tower 19th Floor, 2-7-2 Marunouchi`） |
-- | Twilio | `www.twilio.com/ja-jp/legal/tos` | ⚠️ **利用規約にしか無い**。会社概要ページが存在しない |
-- | クーパ | `coupa.co.jp/company` | ⚠️★**日本サイトは別ドメイン**（`ow_companies.url` は `coupa.com/ja`） |
-- | 日本HP | `www.hpe.com/psnow/doc/a50011874jpn` | ⚠️ **PDF**。HTMLの会社概要ページが無い |
--
-- ── ⚠️★OpenAI は URL を入れない ────────────────────────────────────────────
-- 公式サイト（`openai.com/ja-JP/`）に**日本法人の住所の記載が見つからなかった**。
-- 利用規約・プライバシーポリシーの日本語版も見たが無い。
--
-- ⚠️ **`source_kind` は `official_site` のまま残す。** `unknown` に落とさない——
--    投入時（`20260813061500`）は公式サイト由来だったという記録を消すことになる。
--    ⚠️ `source_url` も **NULL のまま**。それらしいURLで埋めない。
--    ⚠️ **`verified_at` も更新しない。** 見に行ったが**確認できなかった**ので、
--       「2026-08-30 に確認済み」と読める状態にしてはいけない。
--       代わりに `note` に**探して見つからなかった事実**を書く。
--
-- ── 戻し方 ──────────────────────────────────────────────────────────────────
--   作業前ダンプ: .dumps/20260830-1929-ow_companies-ow_company_data_sources.sql
--   ⚠️ .dumps/ は .gitignore 済み。コミットしない。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE v_null int; v_total int;
BEGIN
  SELECT count(*) INTO v_null FROM public.ow_company_data_sources
   WHERE source_kind = 'official_site' AND source_url IS NULL;
  IF v_null <> 17 THEN RAISE EXCEPTION 'URL未記録が % 行（17 のはず）。中止', v_null; END IF;

  SELECT count(*) INTO v_total FROM public.ow_company_data_sources;
  IF v_total <> 73 THEN RAISE EXCEPTION '出典の記録が % 行（73 のはず）。中止', v_total; END IF;

  RAISE NOTICE '適用前: URL未記録 % 行 / 合計 % 行', v_null, v_total;
END $$;

/* ⚠️ 対象は slug で明示列挙する。`source_url IS NULL` のときだけ書く
      （既に入っている13社を上書きしない）。 */
UPDATE public.ow_company_data_sources s SET
  source_url = v.url,
  verified_at = timestamptz '2026-08-30',   -- ★現物を見に行ったので更新する
  updated_at = now()
FROM (VALUES
  ('sansan',     'https://jp.corp-sansan.com/company/info/'),
  ('hubspot',    'https://www.hubspot.jp/company/contact'),
  ('workday',    'https://www.workday.com/ja-jp/pages/company-information-jp.html'),
  ('dell',       'https://www.dell.com/ja-jp/lp/contact-us'),
  ('zendesk',    'https://www.zendesk.co.jp/contact/'),
  ('okta',       'https://www.okta.com/jp/contact/'),
  ('concur',     'https://www.concur.co.jp/about'),
  ('pksha',      'https://www.pkshatech.com/company/about/'),
  ('smarthr',    'https://smarthr.co.jp/company/'),
  ('salesforce', 'https://www.salesforce.com/jp/company/salesforce-japan/'),
  ('ubie',       'https://ubie.life/about_ubie'),
  ('datadog',    'https://www.datadoghq.com/ja/about/contact/'),
  ('twilio',     'https://www.twilio.com/ja-jp/legal/tos'),
  ('coupa',      'https://coupa.co.jp/company'),
  ('hp',         'https://www.hpe.com/psnow/doc/a50011874jpn')
) AS v(slug, url)
WHERE s.company_id = (SELECT id FROM public.ow_companies WHERE slug = v.slug)
  AND s.field = 'headquarters_address'
  AND s.source_kind = 'official_site'
  AND s.source_url IS NULL;

/* ★OpenAI: URL も verified_at も入れず、**探して見つからなかった事実**だけ残す。 */
UPDATE public.ow_company_data_sources s SET
  note = coalesce(s.note || ' ／ ', '')
       || '2026-08-30 に公式サイト（openai.com/ja-JP・利用規約・プライバシーポリシー）を'
       || '確認したが、日本法人の住所の記載が見つからなかった。出典URLは未特定。',
  updated_at = now()
WHERE s.company_id = (SELECT id FROM public.ow_companies WHERE slug = 'openai')
  AND s.field = 'headquarters_address'
  AND s.source_url IS NULL;

DO $$
DECLARE v_url int; v_null int; v_openai_note int; v_openai_url int; v_total int;
BEGIN
  SELECT count(*) INTO v_url FROM public.ow_company_data_sources
   WHERE source_kind = 'official_site' AND source_url IS NOT NULL;
  IF v_url <> 28 THEN RAISE EXCEPTION 'URLありが % 行（13+15=28 のはず）。中止', v_url; END IF;

  -- ★残る NULL は Databricks と OpenAI の2社だけ（Databricks は次の migration で入れる）
  SELECT count(*) INTO v_null FROM public.ow_company_data_sources
   WHERE source_kind = 'official_site' AND source_url IS NULL;
  IF v_null <> 2 THEN RAISE EXCEPTION 'URL未記録が % 行（2 のはず）。中止', v_null; END IF;

  -- ★OpenAI に URL を入れていないこと・note が付いていること
  SELECT count(*) INTO v_openai_url FROM public.ow_company_data_sources s
    JOIN public.ow_companies c ON c.id = s.company_id
   WHERE c.slug = 'openai' AND s.source_url IS NOT NULL;
  IF v_openai_url <> 0 THEN RAISE EXCEPTION 'OpenAI に URL が入っている。中止'; END IF;

  SELECT count(*) INTO v_openai_note FROM public.ow_company_data_sources s
    JOIN public.ow_companies c ON c.id = s.company_id
   WHERE c.slug = 'openai' AND s.note LIKE '%見つからなかった%';
  IF v_openai_note <> 1 THEN RAISE EXCEPTION 'OpenAI の note が付いていない。中止'; END IF;

  SELECT count(*) INTO v_total FROM public.ow_company_data_sources;
  IF v_total <> 73 THEN RAISE EXCEPTION '合計 % 行（73 のはず）。中止', v_total; END IF;

  RAISE NOTICE '完了: URLあり % / 未記録 %（Databricks・OpenAI）/ 合計 %', v_url, v_null, v_total;
END $$;

COMMIT;
