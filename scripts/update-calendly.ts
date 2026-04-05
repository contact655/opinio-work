import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const CALENDLY_URL = 'https://calendly.com/hshiba-opinio/30min'

  // mentorsテーブルの柴さんを更新
  for (const table of ['mentors', 'ow_mentors']) {
    const { error } = await supabase
      .from(table)
      .update({ calendly_url: CALENDLY_URL })
      .eq('name', '柴 久人')
    if (!error) console.log(`✅ Updated ${table}`)
    else console.log(`⚠️ ${table}: ${error.message}`)
  }

  console.log('🎉 Done!')
}

main().catch(console.error)
