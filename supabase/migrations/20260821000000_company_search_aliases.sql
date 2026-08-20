-- ═══════════════════════════════════════════════════════════════════════════
-- 社名の読み仮名を検索対象に足す（2026-08-21）
--
-- ── なぜ ───────────────────────────────────────────────────────────────────
-- 2026-08-20 に「英語名で引けない50社」を直した（`name_en` / `brand_name` / `slug` を
-- 検索対象に追加）。**その裏返しが残っている。**
--
--   社名が英字で書かれている企業 … 公開79社中 **28社**
--   （Notion / Datadog / HubSpot / Indeed / Dropbox など）
--
-- これらは**カタカナで打つと1件も出ない**。「ノーション」「インディード」のように
-- 打つ人は実在するので、読み仮名を持たせて検索で拾えるようにする。
--
-- ── なぜ text[] ではなく text か ───────────────────────────────────────────
-- ⚠️ PostgREST の `.or(...)` に書ける `ilike` は**テキスト列にしか効かない**。
--    配列だと部分一致が書けず、既存の3経路（ヘッダー検索 / 一覧 / 企業ピッカー）の
--    `.or(name.ilike.…)` にそのまま足せない。
--    **空白区切りの1列**にして、既存の書き方に1項目足すだけで済ませる。
--    別読みを持たせたい企業は空白で並べる（例: 'スマートエイチアール スマートHR'）。
--
-- ── 値について ─────────────────────────────────────────────────────────────
-- ⚠️ **これは「調べた事実」ではなく読み仮名。** 表記の揺れは避けられない。
--    ただし **この列は画面に一切出ない**（検索で当てるためだけに使う）ので、
--    ずれても害は「その読みでは引けない」だけ。
-- ⚠️ 下の28件は **2026-08-21 に柴さんが目を通して確定したもの**。
--    オープンエーアイ / スマートエイチアール / トゥイリオ / ニホンアイ・ビー・エム の
--    4件は指摘を受けて修正済み。**勝手に足したり変えたりしないこと。**
--
-- ── 権限 ───────────────────────────────────────────────────────────────────
-- ⚠️ `ow_companies` の SELECT は**テーブルレベル**（anon / authenticated とも）。
--    足した列はそのまま読める＝GRANT は不要。適用後にアサートする。
-- ⚠️ UPDATE は列単位で配っているので、この列は**企業側から書けない**。
--    運営が migration で入れる想定なので、それでよい。
--
-- ⚠️ 対象は **slug で明示列挙**する（CLAUDE.md「全社一括の UPDATE を禁止する」）。
-- ⚠️ 新設の列なので、打ち消す可能性のある過去の migration は無い（確認済み）。
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ow_companies' AND column_name='search_aliases'
  ) THEN
    RAISE EXCEPTION '既に search_aliases がある。適用済みか、前提が違う。中止';
  END IF;
END $$;

ALTER TABLE public.ow_companies ADD COLUMN search_aliases text;

COMMENT ON COLUMN public.ow_companies.search_aliases IS
  '検索専用の別名（空白区切り）。主に社名の読み仮名。'
  ' ⚠️ 画面には出さない。検索で当てるためだけに使う。'
  ' ⚠️ 表示名は name / name_en / brand_name。ここを表示に使わないこと。';

UPDATE public.ow_companies AS c SET search_aliases = v.aliases
FROM (VALUES
  ('asana',       'アサナ'),
  ('box',         'ボックス'),
  ('crowdstrike', 'クラウドストライク'),
  ('databricks',  'データブリックス'),
  ('datadog',     'データドッグ'),
  ('docusign',    'ドキュサイン'),
  ('dropbox',     'ドロップボックス'),
  ('hubspot',     'ハブスポット'),
  ('ibm',         'ニホンアイ・ビー・エム'),
  ('indeed',      'インディード'),
  ('irodas',      'イロダス'),
  ('meta',        'メタ'),
  ('mongodb',     'モンゴディービー'),
  ('new-relic',   'ニューレリック'),
  ('notion',      'ノーション'),
  ('openai',      'オープンエーアイ'),
  ('opinio',      'オピニオ'),
  ('pksha',       'パークシャ'),
  ('sansan',      'サンサン'),
  ('sap',         'エスエーピー'),
  ('servicenow',  'サービスナウ'),
  ('slack',       'スラック'),
  ('smarthr',     'スマートエイチアール'),
  ('snowflake',   'スノーフレイク'),
  ('translead',   'トランスリード'),
  ('twilio',      'トゥイリオ'),
  ('ubie',        'ユビー'),
  ('zendesk',     'ゼンデスク')
) AS v(slug, aliases)
WHERE c.slug = v.slug;

DO $$
DECLARE v_filled int; v_anon boolean; v_auth boolean;
BEGIN
  SELECT count(*) INTO v_filled FROM public.ow_companies WHERE search_aliases IS NOT NULL;
  IF v_filled <> 28 THEN
    RAISE EXCEPTION '28件入るはずが % 件だった。slug が変わった可能性がある。中止', v_filled;
  END IF;

  -- SELECT はテーブルレベルなので、新しい列も読めているはず
  v_anon := has_column_privilege('anon','public.ow_companies','search_aliases','SELECT');
  v_auth := has_column_privilege('authenticated','public.ow_companies','search_aliases','SELECT');
  IF NOT v_anon OR NOT v_auth THEN
    RAISE EXCEPTION 'search_aliases が読めない（anon=% / authenticated=%）。中止', v_anon, v_auth;
  END IF;

  RAISE NOTICE '適用後: 28社に読み仮名を設定 / anon・authenticated とも読める';
END $$;

COMMIT;
