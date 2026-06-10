/**
 * upload-jp-logos-retry.mjs
 * freee / PKSHA — x-icon 失敗分をリトライ
 * Google Favicon (PNG) + brandfetch CDN + 直接サイト探索
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

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

const TARGETS = [
  {
    name: 'freee株式会社',
    id: 'f98f5d13-c72f-42fa-9c91-ee4647de2793',
    urls: [
      // Google Favicon (PNG, 128px)
      'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://freee.co.jp&size=128',
      // Apple touch icon（各社サイトに大抵ある 180px PNG）
      'https://www.freee.co.jp/apple-touch-icon.png',
      'https://www.freee.co.jp/apple-touch-icon-precomposed.png',
      // OGP image
      'https://corp.freee.co.jp/wp-content/uploads/freee_logo_green_rgb.png',
    ],
  },
  {
    name: '株式会社PKSHA Technology',
    id: '09d67e54-0381-45c8-b698-568e1fc47033',
    urls: [
      'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://pkshatech.com&size=128',
      'https://pkshatech.com/apple-touch-icon.png',
      'https://pkshatech.com/apple-touch-icon-precomposed.png',
      'https://www.pkshatech.com/apple-touch-icon.png',
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
          'Accept': 'image/png,image/jpeg,image/*,*/*;q=0.8',
        },
        redirect: 'follow',
      });
      clearTimeout(timeout);
      if (!res.ok) { console.log(`    → ${url.slice(0,70)} [HTTP ${res.status}]`); continue; }
      const ct = (res.headers.get('content-type') ?? '').split(';')[0].trim();
      if (ct === 'image/x-icon' || ct === 'image/vnd.microsoft.icon') {
        console.log(`    → ${url.slice(0,70)} [ICO skip]`);
        continue;
      }
      if (!ct.startsWith('image/')) { console.log(`    → ${url.slice(0,70)} [not image: ${ct}]`); continue; }
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length < 500) { console.log(`    → ${url.slice(0,70)} [too small: ${buffer.length}B]`); continue; }
      const ext = ct.includes('svg') ? 'svg' : ct.includes('jpeg') || ct.includes('jpg') ? 'jpg' : 'png';
      console.log(`    ✓ ${url.slice(0,70)} [${Math.round(buffer.length/1024)}KB, ${ct}]`);
      return { buffer, ext, contentType: ct };
    } catch (e) {
      console.log(`    → ${url.slice(0,70)} [${e.message}]`);
    }
  }
  return null;
}

console.log('🖼  freee / PKSHA リトライ中...\n');
let ok = 0, fail = 0;

for (const target of TARGETS) {
  console.log(`\n▶ ${target.name}`);
  const img = await tryDownload(target.urls);
  if (!img) { console.log('  ❌ 全URL失敗'); fail++; continue; }

  const storagePath = `companies/logos/${target.id}/logo.${img.ext}`;
  const { error: uploadErr } = await supabase.storage
    .from('ow-uploads')
    .upload(storagePath, img.buffer, { contentType: img.contentType, upsert: true });

  if (uploadErr) { console.log(`  ❌ Upload: ${uploadErr.message}`); fail++; continue; }

  const { data: { publicUrl } } = supabase.storage.from('ow-uploads').getPublicUrl(storagePath);

  const { error: dbErr } = await supabase
    .from('ow_companies')
    .update({ logo_url: publicUrl })
    .eq('id', target.id);

  if (dbErr) { console.log(`  ❌ DB: ${dbErr.message}`); fail++; continue; }

  console.log(`  ✅ ${publicUrl.slice(0,90)}`);
  ok++;
}

console.log(`\n📊 完了: ✅ ${ok} / ❌ ${fail}`);
