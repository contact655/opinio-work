import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('🚀 Seeding consultation cases...')

  // 柴 久人のmentor_idを取得
  const { data: mentor, error: mentorErr } = await supabase
    .from('mentors')
    .select('id')
    .eq('name', '柴 久人')
    .single()

  if (mentorErr || !mentor) {
    console.error('❌ Could not find mentor 柴 久人:', mentorErr?.message)
    process.exit(1)
  }
  console.log('✅ Found mentor:', mentor.id)

  const mentorId = mentor.id

  const cases = [
    {
      mentor_id: mentorId,
      consulted_at: '2025-03-20',
      anon_profile: '28歳・SIer営業・3年目',
      worry_category: 'キャリアチェンジ',
      worry_summary: 'SIerの営業を3年やったが、SaaSに転職したい。でもSaaS営業は未経験で不安。',
      insight: '「SIer営業で培った提案力は、SaaSのエンタープライズ営業でそのまま活きます。むしろSIer出身者を求めている企業は多い」というアドバイスに安心した。具体的にどの企業がSIer出身者を歓迎しているかも教えてもらえた。',
      action_taken: 'opinio.jpでSaaS企業3社に応募 → 2社から面接オファー',
      is_published: true,
      consent_given: true,
      display_order: 1,
    },
    {
      mentor_id: mentorId,
      consulted_at: '2025-03-15',
      anon_profile: '32歳・SaaS CS・5年目',
      worry_category: '年収交渉',
      worry_summary: '現職のCSとして5年。年収が上がらず、転職で年収アップしたい。でも相場がわからない。',
      insight: '「SaaS CSの5年経験で、エンタープライズ対応ができるなら年収600-750万が相場。今の480万は明らかに低い」と具体的な数字で教えてもらえた。交渉の仕方も具体的にアドバイスをもらった。',
      action_taken: '転職活動を開始し、年収650万のオファーを獲得。現職にも交渉して年収50万アップ。',
      is_published: true,
      consent_given: true,
      display_order: 2,
    },
    {
      mentor_id: mentorId,
      consulted_at: '2025-03-10',
      anon_profile: '26歳・人材営業・2年目',
      worry_category: '転職タイミング',
      worry_summary: '人材業界の営業を2年やった。IT業界に興味があるが、まだ早いのか、もう少し経験を積むべきか迷っている。',
      insight: '「2年の営業経験があれば十分。むしろ若いうちにIT業界に移った方がキャリアの選択肢が広がる。人材営業の経験はHRテック企業で特に重宝される」と背中を押してもらえた。',
      action_taken: 'HRテック企業2社に応募。1社で内定をもらい、転職を決意。',
      is_published: true,
      consent_given: true,
      display_order: 3,
    },
    {
      mentor_id: mentorId,
      consulted_at: '2025-03-05',
      anon_profile: '30歳・マーケター・4年目',
      worry_category: 'キャリアチェンジ',
      worry_summary: '広告代理店のマーケターだが、事業会社のマーケティングに転職したい。でもBtoBマーケは未経験。',
      insight: '「広告代理店で複数クライアントを担当した経験は、事業会社では"広い視野を持てる人材"として評価される。BtoBマーケ未経験でも、デジタルマーケの基礎があれば問題ない」と聞いて視野が広がった。',
      action_taken: 'SaaS企業のマーケポジションに応募。面接で代理店経験をアピールし、内定獲得。',
      is_published: true,
      consent_given: true,
      display_order: 4,
    },
    {
      mentor_id: mentorId,
      consulted_at: '2025-02-28',
      anon_profile: '35歳・事業開発・7年目',
      worry_category: 'スタートアップ',
      worry_summary: '大手SaaSで事業開発をしているが、スタートアップに転職して裁量のある環境で働きたい。でもリスクが怖い。',
      insight: '「シリーズA-B のスタートアップなら、大手からの転職者も多く、給与もそこまで下がらない。むしろストックオプションを含めるとアップサイドがある」と具体的なステージ別のリスク・リターンを教えてもらった。',
      action_taken: 'シリーズBのスタートアップ2社と面談。1社で事業開発マネージャーとして入社決定。',
      is_published: true,
      consent_given: true,
      display_order: 5,
    },
    {
      mentor_id: mentorId,
      consulted_at: '2025-02-20',
      anon_profile: '29歳・IS（インサイドセールス）・3年目',
      worry_category: '外資転職',
      worry_summary: '日系SaaSでISを3年。外資SaaSに転職して年収を上げたい。でも英語力に自信がない。',
      insight: '「外資SaaSの日本法人なら、日常業務は日本語がメイン。英語はメールと週1のグローバルミーティング程度。TOEIC600点台でも入社している人は多い」と聞いて、ハードルが下がった。',
      action_taken: '外資SaaS 3社に応募。英語面接対策もアドバイスをもらい、1社から内定。年収は30%アップ。',
      is_published: true,
      consent_given: true,
      display_order: 6,
    },
  ]

  // 既存データを削除
  const { error: delErr } = await supabase
    .from('consultation_cases')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (delErr) {
    console.log('⚠️ Delete warning (may be empty):', delErr.message)
  }

  // 挿入
  const { data, error: insertErr } = await supabase
    .from('consultation_cases')
    .insert(cases)
    .select('id')

  if (insertErr) {
    console.error('❌ Insert error:', insertErr.message)
    process.exit(1)
  }

  console.log(`✅ Inserted ${data?.length ?? 0} consultation cases`)
}

main().catch(console.error)
