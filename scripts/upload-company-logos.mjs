/**
 * scripts/upload-company-logos.mjs
 *
 * 各企業の公式サイトから og:image / apple-touch-icon を取得し
 * Supabase Storage にアップロードして logo_url を更新する。
 *
 * 実行: node scripts/upload-company-logos.mjs
 */

import { createClient } from '@supabase/supabase-js';

// ── Supabase クライアント ─────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  // .env.local から読む
  const fs = await import('fs');
  const path = await import('path');
  const envPath = path.resolve(process.cwd(), '.env.local');
  const env = fs.readFileSync(envPath, 'utf-8');
  for (const line of env.split('\n')) {
    const [k, ...rest] = line.split('=');
    if (k && rest.length) process.env[k.trim()] = rest.join('=').trim();
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ── ロゴURLの優先候補（手動で確認済みの信頼できるURL）──────────────────────────
// og:image取得が難しい場合のフォールバック
const KNOWN_LOGO_URLS = {
  'アマゾン ウェブ サービス ジャパン合同会社': 'https://a0.awsstatic.com/libra-css/images/logos/aws_smile_logo_vert_191px.png',
  '日本マイクロソフト株式会社': 'https://upload.wikimedia.org/wikipedia/commons/9/96/Microsoft_logo_%282012%29.png',
  'グーグル合同会社': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Google_2015_logo.svg/320px-Google_2015_logo.svg.png',
};

// ── og:image を取得するヘルパー ──────────────────────────────────────────────
async function fetchLogoUrl(siteUrl) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(siteUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OpinioBot/1.0; +https://opinio.jp)',
        'Accept': 'text/html',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    // 最初の 50KB だけ読む
    const reader = res.body.getReader();
    let html = '';
    while (html.length < 50000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += new TextDecoder().decode(value);
    }
    reader.cancel().catch(() => {});

    // og:image を探す
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                 ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogMatch) return ogMatch[1];

    // apple-touch-icon（512x512 or 192x192）を探す
    const touchMatch = html.match(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i);
    if (touchMatch) {
      const href = touchMatch[1];
      return href.startsWith('http') ? href : new URL(href, siteUrl).href;
    }

    return null;
  } catch {
    return null;
  }
}

// ── 画像をダウンロードして Buffer に変換 ────────────────────────────────────
async function downloadImage(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OpinioBot/1.0)' },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') ?? 'image/png';
    // SVG は PNG ではないのでスキップ（Next.js Image が対応できないケースあり）
    if (contentType.includes('svg')) return null;
    if (!contentType.startsWith('image/')) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg'
               : contentType.includes('webp') ? 'webp'
               : 'png';
    return { buffer, ext, contentType: contentType.split(';')[0] };
  } catch {
    return null;
  }
}

// ── メイン ─────────────────────────────────────────────────────────────────
const { data: companies } = await supabase
  .from('ow_companies')
  .select('id, name, url')
  .eq('is_published', true)
  .not('url', 'is', null)
  .order('name');

console.log(`対象企業: ${companies.length} 社\n`);

let success = 0, skip = 0, fail = 0;

for (const company of companies) {
  process.stdout.write(`[処理中] ${company.name} ... `);

  // og:image を取得
  let imageUrl = KNOWN_LOGO_URLS[company.name];
  if (!imageUrl) {
    imageUrl = await fetchLogoUrl(company.url);
  }

  if (!imageUrl) {
    console.log('❌ og:image 取得失敗');
    fail++;
    continue;
  }

  // 画像ダウンロード
  const img = await downloadImage(imageUrl);
  if (!img) {
    console.log(`❌ 画像ダウンロード失敗 (${imageUrl.slice(0, 60)}...)`);
    fail++;
    continue;
  }

  // Supabase Storage にアップロード
  const storagePath = `companies/logos/${company.id}/logo.${img.ext}`;
  const { error: uploadErr } = await supabase.storage
    .from('ow-uploads')
    .upload(storagePath, img.buffer, {
      contentType: img.contentType,
      upsert: true,
    });

  if (uploadErr) {
    console.log(`❌ アップロード失敗: ${uploadErr.message}`);
    fail++;
    continue;
  }

  // 公開URLを取得
  const { data: { publicUrl } } = supabase.storage
    .from('ow-uploads')
    .getPublicUrl(storagePath);

  // DB 更新
  const { error: dbErr } = await supabase
    .from('ow_companies')
    .update({ logo_url: publicUrl })
    .eq('id', company.id);

  if (dbErr) {
    console.log(`❌ DB更新失敗: ${dbErr.message}`);
    fail++;
    continue;
  }

  console.log(`✅ ${img.ext.toUpperCase()} (${Math.round(img.buffer.length / 1024)}KB)`);
  success++;

  // レート制限対策
  await new Promise(r => setTimeout(r, 500));
}

console.log(`\n完了: ✅ ${success} 社 / ❌ ${fail} 社 / ⏭ ${skip} 社`);
