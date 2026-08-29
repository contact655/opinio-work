/**
 * upload-logos-20260828d.mjs
 *
 * **今回まで手つかずだった6社**のロゴ差し替え（2026-08-28）。
 * 先行する `upload-logos-20260828{,b,c}.mjs` とは**別の集合**
 * （あちらは「OGP画像だった22社」と「実寸が小さい3社」）。
 *
 * 今回の6社は、**比率で分類したときに横長へ入っていなかった**か、
 * **入っていても差し替え対象リストから漏れていた**もの。
 * ⚠️ とくに **ザクトリーはロゴですらなく「手とAIのイメージ写真」**が入っていた。
 *
 * ── 置き場と命名（`1cddb4ca` の形をそのまま使う）──────────────────────────
 * `ow-uploads/companies/logos/{company_id}/logo.png` の**固定名 + upsert**。
 * 同じキーを上書きするので**孤児が原理的に生まれない**。
 *
 * ⚠️★**ただし2社は現在 `logo.jpg` を指している**（ザクトリー・ゲインサイト）。
 *    `logo.png` に上げると**古い `.jpg` が孤児として1件ずつ残る。**
 *    これは既知の例外（CLAUDE.md「拡張子が変わる差し替えだけは1件残る。稀なので許容」）。
 *    **ここに「他の拡張子を消す」処理を足さないこと**（削除を持ち込むことになる）。
 *    この2社は **DB の `logo_url` も更新が要る** → migration 側で行う。
 *
 * ── ICO は PNG に変換して置いた ─────────────────────────────────────────────
 * ⚠️ **ICO は複数フレームを持つ。最大のフレームを選ぶこと。**
 *    ザクトリーの ICO は 16/24/32/48/64/96/128/**256** の8フレームあり、
 *    既定のまま開くと小さいフレームを掴む。
 *
 * | 会社 | 元 | 変換後 |
 * |---|---|---|
 * | ザクトリー | ICO（8フレーム） | **256×256 PNG・透過あり** |
 * | パランティア | ICO（16/32 の2フレーム） | **32×32 PNG・背景 (16,24,32) の濃紺** |
 *
 * ── ★背景がベタ塗りの3社は承知のうえで採用 ─────────────────────────────────
 * Kong（黄緑 #CCFF00）/ ゲインサイト（青 #38A2FF）/ シンカ（白）/ パランティア（濃紺）。
 * 透過は New Relic とザクトリーのみ。**白い正方形と色付き正方形が混在する**が、
 * 横長バナーとの混在よりは揃う、という判断（柴さん・2026-08-28）。
 *
 * ── 保留していた2社のその後（2026-08-29）─────────────────────────────────────
 * ✅ **フライルは入れた**（36×36・第3バッチ）。
 * ⚠️★**PKSHA は入れない。** 候補（32×32 の黒い三角）を 68px 枠で 1.7倍に拡大すると
 *    **再生ボタンに誤読される。** letter（紫グラデに白い "P"）のほうが識別性が高い。
 *    **`logo_url` は NULL のまま維持すること。**
 *    ⚠️ letter は**破綻ではなく「ロゴが無い」ことの表現**。埋めにいかない。
 *
 * ── 実行 ────────────────────────────────────────────────────────────────────
 *   node scripts/upload-logos-20260828d.mjs            … 6社ぶん
 *   node scripts/upload-logos-20260828d.mjs new-relic  … 1社だけ（先行確認用）
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
  const k = t.slice(0, eq).trim();
  let v = t.slice(eq + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/** ⚠️ 対象は id で明示列挙する。`before` は差し替え前の実寸と比率。 */
const TARGETS = [
  { key: 'zactory',   id: '1241f8a5-b645-4aa2-9fa1-bbfc573f1774', name: 'ザクトリー株式会社',
    file: 'scripts/assets/logos-20260828d/zactory.png',   before: '1366x855 比1.6（★ロゴではなく写真）',
    origin: 'https://www.xactlycorp.com/ の favicon（ICO 256px フレーム）', urlWasJpg: true },
  { key: 'kong',      id: 'e459ac79-5dad-499d-bb65-b758d4281123', name: 'コング・ジャパン株式会社',
    file: 'scripts/assets/logos-20260828d/kong.png',      before: '1682x936 比1.8',
    origin: 'https://konghq.com/ の <link rel=icon>' },
  { key: 'new-relic', id: '0d4734e0-0717-475e-a6d1-806aa2cd45ff', name: 'New Relic株式会社',
    file: 'scripts/assets/logos-20260828d/new-relic.png', before: '2400x1352 比1.78',
    origin: 'https://newrelic.com/jp の <link rel=apple-touch-icon>' },
  { key: 'gainsight', id: '4fecbf31-498c-40b0-a04e-3a6cb978433f', name: 'ゲインサイト・ジャパン株式会社',
    file: 'scripts/assets/logos-20260828d/gainsight.png', before: '1200x675 比1.78',
    origin: 'https://www.gainsight.com/apple-touch-icon.png', urlWasJpg: true },
  { key: 'shinka',    id: '28b826eb-fb86-4124-aa08-c489cad662f1', name: '株式会社シンカ',
    file: 'scripts/assets/logos-20260828d/shinka.png',    before: '1200x630 比1.9',
    origin: 'https://www.thinca.co.jp/apple-touch-icon.png' },
  { key: 'palantir',  id: 'be74d989-db8f-4be1-882c-40cf94e07fe2', name: 'パランティア・テクノロジーズ',
    file: 'scripts/assets/logos-20260828d/palantir.png',  before: '2996x1955 比1.53',
    origin: 'https://www.palantir.com/ の <link rel=icon>（ICO 32px フレーム）' },
  /* ★第3バッチ（2026-08-29）。**保留していた2社のうちフライルだけ**を入れる。
        ⚠️ `logo_url` は **NULL** だったので、migration で**新しく設定する**
           （他6社は既存URLの上書き or 拡張子の変更だった）。
        ⚠️ **PKSHA はここに足さないこと。** letter フォールバックのまま残すと決めた
           （理由は `20260829090000_logo_url_flyle.sql` のコメント）。 */
  /* ★第4バッチ（2026-08-29）。**デル・テクノロジーズは todo.md の「残り9社」に
        載っていなかった**（未着手だった1社）。他8社は「一巡済み」で掘り直さない。
     ⚠️ 取得元は **dell.com/ja-jp の apple-touch-icon**。curl は 403 で弾かれるので、
        実ブラウザから取得した（Scene7 の画像も curl では 403）。
     ⚠️ 採ったのは **Dell の四角アイコン**で、いま入っている
        「Dell Technologies」の**積み重ね型ワードマーク（1346x780・比1.73）**とは別の意匠。
        公式サイトが自ら apple-touch-icon に使っている素材で、68px 枠で読める。 */
  { key: 'dell',      id: 'f4acddc0-c746-4537-9edf-6f3c1f2c90b3', name: 'デル・テクノロジーズ株式会社',
    file: 'scripts/assets/logos-20260828d/dell.png',      before: '1346x780 比1.73（Dell Technologies の横長ワードマーク）',
    origin: 'https://www.dell.com/apple-touch-icon.png（180x180）' },
  { key: 'flyle',     id: 'cb386dd2-427c-49d1-b3f8-1e1d3a921fd8', name: '株式会社フライル',
    file: 'scripts/assets/logos-20260828d/flyle.png',     before: 'logo_url が NULL（letter フォールバック "F"）',
    origin: 'https://flyle.io/ の <link rel=icon>' },
];

const only = process.argv[2];
const list = only ? TARGETS.filter((t) => t.key === only) : TARGETS;
if (only && list.length === 0) { console.error(`✗ key "${only}" が無い`); process.exit(1); }

const MIN_PX = 32;      // ⚠️ 今回はパランティアの 32px を承知のうえで採る。b バッチの 150px 基準は当てない
const MAX_RATIO = 1.6;

let ok = 0, ng = 0;
for (const t of list) {
  const buf = fs.readFileSync(path.resolve(process.cwd(), t.file));

  /* ⚠️ PNG であることを確かめてから上げる（HTML のエラーページを掴んでいると
        「上がったのに表示されない」になる）。今回は実際に SPA が 200 で HTML を
        返す例が9件あった。 */
  if (!(buf[0] === 0x89 && buf.subarray(1, 4).toString() === 'PNG')) {
    console.error(`✗ ${t.name}: PNG ではない`); ng++; continue;
  }
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  const ratio = w / h;
  if (ratio > MAX_RATIO || ratio < 1 / MAX_RATIO) { console.error(`✗ ${t.name}: ${w}x${h} は正方形から離れすぎ`); ng++; continue; }
  if (Math.min(w, h) < MIN_PX) { console.error(`✗ ${t.name}: 短辺 ${Math.min(w, h)}px < ${MIN_PX}px`); ng++; continue; }

  /* ★DB の現在値を見てから上げる。**キーを組み立てて確認しない**
        （前回「7件上げたのに5件しか効かない」と誤報した原因がこれ）。 */
  const { data: row, error: qErr } = await supabase
    .from('ow_companies').select('logo_url').eq('id', t.id).single();
  if (qErr) { console.error(`✗ ${t.name}: DB 取得失敗 ${qErr.message}`); ng++; continue; }

  const key = `companies/logos/${t.id}/logo.png`;
  const { error } = await supabase.storage.from('ow-uploads').upload(key, buf, {
    contentType: 'image/png', upsert: true,
  });
  if (error) { console.error(`✗ ${t.name}: ${error.message}`); ng++; continue; }

  /* ⚠️ 3通りある。**二択で書かないこと**（フライルを .jpg と誤って表示した）。
        NULL         … 新しく設定する（migration が要る）
        別の拡張子    … 差し替える（migration が要る。旧ファイルは孤児として残る）
        logo.png     … 同じキーを上書きしたので DB は触らなくてよい */
  const cur = row?.logo_url;
  const state = cur == null ? '★NULL（migration で新しく設定する）'
    : cur.endsWith('/logo.png') ? 'logo.png（このまま反映される）'
    : `★${cur.split('/').pop()}（migration で更新が要る）`;
  console.log(`✓ ${t.name}  ${t.before} → ${w}x${h}  ${buf.length}bytes`);
  console.log(`   DB の指す先: ${state}`);
  ok++;
}
console.log(`\n成功 ${ok} / 失敗 ${ng}`);
console.log('⚠️ 確認は DB の logo_url を実際に取得して測ること（Storage のキーを組み立てない）。');
process.exit(ng ? 1 : 0);
