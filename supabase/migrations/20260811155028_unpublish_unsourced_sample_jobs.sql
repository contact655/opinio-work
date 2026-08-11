-- 出典の無いサンプル求人13件の掲載を下ろす（status → draft）
--
-- ── なぜ下ろすか ────────────────────────────────────────────────────────────
-- 対象13件は archive/147_add_sample_jobs.sql が投入したもので、
-- そのファイル自身が冒頭に「Migration 147: サンプル求人データ追加（11社 計26件）」
-- と書いている。**求人原文の URL がどこにも記録されておらず、実在を確認できない。**
--
-- 勤務地は全件 '東京都'、勤務形態は全件 'hybrid' で、1件ずつ調べた形跡が無い。
-- 当初は「正しい値に直す」方針だったが、直す元になる原文が存在しないため
-- 「掲載を下ろす」に変更した。
--
-- Opinio は有料職業紹介事業の許可事業者であり、実在しない求人の掲載は
-- 的確表示義務に関わる。値の精度以前の問題として扱う。
--
-- ⚠️ DELETE はしない。status を draft にするだけ。
--    原文が確認できたら status を戻し、同時に source_url を埋める。
--
-- ── 対象外 ──────────────────────────────────────────────────────────────────
-- 株式会社セールスフォース・ジャパンの5件（archive/152 由来）は**保留**。
-- 現在の採用ページとの突合結果を待って判断するため、本migrationでは触らない。
--
-- ── 直近に同じ列を触った migration（確認済み）────────────────────────────────
--   archive/113 … status の値を正規化（active → published）
--   archive/231 … published_at が null の106件を削除（Salesforce のテストデータ）
--   archive/232 … expires_at のバックフィル → 20260719 の257 で全件 NULL に戻済み
--   いずれも本migrationの対象13件を published にした判断ではない。
--
-- ── 副作用として一緒に消えるもの（コード側で対応済み）────────────────────────
--   ow_posts の job_posted 投稿13件。`lib/feed/visibility.ts` の isJobPostAlive() が
--   published/active でない求人の告知を落とす。投稿レコード自体は残す（DELETE しない）。
--
-- ⚠️ 対象13件への応募は 0 件（ow_job_applications で確認済み）。巻き戻す申込は無い。

BEGIN;

CREATE TEMP TABLE _unpublish (id uuid PRIMARY KEY) ON COMMIT DROP;

INSERT INTO _unpublish (id) VALUES
    ('fcabb160-7fbc-436b-8775-dde831d1d14d'), -- Databricks Japan株式会社 / Enterprise Account Executive（金融・製造業界）
    ('ff8fb0e7-bf5d-47f3-a041-8dfbfc5191ec'), -- Databricks Japan株式会社 / Solutions Architect（Data/AI）
    ('bcee5792-84a6-4738-bcf7-6885391e79d8'), -- Datadog Japan株式会社 / Enterprise Account Executive
    ('7c2a70aa-4788-44a2-ab3d-0246c5f40cf5'), -- Datadog Japan株式会社 / Sales Engineer（Infrastructure/Cloud）
    ('12d08d2f-0142-43c0-a171-c1a4307001ac'), -- HubSpot Japan株式会社 / Account Executive（Mid-Market）
    ('7544bcef-19a8-4bca-9ca4-39ff175943a1'), -- HubSpot Japan株式会社 / Customer Success Manager
    ('c18b3155-47d4-4517-ace7-40f129ce9e14'), -- HubSpot Japan株式会社 / Solutions Engineer（プリセールス）
    ('317675a9-82f2-486f-84b3-742dda710a15'), -- Notion Labs Japan合同会社 / Account Executive, SMB Japan
    ('28982315-1f3c-48c6-86a0-ba336b7683ec'), -- Notion Labs Japan合同会社 / Solutions Engineer Japan
    ('6d8afa7d-10ab-422d-ba86-ce54a67e8944'), -- OpenAI Japan合同会社 / Enterprise Account Executive, Japan
    ('044f7a66-a0b6-42b2-b196-1d986966f913'), -- OpenAI Japan合同会社 / Solutions Architect, Japan
    ('e890f554-efd4-40f2-9a7a-a93502933eaf'), -- Sansan株式会社 / Railsエンジニア（名刺データ基盤）
    ('6a6a0d23-239e-48a2-b376-9270eccaaa97'); -- Sansan株式会社 / カスタマーサクセス（エンタープライズ）

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_listed   int;
  v_exists   int;
  v_pub      int;
  v_sf       int;
  v_apps     int;
BEGIN
  SELECT count(*) INTO v_listed FROM _unpublish;
  IF v_listed <> 13 THEN
    RAISE EXCEPTION '対象リストが13件でない: %', v_listed;
  END IF;

  SELECT count(*) INTO v_exists FROM _unpublish t JOIN ow_jobs j ON j.id = t.id;
  IF v_exists <> 13 THEN
    RAISE EXCEPTION '実在する対象が13件でない: %（削除済みの求人を列挙している）', v_exists;
  END IF;

  SELECT count(*) INTO v_pub
    FROM _unpublish t JOIN ow_jobs j ON j.id = t.id
    WHERE j.status IN ('published', 'active');
  IF v_pub <> 13 THEN
    RAISE EXCEPTION '公開中の対象が13件でない: %（既に誰かが変更している）', v_pub;
  END IF;

  -- ⚠️ 保留にした Salesforce の求人が紛れ込んでいないこと
  SELECT count(*) INTO v_sf
    FROM _unpublish t JOIN ow_jobs j ON j.id = t.id
    JOIN ow_companies c ON c.id = j.company_id
    WHERE c.name = '株式会社セールスフォース・ジャパン';
  IF v_sf <> 0 THEN
    RAISE EXCEPTION '保留対象（Salesforce）が % 件混ざっている', v_sf;
  END IF;

  -- ⚠️ 応募が入っている求人を黙って下ろさない
  SELECT count(*) INTO v_apps
    FROM ow_job_applications a JOIN _unpublish t ON t.id = a.job_id;
  IF v_apps <> 0 THEN
    RAISE EXCEPTION '対象求人に応募が % 件ある。下ろす前に扱いを決めること', v_apps;
  END IF;
END $$;

-- ── 本処理 ──────────────────────────────────────────────────────────────────
UPDATE ow_jobs j
SET status = 'draft'
FROM _unpublish t
WHERE j.id = t.id;

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_left  int;
  v_total int;
  v_sf    int;
BEGIN
  SELECT count(*) INTO v_left
    FROM _unpublish t JOIN ow_jobs j ON j.id = t.id
    WHERE j.status IN ('published', 'active');
  IF v_left <> 0 THEN
    RAISE EXCEPTION '対象のうち % 件が公開のまま', v_left;
  END IF;

  SELECT count(*) INTO v_total FROM ow_jobs WHERE status IN ('published', 'active');
  IF v_total <> 5 THEN
    RAISE EXCEPTION '公開求人が5件でない: %', v_total;
  END IF;

  SELECT count(*) INTO v_sf
    FROM ow_jobs j JOIN ow_companies c ON c.id = j.company_id
    WHERE j.status IN ('published', 'active')
      AND c.name = '株式会社セールスフォース・ジャパン';
  IF v_sf <> 5 THEN
    RAISE EXCEPTION '残る5件がSalesforceでない: %', v_sf;
  END IF;

  RAISE NOTICE '13件を draft に変更。公開求人は Salesforce の5件のみ。';
END $$;

COMMIT;
