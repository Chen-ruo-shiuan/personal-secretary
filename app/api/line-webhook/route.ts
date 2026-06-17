import { NextRequest, NextResponse } from 'next/server'
import * as crypto from 'crypto'
import { supabase } from '@/lib/supabase'
import { pushMessage, textMessage } from '@/lib/line'

function verify(body: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET!
  const hash = crypto.createHmac('sha256', secret).update(body).digest('base64')
  return hash === signature
}

function parseEventText(text: string): { date: string; time: string; title: string; category: 'personal' | 'work' } | null {
  const now = new Date()
  const year = now.getFullYear()
  const short = text.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}:\d{2})\s+(.+)$/)
  if (short) {
    const [, month, day, time, rest] = short
    const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    const { title, category } = extractCategory(rest)
    return { date, time: time.padStart(5, '0'), title, category }
  }
  const long = text.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2})\s+(.+)$/)
  if (long) {
    const [, y, month, day, time, rest] = long
    const { title, category } = extractCategory(rest)
    return { date: `${y}-${month}-${day}`, time, title, category }
  }
  return null
}

function extractCategory(text: string): { title: string; category: 'personal' | 'work' } {
  if (text.startsWith('公事 ') || text.startsWith('💼 '))
    return { title: text.replace(/^公事\s+|^💼\s+/, ''), category: 'work' }
  if (text.startsWith('個人 ') || text.startsWith('🌸 '))
    return { title: text.replace(/^個人\s+|^🌸\s+/, ''), category: 'personal' }
  return { title: text, category: 'personal' }
}

// 解析「刪除 6/23 16:00 標題」或「刪除 6/23 16:00」
function parseDeleteText(text: string): { date: string; time?: string; keyword?: string } | null {
  const withTime = text.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}:\d{2})(?:\s+(.+))?$/)
  if (withTime) {
    const [, month, day, time, keyword] = withTime
    const year = new Date().getFullYear()
    return {
      date: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
      time: time.padStart(5, '0'),
      keyword,
    }
  }
  const dateOnly = text.match(/^(\d{1,2})\/(\d{1,2})\s+(.+)$/)
  if (dateOnly) {
    const [, month, day, keyword] = dateOnly
    const year = new Date().getFullYear()
    return { date: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`, keyword }
  }
  return null
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('x-line-signature') ?? ''
  if (!verify(body, signature)) return NextResponse.json({ error: 'invalid signature' }, { status: 401 })

  const { events } = JSON.parse(body)

  for (const event of events) {
    const userId: string = event.source?.userId ?? ''
    if (event.type !== 'message' || event.message.type !== 'text') continue

    const text: string = event.message.text.trim()

    // /我是誰
    if (text === '/我是誰') {
      await pushMessage(userId, [textMessage(`你的 LINE User ID 是：\n${userId}`)])
      continue
    }

    // 刪除行程：刪除 6/23 16:00 羽毛球 / 刪除 6/23 16:00
    if (text.startsWith('刪除 ') || text.startsWith('取消 ')) {
      const query = text.replace(/^刪除\s+|^取消\s+/, '')
      const parsed = parseDeleteText(query)
      if (!parsed) {
        await pushMessage(userId, [textMessage('格式：刪除 6/23 16:00 羽毛球\n或：刪除 6/23 16:00')])
        continue
      }
      const dayStart = new Date(`${parsed.date}T00:00:00+08:00`).toISOString()
      const dayEnd = new Date(`${parsed.date}T23:59:59+08:00`).toISOString()
      let q = supabase.from('events').select('*').gte('start_at', dayStart).lte('start_at', dayEnd)
      const { data: candidates } = await q

      if (!candidates || candidates.length === 0) {
        await pushMessage(userId, [textMessage(`找不到 ${parsed.date} 的行程`)])
        continue
      }

      // 過濾時間和關鍵字
      let targets = candidates
      if (parsed.time) {
        targets = targets.filter((e: { start_at: string }) => {
          const t = new Date(e.start_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
          return t === parsed.time
        })
      }
      if (parsed.keyword) {
        targets = targets.filter((e: { title: string }) => e.title.includes(parsed.keyword!))
      }

      if (targets.length === 0) {
        await pushMessage(userId, [textMessage('找不到符合的行程，請確認時間或名稱')])
        continue
      }
      if (targets.length > 1) {
        const list = targets.map((e: { start_at: string; title: string }) => {
          const t = new Date(e.start_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
          return `• ${t} ${e.title}`
        }).join('\n')
        await pushMessage(userId, [textMessage(`找到多筆行程，請加上時間或名稱縮小範圍：\n${list}`)])
        continue
      }

      const target = targets[0]
      await supabase.from('events').delete().eq('id', target.id)
      const t = new Date(target.start_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
      await pushMessage(userId, [textMessage(`🗑️ 已刪除行程\n📅 ${parsed.date} ${t} ${target.title}`)])
      continue
    }

    // 改期：6/23 16:00 羽毛球 改期為 6/25 18:00
    if (/改期為/.test(text)) {
      // 空白鍵不影響：統一壓縮多餘空格
      const normalized = text.replace(/\s+/g, ' ').trim()
      const match = normalized.match(/^(.+?)\s*改期為\s*(\d{1,2}\/\d{1,2})\s+(\d{1,2}:\d{2})$/)
      if (!match) {
        await pushMessage(userId, [textMessage('格式：6/23 16:00 羽毛球 改期為 6/25 18:00')])
        continue
      }
      const [, oldPart, newDateStr, newTime] = match
      const oldParsed = parseDeleteText(oldPart.trim())
      if (!oldParsed) {
        await pushMessage(userId, [textMessage('格式：6/23 16:00 羽毛球 改期為 6/25 18:00')])
        continue
      }

      const dayStart = new Date(`${oldParsed.date}T00:00:00+08:00`).toISOString()
      const dayEnd = new Date(`${oldParsed.date}T23:59:59+08:00`).toISOString()
      const { data: candidates } = await supabase.from('events').select('*').gte('start_at', dayStart).lte('start_at', dayEnd)

      let targets = candidates ?? []
      if (oldParsed.time) targets = targets.filter((e: { start_at: string }) => {
        const t = new Date(e.start_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
        return t === oldParsed.time
      })
      if (oldParsed.keyword) targets = targets.filter((e: { title: string }) => e.title.includes(oldParsed.keyword!))

      if (targets.length === 0) {
        await pushMessage(userId, [textMessage('找不到符合的行程')])
        continue
      }
      if (targets.length > 1) {
        await pushMessage(userId, [textMessage('找到多筆行程，請加上時間縮小範圍')])
        continue
      }

      const year = new Date().getFullYear()
      const [newMonth, newDay] = newDateStr.split('/')
      const newDate = `${year}-${newMonth.padStart(2, '0')}-${newDay.padStart(2, '0')}`
      const newStartAt = new Date(`${newDate}T${newTime.padStart(5, '0')}:00+08:00`).toISOString()

      await supabase.from('events').update({ start_at: newStartAt }).eq('id', targets[0].id)
      await pushMessage(userId, [textMessage(`✅ 行程已改期！\n📅 ${oldParsed.date} → ${newDate} ${newTime}\n${targets[0].title}`)])
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
      const { data } = await supabase.from('events').select('*').gte('start_at', start.toISOString()).lte('start_at', end.toISOString()).order('start_at')
      if (!data || data.length === 0) {
        await pushMessage(userId, [textMessage('今天沒有行程 😊')])
      } else {
        const list = data.map((e: { start_at: string; title: string; category: string }) => {
          const t = new Date(e.start_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
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
      const { data } = await supabase.from('events').select('*').gte('start_at', monday.toISOString()).lte('start_at', sunday.toISOString()).order('start_at')
      if (!data || data.length === 0) {
        await pushMessage(userId, [textMessage('本週沒有行程 😊')])
      } else {
        const list = data.map((e: { start_at: string; title: string; category: string }) => {
          const d = new Date(e.start_at)
          const weekday = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
          const t = d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
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
        '📅 新增行程：\n' +
        '6/28 14:00 羽毛球\n' +
        '6/28 14:00 公事 開會\n\n' +
        '🗑️ 刪除行程：\n' +
        '刪除 6/28 14:00 羽毛球\n\n' +
        '🔄 改期：\n' +
        '6/28 14:00 羽毛球 改期為 6/30 16:00\n\n' +
        '💡 靈感：內容\n\n' +
        '今天 → 今日行程\n' +
        '本週 → 本週行程'
      )])
      continue
    }

    // 彈性行程格式
    const parsed = parseEventText(text)
    if (parsed) {
      const { date, time, title, category } = parsed
      await supabase.from('events').insert({
        title,
        start_at: new Date(`${date}T${time}:00+08:00`).toISOString(),
        category,
        color: category === 'work' ? '#2E86AB' : '#C4622D',
      })
      await pushMessage(userId, [textMessage(`✅ 行程已新增！\n📅 ${date} ${time} ${title}\n${category === 'work' ? '💼 公事' : '🌸 個人'}`)])
      continue
    }

    // 其他：存靈感庫
    await supabase.from('inspiration_items').insert({ content: text, source: 'line' })
    await pushMessage(userId, [textMessage(`💾 已記錄到靈感庫！\n發「說明」可查看所有指令`)])
  }

  return NextResponse.json({ ok: true })
}
