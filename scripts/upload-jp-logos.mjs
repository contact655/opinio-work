/**
 * upload-jp-logos.mjs
 * freee / Sansan / SmartHR / Ubie / LayerX / PKSHA のロゴを
 * 複数ソースで試行 → Supabase Storage にアップロード → DB 更新
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// .env.local 読み込み
const envPath = path.resolve(process.cwd(), '.env.local');
for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq === -1) continue;
  const key = t.slice(0, eq).trim();
  let val = t.slice(eq + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
  if (!process.env[key]) process.env[key] = val;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ── ロゴ取得先（優先順に試す）──────────────────────────────────────────────
const TARGETS = [
  {
    name: 'SmartHR株式会社',
    id: '81aa95dc-2304-4faa-9c4a-f2f5454e8e11',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/SmartHR_logo.svg/320px-SmartHR_logo.svg.png',
      'https://icon.horse/icon/smarthr.co.jp',
      'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://smarthr.co.jp&size=128',
    ],
  },
  {
    name: 'Ubie株式会社',
    id: 'fb7397eb-a9c7-4ce3-964a-d7a72159847f',
    urls: [
      'https://icon.horse/icon/ubie.life',
      'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://ubie.life&size=128',
    ],
  },
  {
    name: '株式会社LayerX',
    id: '17e171bb-f2fa-480d-a4e1-e1382af8e842',
    urls: [
      'https://icon.horse/icon/layerx.co.jp',
      'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://layerx.co.jp&size=128',
    ],
  },
  {
    name: 'freee株式会社',
    id: 'f98f5d13-c72f-42fa-9c91-ee4647de2793',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Freee_logo.png/320px-Freee_logo.png',
      'https://icon.horse/icon/freee.co.jp',
      'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://freee.co.jp&size=128',
    ],
  },
  {
    name: 'Sansan株式会社',
    id: '8b9f84b0-b4be-4191-8322-07c6a2e5e91a',
    urls: [
      'https://icon.horse/icon/sansan.com',
      'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://sansan.com&size=128',
    ],
  },
  {
    name: '株式会社PKSHA Technology',
    id: '09d67e54-0381-45c8-b698-568e1fc47033',
    urls: [
      'https://icon.horse/icon/pkshatech.com',
      'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://pkshatech.com&size=128',
    ],
  },
];

async function tryDownload(urls) {
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'image/*,*/*;q=0.8',
        },
        redirect: 'follow',
      });
      clearTimeout(timeout);
      if (!res.ok) { console.log(`    → ${url.slice(0, 60)} [HTTP ${res.status}]`); continue; }
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.startsWith('image/')) { console.log(`    → ${url.slice(0, 60)} [not image: ${ct}]`); continue; }
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length < 500) { console.log(`    → ${url.slice(0, 60)} [too small: ${buffer.length}B]`); continue; }
      const ext = ct.includes('svg') ? 'svg' : ct.includes('jpeg') || ct.includes('jpg') ? 'jpg' : 'png';
      console.log(`    ✓ ${url.slice(0, 60)} [${Math.round(buffer.length/1024)}KB]`);
      return { buffer, ext, contentType: ct.split(';')[0] };
    } catch (e) {
      console.log(`    → ${url.slice(0, 60)} [${e.message}]`);
    }
  }
  return null;
}

console.log('🖼  ロゴをダウンロード → Storage アップロード中...\n');
let ok = 0, fail = 0;

for (const target of TARGETS) {
  console.log(`\n▶ ${target.name}`);
  const img = await tryDownload(target.urls);
  if (!img) {
    console.log('  ❌ 全てのURLで失敗');
    fail++;
    continue;
  }

  const storagePath = `companies/logos/${target.id}/logo.${img.ext}`;
  const { error: uploadErr } = await supabase.storage
    .from('ow-uploads')
    .upload(storagePath, img.buffer, { contentType: img.contentType, upsert: true });

  if (uploadErr) {
    console.log(`  ❌ Upload: ${uploadErr.message}`);
    fail++;
    continue;
  }

  const { data: { publicUrl } } = supabase.storage.from('ow-uploads').getPublicUrl(storagePath);

  const { error: dbErr } = await supabase
    .from('ow_companies')
    .update({ logo_url: publicUrl })
    .eq('id', target.id);

  if (dbErr) {
    console.log(`  ❌ DB update: ${dbErr.message}`);
    fail++;
    continue;
  }

  console.log(`  ✅ → ${publicUrl.slice(0, 80)}`);
  ok++;
  await new Promise(r => setTimeout(r, 400));
}

console.log(`\n📊 完了: ✅ ${ok} 件 / ❌ ${fail} 件`);
