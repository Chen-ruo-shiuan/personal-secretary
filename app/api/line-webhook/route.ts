import { NextRequest, NextResponse } from 'next/server'
import * as crypto from 'crypto'
import { supabase } from '@/lib/supabase'
import { pushMessage, textMessage } from '@/lib/line'

function verify(body: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET!
  const hash = crypto.createHmac('sha256', secret).update(body).digest('base64')
  return hash === signature
}

// 解析彈性日期格式：6/28 14:00 羽毛球 / 6/28 14:00 公事 羽毛球
function parseEventText(text: string): { date: string; time: string; title: string; category: 'personal' | 'work' } | null {
  // 支援格式：M/D HH:mm 標題 或 YYYY-MM-DD HH:mm 標題
  const patterns = [
    // 6/28 14:00 標題
    /^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}:\d{2})\s+(.+)$/,
    // 2026-06-28 14:00 標題
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2})\s+(.+)$/,
  ]

  const now = new Date()
  const year = now.getFullYear()

  // 短格式：M/D HH:mm 標題
  const short = text.match(patterns[0])
  if (short) {
    const [, month, day, time, rest] = short
    const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    const { title, category } = extractCategory(rest)
    return { date, time: time.padStart(5, '0'), title, category }
  }

  // 長格式：YYYY-MM-DD HH:mm 標題
  const long = text.match(patterns[1])
  if (long) {
    const [, y, month, day, time, rest] = long
    const date = `${y}-${month}-${day}`
    const { title, category } = extractCategory(rest)
    return { date, time, title, category }
  }

  return null
}

function extractCategory(text: string): { title: string; category: 'personal' | 'work' } {
  if (text.startsWith('公事 ') || text.startsWith('💼 ')) {
    return { title: text.replace(/^公事\s+|^💼\s+/, ''), category: 'work' }
  }
  if (text.startsWith('個人 ') || text.startsWith('🌸 ')) {
    return { title: text.replace(/^個人\s+|^🌸\s+/, ''), category: 'personal' }
  }
  return { title: text, category: 'personal' }
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('x-line-signature') ?? ''

  if (!verify(body, signature)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  const { events } = JSON.parse(body)

  for (const event of events) {
    const userId: string = event.source?.userId ?? ''

    if (event.type === 'message' && event.message.type === 'text') {
      const text: string = event.message.text.trim()

      // /我是誰
      if (text === '/我是誰') {
        await pushMessage(userId, [textMessage(`你的 LINE User ID 是：\n${userId}`)])
        continue
      }

      // 靈感庫
      if (text.startsWith('靈感：') || text.startsWith('💡')) {
        const content = text.replace(/^靈感：|^💡\s*/, '').trim()
        await supabase.from('inspiration_items').insert({ content, source: 'line' })
        await pushMessage(userId, [textMessage(`✅ 靈感已收錄！\n「${content.slice(0, 30)}${content.length > 30 ? '…' : ''}」`)])
        continue
      }

      // 今日行程
      if (text === '今天' || text === '今日行程') {
        const today = new Date()
        const start = new Date(today); start.setHours(0, 0, 0, 0)
        const end = new Date(today); end.setHours(23, 59, 59, 999)
        const { data } = await supabase.from('events').select('*')
          .gte('start_at', start.toISOString()).lte('start_at', end.toISOString()).order('start_at')
        if (!data || data.length === 0) {
          await pushMessage(userId, [textMessage('今天沒有行程 😊')])
        } else {
          const list = data.map((e: { start_at: string; title: string; category: string }) => {
            const t = new Date(e.start_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
            return `${e.category === 'work' ? '💼' : '🌸'} ${t} ${e.title}`
          }).join('\n')
          await pushMessage(userId, [textMessage(`📅 今日行程\n\n${list}`)])
        }
        continue
      }

      // 本週行程
      if (text === '本週' || text === '本週行程') {
        const now = new Date()
        const day = now.getDay()
        const monday = new Date(now)
        monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
        monday.setHours(0, 0, 0, 0)
        const sunday = new Date(monday)
        sunday.setDate(monday.getDate() + 6)
        sunday.setHours(23, 59, 59, 999)
        const { data } = await supabase.from('events').select('*')
          .gte('start_at', monday.toISOString()).lte('start_at', sunday.toISOString()).order('start_at')
        if (!data || data.length === 0) {
          await pushMessage(userId, [textMessage('本週沒有行程 😊')])
        } else {
          const list = data.map((e: { start_at: string; title: string; category: string }) => {
            const d = new Date(e.start_at)
            const weekday = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
            const t = d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
            return `${e.category === 'work' ? '💼' : '🌸'} 週${weekday} ${t} ${e.title}`
          }).join('\n')
          await pushMessage(userId, [textMessage(`📅 本週行程\n\n${list}`)])
        }
        continue
      }

      // 說明
      if (text === '?' || text === '說明' || text === 'help') {
        await pushMessage(userId, [textMessage(
          '小祕書指令說明 🤖\n\n' +
          '📅 新增行程（直接輸入）：\n' +
          '6/28 14:00 羽毛球\n' +
          '6/28 14:00 公事 開會\n' +
          '6/28 14:00 💼 客戶訪談\n\n' +
          '💡 靈感：[內容] → 存入靈感庫\n\n' +
          '今天 → 查今日行程\n' +
          '本週 → 查本週行程\n' +
          '/我是誰 → 查詢 User ID'
        )])
        continue
      }

      // 嘗試解析為行程（彈性格式）
      const parsed = parseEventText(text)
      if (parsed) {
        const { date, time, title, category } = parsed
        await supabase.from('events').insert({
          title,
          start_at: new Date(`${date}T${time}:00+08:00`).toISOString(),
          category,
          color: category === 'work' ? '#2E86AB' : '#C4622D',
        })
        const categoryLabel = category === 'work' ? '💼 公事' : '🌸 個人'
        await pushMessage(userId, [textMessage(`✅ 行程已新增！\n📅 ${date} ${time} ${title}\n${categoryLabel}`)])
        continue
      }

      // 其他：存靈感庫
      await supabase.from('inspiration_items').insert({ content: text, source: 'line' })
      await pushMessage(userId, [textMessage(`💾 已記錄到靈感庫！\n發「說明」可查看所有指令`)])
    }
  }

  return NextResponse.json({ ok: true })
}
