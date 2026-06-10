/**
 * set-japanese-logos.mjs
 * freee / Sansan / SmartHR / Ubie / LayerX / PKSHA の logo_url を Clearbit URL に設定
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

const TARGETS = [
  { name: 'freee株式会社',            domain: 'freee.co.jp' },
  { name: 'Sansan株式会社',           domain: 'sansan.com' },
  { name: 'SmartHR株式会社',          domain: 'smarthr.co.jp' },
  { name: 'Ubie株式会社',             domain: 'ubie.life' },
  { name: '株式会社LayerX',           domain: 'layerx.co.jp' },
  { name: '株式会社PKSHA Technology', domain: 'pkshatech.com' },
];

console.log('🖼  ロゴURL設定中...\n');
let ok = 0, fail = 0;

for (const { name, domain } of TARGETS) {
  const logoUrl = `https://logo.clearbit.com/${domain}`;
  process.stdout.write(`  ${name} → ${logoUrl} ... `);

  const { error } = await supabase
    .from('ow_companies')
    .update({ logo_url: logoUrl })
    .eq('name', name);

  if (error) {
    console.log(`❌ ${error.message}`);
    fail++;
  } else {
    console.log('✅');
    ok++;
  }
}

console.log(`\n📊 完了: ✅ ${ok} 件 / ❌ ${fail} 件`);
