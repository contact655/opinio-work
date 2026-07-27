-- Migration 158: Clearbit ロゴ URL 設定
-- https://logo.clearbit.com/{domain} で無料取得できるロゴを logo_url に設定
-- 画像取得失敗時はフロントエンド側で gradient + 頭文字にフォールバック

-- ── メガクラウド ──────────────────────────────────────────────────────────────

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/aws.amazon.com'
WHERE name = 'アマゾン ウェブ サービス ジャパン合同会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/microsoft.com'
WHERE name = '日本マイクロソフト株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/google.com'
WHERE name = 'グーグル合同会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/oracle.com'
WHERE name = '日本オラクル株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/ibm.com'
WHERE name = '日本IBM株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/sap.com'
WHERE name = 'SAPジャパン株式会社';

-- ── SaaS ─────────────────────────────────────────────────────────────────────

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/servicenow.com'
WHERE name = 'ServiceNow Japan合同会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/workday.com'
WHERE name = '株式会社ワークデイ';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/hubspot.com'
WHERE name = 'HubSpot Japan株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/zendesk.com'
WHERE name = 'Zendesk株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/slack.com'
WHERE name = 'Slack Japan株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/atlassian.com'
WHERE name = 'アトラシアン株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/box.com'
WHERE name = 'Box Japan株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/docusign.com'
WHERE name = 'DocuSign Japan株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/dropbox.com'
WHERE name = 'Dropbox Japan株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/asana.com'
WHERE name = 'Asana Japan株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/notion.so'
WHERE name = 'Notion Labs Japan合同会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/twilio.com'
WHERE name = 'Twilio Japan合同会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/okta.com'
WHERE name = 'オクタ・ジャパン株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/braze.com'
WHERE name = 'ブレイズ株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/pagerduty.com'
WHERE name = 'ページャーデューティー株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/marketo.com'
WHERE name = 'マルケト株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/concur.com'
WHERE name = 'コンカー株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/coupa.com'
WHERE name = 'クーパ・ソフトウェア株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/gainsight.com'
WHERE name = 'ゲインサイト・ジャパン株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/walkme.com'
WHERE name = 'ウォークミー株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/blackline.com'
WHERE name = 'ブラックライン株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/xactlycorp.com'
WHERE name = 'ザクトリー株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/kyriba.com'
WHERE name = 'キリバ株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/apptio.com'
WHERE name = 'アプティオ株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/ncino.com'
WHERE name = 'エヌシーノ合同会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/mirakl.com'
WHERE name = 'ミラクル株式会社';

-- ── セキュリティ ──────────────────────────────────────────────────────────────

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/crowdstrike.com'
WHERE name = 'CrowdStrike株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/paloaltonetworks.com'
WHERE name = 'パロアルトネットワークス株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/zscaler.com'
WHERE name = 'ゼットスケーラー株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/fortinet.com'
WHERE name = 'フォーティネット株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/cloudflare.com'
WHERE name = 'クラウドフレア・ジャパン株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/okta.com'
WHERE name = 'オクタ・ジャパン株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/akamai.com'
WHERE name = 'アカマイ・テクノロジーズ合同会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/knowbe4.com'
WHERE name = 'ノービフォー株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/konghq.com'
WHERE name = 'コング・ジャパン株式会社';

-- ── ハードウェア ──────────────────────────────────────────────────────────────

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/apple.com'
WHERE name = 'アップルジャパン合同会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/intel.com'
WHERE name = 'インテル株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/nvidia.com'
WHERE name = 'エヌビディア合同会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/dell.com'
WHERE name = 'デル・テクノロジーズ株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/qualcomm.com'
WHERE name = 'クアルコムジャパン合同会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/lenovo.com'
WHERE name = 'レノボ・ジャパン合同会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/hpe.com'
WHERE name = '日本ヒューレット・パッカード合同会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/hp.com'
WHERE name = '株式会社日本HP';

-- ── ネットワーク ──────────────────────────────────────────────────────────────

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/cisco.com'
WHERE name = 'シスコシステムズ合同会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/arista.com'
WHERE name = 'アリスタネットワークス合同会社';

-- ── データ / AI ───────────────────────────────────────────────────────────────

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/databricks.com'
WHERE name = 'Databricks Japan株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/snowflake.com'
WHERE name = 'Snowflake Japan株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/mongodb.com'
WHERE name = 'MongoDB Japan合同会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/elastic.co'
WHERE name = 'エラスティック株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/confluent.io'
WHERE name = 'コンフルエント合同会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/clickhouse.com'
WHERE name = 'クリックハウス株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/palantir.com'
WHERE name = 'パランティア・テクノロジーズ';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/datadoghq.com'
WHERE name = 'Datadog Japan株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/newrelic.com'
WHERE name = 'New Relic株式会社';

-- ── その他 ───────────────────────────────────────────────────────────────────

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/adobe.com'
WHERE name = 'アドビ株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/vmware.com'
WHERE name = 'ヴイエムウェア株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/openai.com'
WHERE name = 'OpenAI Japan合同会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/anthropic.com'
WHERE name = 'アンソロピックジャパン合同会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/meta.com'
WHERE name = 'Meta日本法人';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/uber.com'
WHERE name = 'ウーバー・ジャパン株式会社';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/indeed.com'
WHERE name = 'Indeed Japan株式会社';

-- ── 既存日本企業（Clearbit にあれば表示、なければフォールバック）──────────────

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/salesforce.com'
WHERE name = '株式会社セールスフォース・ジャパン';

UPDATE ow_companies SET logo_url = 'https://logo.clearbit.com/timee.co.jp'
WHERE name = '株式会社タイミー';
