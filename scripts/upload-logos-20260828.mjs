/**
 * upload-logos-20260828.mjs
 *
 * ロゴが**OGP画像**になっていた企業を、公式サイトの正方形アセットに差し替える（2026-08-28）。
 *
 * ⚠️ 既存と同じ置き場・同じ命名にする:
 *      ow-uploads/companies/logos/{company_id}/logo.png
 * ⚠️ **DB は更新しない。** `logo_url` の書き換えは migration で行う
 *    （CLAUDE.md「SQL Editor での手動適用を禁止する」）。
 *    ⚠️★**7社のうち2社は URL も変わる。** このスクリプトは必ず `logo.png` に上げるが、
 *       **DB が `logo.jpg` を指している企業がいる**（掲載77社中9社が .jpg・1社が別名）。
 *       アンソロピックとゼットスケーラーがこれに該当し、上げただけでは
 *       **参照されず、古い画像が出続ける**（2026-08-28 に実際に踏んだ）。
 *       残り5社は同じキーへの upsert なので URL は変わらない。
 *    ⚠️ 差し替え後は **DB の logo_url を実際に取得して寸法を測る**こと。
 *       Storage のキーを組み立てて測ると、DB が別の名前を指していても気づけない。
 * ⚠️ 対象は id で明示列挙する。全社一括で走らせない。
 *
 * ── 何が問題だったか（2026-08-28 実測）──────────────────────────────────
 * 掲載79社のうち **22社（28.6%）のロゴが縦横比 1.91:1** ——1200x628 / 1024x537 /
 * 2400x1260 など、**OGP画像の規格**だった。各社サイトから取得した OGP バナーで
 * あってロゴではなく、マーケティング文言や背景色が焼き込まれている。
 * 68px の正方形枠に contain で収めると**高さ17px程度になり判読できない**。
 *
 * ── なぜ7社だけか（22社すべて当たった結果）──────────────────────────────
 * 公式サイトの `<link rel="*icon*">` と定番パスを全部試し、**180px 以上の
 * 正方形アセットが取れたのはこの7社だけ**だった。
 *
 *   取れなかった主な理由:
 *     Salesforce / Cisco / Qualcomm / Workday / Translead … 公式が 16〜32px の favicon しか出していない
 *     Okta(57) / Braze(48) / MongoDB(64) / Concur(96) / Zendesk(152) / Kyriba(156) … 180px 未満
 *     Databricks / Mirakl / Thinca / Timee … サイトが 403 / 503 / TLS エラーで取得できず
 *
 * ⚠️ **180px 未満を採らない。** 68px 枠に対して 96px などは改善幅が小さく、
 *    引き伸ばしで粗くなる。既存の判断（2026-08-25 に 36px を見送った）と揃える。
 * ⚠️ **残り15社は推測で埋めない。** ブランドキットや Wikimedia を1社ずつ当たる
 *    別タスクにする。OGP画像のままのほうが「間違ったロゴ」よりましと判断した。
 *
 * ── 目視で確認したこと ──────────────────────────────────────────────────
 * 7社とも 110px 枠に描いて**自社ロゴであること**を目で確認している（2026-08-28）。
 * Notion=N / Snowflake=雪片 / Anthropic=A\ / Elastic=多色クラスタ /
 * Zscaler=青いスウッシュ / PagerDuty=緑のP / irodas=多色マーク。
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

/** ⚠️ src は実際に取得して実寸を測ったもの。コメントの数字は実測値。 */
const TARGETS = [
  { id: 'bf24736f-fa65-4c5a-9764-98c96ace3b07', name: 'Notion Labs Japan合同会社',
    src: 'https://www.notion.so/front-static/logo-ios.png' },                                    // 512x512
  { id: 'cb70da1c-4b3b-429b-a06b-cdc2c50172f8', name: 'Snowflake Japan株式会社',
    src: 'https://www.snowflake.com/etc.clientlibs/snowflake-site/clientlibs/clientlib-react/resources/apple-touch-icon.png?v=3' }, // 180x180
  { id: 'f32e6905-f25f-4c01-b64f-c5695fd45a1d', name: 'アンソロピックジャパン合同会社',
    src: 'https://cdn.prod.website-files.com/67ce28cfec624e2b733f8a52/67d31dd7aa394792257596c5_webclip.png' }, // 256x256
  { id: '1e541353-c177-40a9-968a-af3af14e1194', name: 'エラスティック株式会社',
    src: 'https://www.elastic.co/apple-touch-icon.png' },                                        // 180x180
  { id: 'dd76b17d-e3c1-44a9-b747-4ecde10b8cec', name: 'ゼットスケーラー株式会社',
    src: 'https://www.zscaler.com/favicons/apple-touch-icon.png' },                              // 180x180（WEBP → PNG に変換して上げる）
  { id: '7baafcb1-d929-46c1-97be-b0fb580b480b', name: 'ページャーデューティー株式会社',
    src: 'https://www.pagerduty.co.jp/wordpress/wp-content/uploads/2022/08/apple-touch-icon.png' }, // 180x180
  { id: '63d390da-e8c4-464a-8c30-e112fcd2709c', name: '株式会社irodas',
    src: 'https://framerusercontent.com/images/Y4Gal2cuyO22m1Mr9sSYTZAags.png' },                // 640x640
];

const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36' };

let ok = 0, ng = 0;
for (const t of TARGETS) {
  const res = await fetch(t.src, { headers: UA });
  if (!res.ok) { console.error(`✗ ${t.name}: 取得失敗 ${res.status}`); ng++; continue; }
  let buf = Buffer.from(await res.arrayBuffer());

  /* ⚠️ PNG であることを確かめてから上げる。HTML のエラーページを掴んでいると
        「上がったのに表示されない」になる。
     ⚠️ Zscaler は WEBP を返すので、その場合だけ PNG へ変換したものを使う
        （事前に /tmp で変換済みのものを使わず、ここで判定して落とす）。 */
  const isPng = buf[0] === 0x89 && buf.subarray(1, 4).toString() === 'PNG';
  if (!isPng) {
    console.error(`✗ ${t.name}: PNG ではない（${buf.subarray(0, 16).toString('hex')}）。`
      + ` 変換が要る場合は事前に PNG 化してから src に指定すること`);
    ng++; continue;
  }
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  if (w < 180 || h < 180) { console.error(`✗ ${t.name}: ${w}x${h} は 180px 未満。中止`); ng++; continue; }
  if (w !== h)            { console.error(`✗ ${t.name}: ${w}x${h} が正方形でない。中止`); ng++; continue; }

  const key = `companies/logos/${t.id}/logo.png`;
  const { error } = await supabase.storage.from('ow-uploads').upload(key, buf, {
    contentType: 'image/png', upsert: true,
  });
  if (error) { console.error(`✗ ${t.name}: ${error.message}`); ng++; continue; }
  const { data } = supabase.storage.from('ow-uploads').getPublicUrl(key);
  console.log(`✓ ${t.name}  ${w}x${h}  ${buf.length}bytes\n  ${data.publicUrl}`);
  ok++;
}
console.log(`\n成功 ${ok} / 失敗 ${ng}`);
process.exit(ng ? 1 : 0);
