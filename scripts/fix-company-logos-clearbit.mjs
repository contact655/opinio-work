/**
 * fix-company-logos-clearbit.mjs
 *
 * 全企業のロゴを Clearbit の透明背景ロゴに統一する。
 * - colored-background の simple-icons ロゴ → 透明/白背景に置き換え
 * - logo_url = null の企業 → Clearbit URL を設定
 *
 * 使い方: node scripts/fix-company-logos-clearbit.mjs
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// .env.local 読み込み
const envPath = path.resolve(process.cwd(), '.env.local');
const env = fs.readFileSync(envPath, 'utf-8');
for (const line of env.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  if (!process.env[key]) process.env[key] = val;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// 企業名 → Clearbit ドメイン のマッピング
const LOGO_MAP = {
  'Asana Japan株式会社':                    'asana.com',
  'Box Japan株式会社':                      'box.com',
  'CrowdStrike株式会社':                    'crowdstrike.com',
  'Databricks Japan株式会社':               'databricks.com',
  'Datadog Japan株式会社':                  'datadoghq.com',
  'DocuSign Japan株式会社':                 'docusign.com',
  'Dropbox Japan株式会社':                  'dropbox.com',
  'HubSpot Japan株式会社':                  'hubspot.com',
  'Indeed Japan株式会社':                   'indeed.com',
  'Meta日本法人':                           'meta.com',
  'MongoDB Japan合同会社':                  'mongodb.com',
  'New Relic株式会社':                      'newrelic.com',
  'Notion Labs Japan合同会社':              'notion.so',
  'OpenAI Japan合同会社':                   'openai.com',
  'SAPジャパン株式会社':                    'sap.com',
  'ServiceNow Japan合同会社':               'servicenow.com',
  'Slack Japan株式会社':                    'slack.com',
  'Snowflake Japan株式会社':                'snowflake.com',
  'Twilio Japan合同会社':                   'twilio.com',
  'Zendesk株式会社':                        'zendesk.com',
  'アカマイ・テクノロジーズ合同会社':       'akamai.com',
  'アップルジャパン合同会社':               'apple.com',
  'アドビ株式会社':                         'adobe.com',
  'アトラシアン株式会社':                   'atlassian.com',
  'アプティオ株式会社':                     'apptio.com',
  'アマゾン ウェブ サービス ジャパン合同会社': 'amazon.com',
  'アリスタネットワークス合同会社':         'arista.com',
  'アンソロピックジャパン合同会社':         'anthropic.com',
  'インテル株式会社':                       'intel.com',
  'ウーバー・ジャパン株式会社':             'uber.com',
  'ヴイエムウェア株式会社':                 'vmware.com',
  'ウォークミー株式会社':                   'walkme.com',
  'エヌシーノ合同会社':                     'ncino.com',
  'エヌビディア合同会社':                   'nvidia.com',
  'エラスティック株式会社':                 'elastic.co',
  'オクタ・ジャパン株式会社':               'okta.com',
  'キリバ株式会社':                         'kyriba.com',
  'グーグル合同会社':                       'google.com',
  'クーパ・ソフトウェア株式会社':           'coupa.com',
  'クアルコムジャパン合同会社':             'qualcomm.com',
  'クラウドフレア・ジャパン株式会社':       'cloudflare.com',
  'クリックハウス株式会社':                 'clickhouse.com',
  'ゲインサイト・ジャパン株式会社':         'gainsight.com',
  'コンカー株式会社':                       'concur.com',
  'コング・ジャパン株式会社':               'konghq.com',
  'コンフルエント合同会社':                 'confluent.io',
  'ザクトリー株式会社':                     'xactlycorp.com',
  'シスコシステムズ合同会社':               'cisco.com',
  'ゼットスケーラー株式会社':               'zscaler.com',
  'デル・テクノロジーズ株式会社':           'dell.com',
  'ノービフォー株式会社':                   'knowbe4.com',
  'パランティア・テクノロジーズ':           'palantir.com',
  'パロアルトネットワークス株式会社':       'paloaltonetworks.com',
  'フォーティネット株式会社':               'fortinet.com',
  'ブラックライン株式会社':                 'blackline.com',
  'ブレイズ株式会社':                       'braze.com',
  'ページャーデューティー株式会社':         'pagerduty.com',
  'マルケト株式会社':                       'marketo.com',
  'ミラクル株式会社':                       'mirakl.com',
  'レノボ・ジャパン合同会社':               'lenovo.com',
  '日本IBM株式会社':                        'ibm.com',
  '日本オラクル株式会社':                   'oracle.com',
  '日本ヒューレット・パッカード合同会社':   'hpe.com',
  '日本マイクロソフト株式会社':             'microsoft.com',
  '株式会社日本HP':                         'hp.com',
  '株式会社ワークデイ':                     'workday.com',
  '株式会社セールスフォース・ジャパン':     'salesforce.com',
};

console.log(`📋 ${Object.keys(LOGO_MAP).length} 社のロゴを Clearbit URL に更新します...\n`);

let ok = 0, fail = 0;

for (const [name, domain] of Object.entries(LOGO_MAP)) {
  const clearbitUrl = `https://logo.clearbit.com/${domain}`;
  process.stdout.write(`  ${name} ... `);

  const { error } = await supabase
    .from('ow_companies')
    .update({ logo_url: clearbitUrl })
    .eq('name', name);

  if (error) {
    console.log(`❌ ${error.message}`);
    fail++;
  } else {
    console.log(`✅ ${clearbitUrl}`);
    ok++;
  }
}

console.log(`\n📊 完了: ✅ ${ok} 件成功 / ❌ ${fail} 件失敗`);
console.log('\n💡 ヒント: Clearbit が返せないロゴは onError で gradient+letter フォールバックが表示されます。');
