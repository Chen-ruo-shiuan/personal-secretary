import { NextRequest, NextResponse } from 'next/server'
import * as crypto from 'crypto'
import { supabase } from '@/lib/supabase'
import { pushMessage, textMessage } from '@/lib/line'

function verify(body: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET!
  const hash = crypto.createHmac('sha256', secret).update(body).digest('base64')
  return hash === signature
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('x-line-signature') ?? ''

  if (!verify(body, signature)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  const { events } = JSON.parse(body)

  for (const event of events) {
    // 第一次傳訊息時，把 userId 印出來（方便設定 LINE_OWNER_USER_ID）
    const userId: string = event.source?.userId ?? ''

    if (event.type === 'message' && event.message.type === 'text') {
      const text: string = event.message.text.trim()

      // 指令：/我是誰 → 回傳 userId（設定用）
      if (text === '/我是誰') {
        await pushMessage(userId, [textMessage(`你的 LINE User ID 是：\n${userId}`)])
        continue
      }

      // 儲存素材到靈感庫
      if (text.startsWith('靈感：') || text.startsWith('💡')) {
        const content = text.replace(/^靈感：|^💡\s*/, '').trim()
        await supabase.from('inspiration_items').insert({
          content,
          source: 'line',
        })
        await pushMessage(userId, [textMessage(`✅ 靈感已收錄！\n「${content.slice(0, 30)}${content.length > 30 ? '…' : ''}」`)])
        continue
      }

      // 新增行程：行程：2026-06-20 14:00 標題
      if (text.startsWith('行程：') || text.startsWith('📅')) {
        const content = text.replace(/^行程：|^📅\s*/, '').trim()
        // 格式：YYYY-MM-DD HH:mm 標題
        const match = content.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+(.+)$/)
        if (match) {
          const [, date, time, title] = match
          await supabase.from('events').insert({
            title,
            start_at: new Date(`${date}T${time}:00`).toISOString(),
            category: 'personal',
            color: '#C4622D',
          })
          await pushMessage(userId, [textMessage(`✅ 行程已新增！\n📅 ${date} ${time} ${title}`)])
        } else {
          await pushMessage(userId, [textMessage('格式：行程：YYYY-MM-DD HH:mm 標題\n例：行程：2026-06-20 14:00 護膚療程')])
        }
        continue
      }

      // 查詢今日行程
      if (text === '今天' || text === '今日行程') {
        const today = new Date()
        const start = new Date(today.setHours(0, 0, 0, 0)).toISOString()
        const end = new Date(today.setHours(23, 59, 59, 999)).toISOString()
        const { data } = await supabase.from('events').select('*')
          .gte('start_at', start).lte('start_at', end).order('start_at')

        if (!data || data.length === 0) {
          await pushMessage(userId, [textMessage('今天沒有行程 😊')])
        } else {
          const list = data.map((e: { start_at: string; title: string; category: string }) => {
            const time = new Date(e.start_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
            const tag = e.category === 'work' ? '💼' : '🌸'
            return `${tag} ${time} ${e.title}`
          }).join('\n')
          await pushMessage(userId, [textMessage(`📅 今日行程\n\n${list}`)])
        }
        continue
      }

      // 查詢本週行程
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
            const time = d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
            const tag = e.category === 'work' ? '💼' : '🌸'
            return `${tag} 週${weekday} ${time} ${e.title}`
          }).join('\n')
          await pushMessage(userId, [textMessage(`📅 本週行程\n\n${list}`)])
        }
        continue
      }

      // 幫助指令
      if (text === '?' || text === '說明' || text === 'help') {
        await pushMessage(userId, [textMessage(
          '小祕書指令說明 🤖\n\n' +
          '💡 靈感：[內容] → 存入靈感庫\n' +
          '📅 行程：YYYY-MM-DD HH:mm [標題] → 新增行程\n' +
          '今天 → 查今日行程\n' +
          '本週 → 查本週行程\n' +
          '/我是誰 → 查詢你的 User ID'
        )])
        continue
      }

      // 其他訊息：存入靈感庫
      await supabase.from('inspiration_items').insert({
        content: text,
        source: 'line',
      })
      await pushMessage(userId, [textMessage(`💾 已記錄到靈感庫！\n發「說明」可查看所有指令`)])
    }
  }

  return NextResponse.json({ ok: true })
}
