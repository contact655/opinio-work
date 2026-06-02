/**
 * upload-mentor-photos.mjs
 * ─────────────────────────────────────────────────────────────
 * Airtable の一時 URL からメンター写真をダウンロードして
 * Supabase Storage にアップロードし、ow_mentors.photo_url を更新します。
 *
 * 使い方:
 *   node scripts/upload-mentor-photos.mjs
 *
 * 前提:
 *   - Node.js 18 以上
 *   - Migration 132 が適用済み（ow_mentors に photo_url カラムが存在する）
 *   - .env.local に NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が設定済み
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// ── 環境変数読み込み ──────────────────────────────────────────────────────────
const envPath = join(process.cwd(), '.env.local');
let envContent;
try {
  envContent = readFileSync(envPath, 'utf8');
} catch {
  console.error('❌ .env.local が見つかりません。プロジェクトルートから実行してください。');
  process.exit(1);
}
const env = Object.fromEntries(
  envContent.split('\n')
    .filter(l => l.trim() && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が .env.local にありません。');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// ── メンター写真データ ────────────────────────────────────────────────────────
// ⚠️ Airtable URL は有効期限があります。期限切れの場合は
//    Airtable から再度「共有リンクをコピー」して URL を差し替えてください。
const MENTOR_PHOTOS = [
  {
    name: '柴 久人',
    slug: '01-shiba',
    ext: 'png',
    url: 'https://v5.airtableusercontent.com/v3/u/53/53/1780380000000/YSMTniftB33fd4rrqRx24g/AHxEEmDAhw7ncBzWMLn-WEkUdet0Blo72shBVALs8dLv8FlkjLaY6teMdhWMBCAvhun_JK5rZNyNsR1FGGS94aZBd4c6-bkGkPkUIs2QkRyuAlBMrJ-lmNmafayJtkZ-8zRCUaEV1Wa1YiRmzZc7qhq4rtsHad3UH1r5cLlJv-k/6BOV0lPJ_PDI0jPpz5FhCP9qJ1evEdJHim3tArotyXc',
  },
  {
    name: '木村 勇人',
    slug: '02-kimura-hayato',
    ext: 'png',
    url: 'https://v5.airtableusercontent.com/v3/u/53/53/1780380000000/krq11u8s1PR1EavBu8Ey2A/cDn80KKb3s040Nj3-mlj_yLF0xeZJL8O4H5GoMckJ9Vzq5UNDILWnwEr_pffrBK3v6ybWMD0cFmWBV1drQg-nexYh1sYbQpBfajqcQyfxZC6KjB6WmHBSk8okNpEzr2pEX7kVqQM62EiRJWx8Phs02frZ1c_jDHLva7AR5OklUk/kMRJnk46d8esjoJ8wEVQUL0aYht4Sg7h4x5pm11U_0Y',
  },
  {
    name: '松本 圭史',
    slug: '03-matsumoto',
    ext: 'jpg',
    url: 'https://v5.airtableusercontent.com/v3/u/53/53/1780380000000/sqaWzG-BmOQ7dk7CIRCeAA/ptO0TKj1Xp2e-AZQFRduqW5AV4_WgCZeWqUFbAGNfZ1IB_SaUGLSZLXgvVFZmBMIkMEuYS3UmUk5D2nqMpvOZmvS5JK95pK7UtoPuCH6caTXm_BEhVVIBefKiqtg4lm1vJC_E5WmHx-1Myz7IB3MJXBGJPILFEBMaAEX3e2hfj/Buxwj5ib4qqcTczAMK7H0-_G5EimFH2t9822ZKzCwkA',
  },
  {
    name: '木村 雅樹',
    slug: '04-kimura-masaki',
    ext: 'png',
    url: 'https://v5.airtableusercontent.com/v3/u/53/53/1780380000000/gqtOi_nsx9FYyOdzKF-UFA/5kzPpnQI-Ra2dtpbkHtcLLACyCVnHD-MsMudU5u1qcdoR62rzF2tVmql8WsEJIOf4Gv-Nm76nH-7xMGWzEiAq_gZaxKgxI4GZzlCRHAtfNX73vqsw4qHMJm32yMfHY5oBTNWxZFjFMCkobzlakYQiSz3JBGkIX1EWl-PfQ2dNYeGg/ZECsr01K0UYre8uTdSmHKp5PBq68TaZiZ9QailWaCMM',
  },
  {
    name: '生藤 弘樹',
    slug: '05-shoto',
    ext: 'jpg',
    url: 'https://v5.airtableusercontent.com/v3/u/53/53/1780380000000/dRd4Kctwt-SEtvBvunUzgg/klAxQFVqHR2rEWV6GEbD-NCu_4Wiq3g-UHkTHc95bgjnbUV87IxSOyfjZ3JT4KonafLF7fdUTYKKo9PeweMzCVai8P5J0AO_iQChyivFcgNhML7gcbgPx6l5ihjB9Csf01GLFZW3F791RgayeLF_LE4eaPFD0oKAA6v9U4EiEGBMR0ARWqjlWE/lDwsp7NTQNwd3dREg86IvuE6bUWnKh19fviAJYxDIC0',
  },
  // 山本 博之: 写真なし → スキップ
  {
    name: '小島 良介',
    slug: '07-kojima',
    ext: 'jpg',
    url: 'https://v5.airtableusercontent.com/v3/u/53/53/1780380000000/2KP5O28GJMz1YGYRDDtJLA/AnHOIbhQBFt7moaQkXGgDmF9bXAoL9RtBEBd5Y7J45Y5hJRjVkINYn-aCBEMSVLQ2jPE2LTq_6BYPq2MBjFm2sf7EN2flzLffj3WuzuHjOU83J-yfCP7U0x_gFpYMeecNr3dIW8j1i1qyiyzLtDiYvhCM5NJ8NZHbLxzUFDUe46hoF8/72IWCkX0bptx5KZW-4cb7-029b2TvrLllNNtSEYcdR0',
  },
  {
    name: '山崎 華奈',
    slug: '08-yamazaki',
    ext: 'png',
    url: 'https://v5.airtableusercontent.com/v3/u/53/53/1780380000000/1hNO1kdyU0Kz9vzXyZw5lw/CFBNGj1YLEB55tnVTVN9WBF4heR2FBkjSKO8N4Z_0mMbs_g73tWnf_suLKtotx7rZd5Gkp7Lyi5i1AUsyisdw_AM1jNquIfB8tP9PthurPGmQr6Fe7JdJmkJmJq4q2rE-0elphL79BOkw1JBkET-hMLVqpwGzByKxUxGZyh2YzE/eZqWyCZigOr1Hr7BXbzvYEebqoaODTyrXe1xi-XbKLc',
  },
  {
    name: '藤岡 正樹',
    slug: '09-fujioka',
    ext: 'jpg',
    url: 'https://v5.airtableusercontent.com/v3/u/53/53/1780380000000/eZQq6E0A-_of92ywIQGmoA/LIATB_loJW9zdO1lpx1Ru4dSbt7_S_fAm5t6w3xbZI5Kk6V2oMVA4aFZqBl9M3z7wUnV_pPWeDp_Cq8-uIDxnVZHeP8bkwCKMyvDGOc11Im4ctY835lFoOv5u4X-EolMDZzQ08F2L9gvE4AoNRM1PQ/Mn9Cts1GAmxOLQi_23XsrkuKWeCBlPA1N1Jimhr-KYA',
  },
  {
    name: '岡田 達哉',
    slug: '10-okada',
    ext: 'jpg',
    url: 'https://v5.airtableusercontent.com/v3/u/53/53/1780380000000/1-4-8cDtjcMEkF0lDf5DIQ/czUK6yKbVdn_V3L05p2qUZM2B9Xl7aX8io29ZoWTnA951vlQ1HDxfWizcWIQD8J3x887fCO3zW8NmPOW9NPoxKmUWwMcAV2RjfHyiuGvlJu3_NqOHjeg2JUb3cYMJQcA8kpzrFvm1o/UWqdEMgrRmMWgdTC4Y3dXaQ8YZAaSS-1fa0tyJmeZgU',
  },
  {
    name: '木村 拓哉',
    slug: '11-kimura-takuya',
    ext: 'png',
    url: 'https://v5.airtableusercontent.com/v3/u/53/53/1780380000000/HzwQ4TrCNWlW2AhYxlH4Fw/k5B6c_kjx1jCsuWjnfvltZy4uIzVM1BZt6TnFHgyRmqvkrDBkZKd_2uLCPb8cOQAkevNS1rVn5mpU_ex8FPFwSRO29582PfCTTQRI245pp7E_uvAGLnV9_ggKsT9Za7Q2RzpYxD3VEx6N-HydVyRPq_k4AX55Oa9UGCtWXySh3S5_gW1U',
  },
  {
    name: '金澤 啓太郎',
    slug: '12-kanazawa',
    ext: 'jpg',
    url: 'https://v5.airtableusercontent.com/v3/u/53/53/1780380000000/4PNtg4aN0FMnvZncrTOYyA/mlm6VRcEImMBvkC16VUJ0wjNBrIDSsmXKktDW-3JZz1EBBBq-qvB0Rc8Ro8BO-YZ8EEBhfZm4RFgN3Y0JLTDcVoN5-SJkGIFHm9JIgQTVBQOPwIy2JKqe_RgN2BGTXj3Bqnd5RgQGrL9Uhq1vDpfR79rjaGPRfQTDTCmwSGxl9wqlKn4eQfpFEqcJpS6SLdsY7RxAQ0bvF2LNdcQO0/qJcU3NRoZKMfYj2eNC1-roB_zbIEExl9s',
  },
  {
    name: '片山 幹大',
    slug: '13-katayama',
    ext: 'jpeg',
    url: 'https://v5.airtableusercontent.com/v3/u/53/53/1780380000000/aZ1PcqyKssFiKuAVAUkmDQ/E6dImeQmYoGs0FTZzzbR4BKrWtle2spf-y1Q67eNc8D1zT1oqOOeNVsbc3QpIm2mJYT9y_m9hTA1YlQUovU39C3FAMUnEXzo0ldkW_lrUIxKKo9PeweMzCVai8P5J0AO_iQChyivFcgNhML7nyyo77mvyS_eM5ZW39KQYid9SBjDB60XDcxHPt1DJHiicQIm/S_evTeZwCunIkFCI7wsh9QTi3NGUCh8UHaRY_xMotQw',
  },
];

// ── アップロード処理 ─────────────────────────────────────────────────────────
const BUCKET = 'ow-uploads';

console.log('📸 メンター写真のアップロードを開始します...\n');

let successCount = 0;
let failCount = 0;

for (const mentor of MENTOR_PHOTOS) {
  const storagePath = `mentors/photos/${mentor.slug}.${mentor.ext}`;
  const contentType = mentor.ext === 'jpg' || mentor.ext === 'jpeg' ? 'image/jpeg' : 'image/png';

  process.stdout.write(`  ${mentor.name} を処理中... `);

  try {
    // 1. Airtable からダウンロード
    const response = await fetch(mentor.url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} - Airtable URL が期限切れの可能性があります`);
    }
    const buffer = await response.arrayBuffer();

    // 2. Supabase Storage にアップロード
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType, upsert: true });

    if (uploadError) throw new Error(`Storage upload error: ${uploadError.message}`);

    // 3. public URL を取得
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    // 4. ow_mentors.photo_url を更新
    const { error: updateError } = await supabase
      .from('ow_mentors')
      .update({ photo_url: publicUrl })
      .eq('name', mentor.name);

    if (updateError) throw new Error(`DB update error: ${updateError.message}`);

    console.log(`✅ ${publicUrl}`);
    successCount++;

  } catch (err) {
    console.log(`❌ 失敗: ${err.message}`);
    failCount++;
  }
}

console.log(`\n完了: ${successCount}件成功 / ${failCount}件失敗`);

if (failCount > 0) {
  console.log(`
⚠️  失敗した写真について:
Airtable URL が期限切れになっている場合は、
Airtable ベースを開いて各メンターの写真を再度「添付ファイルリンクをコピー」し、
このスクリプトの該当 URL を差し替えて再実行してください。
`);
}
