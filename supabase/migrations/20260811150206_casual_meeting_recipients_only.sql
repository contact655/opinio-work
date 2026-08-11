-- カジュアル面談の受付フラグを「宛先がある企業」だけに戻す
--
-- ── なぜ必要か ──────────────────────────────────────────────────────────────
-- archive/258_enable_casual_meetings_all_companies.sql が
--     UPDATE ow_companies SET accepting_casual_meetings = true WHERE is_published = true;
-- で全社を true にし、その直前の archive/170_disable_casual_meetings_6companies.sql
-- （「LayerX / PKSHA / Ubie / freee / SmartHR / Sansan は現時点で面談を受け付けて
--   いないためバッジを非表示にする」と明記して個別に false にしていた）を
-- 理由もろとも打ち消していた。
--
-- 結果、2026-08-11 時点で公開76社すべてが「面談受付中」と表示され、
-- 全社で申込フォームが実際に送信可能だった。届く先を持つのは2社しかない。
--
-- ⚠️ この migration は**同じ過ちを繰り返さないため対象を明示列挙する。**
--    `WHERE is_published = true` のような一括条件は使わない。
--
-- ── 直近に同じ列を触った migration（確認済み）────────────────────────────────
--   archive/170 … 6社を false（打ち消されていた）→ 本migrationで実質復元される
--                 （LayerX / freee は企業ごと削除済みのため対象に現れない）
--   archive/258 … 公開全社を true ← これを取り消すのが本migrationの目的
--   archive/275 … スマートキャンプ1社（非公開）。本migrationの対象外
--
-- ── 対象 ────────────────────────────────────────────────────────────────────
--   公開中 かつ accepting_casual_meetings = true かつ **宛先が0件** の74社
--   宛先の定義は src/lib/notify/recipients.ts と同じ:
--     ① ow_companies.notification_emails に @ を含む値があればそれ
--     ② 無ければ ow_company_admins（permission='admin' かつ is_active）の ow_users.email
--
-- ⚠️ DELETE はしない。フラグの UPDATE と DEFAULT の変更のみ。

BEGIN;

-- ── 対象企業（74社）を一時表に置く ───────────────────────────────────────────
CREATE TEMP TABLE _targets (id uuid PRIMARY KEY) ON COMMIT DROP;

INSERT INTO _targets (id) VALUES
    ('6c218a59-a951-44ee-9003-163956376554'), -- Asana Japan株式会社
    ('c7353772-0c07-4f0d-8d20-294215125303'), -- Box Japan株式会社
    ('87bcae88-2779-4bf7-b461-b3c8661b2764'), -- CrowdStrike株式会社
    ('ae15610d-477a-410d-b74a-54ab3e351add'), -- Databricks Japan株式会社
    ('a5ffac90-70aa-4242-b867-6d9334317851'), -- Datadog Japan株式会社
    ('da8cfab5-f5c2-4648-b866-895be46a1494'), -- DocuSign Japan株式会社
    ('1f73df31-8e55-4e70-a928-afe1150d72d0'), -- Dropbox Japan株式会社
    ('aaaaaaaa-0001-0001-0001-000000000007'), -- HubSpot Japan株式会社
    ('e7e9b0be-20c2-4434-afea-7a27c89332e2'), -- Indeed Japan株式会社
    ('0ece9af4-96cb-443c-b8a8-0f358c8e3a64'), -- Meta日本法人
    ('565b0f13-252d-44d0-8b90-e00acacf4b75'), -- MongoDB Japan合同会社
    ('0d4734e0-0717-475e-a6d1-806aa2cd45ff'), -- New Relic株式会社
    ('bf24736f-fa65-4c5a-9764-98c96ace3b07'), -- Notion Labs Japan合同会社
    ('daa558e5-054f-4475-ab00-3817170759ce'), -- OpenAI Japan合同会社
    ('8b9f84b0-b4be-4191-8322-07c6a2e5e91a'), -- Sansan株式会社          ← archive/170 が false にしていた
    ('bcea5e4e-94ee-4019-8ce3-237a7edf79a7'), -- SAPジャパン株式会社
    ('4df6e844-74d6-4f50-98f9-08468a12f1dc'), -- ServiceNow Japan合同会社
    ('cd4d23ca-d2cd-4e5d-bd2f-ad63d3533e16'), -- Slack Japan株式会社
    ('cb70da1c-4b3b-429b-a06b-cdc2c50172f8'), -- Snowflake Japan株式会社
    ('88defb4b-b18c-437b-8b7d-d41a43232af4'), -- Twilio Japan合同会社
    ('fb7397eb-a9c7-4ce3-964a-d7a72159847f'), -- Ubie株式会社            ← archive/170 が false にしていた
    ('d6650b18-5ef2-40c9-9938-2adbad70fe2b'), -- Zendesk株式会社
    ('6396920c-70d3-47d2-9f4e-67bc2efe262f'), -- アカマイ・テクノロジーズ合同会社
    ('dcd2c652-4335-4031-b4d2-a4f22c98182b'), -- アップルジャパン合同会社
    ('eccd3dfb-decd-4277-a3a4-df489d3b3e5e'), -- アドビ株式会社
    ('fc1f7cb7-9530-4d6a-85cf-15196a4b155e'), -- アトラシアン株式会社
    ('08e4aff6-a12c-4963-ad43-960ac9e39967'), -- アプティオ株式会社
    ('a9de1561-eb91-4ebf-842d-f6d39865b7ef'), -- アマゾン ウェブ サービス ジャパン合同会社
    ('3efd857e-315c-4650-9727-1e5aa1245753'), -- アリスタネットワークス合同会社
    ('f32e6905-f25f-4c01-b64f-c5695fd45a1d'), -- アンソロピックジャパン合同会社
    ('ec97fde1-6f22-4ab5-89ee-9cea0b258f2a'), -- インテル株式会社
    ('943620b5-0fa2-48b4-a072-d47f900ba9f0'), -- ウーバー・ジャパン株式会社
    ('7dac3c6e-bc5f-4550-9170-4338ea809be2'), -- ヴイエムウェア株式会社
    ('e3eafa66-02ce-4060-a5fe-57e4317c8e7c'), -- ウォークミー株式会社
    ('b8aa0e3d-828c-4bbe-b588-88450aab5739'), -- エヌシーノ合同会社
    ('829a1ea9-d577-4404-9ba7-e301680523a8'), -- エヌビディア合同会社
    ('1e541353-c177-40a9-968a-af3af14e1194'), -- エラスティック株式会社
    ('f8ebbe74-b647-46ea-869f-b126d1c4f316'), -- オクタ・ジャパン株式会社
    ('a1a7036b-a5c4-4328-b5db-96ac1d5e29df'), -- キリバ株式会社
    ('7d186c45-ce23-4d96-8eae-cd6e7c00faee'), -- グーグル合同会社
    ('1027a327-18c0-4191-b27b-a28bf5781126'), -- クーパ・ソフトウェア株式会社
    ('94edfbe5-0496-4c1d-865c-d2d448232135'), -- クアルコムジャパン合同会社
    ('0a216ebb-c1fa-4d19-b066-f45e45c3ba2e'), -- クラウドフレア・ジャパン株式会社
    ('1413b97e-ef19-4e40-87ae-e31ac8996bdd'), -- クリックハウス株式会社
    ('4fecbf31-498c-40b0-a04e-3a6cb978433f'), -- ゲインサイト・ジャパン株式会社
    ('91523b3b-15e4-4f6b-8c9b-a90b67552b9e'), -- コンカー株式会社
    ('e459ac79-5dad-499d-bb65-b758d4281123'), -- コング・ジャパン株式会社
    ('9ccf1640-6a5c-42e3-bbcf-4110f715fbf4'), -- コンフルエント合同会社
    ('1241f8a5-b645-4aa2-9fa1-bbfc573f1774'), -- ザクトリー株式会社
    ('27988ac1-fd93-445d-a9fd-6dad74c92686'), -- シスコシステムズ合同会社
    ('dd76b17d-e3c1-44a9-b747-4ecde10b8cec'), -- ゼットスケーラー株式会社
    ('f4acddc0-c746-4537-9edf-6f3c1f2c90b3'), -- デル・テクノロジーズ株式会社
    ('99132c64-ff07-4945-aeb6-7e21e6c256c9'), -- ノービフォー株式会社
    ('be74d989-db8f-4be1-882c-40cf94e07fe2'), -- パランティア・テクノロジーズ
    ('f4a6aa23-3775-4548-981b-156e416ef6f6'), -- パロアルトネットワークス株式会社
    ('3122e2ce-a1bc-4e6c-9dc9-4612b5cccfc2'), -- フォーティネット株式会社
    ('53ea9a54-feef-413b-8a7c-e31e4def2e11'), -- ブラックライン株式会社
    ('478a9ede-ea0f-48c1-859c-d47f84d35b6b'), -- ブレイズ株式会社
    ('7baafcb1-d929-46c1-97be-b0fb580b480b'), -- ページャーデューティー株式会社
    ('e4d317d3-48b9-4718-ae3e-8d27147d05f5'), -- マルケト株式会社
    ('355ce5c6-0412-4512-8864-1d477c97c917'), -- ミラクル株式会社
    ('f201ed17-a9e2-4859-85aa-474578b2870d'), -- レノボ・ジャパン合同会社
    ('9ef65fa1-e04b-4098-a7b1-4ee3d535a23a'), -- 日本IBM株式会社
    ('1f8010f2-ba3f-4f7a-b7f4-d5b60400e638'), -- 日本オラクル株式会社
    ('9e8bb2c2-2a02-4703-89b0-5d9c4d1981d6'), -- 日本ヒューレット・パッカード合同会社
    ('40dca29e-aa4b-4654-aada-8e29763f8521'), -- 日本マイクロソフト株式会社
    ('63d390da-e8c4-464a-8c30-e112fcd2709c'), -- 株式会社irodas
    ('09d67e54-0381-45c8-b698-568e1fc47033'), -- 株式会社PKSHA Technology ← archive/170 が false にしていた
    ('81aa95dc-2304-4faa-9c4a-f2f5454e8e11'), -- 株式会社SmartHR          ← archive/170 が false にしていた
    ('d1c26664-5643-42bc-84e4-6f0c940bb39d'), -- 株式会社Translead
    ('28b826eb-fb86-4124-aa08-c489cad662f1'), -- 株式会社シンカ
    ('2e54ff06-2f4d-420c-9a5c-9a80a85ca55a'), -- 株式会社タイミー
    ('8dc04d46-3430-45de-91f8-e37c8880b8a5'), -- 株式会社ワークデイ
    ('c32027b9-cfbd-4a70-bf4c-464e42790db4'); -- 株式会社日本HP

-- ── 事前チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_targets   int;
  v_exists    int;
  v_true_now  int;
  v_recipient int;
BEGIN
  SELECT count(*) INTO v_targets FROM _targets;
  IF v_targets <> 74 THEN
    RAISE EXCEPTION '対象リストが74社でない: %', v_targets;
  END IF;

  -- 列挙した企業が全て実在するか（企業を削除した後に流すと取りこぼす）
  SELECT count(*) INTO v_exists
    FROM _targets t JOIN ow_companies c ON c.id = t.id;
  IF v_exists <> 74 THEN
    RAISE EXCEPTION '実在する対象が74社でない: %（削除済みの企業を列挙している）', v_exists;
  END IF;

  -- 全て「公開 かつ 現在 true」であること
  SELECT count(*) INTO v_true_now
    FROM _targets t JOIN ow_companies c ON c.id = t.id
    WHERE c.is_published AND c.accepting_casual_meetings;
  IF v_true_now <> 74 THEN
    RAISE EXCEPTION '公開かつ true の対象が74社でない: %（既に誰かが変更している）', v_true_now;
  END IF;

  -- ⚠️ 対象に「宛先を持つ企業」が混ざっていないこと。混ざっていたら受付を奪うことになる
  SELECT count(*) INTO v_recipient
    FROM _targets t JOIN ow_companies c ON c.id = t.id
    WHERE coalesce(array_length(
            array(SELECT e FROM unnest(coalesce(c.notification_emails, '{}')) e WHERE e LIKE '%@%'), 1), 0) > 0
       OR EXISTS (
            SELECT 1 FROM ow_company_admins a JOIN ow_users u ON u.id = a.user_id
            WHERE a.company_id = c.id AND a.permission = 'admin' AND a.is_active AND u.email LIKE '%@%');
  IF v_recipient <> 0 THEN
    RAISE EXCEPTION '対象に宛先を持つ企業が % 社混ざっている', v_recipient;
  END IF;
END $$;

-- ── 本処理 ──────────────────────────────────────────────────────────────────
UPDATE ow_companies c
SET accepting_casual_meetings = false
FROM _targets t
WHERE c.id = t.id;

-- ⚠️ 既定値が true だった。企業を作った瞬間に「面談受付中」になる状態を止める。
--    受け付けるかどうかは企業が /biz/company で明示的に有効化する。
ALTER TABLE ow_companies ALTER COLUMN accepting_casual_meetings SET DEFAULT false;

-- ── 事後チェック ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_left      int;
  v_open_pub  int;
  v_orphan    int;
  v_default   text;
BEGIN
  SELECT count(*) INTO v_left
    FROM _targets t JOIN ow_companies c ON c.id = t.id
    WHERE c.accepting_casual_meetings;
  IF v_left <> 0 THEN
    RAISE EXCEPTION '対象のうち % 社が true のまま', v_left;
  END IF;

  -- 公開企業で受付中なのは「宛先を持つ2社」だけになったか
  SELECT count(*) INTO v_open_pub
    FROM ow_companies c WHERE c.is_published AND c.accepting_casual_meetings;
  IF v_open_pub <> 2 THEN
    RAISE EXCEPTION '公開かつ受付中が2社でない: %', v_open_pub;
  END IF;

  -- 受付中なのに宛先が無い企業が1社も残っていないこと（非公開も含めて確認する）
  SELECT count(*) INTO v_orphan
    FROM ow_companies c
    WHERE c.accepting_casual_meetings
      AND NOT (
        coalesce(array_length(
          array(SELECT e FROM unnest(coalesce(c.notification_emails, '{}')) e WHERE e LIKE '%@%'), 1), 0) > 0
        OR EXISTS (
          SELECT 1 FROM ow_company_admins a JOIN ow_users u ON u.id = a.user_id
          WHERE a.company_id = c.id AND a.permission = 'admin' AND a.is_active AND u.email LIKE '%@%'));
  IF v_orphan <> 0 THEN
    RAISE EXCEPTION '宛先が無いのに受付中の企業が % 社残っている', v_orphan;
  END IF;

  SELECT column_default INTO v_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ow_companies'
      AND column_name = 'accepting_casual_meetings';
  IF v_default IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION '既定値が false になっていない: %', coalesce(v_default, '(null)');
  END IF;

  RAISE NOTICE '74社を false に変更。公開かつ受付中は2社。既定値を false に変更。';
END $$;

COMMIT;
