/**
 * set-missing-logo-urls.mjs
 * Storage にないロゴを Wikipedia / 公式 SVG/PNG URL で直接 DB に設定する
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const env = fs.readFileSync(envPath, 'utf-8');
for (const line of env.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
  if (!process.env[key]) process.env[key] = val;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const LOGO_URLS = {
  'CrowdStrike株式会社':
    'https://upload.wikimedia.org/wikipedia/commons/7/75/CrowdStrike_Logo_2023.png',
  'ServiceNow Japan合同会社':
    'https://upload.wikimedia.org/wikipedia/commons/5/57/ServiceNow_logo.svg',
  'Slack Japan株式会社':
    'https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg',
  '日本ヒューレット・パッカード合同会社':
    'https://upload.wikimedia.org/wikipedia/commons/a/a7/Hewlett_Packard_Enterprise_logo.svg',
  '株式会社日本HP':
    'https://upload.wikimedia.org/wikipedia/commons/a/ad/HP_logo_2012.svg',
  'アプティオ株式会社':
    'https://upload.wikimedia.org/wikipedia/commons/5/51/IBM_logo.svg',
  'アリスタネットワークス合同会社':
    'https://upload.wikimedia.org/wikipedia/commons/4/44/Arista_Networks_logo.svg',
  'ウォークミー株式会社':
    null,  // Wikipedia なし → gradient fallback のまま
  'エヌシーノ合同会社':
    null,  // Wikipedia なし → gradient fallback のまま
  'クーパ・ソフトウェア株式会社':
    'https://upload.wikimedia.org/wikipedia/commons/2/2e/Coupa_Software_logo.svg',
  'ノービフォー株式会社':
    null,  // Wikipedia なし → gradient fallback のまま
  'ブラックライン株式会社':
    'https://upload.wikimedia.org/wikipedia/commons/c/ce/BlackLine_Inc_logo.svg',
};

let ok = 0, skip = 0;
for (const [name, url] of Object.entries(LOGO_URLS)) {
  if (!url) { console.log(`  ⚠ ${name} — URLなし（gradient fallback）`); skip++; continue; }

  process.stdout.write(`  ${name} ... `);
  const { error } = await supabase
    .from('ow_companies')
    .update({ logo_url: url })
    .eq('name', name);

  if (error) { console.log(`❌ ${error.message}`); }
  else { console.log(`✅`); ok++; }
}

console.log(`\n完了: ✅ ${ok} / ⚠ ${skip} (fallback)`);
