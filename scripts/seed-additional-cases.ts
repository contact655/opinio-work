import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('🚀 Seeding additional consultation cases...')

  const { data: mentor, error: mentorErr } = await supabase
    .from('mentors')
    .select('id')
    .eq('name', '柴 久人')
    .single()

  if (mentorErr || !mentor) {
    console.error('❌ Could not find mentor:', mentorErr?.message)
    process.exit(1)
  }

  const cases = [
    {
      mentor_id: mentor.id,
      consulted_at: '2025-03-18',
      anon_profile: 'フィールドセールス 3年 / 20代後半 / 関東',
      worry_category: 'スタートアップ',
      worry_summary: '大手SaaSからシリーズAのスタートアップへのオファーがある。年収は100万下がるがストックオプションがある。どう判断すべきか。',
      insight: 'ストックオプションは会社のフェーズと自分の生活費のバランスで判断する。最悪のシナリオ（会社が潰れた場合）を具体的に考えて許容できるかを確認する。20代なら失敗しても資産になる。',
      action_taken: 'スタートアップへの転職を決断。入社6ヶ月後に追加調達を達成',
      is_published: true, consent_given: true, display_order: 7,
    },
    {
      mentor_id: mentor.id,
      consulted_at: '2025-03-16',
      anon_profile: 'インサイドセールス 2年 / 20代前半 / 関西',
      worry_category: 'キャリアチェンジ',
      worry_summary: 'ISからフィールドセールスにキャリアチェンジしたい。でも未経験扱いになるのが不安。年収が下がらないか心配。',
      insight: 'ISの経験はFSへの転職で高く評価される。リード獲得から商談設定まで経験済みなので未経験扱いにはならない。むしろBDR経験者を求めている企業は多い。',
      action_taken: 'フィールドセールスとして転職。年収は据え置きで達成',
      is_published: true, consent_given: true, display_order: 8,
    },
    {
      mentor_id: mentor.id,
      consulted_at: '2025-03-14',
      anon_profile: 'CS 4年 / 30代前半 / 関東',
      worry_category: '年収交渉',
      worry_summary: '現職のCSで4年働いているが年収が上がらない。転職して年収を上げたいが、CS職は年収が低いと聞く。600万以上は可能か。',
      insight: 'CS職でも会社によっては800万〜1000万のレンジがある。特にエンタープライズCSやCCO候補ポジションは高い。今の年収を正直に伝えて上振れを交渉することが重要。',
      action_taken: '転職して年収を520万→680万に引き上げることに成功',
      is_published: true, consent_given: true, display_order: 9,
    },
    {
      mentor_id: mentor.id,
      consulted_at: '2025-03-12',
      anon_profile: 'マーケ 3年 / 20代後半 / 関東',
      worry_category: 'キャリアチェンジ',
      worry_summary: '事業会社のマーケから、SaaSのマーケへの転職を考えている。BtoBマーケは未経験。何を準備すべきか。',
      insight: 'BtoCマーケの経験はBtoBに転用できる。特にデータ分析・コンテンツ制作の経験は直結する。MAツール（HubSpot等）の資格を取ると転職市場での評価が上がる。',
      action_taken: 'HubSpot認定資格を取得後、SaaSマーケとして転職に成功',
      is_published: true, consent_given: true, display_order: 10,
    },
    {
      mentor_id: mentor.id,
      consulted_at: '2025-03-10',
      anon_profile: 'フィールドセールス 7年 / 30代後半 / 関東',
      worry_category: '転職タイミング',
      worry_summary: '大手SIerで7年営業をやってきた。SaaSへの転職を考えているが、30代後半という年齢がネックにならないか不安。',
      insight: '30代後半でも大手SIerの営業経験は評価される。エンタープライズ営業の経験・人脈が特に評価される。マネージャー候補として採用されるケースも多い。',
      action_taken: 'SaaS企業のシニアセールスとして転職。マネージャー候補として入社',
      is_published: true, consent_given: true, display_order: 11,
    },
    {
      mentor_id: mentor.id,
      consulted_at: '2025-03-08',
      anon_profile: 'CS 1年 / 20代前半 / 関東',
      worry_category: 'スタートアップ',
      worry_summary: '新卒でSaaSのCSに入社したが、会社の成長が遅くて物足りない。もっと早い成長フェーズで働きたい。',
      insight: '1年での転職は早いと思われる可能性があるので、なぜ転職したいかの説明を準備する。成長フェーズへの転職は早い方が良い面もある。ただし生活費を確保できるかの確認は必須。',
      action_taken: 'シリーズAのスタートアップへ転職。責任範囲が大幅に広がった',
      is_published: true, consent_given: true, display_order: 12,
    },
    {
      mentor_id: mentor.id,
      consulted_at: '2025-03-06',
      anon_profile: '事業会社マーケ 5年 / 30代前半 / 東海',
      worry_category: '外資転職',
      worry_summary: '外資SaaSのマーケポジションにオファーをもらった。外資で働くのが初めてで文化的に馴染めるか不安。英語はビジネスレベル。',
      insight: '外資は結果主義で評価が明確。英語ビジネスレベルがあれば業務は問題ない。最初の3ヶ月は文化の違いに戸惑うが、慣れれば働きやすい。オファーレターの条件を細かく確認することを推奨。',
      action_taken: '外資SaaSへ転職。入社後は思った以上に日本的な環境で驚いた',
      is_published: true, consent_given: true, display_order: 13,
    },
    {
      mentor_id: mentor.id,
      consulted_at: '2025-03-04',
      anon_profile: 'IS 3年 / 20代後半 / 関東',
      worry_category: '転職タイミング',
      worry_summary: '結婚を控えており転職のタイミングを迷っている。入籍前に転職した方が良いか、落ち着いてからにした方が良いか。',
      insight: '転職と結婚の順番に正解はない。ただし転職直後は試用期間があり収入が不安定になるリスクがある。パートナーと状況を共有した上で決断することが最重要。',
      action_taken: '転職先を決めてから入籍。パートナーの理解が大きかった',
      is_published: true, consent_given: true, display_order: 14,
    },
    {
      mentor_id: mentor.id,
      consulted_at: '2025-03-02',
      anon_profile: 'フィールドセールス 5年 / 30代前半 / 関東',
      worry_category: '年収交渉',
      worry_summary: '複数社から内定をもらっている。A社は年収高め・成長性低め、B社は年収低め・成長性高め。どちらを選ぶべきか。',
      insight: '30代前半なら成長性を取る選択は理にかなっている。ただしB社の「成長性」が本当かどうかの検証が必要。資金調達状況・競合・プロダクトのPMF確認を。A社の年収をB社に交渉するのも手。',
      action_taken: 'B社の成長性を詳しく検証した上でB社を選択。その後シリーズCに進化',
      is_published: true, consent_given: true, display_order: 15,
    },
    {
      mentor_id: mentor.id,
      consulted_at: '2025-02-28',
      anon_profile: 'CS 3年 / 20代後半 / 関西',
      worry_category: 'キャリアチェンジ',
      worry_summary: 'CSからプロダクトマネージャーにキャリアチェンジしたい。ユーザーの声を拾う経験はある。でも技術的なバックグラウンドがない。',
      insight: 'CS出身PMは増えている。ユーザーリサーチ・課題定義の経験は武器になる。技術的なスキルはPMになってから学べる。まずはPMポジションを募集している会社を探す。',
      action_taken: 'SaaSスタートアップのPMとして転職に成功',
      is_published: true, consent_given: true, display_order: 16,
    },
    {
      mentor_id: mentor.id,
      consulted_at: '2025-02-25',
      anon_profile: 'フィールドセールス 2年 / 20代前半 / 関東',
      worry_category: '転職タイミング',
      worry_summary: '入社2年目で転職を考えている。上司から「まだ早い」と言われた。2年での転職はやはり不利か。',
      insight: 'SaaS業界では2〜3年での転職は珍しくない。「なぜ転職するか」の理由が明確であれば問題ない。ポジティブな理由（成長・チャレンジ）で語れるか確認する。',
      action_taken: '転職理由を整理し直し、3ヶ月後に転職活動を開始',
      is_published: true, consent_given: true, display_order: 17,
    },
    {
      mentor_id: mentor.id,
      consulted_at: '2025-02-22',
      anon_profile: 'マーケ 4年 / 30代前半 / 関東',
      worry_category: '外資転職',
      worry_summary: '外資SaaSのマーケでオファーをもらったが、基本給は現職と同等でRSU（株式報酬）が大きい。RSUの価値をどう考えるべきか。',
      insight: 'RSUは上場企業なら換金性があるが、株価によって価値が変動する。ベスティングスケジュールと会社の株価動向を確認する。基本給が維持されるなら検討価値は高い。',
      action_taken: '条件を詳細に確認した上で外資SaaSへ転職を決断',
      is_published: true, consent_given: true, display_order: 18,
    },
    {
      mentor_id: mentor.id,
      consulted_at: '2025-02-18',
      anon_profile: 'IS 4年 / 30代前半 / 関東',
      worry_category: 'キャリアチェンジ',
      worry_summary: '長くISをやってきたが、フィールドに出たい。ただしエンタープライズ向けの経験がなく、ハードルが高いと感じている。',
      insight: 'ISでエンタープライズ企業への商談設定経験があれば、FSへの転換は可能。SMB向けのFSから始めてステップアップする方法もある。まずはMidマーケット向けのFSポジションを探すのが現実的。',
      action_taken: 'Midマーケット向けFSとして転職。1年後にエンタープライズ担当に昇格',
      is_published: true, consent_given: true, display_order: 19,
    },
    {
      mentor_id: mentor.id,
      consulted_at: '2025-02-15',
      anon_profile: 'フィールドセールス 8年 / 40代前半 / 関東',
      worry_category: '転職タイミング',
      worry_summary: '40代での転職を考えている。年齢的に厳しいと感じているが、SaaS業界なら年齢より実績で評価されると聞いた。実際のところはどうか。',
      insight: 'SaaS業界でも40代の転職は容易ではないが、エンタープライズ営業の実績・人脈があれば評価される。マネージャー・ディレクタークラスのポジションを中心に探すのが現実的。',
      action_taken: 'エンタープライズ営業のシニアマネージャーとして転職に成功',
      is_published: true, consent_given: true, display_order: 20,
    },
  ]

  const { data, error: insertErr } = await supabase
    .from('consultation_cases')
    .insert(cases)
    .select('id')

  if (insertErr) {
    console.error('❌ Insert error:', insertErr.message)
    process.exit(1)
  }

  console.log(`✅ Inserted ${data?.length ?? 0} additional consultation cases`)
}

main().catch(console.error)
