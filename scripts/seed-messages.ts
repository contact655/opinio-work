import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('🚀 Seeding messages...')

  // HisatoさんのuserIdを取得
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const hisato = users.find(u => u.email === 'hshiba@opinio.co.jp')
  if (!hisato) { console.error('❌ User not found'); return }
  const userId = hisato.id
  console.log('✅ User found:', userId)

  // 企業IDを取得
  const { data: companies } = await supabase
    .from('ow_companies')
    .select('id, name')
    .in('name', ['Salesforce Japan株式会社', 'Ubie株式会社', 'フリー株式会社', '株式会社LayerX'])

  if (!companies?.length) { console.error('❌ Companies not found'); return }

  const companyMap: Record<string, string> = {}
  companies.forEach(c => { companyMap[c.name] = c.id })
  console.log('✅ Companies found:', Object.keys(companyMap).join(', '))

  // 既存スレッドを削除（再実行対応）
  const { data: existingThreads } = await supabase
    .from('ow_threads')
    .select('id')
    .eq('candidate_id', userId)
  if (existingThreads && existingThreads.length > 0) {
    const threadIds = existingThreads.map(t => t.id)
    await supabase.from('ow_messages').delete().in('thread_id', threadIds)
    await supabase.from('ow_threads').delete().eq('candidate_id', userId)
    console.log('🗑 Cleared existing threads/messages')
  }

  // サンプルスレッドを作成
  const threadsData = [
    {
      company_id: companyMap['Salesforce Japan株式会社'],
      candidate_id: userId,
      status: 'schedule_adjusting',
      company_name: 'Salesforce Japan株式会社',
      last_message: 'ご都合のよい日程を教えていただけますか？',
      unread_count: 1,
    },
    {
      company_id: companyMap['Ubie株式会社'],
      candidate_id: userId,
      status: 'casual_confirmed',
      company_name: 'Ubie株式会社',
      last_message: '面談日程が確定しました。よろしくお願いいたします！',
      unread_count: 0,
    },
    {
      company_id: companyMap['株式会社LayerX'],
      candidate_id: userId,
      status: 'casual_requested',
      company_name: '株式会社LayerX',
      last_message: 'カジュアル面談のリクエストが送信されました',
      unread_count: 1,
    },
    {
      company_id: companyMap['フリー株式会社'],
      candidate_id: userId,
      status: 'offer',
      company_name: 'フリー株式会社',
      last_message: '内定のご連絡です。ぜひご検討ください。',
      unread_count: 1,
    },
  ].filter(t => t.company_id) // company_idがundefinedのものを除外

  const createdThreads: any[] = []
  for (const thread of threadsData) {
    const { data, error } = await supabase
      .from('ow_threads')
      .insert(thread)
      .select()
      .single()
    if (error) {
      console.error(`❌ Thread error (${thread.company_name}):`, error.message)
    } else {
      createdThreads.push(data)
      console.log(`✅ Thread: ${thread.company_name}`)
    }
  }

  // サンプルメッセージを投入
  const now = new Date()
  const messagesData = [
    // Salesforceスレッド
    ...(createdThreads[0] ? [
      {
        thread_id: createdThreads[0].id,
        sender_id: userId,
        sender_type: 'system',
        content: 'Salesforce Japan株式会社へのカジュアル面談リクエストが送信されました',
        created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        is_read: true,
      },
      {
        thread_id: createdThreads[0].id,
        sender_type: 'company',
        content: 'はじめまして、採用担当の田中です。この度はご関心をいただきありがとうございます！まずはカジュアルにお話しできればと思っています。',
        created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        is_read: true,
      },
      {
        thread_id: createdThreads[0].id,
        sender_id: userId,
        sender_type: 'candidate',
        content: 'ありがとうございます！エンタープライズ営業のポジションに興味があります。よろしくお願いいたします。',
        created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
        is_read: true,
      },
      {
        thread_id: createdThreads[0].id,
        sender_type: 'company',
        content: 'ご連絡ありがとうございます！ではZoomで30分ほどお話しさせてください。来週のご都合はいかがでしょうか？\n\n候補日：\n・4/8（火）14:00〜\n・4/9（水）11:00〜\n・4/10（木）16:00〜',
        created_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
        is_read: false,
      },
    ] : []),
    // Ubieスレッド
    ...(createdThreads[1] ? [
      {
        thread_id: createdThreads[1].id,
        sender_id: userId,
        sender_type: 'system',
        content: 'Ubie株式会社へのカジュアル面談リクエストが送信されました',
        created_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        is_read: true,
      },
      {
        thread_id: createdThreads[1].id,
        sender_type: 'company',
        content: 'ご応募ありがとうございます！4/7（月）15:00でいかがでしょうか？',
        created_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        is_read: true,
      },
      {
        thread_id: createdThreads[1].id,
        sender_id: userId,
        sender_type: 'candidate',
        content: '4/7（月）15:00でお願いいたします！よろしくお願いいたします。',
        created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        is_read: true,
      },
      {
        thread_id: createdThreads[1].id,
        sender_type: 'company',
        content: 'ありがとうございます！確定いたしました。Zoomリンクをメールでお送りします。当日お待ちしております！',
        created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
        is_read: true,
      },
    ] : []),
    // LayerXスレッド
    ...(createdThreads[2] ? [
      {
        thread_id: createdThreads[2].id,
        sender_id: userId,
        sender_type: 'system',
        content: '株式会社LayerXへのカジュアル面談リクエストが送信されました',
        created_at: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
        is_read: false,
      },
    ] : []),
    // Freeeスレッド
    ...(createdThreads[3] ? [
      {
        thread_id: createdThreads[3].id,
        sender_type: 'company',
        content: 'この度は選考にご参加いただきありがとうございました。慎重に検討した結果、内定のご連絡をさせていただきます。ぜひご検討ください。',
        created_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        is_read: false,
      },
    ] : []),
  ]

  let msgCount = 0
  for (const msg of messagesData) {
    if (!msg.thread_id) continue
    const { error } = await supabase.from('ow_messages').insert(msg)
    if (error) console.error('❌ Message error:', error.message)
    else msgCount++
  }

  console.log(`🎉 Messages seed complete! ${createdThreads.length} threads, ${msgCount} messages`)
}

main().catch(console.error)
