/**
 * Wikimedia サムネイル PNG を使ってロゴをアップロードする（第2リトライ）
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const env = fs.readFileSync(envPath, 'utf-8');
for (const line of env.split('\n')) {
  const [k, ...rest] = line.split('=');
  if (k && rest.length) process.env[k.trim()] = rest.join('=').trim();
}
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ── Wikimedia サムネイル PNG URL（SVGではなくPNG版）──────────────────────────
// 形式: https://upload.wikimedia.org/wikipedia/commons/thumb/{hash1}/{hash2}/{filename}.svg/320px-{filename}.svg.png
const DIRECT_LOGO_URLS = {
  'アマゾン ウェブ サービス ジャパン合同会社':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Amazon_Web_Services_Logo.svg/320px-Amazon_Web_Services_Logo.svg.png',
  '日本マイクロソフト株式会社':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Microsoft_logo.svg/320px-Microsoft_logo.svg.png',
  'グーグル合同会社':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Google_2015_logo.svg/320px-Google_2015_logo.svg.png',
  'Box Japan株式会社':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Box%2C_Inc._logo.svg/320px-Box%2C_Inc._logo.svg.png',
  'CrowdStrike株式会社':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/CrowdStrike_Logo_2023.png/320px-CrowdStrike_Logo_2023.png',
  'Dropbox Japan株式会社':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Dropbox_logo_%282013%29.svg/320px-Dropbox_logo_%282013%29.svg.png',
  'HubSpot Japan株式会社':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/HubSpot_Logo.svg/320px-HubSpot_Logo.svg.png',
  'Indeed Japan株式会社':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Indeed_logo.svg/320px-Indeed_logo.svg.png',
  'Meta日本法人':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Meta_Platforms_Inc._logo.svg/320px-Meta_Platforms_Inc._logo.svg.png',
  'OpenAI Japan合同会社':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/OpenAI_Logo.svg/320px-OpenAI_Logo.svg.png',
  'ServiceNow Japan合同会社':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/ServiceNow_logo.svg/320px-ServiceNow_logo.svg.png',
  'Slack Japan株式会社':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Slack_icon_2019.svg/320px-Slack_icon_2019.svg.png',
  'アカマイ・テクノロジーズ合同会社':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Akamai_Technologies_Logo.svg/320px-Akamai_Technologies_Logo.svg.png',
  'アトラシアン株式会社':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Atlassian-Logo.svg/320px-Atlassian-Logo.svg.png',
  'インテル株式会社':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Intel_logo_%282006-2020%29.svg/320px-Intel_logo_%282006-2020%29.svg.png',
  'ウーバー・ジャパン株式会社':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Uber_logo_2018.svg/320px-Uber_logo_2018.svg.png',
  'エヌビディア合同会社':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Nvidia_logo.svg/320px-Nvidia_logo.svg.png',
  'クラウドフレア・ジャパン株式会社':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Cloudflare_Logo.png/320px-Cloudflare_Logo.png',
  'フォーティネット株式会社':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Fortinet_logo.svg/320px-Fortinet_logo.svg.png',
  'レノボ・ジャパン合同会社':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Lenovo_logo_2015.svg/320px-Lenovo_logo_2015.svg.png',
  '日本オラクル株式会社':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Oracle_logo.svg/320px-Oracle_logo.svg.png',
  '日本ヒューレット・パッカード合同会社':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Hewlett_Packard_Enterprise_logo.svg/320px-Hewlett_Packard_Enterprise_logo.svg.png',
  '株式会社日本HP':
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/HP_logo_2012.svg/320px-HP_logo_2012.svg.png',
};

async function downloadImage(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://en.wikipedia.org/',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    if (!res.ok) { console.log(`  HTTP ${res.status}`); return null; }
    const contentType = res.headers.get('content-type') ?? 'image/png';
    if (!contentType.startsWith('image/')) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png';
    return { buffer, ext, contentType: 'image/png' };
  } catch (e) {
    console.log(`  error: ${e.message}`);
    return null;
  }
}

const { data: companies } = await supabase
  .from('ow_companies').select('id, name').eq('is_published', true);

let success = 0, fail = 0;

for (const [companyName, logoUrl] of Object.entries(DIRECT_LOGO_URLS)) {
  const company = companies.find(c => c.name === companyName);
  if (!company) { console.log(`⚠️  ${companyName} — DBに見つかりません`); continue; }

  process.stdout.write(`[${companyName}] ... `);

  const img = await downloadImage(logoUrl);
  if (!img) { fail++; continue; }

  const storagePath = `companies/logos/${company.id}/logo.${img.ext}`;
  const { error: uploadErr } = await supabase.storage.from('ow-uploads')
    .upload(storagePath, img.buffer, { contentType: img.contentType, upsert: true });

  if (uploadErr) { console.log(`❌ ${uploadErr.message}`); fail++; continue; }

  const { data: { publicUrl } } = supabase.storage.from('ow-uploads').getPublicUrl(storagePath);
  await supabase.from('ow_companies').update({ logo_url: publicUrl }).eq('id', company.id);

  console.log(`✅ (${Math.round(img.buffer.length / 1024)}KB)`);
  success++;
  await new Promise(r => setTimeout(r, 400));
}

console.log(`\n完了: ✅ ${success} / ❌ ${fail}`);
