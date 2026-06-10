/**
 * upload-missing-logos.mjs
 * Storage にファイルがない残り12社のロゴをダウンロード→Storage→DB更新
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

// ロゴの直接DLソース（Wikimedia PNG or 公式サイトアセット）
const TARGETS = [
  {
    name: 'CrowdStrike株式会社',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/CrowdStrike_Logo_2023.png/320px-CrowdStrike_Logo_2023.png',
  },
  {
    name: 'ServiceNow Japan合同会社',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/ServiceNow_logo.svg/320px-ServiceNow_logo.svg.png',
  },
  {
    name: 'Slack Japan株式会社',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Slack_icon_2019.svg/320px-Slack_icon_2019.svg.png',
  },
  {
    name: '日本ヒューレット・パッカード合同会社',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Hewlett_Packard_Enterprise_logo.svg/320px-Hewlett_Packard_Enterprise_logo.svg.png',
  },
  {
    name: '株式会社日本HP',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/HP_logo_2012.svg/320px-HP_logo_2012.svg.png',
  },
  // 以下は公式サイトのfaviconを使う（Wikimediaに掲載なし）
  {
    name: 'アプティオ株式会社',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/IBM_logo.svg/320px-IBM_logo.svg.png', // Apptio is now IBM → IBMロゴ
  },
  {
    name: 'アリスタネットワークス合同会社',
    url: 'https://www.arista.com/assets/images/logo/Arista_logo.png',
  },
  {
    name: 'ウォークミー株式会社',
    url: 'https://resources.workato.com/wp-content/uploads/2021/02/walkme-logo.png',
  },
  {
    name: 'エヌシーノ合同会社',
    url: 'https://www.ncino.com/wp-content/uploads/2021/03/ncino-logo.png',
  },
  {
    name: 'クーパ・ソフトウェア株式会社',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Coupa_Software_logo.svg/320px-Coupa_Software_logo.svg.png',
  },
  {
    name: 'ノービフォー株式会社',
    url: 'https://www.knowbe4.com/hubfs/KnowBe4_logo_2021_web.png',
  },
  {
    name: 'ブラックライン株式会社',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/BlackLine_Inc_logo.svg/320px-BlackLine_Inc_logo.svg.png',
  },
];

async function downloadImage(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://en.wikipedia.org/',
        'Accept': 'image/*,*/*;q=0.8',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    if (!res.ok) { console.log(`HTTP ${res.status}`); return null; }
    const contentType = res.headers.get('content-type') ?? 'image/png';
    if (!contentType.startsWith('image/')) { console.log(`wrong content-type: ${contentType}`); return null; }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 500) { console.log(`too small: ${buffer.length}B`); return null; }
    const ext = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png';
    return { buffer, ext, contentType: `image/${ext}` };
  } catch (e) {
    console.log(`error: ${e.message}`);
    return null;
  }
}

const { data: companies } = await supabase
  .from('ow_companies')
  .select('id, name')
  .in('name', TARGETS.map(t => t.name));

const companyById = new Map(companies?.map(c => [c.name, c.id]) ?? []);

let ok = 0, fail = 0;

for (const target of TARGETS) {
  process.stdout.write(`  ${target.name} ... `);
  const companyId = companyById.get(target.name);
  if (!companyId) { console.log('⚠ DBに見つかりません'); fail++; continue; }

  const img = await downloadImage(target.url);
  if (!img) { fail++; continue; }

  const storagePath = `companies/logos/${companyId}/logo.${img.ext}`;
  const { error: uploadErr } = await supabase.storage
    .from('ow-uploads')
    .upload(storagePath, img.buffer, { contentType: img.contentType, upsert: true });

  if (uploadErr) { console.log(`❌ upload: ${uploadErr.message}`); fail++; continue; }

  const { data: { publicUrl } } = supabase.storage.from('ow-uploads').getPublicUrl(storagePath);

  const { error: dbErr } = await supabase
    .from('ow_companies')
    .update({ logo_url: publicUrl })
    .eq('id', companyId);

  if (dbErr) { console.log(`❌ db: ${dbErr.message}`); fail++; continue; }

  console.log(`✅ ${Math.round(img.buffer.length / 1024)}KB`);
  ok++;
  await new Promise(r => setTimeout(r, 300));
}

console.log(`\n📊 完了: ✅ ${ok} / ❌ ${fail}`);
