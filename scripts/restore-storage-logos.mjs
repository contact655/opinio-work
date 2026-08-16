/**
 * restore-storage-logos.mjs
 *
 * Clearbit URL に変更した logo_url を Supabase Storage の実ファイルURLに戻す。
 * Storage 内の companies/logos/{id}/logo.{ext} を HEAD リクエストで確認し、
 * 存在するものを logo_url に設定する。
 *
 * ⚠️ **このスクリプトは `logo.<ext>` 決め打ちなので、8件を拾えない**（2026-08-16 実測）。
 *    `companies/logos` の87ファイルのうち **79件が `logo.<ext>`（一括投入スクリプト由来）**、
 *    残り **8件は `<13桁タイムスタンプ>.<ext>`**（画面のアップローダー
 *    = `buildLogoStoragePath` 由来）。後者はこのスクリプトでは見つからない。
 *
 * ⚠️ **全件を対象にするなら Storage を `list()` で走査すること。**
 *    ファイル名の形で選ばず、`updated_at` が最新のものを採る
 *    （同じ company_id に複数ある会社が3社ある）。
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

const BASE = `${SUPABASE_URL}/storage/v1/object/public/ow-uploads`;
const EXTS = ['png', 'jpg', 'jpeg', 'webp', 'svg'];

async function checkExists(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    return r.ok;
  } catch {
    return false;
  }
}

const { data: companies } = await supabase
  .from('ow_companies')
  .select('id, name, logo_url')
  .eq('is_published', true)
  .order('name');

console.log(`📋 ${companies.length} 社を確認中...\n`);

let restored = 0, notFound = 0;

for (const c of companies) {
  process.stdout.write(`  ${c.name} ... `);

  let found = null;
  for (const ext of EXTS) {
    const url = `${BASE}/companies/logos/${c.id}/logo.${ext}`;
    if (await checkExists(url)) {
      found = url;
      break;
    }
  }

  if (found) {
    const { error } = await supabase
      .from('ow_companies')
      .update({ logo_url: found })
      .eq('id', c.id);
    if (error) {
      console.log(`❌ DB更新失敗: ${error.message}`);
    } else {
      console.log(`✅ ${found.split('/').pop()}`);
      restored++;
    }
  } else {
    console.log(`⚠ Storage にファイルなし（現状維持: ${c.logo_url?.slice(0,40) ?? 'null'}）`);
    notFound++;
  }

  await new Promise(r => setTimeout(r, 100));
}

console.log(`\n📊 Storage復元: ✅ ${restored} 件 / ⚠ ${notFound} 件（ファイルなし）`);
