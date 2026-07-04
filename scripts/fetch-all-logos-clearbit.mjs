/**
 * scripts/fetch-all-logos-clearbit.mjs
 *
 * 全企業のロゴを Clearbit Logo API から一括取得し、logo_url を更新する。
 * - URL があれば自動でドメインを抽出
 * - URL がない企業は DOMAIN_OVERRIDES で対応
 *
 * 実行: node scripts/fetch-all-logos-clearbit.mjs
 * オプション:
 *   --all       既にロゴがある企業も再取得して上書き（デフォルトは null のみ）
 *   --dry-run   DBを更新せず、設定するドメインを一覧表示のみ
 *   --verify    設定済みの Clearbit URL が実際に画像を返すか確認
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// ── .env.local 読み込み ─────────────────────────────────────────────────────
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf-8');
  for (const line of env.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const args = process.argv.slice(2);
const OVERWRITE_ALL = args.includes('--all');
const DRY_RUN      = args.includes('--dry-run');
const VERIFY       = args.includes('--verify');

// ── URL なし企業のドメイン手動設定 ─────────────────────────────────────────
// URL フィールドが null の企業、または自動抽出で正しくならない企業を手動指定
const DOMAIN_OVERRIDES = {
  // URL なし
  'freee株式会社':                        'freee.co.jp',
  'HubSpot Japan株式会社':                'hubspot.com',
  'Sansan株式会社':                       'sansan.com',
  'SmartHR株式会社':                      'smarthr.co.jp',
  'Ubie株式会社':                         'ubie.app',
  '株式会社LayerX':                       'layerx.co.jp',
  '株式会社medimo':                       'medimo.co.jp',
  '株式会社PKSHA Technology':             'pkshatech.com',

  // URL はあるが自動抽出だと正しくならない企業
  'アマゾン ウェブ サービス ジャパン合同会社': 'aws.amazon.com',
  'グーグル合同会社':                     'google.com',
  'クアルコムジャパン合同会社':           'qualcomm.com',
  'インテル株式会社':                     'intel.com',
  'コンカー株式会社':                     'concur.com',
  'ゼットスケーラー株式会社':             'zscaler.com',
  'パロアルトネットワークス株式会社':     'paloaltonetworks.com',
  'ページャーデューティー株式会社':       'pagerduty.com',
  '株式会社セールスフォース・ジャパン':   'salesforce.com',
  '株式会社ワークデイ':                   'workday.com',
  '株式会社日本HP':                       'hp.com',
  'マルケト株式会社':                     'marketo.com',
};

// ── URL からドメインを自動抽出 ──────────────────────────────────────────────
function extractDomain(url) {
  if (!url) return null;
  try {
    let hostname = new URL(url).hostname;
    // www. を除去
    hostname = hostname.replace(/^www\./, '');
    // 国別サブドメインを除去: jp., ja., about., corp., careers., en., us.
    hostname = hostname.replace(/^(jp|ja|about|corp|careers|en|us|intl)\./i, '');
    return hostname;
  } catch {
    return null;
  }
}

// ── Clearbit ロゴの疎通確認 ────────────────────────────────────────────────
async function verifyClearbitLogo(domain) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://logo.clearbit.com/${domain}`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

// ── メイン ─────────────────────────────────────────────────────────────────
console.log('');
console.log('🔷 全企業 Clearbit ロゴ一括取得');
console.log(`   モード: ${DRY_RUN ? 'DRY RUN（DB更新なし）' : OVERWRITE_ALL ? '全社上書き' : 'ロゴなしのみ対象'}`);
console.log('');

// 企業一覧を取得
const { data: companies, error: fetchErr } = await supabase
  .from('ow_companies')
  .select('id, name, url, logo_url')
  .eq('is_published', true)
  .order('name');

if (fetchErr) {
  console.error('❌ 企業取得失敗:', fetchErr.message);
  process.exit(1);
}

console.log(`📋 公開企業: ${companies.length} 社\n`);

let ok = 0, skip = 0, fail = 0;

for (const company of companies) {
  // 処理対象を決定
  if (!OVERWRITE_ALL && company.logo_url) {
    if (VERIFY) {
      // 疎通確認モードの場合はチェック
      const isAlive = await verifyClearbitLogo(
        company.logo_url.replace('https://logo.clearbit.com/', '')
      );
      const icon = isAlive ? '✅' : '❌';
      console.log(`${icon} ${company.name}`);
      if (!isAlive) fail++;
    } else {
      skip++;
    }
    continue;
  }

  // ドメインを決定（手動優先 → URL自動抽出）
  const domain = DOMAIN_OVERRIDES[company.name] ?? extractDomain(company.url);

  if (!domain) {
    console.log(`⚠️  ${company.name}: ドメイン取得不可（URLなし・手動設定なし）`);
    fail++;
    continue;
  }

  const clearbitUrl = `https://logo.clearbit.com/${domain}`;

  if (DRY_RUN) {
    console.log(`  📌 ${company.name.padEnd(40)} → ${clearbitUrl}`);
    ok++;
    continue;
  }

  // DB 更新
  const { error: updateErr } = await supabase
    .from('ow_companies')
    .update({ logo_url: clearbitUrl })
    .eq('id', company.id);

  if (updateErr) {
    console.log(`❌ ${company.name}: ${updateErr.message}`);
    fail++;
  } else {
    console.log(`✅ ${company.name.padEnd(40)} → ${domain}`);
    ok++;
  }

  // レート制限対策（Clearbit free tier: ~10 req/s）
  await new Promise(r => setTimeout(r, 100));
}

console.log('');
if (VERIFY) {
  const total = companies.length - skip;
  console.log(`📊 疎通確認: ✅ ${total - fail} 件OK / ❌ ${fail} 件NG`);
} else if (DRY_RUN) {
  console.log(`📊 DRY RUN完了: ${ok} 社を処理予定`);
  console.log('   実際に更新するには --dry-run を外して実行してください');
} else {
  console.log(`📊 完了: ✅ ${ok} 社更新 / ⏭ ${skip} 社スキップ / ❌ ${fail} 社失敗`);
  console.log('');
  console.log('💡 ヒント: Clearbit にロゴが登録されていない企業は、');
  console.log('   フロントエンドの onError で gradient+letter フォールバックが表示されます。');
}
console.log('');
