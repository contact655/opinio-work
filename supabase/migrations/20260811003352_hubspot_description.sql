-- HubSpot Japan の description を埋める（2026-08-11）
--
-- 背景:
--   tagline を25字前後に短縮したため、事業説明が1行しか残っていない状態だった。
--
-- ⚠️ 「公開76社で唯一 description が空」という前提は**誤り**だった。
--    実際は5社（PKSHA / SmartHR / HubSpot / Ubie / Sansan）が空。
--    HubSpot が唯一だったのは「tagline が26字以上で短縮対象だった61社の中で」であって、
--    公開76社全体では他に4社ある。残り4社はいずれも tagline が
--    公式ミッション（「Advancing Humanity」等）で、事業説明が別途要る点は同じ。
--    今回は指示どおり HubSpot のみを埋める。
--
-- ⚠️ 事実ベースで書き、評価語（急成長中の／業界をリードする／革新的な）は使っていない。
--    設立年・製品名・上場ティッカー・導入社数はいずれも公式記載に基づく。
--      会社概要        https://www.hubspot.jp/company-information
--      有料顧客10万社  https://www.hubspot.jp/company-news/100kcustomers-20210215
--
-- ⚠️ 導入社数は「11万社以上」と書く。時点値だが「以上」なら増加方向でも嘘にならない。
--    他社（Zendesk「110,000社以上」）とも書き方を揃えている。
--
-- ⚠️ 他社の description は 107〜151字（中央値128字）。この案は137字で範囲内。
-- ⚠️ tagline / industry は触らない。

BEGIN;

-- 事前チェック: 対象が存在し、description が空であること
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.ow_companies
    WHERE id = 'aaaaaaaa-0001-0001-0001-000000000007'
      AND name = 'HubSpot Japan株式会社'
      AND description IS NULL
  ) THEN
    RAISE EXCEPTION '想定外: HubSpot Japan が見つからないか、description が既に埋まっている';
  END IF;
END $$;

UPDATE public.ow_companies
   SET description = '米HubSpot, Inc.（NYSE: HUBS）の日本法人。2016年設立。Marketing Hub・Sales Hub・Service Hub を1つのCRM基盤上で提供し、集客から商談・顧客対応までを同じ顧客データで扱う。世界120か国以上・11万社以上が導入。',
       updated_at = now()
 WHERE id = 'aaaaaaaa-0001-0001-0001-000000000007';

-- 事後チェック
DO $$
DECLARE
  v_desc text;
  v_empty bigint;
BEGIN
  SELECT description INTO v_desc FROM public.ow_companies
   WHERE id = 'aaaaaaaa-0001-0001-0001-000000000007';
  IF v_desc IS NULL OR btrim(v_desc) = '' THEN
    RAISE EXCEPTION '事後チェック失敗: HubSpot の description が埋まっていない';
  END IF;

  /* ⚠️ 「0件になること」を条件にしない。他に4社（PKSHA / SmartHR / Ubie / Sansan）が
        空のままで、それらは今回の対象外。件数は NOTICE で残すだけにする。 */
  SELECT count(*) INTO v_empty
  FROM public.ow_companies
  WHERE is_published = true AND (description IS NULL OR btrim(description) = '');
  RAISE NOTICE 'description が空の公開企業: % 件（HubSpot を除く残り。別タスク）', v_empty;
END $$;

COMMIT;
