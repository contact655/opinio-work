/**
 * scripts/upload-company-logos-retry.mjs
 *
 * 1回目のスクリプトで失敗した企業に対して
 * 手動で調査した直接URLからロゴをダウンロードしてアップロードする
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// .env.local を読む
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

// ── 失敗した企業の直接ロゴURL ───────────────────────────────────────────────
const DIRECT_LOGO_URLS = {
  'アマゾン ウェブ サービス ジャパン合同会社': 'https://upload.wikimedia.org/wikipedia/commons/9/93/Amazon_Web_Services_Logo.svg',
  '日本マイクロソフト株式会社':               'https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg',
  'グーグル合同会社':                          'https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg',
  'Box Japan株式会社':                         'https://upload.wikimedia.org/wikipedia/commons/5/57/Box%2C_Inc._logo.svg',
  'CrowdStrike株式会社':                       'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/CrowdStrike_Logo_2023.png/640px-CrowdStrike_Logo_2023.png',
  'Dropbox Japan株式会社':                     'https://upload.wikimedia.org/wikipedia/commons/7/74/Dropbox_logo_%282013%29.svg',
  'HubSpot Japan株式会社':                     'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/HubSpot_Logo.svg/640px-HubSpot_Logo.svg.png',
  'Indeed Japan株式会社':                      'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Indeed_logo.svg/640px-Indeed_logo.svg.png',
  'Meta日本法人':                              'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Meta_Platforms_Inc._logo.svg/640px-Meta_Platforms_Inc._logo.svg.png',
  'OpenAI Japan合同会社':                      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/OpenAI_Logo.svg/640px-OpenAI_Logo.svg.png',
  'ServiceNow Japan合同会社':                  'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/ServiceNow_logo.svg/640px-ServiceNow_logo.svg.png',
  'Slack Japan株式会社':                       'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Slack_icon_2019.svg/640px-Slack_icon_2019.svg.png',
  'アカマイ・テクノロジーズ合同会社':          'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Akamai_Technologies_Logo.svg/640px-Akamai_Technologies_Logo.svg.png',
  'アトラシアン株式会社':                      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Atlassian-Logo.svg/640px-Atlassian-Logo.svg.png',
  'アプティオ株式会社':                        'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Apptio_logo.svg/640px-Apptio_logo.svg.png',
  'アリスタネットワークス合同会社':            'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Arista_Networks_logo.svg/640px-Arista_Networks_logo.svg.png',
  'インテル株式会社':                          'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Intel_logo_%282006-2020%29.svg/640px-Intel_logo_%282006-2020%29.svg.png',
  'ウーバー・ジャパン株式会社':                'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Uber_logo_2018.svg/640px-Uber_logo_2018.svg.png',
  'エヌシーノ合同会社':                        'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/NcIno_logo.svg/640px-NcIno_logo.svg.png',
  'エヌビディア合同会社':                      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Nvidia_logo.svg/640px-Nvidia_logo.svg.png',
  'クラウドフレア・ジャパン株式会社':          'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Cloudflare_Logo.png/640px-Cloudflare_Logo.png',
  'クリックハウス株式会社':                    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/ClickHouse_Logo.svg/640px-ClickHouse_Logo.svg.png',
  'クーパ・ソフトウェア株式会社':              'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Coupa_logo.svg/640px-Coupa_logo.svg.png',
  'フォーティネット株式会社':                  'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Fortinet_logo.svg/640px-Fortinet_logo.svg.png',
  'ブラックライン株式会社':                    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/BlackLine_Logo.svg/640px-BlackLine_Logo.svg.png',
  'マルケト株式会社':                          'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Marketo_logo.svg/640px-Marketo_logo.svg.png',
  'レノボ・ジャパン合同会社':                  'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Lenovo_logo_2015.svg/640px-Lenovo_logo_2015.svg.png',
  '日本オラクル株式会社':                      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Oracle_logo.svg/640px-Oracle_logo.svg.png',
  '日本ヒューレット・パッカード合同会社':      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Hewlett_Packard_Enterprise_logo.svg/640px-Hewlett_Packard_Enterprise_logo.svg.png',
  'ノービフォー株式会社':                      'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/KnowBe4-Logo.png/640px-KnowBe4-Logo.png',
  '株式会社日本HP':                            'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/HP_logo_2012.svg/640px-HP_logo_2012.svg.png',
};

// ── 画像ダウンロード（SVG 含む）────────────────────────────────────────────
async function downloadImage(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OpinioBot/1.0)',
        'Accept': 'image/*,*/*',
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') ?? 'image/png';
    if (!contentType.startsWith('image/') && !contentType.includes('svg')) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = contentType.includes('svg') ? 'svg'
               : contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg'
               : contentType.includes('webp') ? 'webp'
               : 'png';
    const ct = contentType.includes('svg') ? 'image/svg+xml'
              : contentType.split(';')[0];
    return { buffer, ext, contentType: ct };
  } catch {
    return null;
  }
}

// ── Wikimedia の PNG サムネイルURL を SVG から生成 ─────────────────────────
// Wikimedia SVG URL → PNG Thumbnail URL の変換を試みる
function wikimediaSvgToPng(svgUrl) {
  const match = svgUrl.match(/\/commons\/(thumb\/)?([^?]+?)(?:\/\d+px-[^/]+)?\.svg(?:\.png)?$/);
  if (!match) return null;
  const filePart = match[2];
  const fileName = filePart.split('/').pop();
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${filePart}.svg/320px-${fileName}.svg.png`;
}

// ── メイン ─────────────────────────────────────────────────────────────────
const { data: companies } = await supabase
  .from('ow_companies')
  .select('id, name, logo_url')
  .eq('is_published', true)
  .order('name');

// logo_url が Clearbit URL（失敗中）または null の企業のみ対象
const targets = companies.filter(c =>
  !c.logo_url ||
  c.logo_url.includes('logo.clearbit.com') ||
  c.logo_url.includes('supabase.co') === false
);

console.log(`リトライ対象: ${Object.keys(DIRECT_LOGO_URLS).length} 社\n`);

let success = 0, fail = 0;

for (const [companyName, logoUrl] of Object.entries(DIRECT_LOGO_URLS)) {
  const company = companies.find(c => c.name === companyName);
  if (!company) {
    console.log(`⚠️  ${companyName} — DBに見つかりません`);
    continue;
  }

  process.stdout.write(`[処理中] ${companyName} ... `);

  // PNG サムネイルに変換（SVG直接でもOK）
  const img = await downloadImage(logoUrl);
  if (!img) {
    // Wikimedia SVG → PNG thumbnail に変換して再試行
    const pngUrl = wikimediaSvgToPng(logoUrl);
    if (pngUrl) {
      const img2 = await downloadImage(pngUrl);
      if (img2) {
        await uploadAndUpdate(company, img2, companyName);
        success++;
        continue;
      }
    }
    console.log(`❌ ダウンロード失敗`);
    fail++;
    continue;
  }

  await uploadAndUpdate(company, img, companyName);
  success++;
  await new Promise(r => setTimeout(r, 300));
}

async function uploadAndUpdate(company, img, name) {
  const storagePath = `companies/logos/${company.id}/logo.${img.ext}`;
  const { error: uploadErr } = await supabase.storage
    .from('ow-uploads')
    .upload(storagePath, img.buffer, { contentType: img.contentType, upsert: true });

  if (uploadErr) {
    console.log(`❌ アップロード失敗: ${uploadErr.message}`);
    fail++;
    return;
  }

  const { data: { publicUrl } } = supabase.storage.from('ow-uploads').getPublicUrl(storagePath);

  const { error: dbErr } = await supabase
    .from('ow_companies')
    .update({ logo_url: publicUrl })
    .eq('id', company.id);

  if (dbErr) {
    console.log(`❌ DB更新失敗: ${dbErr.message}`);
    fail++;
    return;
  }

  console.log(`✅ ${img.ext.toUpperCase()} (${Math.round(img.buffer.length / 1024)}KB)`);
}

console.log(`\n完了: ✅ ${success} 社 / ❌ ${fail} 社`);
