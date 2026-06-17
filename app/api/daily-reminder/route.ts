import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { pushMessage, textMessage } from '@/lib/line'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const ownerUserId = process.env.LINE_OWNER_USER_ID!

  // 明天的範圍（台灣時間）
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dateStr = tomorrow.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) // YYYY-MM-DD
  const start = new Date(`${dateStr}T00:00:00+08:00`).toISOString()
  const end = new Date(`${dateStr}T23:59:59+08:00`).toISOString()

  const { data } = await supabase.from('events').select('*')
    .gte('start_at', start).lte('start_at', end).order('start_at')

  if (!data || data.length === 0) {
    // 明天沒行程就不推（不打擾）
    return NextResponse.json({ ok: true, sent: false })
  }

  const weekday = ['日', '一', '二', '三', '四', '五', '六'][tomorrow.getDay()]
  const list = data.map((e: { start_at: string; title: string; category: string }) => {
    const t = new Date(e.start_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Taipei' })
    return `${e.category === 'work' ? '💼' : '🌸'} ${t} ${e.title}`
  }).join('\n')

  await pushMessage(ownerUserId, [textMessage(
    `🔔 明日行程提醒\n明天（週${weekday} ${dateStr}）\n${'─'.repeat(18)}\n\n${list}`
  )])

  return NextResponse.json({ ok: true, sent: true, count: data.length })
}
