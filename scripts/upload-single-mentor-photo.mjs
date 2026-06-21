/**
 * upload-single-mentor-photo.mjs
 * ─────────────────────────────────────────────────────────────
 * 単一のメンター写真をローカルファイルから Supabase Storage にアップロードし、
 * ow_mentors.photo_url を更新します。
 *
 * 使い方:
 *   node scripts/upload-single-mentor-photo.mjs <ローカルファイルパス> <メンター名>
 *
 * 例:
 *   node scripts/upload-single-mentor-photo.mjs /tmp/namafu-hiroki.jpg "生藤 弘樹"
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, extname } from 'path';

// ── 引数確認 ──────────────────────────────────────────────────────────────────
const [, , filePath, mentorName] = process.argv;
if (!filePath || !mentorName) {
  console.error('使い方: node scripts/upload-single-mentor-photo.mjs <ファイルパス> <メンター名>');
  console.error('例: node scripts/upload-single-mentor-photo.mjs /tmp/namafu.jpg "生藤 弘樹"');
  process.exit(1);
}

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
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が未設定です。');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// ── アップロード処理 ─────────────────────────────────────────────────────────
const BUCKET = 'ow-uploads';

const ext = extname(filePath).replace('.', '').toLowerCase();
const slug = '05-shoto'; // 生藤弘樹さん固定
const storagePath = `mentors/photos/${slug}.${ext}`;
const contentType = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : 'image/png';

console.log(`📸 ${mentorName} の写真をアップロード中...`);
console.log(`  ファイル: ${filePath}`);
console.log(`  保存先: ${BUCKET}/${storagePath}`);

try {
  // 1. ファイル読み込み
  const buffer = readFileSync(filePath);

  // 2. Supabase Storage にアップロード（upsert=true で上書き）
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: true });

  if (uploadError) throw new Error(`Storage error: ${uploadError.message}`);

  // 3. public URL 取得
  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  // 4. ow_mentors.photo_url を更新
  const { error: updateError, count } = await supabase
    .from('ow_mentors')
    .update({ photo_url: publicUrl })
    .eq('name', mentorName)
    .select();

  if (updateError) throw new Error(`DB update error: ${updateError.message}`);

  console.log(`✅ 完了！`);
  console.log(`  公開URL: ${publicUrl}`);
  console.log(`  DB更新: ow_mentors WHERE name = '${mentorName}'`);

} catch (err) {
  console.error(`❌ エラー: ${err.message}`);
  process.exit(1);
}
