import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'
import { pushMessage, textMessage } from '@/lib/line'
import { format, startOfWeek, endOfWeek, addWeeks } from 'date-fns'
import { zhTW } from 'date-fns/locale'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function GET(req: NextRequest) {
  // Vercel Cron 會帶 Authorization header
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const ownerUserId = process.env.LINE_OWNER_USER_ID!
  const now = new Date()
  const nextWeekStart = startOfWeek(addWeeks(now, 1), { weekStartsOn: 1 })
  const nextWeekEnd = endOfWeek(addWeeks(now, 1), { weekStartsOn: 1 })
  const weekLabel = format(nextWeekStart, 'M月d日', { locale: zhTW }) + '～' + format(nextWeekEnd, 'M月d日', { locale: zhTW })

  // 抓最近未使用的靈感素材
  const { data: inspirations } = await supabase
    .from('inspiration_items')
    .select('content, tags')
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(10)

  const inspirationText = inspirations && inspirations.length > 0
    ? inspirations.map((i, idx) => `${idx + 1}. ${i.content}${i.tags?.length ? `（${i.tags.join('、')}）` : ''}`).join('\n')
    : '（目前靈感庫是空的，請本週多記錄一些素材）'

  // 用 Claude 生成靈感包
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `你是一位台灣美容皮膚療癒所（NiNi の 皮膚療癒所）的 IG 內容顧問。

以下是店主這週收集的靈感素材：
${inspirationText}

請根據這些素材，結合 ${weekLabel} 這週的時節與台灣當前美容趨勢，給出：

1. **3個本週可發的 IG 主題方向**（每個主題一句話說明角度）
2. **1個衛教知識點**（客人最可能問到的問題）
3. **1句本週創作提醒**（鼓勵店主的話）

請用繁體中文，語氣親切，格式簡潔易讀，適合直接在 LINE 上閱讀。`
    }]
  })

  const aiContent = message.content[0].type === 'text' ? message.content[0].text : ''

  // 儲存到 weekly_digests
  await supabase.from('weekly_digests').upsert({
    week_start: format(nextWeekStart, 'yyyy-MM-dd'),
    content: { ai_response: aiContent, inspiration_count: inspirations?.length ?? 0 },
    sent_at: new Date().toISOString(),
  }, { onConflict: 'week_start' })

  // 推播到 LINE
  const header = `✨ 本週靈感包\n${weekLabel}\n${'─'.repeat(18)}\n\n`
  await pushMessage(ownerUserId, [textMessage(header + aiContent)])

  return NextResponse.json({ ok: true, week: weekLabel })
}
