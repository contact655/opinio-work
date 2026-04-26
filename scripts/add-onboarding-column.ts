// Add onboarding_completed column to ow_profiles
// Run via: npx tsx scripts/add-onboarding-column.ts

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  // Use PostgREST to check if column exists by querying it
  const checkRes = await fetch(
    `${SUPABASE_URL}/rest/v1/ow_profiles?select=onboarding_completed&limit=1`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    }
  );

  if (checkRes.ok) {
    console.log("✅ Column onboarding_completed already exists");
    return;
  }

  // Column doesn't exist - we need to add it via SQL
  // Try using the database's HTTP extension or pg_net
  // Since we can't run raw SQL via PostgREST, we'll create a temporary RPC function

  // Step 1: Create a temporary function via the setup-tables API
  console.log("⚠️ Column does not exist. Please run the following SQL in Supabase Dashboard SQL Editor:");
  console.log("");
  console.log("ALTER TABLE ow_profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;");
  console.log("");
  console.log("Dashboard URL: https://supabase.com/dashboard/project/xtutnecqeamftygufxco/sql/new");
}

main().catch(console.error);
