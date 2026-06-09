/**
 * scripts/fix-wikipedia-logos.mjs
 * Wikipedia/Wikimedia ロゴを Google Favicon API → Supabase Storage に移行
 *
 * Google Favicon API: https://www.google.com/s2/favicons?domain={domain}&sz=256
 * → PNG を返す
 *
 * 実行: node scripts/fix-wikipedia-logos.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://xtutnecqeamftygufxco.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dXRuZWNxZWFtZnR5Z3VmeGNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIxMzg2NywiZXhwIjoyMDg4Nzg5ODY3fQ.l59z5TNQdFWiY5f2_FfezmU2dmuVhY0jdsUKArpQo7g";

const BUCKET = "ow-uploads";

const COMPANIES = [
  { id: "87bcae88-2779-4bf7-b461-b3c8661b2764", name: "CrowdStrike",  domain: "crowdstrike.com" },
  { id: "4df6e844-74d6-4f50-98f9-08468a12f1dc", name: "ServiceNow",   domain: "servicenow.com" },
  { id: "cd4d23ca-d2cd-4e5d-bd2f-ad63d3533e16", name: "Slack",        domain: "slack.com" },
  { id: "08e4aff6-a12c-4963-ad43-960ac9e39967", name: "IBM (Aptio)",  domain: "ibm.com" },
  { id: "3efd857e-315c-4650-9727-1e5aa1245753", name: "Arista",       domain: "arista.com" },
  { id: "1027a327-18c0-4191-b27b-a28bf5781126", name: "Coupa",        domain: "coupa.com" },
  { id: "53ea9a54-feef-413b-8a7c-e31e4def2e11", name: "BlackLine",    domain: "blackline.com" },
  { id: "9e8bb2c2-2a02-4703-89b0-5d9c4d1981d6", name: "HPE",         domain: "hpe.com" },
  { id: "c32027b9-cfbd-4a70-bf4c-464e42790db4", name: "HP",           domain: "hp.com" },
];

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function downloadLogo(domain) {
  // Google Favicon API — PNG, follows redirects
  const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "OPINIOBot/1.0" },
    redirect: "follow",
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const contentType = resp.headers.get("content-type") ?? "image/png";
  const buffer = Buffer.from(await resp.arrayBuffer());
  return { buffer, contentType };
}

async function processCompany(company) {
  const storagePath = `companies/logos/${company.id}/logo.png`;

  console.log(`\n[${company.name}] (${company.domain})`);

  // 1. ダウンロード
  console.log(`  ↓ Google Favicon API...`);
  let logoData;
  try {
    const { buffer } = await downloadLogo(company.domain);
    logoData = buffer;
    console.log(`  ✓ downloaded (${Math.round(logoData.length / 1024)}KB)`);
  } catch (err) {
    console.error(`  ✗ download failed: ${err.message}`);
    return false;
  }

  // 2. Supabase Storage にアップロード (upsert)
  console.log(`  ↑ uploading to ${BUCKET}/${storagePath}...`);
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, logoData, {
      contentType: "image/png",
      upsert: true,
      cacheControl: "31536000",
    });

  if (uploadError) {
    console.error(`  ✗ upload failed: ${uploadError.message}`);
    return false;
  }
  console.log(`  ✓ uploaded`);

  // 3. 公開URLを取得
  const { data: publicUrlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);
  const newUrl = publicUrlData.publicUrl;
  console.log(`  🔗 ${newUrl}`);

  // 4. DBのlogo_urlを更新
  const { error: dbError } = await supabase
    .from("ow_companies")
    .update({ logo_url: newUrl })
    .eq("id", company.id);

  if (dbError) {
    console.error(`  ✗ DB update failed: ${dbError.message}`);
    return false;
  }
  console.log(`  ✓ DB updated`);
  return true;
}

async function main() {
  console.log("=== Wikipedia logo → Google Favicon + Supabase Storage ===");
  console.log(`Processing ${COMPANIES.length} companies...\n`);

  let success = 0;
  let fail = 0;

  for (const company of COMPANIES) {
    const ok = await processCompany(company);
    if (ok) success++;
    else fail++;
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\n=== 完了: ${success}件成功 / ${fail}件失敗 ===`);
}

main().catch(console.error);
