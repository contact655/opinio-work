/**
 * simple-icons のモノクロSVGをブランドカラー背景 + 白アイコンに変換して
 * Supabase Storage にアップロードする
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

// ── ブランドカラー + simple-icons スラッグ ─────────────────────────────────
const BRANDS = [
  { name: 'Datadog Japan株式会社',   slug: 'datadog',   bgColor: '#632CA6', fgColor: '#FFFFFF' },
  { name: 'DocuSign Japan株式会社',  slug: 'docusign',  bgColor: '#1B2C4E', fgColor: '#FFFFFF' },
  { name: 'Twilio Japan合同会社',    slug: 'twilio',    bgColor: '#F22F46', fgColor: '#FFFFFF' },
];

async function fetchSvgPath(slug) {
  const res = await fetch(`https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${slug}.svg`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const svg = await res.text();
  // <path d="..."/> を抽出
  const match = svg.match(/<path\s+d="([^"]+)"/);
  if (!match) throw new Error('path not found');
  return match[1];
}

function buildSvg(pathD, bgColor, fgColor) {
  // 24x24 アイコンを中央に配置（余白付き）
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="${bgColor}" rx="12"/>
  <g transform="translate(14, 14) scale(3.0)">
    <path d="${pathD}" fill="${fgColor}"/>
  </g>
</svg>`;
}

const { data: companies } = await supabase
  .from('ow_companies').select('id, name').eq('is_published', true);

let success = 0, fail = 0;

for (const brand of BRANDS) {
  const company = companies.find(c => c.name === brand.name);
  if (!company) { console.log(`⚠️  ${brand.name} — DBに見つかりません`); continue; }

  process.stdout.write(`[${brand.name}] ... `);

  try {
    const pathD = await fetchSvgPath(brand.slug);
    const svgContent = buildSvg(pathD, brand.bgColor, brand.fgColor);
    const buffer = Buffer.from(svgContent, 'utf-8');

    const storagePath = `companies/logos/${company.id}/logo.svg`;
    const { error: uploadErr } = await supabase.storage
      .from('ow-uploads')
      .upload(storagePath, buffer, { contentType: 'image/svg+xml', upsert: true });

    if (uploadErr) {
      // SVG が許可されていない場合は PNG 代替を試みる（データURLの場合はスキップ）
      console.log(`❌ アップロード失敗: ${uploadErr.message}`);
      fail++;
      continue;
    }

    const { data: { publicUrl } } = supabase.storage.from('ow-uploads').getPublicUrl(storagePath);
    await supabase.from('ow_companies').update({ logo_url: publicUrl }).eq('id', company.id);

    console.log(`✅ SVG (${Math.round(buffer.length / 1024)}KB)`);
    success++;
  } catch (e) {
    console.log(`❌ ${e.message}`);
    fail++;
  }

  await new Promise(r => setTimeout(r, 500));
}

console.log(`\n完了: ✅ ${success} / ❌ ${fail}`);
