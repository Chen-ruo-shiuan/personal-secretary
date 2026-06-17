import { supabase } from '@/lib/supabase'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import Link from 'next/link'

export const revalidate = 0

async function getData() {
  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })

  const [eventsRes, goalsRes, inspirationRes] = await Promise.all([
    supabase.from('events')
      .select('*')
      .gte('start_at', weekStart.toISOString())
      .lte('start_at', weekEnd.toISOString())
      .order('start_at'),
    supabase.from('goals').select('*').eq('status', 'active').order('horizon'),
    supabase.from('inspiration_items').select('*').eq('used', false).order('created_at', { ascending: false }).limit(3),
  ])

  return {
    events: eventsRes.data ?? [],
    goals: goalsRes.data ?? [],
    inspirations: inspirationRes.data ?? [],
  }
}

const horizonColor: Record<string, string> = {
  long: '#7B5EA7',
  medium: '#2E86AB',
  short: '#C4622D',
  near: '#2A9D4E',
}

export default async function DashboardPage() {
  const { events, goals, inspirations } = await getData()
  const today = format(new Date(), 'yyyy年M月d日 EEEE', { locale: zhTW })

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">早安 👋</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{today}</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="本週行程" value={events.length} unit="個" href="/calendar" />
        <StatCard label="進行中目標" value={goals.length} unit="項" href="/goals" />
        <StatCard label="待用靈感素材" value={inspirations.length} unit="則" href="/inspiration" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <section className="rounded-xl p-5 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">本週行程</h2>
            <Link href="/calendar" className="text-xs" style={{ color: 'var(--brand)' }}>查看全部 →</Link>
          </div>
          {events.length === 0
            ? <p className="text-sm" style={{ color: 'var(--muted)' }}>本週還沒有行程</p>
            : events.slice(0, 5).map((e: { id: string; color: string; title: string; start_at: string }) => (
              <div key={e.id} className="flex items-start gap-2 mb-3">
                <div className="w-1 h-8 rounded-full mt-0.5 shrink-0" style={{ background: e.color }} />
                <div>
                  <div className="text-sm font-medium">{e.title}</div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>
                    {format(new Date(e.start_at), 'M/d HH:mm')}
                  </div>
                </div>
              </div>
            ))
          }
        </section>

        <section className="rounded-xl p-5 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">目標概覽</h2>
            <Link href="/goals" className="text-xs" style={{ color: 'var(--brand)' }}>查看全部 →</Link>
          </div>
          {goals.length === 0
            ? <p className="text-sm" style={{ color: 'var(--muted)' }}>還沒有設定目標</p>
            : goals.slice(0, 5).map((g: { id: string; horizon: string; title: string }) => (
              <div key={g.id} className="flex items-center gap-2 mb-3">
                <span className="text-xs px-2 py-0.5 rounded-full text-white shrink-0"
                  style={{ background: horizonColor[g.horizon] }}>
                  {g.horizon === 'long' ? '長' : g.horizon === 'medium' ? '中' : g.horizon === 'short' ? '短' : '近'}
                </span>
                <span className="text-sm">{g.title}</span>
              </div>
            ))
          }
        </section>

        <section className="col-span-2 rounded-xl p-5 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">最新靈感素材</h2>
            <Link href="/inspiration" className="text-xs" style={{ color: 'var(--brand)' }}>查看全部 →</Link>
          </div>
          {inspirations.length === 0
            ? <p className="text-sm" style={{ color: 'var(--muted)' }}>靈感庫是空的，去新增一些素材吧</p>
            : <div className="grid grid-cols-3 gap-3">
              {inspirations.map((i: { id: string; content: string; tags?: string[] }) => (
                <div key={i.id} className="rounded-lg p-3 text-sm" style={{ background: '#FDF0E8' }}>
                  <p className="line-clamp-3">{i.content}</p>
                  {i.tags && i.tags.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {i.tags.map(t => (
                        <span key={t} className="text-xs px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--border)', color: 'var(--muted)' }}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          }
        </section>
      </div>
    </div>
  )
}

function StatCard({ label, value, unit, href }: { label: string; value: number; unit: string; href: string }) {
  return (
    <Link href={href} className="rounded-xl p-5 border flex flex-col gap-1 hover:shadow-sm transition-shadow"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <span className="text-xs" style={{ color: 'var(--muted)' }}>{label}</span>
      <span className="text-3xl font-bold" style={{ color: 'var(--brand)' }}>{value}</span>
      <span className="text-xs" style={{ color: 'var(--muted)' }}>{unit}</span>
    </Link>
  )
}
