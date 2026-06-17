'use client'
import { useEffect, useState } from 'react'
import { supabase, type Event } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, isSameMonth, addMonths, subMonths } from 'date-fns'
import { zhTW } from 'date-fns/locale'

type Category = 'all' | 'personal' | 'work'
type EventWithCategory = Event & { category: 'personal' | 'work' }

const categoryConfig = {
  personal: { label: '個人', color: '#C4622D', bg: '#FDF0E8' },
  work:     { label: '公事', color: '#2E86AB', bg: '#E8F4FD' },
}

const emptyForm = { title: '', start_at: '', end_at: '', all_day: false, category: 'personal' as 'personal' | 'work' }

export default function CalendarPage() {
  const [current, setCurrent] = useState(new Date())
  const [events, setEvents] = useState<EventWithCategory[]>([])
  const [selected, setSelected] = useState<Date | null>(null)
  const [view, setView] = useState<Category>('all')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  async function load(month: Date) {
    const start = startOfMonth(month)
    const end = endOfMonth(month)
    const { data } = await supabase.from('events').select('*')
      .gte('start_at', start.toISOString()).lte('start_at', end.toISOString()).order('start_at')
    setEvents((data ?? []) as EventWithCategory[])
  }

  useEffect(() => { load(current) }, [current])

  function openNew() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(e: EventWithCategory) {
    setEditingId(e.id)
    setForm({
      title: e.title,
      start_at: format(new Date(e.start_at), "yyyy-MM-dd'T'HH:mm"),
      end_at: e.end_at ? format(new Date(e.end_at), "yyyy-MM-dd'T'HH:mm") : '',
      all_day: e.all_day,
      category: e.category,
    })
    setShowForm(true)
  }

  async function saveEvent() {
    if (!form.title.trim() || !form.start_at) return
    const payload = {
      title: form.title,
      start_at: new Date(form.start_at).toISOString(),
      end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
      all_day: form.all_day,
      color: categoryConfig[form.category].color,
      category: form.category,
    }
    if (editingId) {
      await supabase.from('events').update(payload).eq('id', editingId)
    } else {
      await supabase.from('events').insert(payload)
    }
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(false)
    load(current)
  }

  async function deleteEvent(id: string) {
    await supabase.from('events').delete().eq('id', id)
    load(current)
  }

  const filtered = events.filter(e => view === 'all' || e.category === view)
  const monthStart = startOfMonth(current)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(endOfMonth(current), { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const selectedEvents = selected ? filtered.filter(e => isSameDay(new Date(e.start_at), selected)) : []

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">行事曆</h1>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            {(['all', 'personal', 'work'] as Category[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="text-xs px-3 py-2 transition-colors"
                style={{
                  background: view === v ? (v === 'all' ? 'var(--text)' : categoryConfig[v].color) : 'var(--surface)',
                  color: view === v ? 'white' : 'var(--muted)',
                  fontWeight: view === v ? 600 : 400,
                }}>
                {v === 'all' ? '全部' : categoryConfig[v].label}
              </button>
            ))}
          </div>
          <button onClick={openNew}
            className="text-sm px-4 py-2 rounded-lg text-white hover:opacity-80"
            style={{ background: 'var(--brand)' }}>+ 新增行程</button>
        </div>
      </div>

      {view === 'all' && (
        <div className="flex gap-4 mb-4">
          {(['personal', 'work'] as const).map(c => (
            <div key={c} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ background: categoryConfig[c].color }} />
              <span className="text-xs" style={{ color: 'var(--muted)' }}>{categoryConfig[c].label}</span>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="rounded-xl border p-5 mb-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <h3 className="font-semibold mb-4 text-sm">{editingId ? '編輯行程' : '新增行程'}</h3>
          <div className="flex gap-2 mb-4">
            {(['personal', 'work'] as const).map(c => (
              <button key={c} onClick={() => setForm(f => ({ ...f, category: c }))}
                className="flex-1 text-sm py-2 rounded-lg border-2 font-medium transition-colors"
                style={{
                  borderColor: form.category === c ? categoryConfig[c].color : 'var(--border)',
                  background: form.category === c ? categoryConfig[c].bg : 'transparent',
                  color: form.category === c ? categoryConfig[c].color : 'var(--muted)',
                }}>
                {categoryConfig[c].label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="行程名稱" className="col-span-2 text-sm border rounded-lg px-3 py-2 outline-none"
              style={{ borderColor: 'var(--border)' }} autoFocus />
            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--muted)' }}>開始時間</label>
              <input type="datetime-local" value={form.start_at} onChange={e => setForm(f => ({ ...f, start_at: e.target.value }))}
                className="w-full text-sm border rounded-lg px-3 py-2 outline-none" style={{ borderColor: 'var(--border)' }} />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--muted)' }}>結束時間（選填）</label>
              <input type="datetime-local" value={form.end_at} onChange={e => setForm(f => ({ ...f, end_at: e.target.value }))}
                className="w-full text-sm border rounded-lg px-3 py-2 outline-none" style={{ borderColor: 'var(--border)' }} />
            </div>
          </div>
          <label className="flex items-center gap-1.5 text-sm mb-4 cursor-pointer">
            <input type="checkbox" checked={form.all_day} onChange={e => setForm(f => ({ ...f, all_day: e.target.checked }))} />
            全天
          </label>
          <div className="flex gap-2">
            <button onClick={saveEvent}
              className="text-sm px-4 py-2 rounded-lg text-white hover:opacity-80"
              style={{ background: categoryConfig[form.category].color }}>
              {editingId ? '儲存' : '新增'}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null) }}
              className="text-sm px-4 py-2 rounded-lg border"
              style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>取消</button>
          </div>
        </div>
      )}

      <div className="rounded-xl border overflow-hidden mb-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <button onClick={() => setCurrent(m => subMonths(m, 1))} className="text-lg px-2 hover:opacity-60">‹</button>
          <span className="font-semibold">{format(current, 'yyyy年 M月', { locale: zhTW })}</span>
          <button onClick={() => setCurrent(m => addMonths(m, 1))} className="text-lg px-2 hover:opacity-60">›</button>
        </div>
        <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border)' }}>
          {weekdays.map(d => (
            <div key={d} className="text-center text-xs py-2 font-medium" style={{ color: 'var(--muted)' }}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const dayEvents = filtered.filter(e => isSameDay(new Date(e.start_at), day))
            const isToday = isSameDay(day, new Date())
            const isSelected = selected && isSameDay(day, selected)
            const inMonth = isSameMonth(day, current)
            return (
              <div key={i} onClick={() => { setSelected(day); setShowForm(false) }}
                className="min-h-16 p-1.5 border-b border-r cursor-pointer transition-colors hover:bg-orange-50"
                style={{ borderColor: 'var(--border)', opacity: inMonth ? 1 : 0.35, background: isSelected ? '#FDF0E8' : 'transparent' }}>
                <div className={`text-xs w-6 h-6 flex items-center justify-center rounded-full mb-0.5 font-medium ${isToday ? 'text-white' : ''}`}
                  style={{ background: isToday ? 'var(--brand)' : 'transparent' }}>
                  {format(day, 'd')}
                </div>
                {dayEvents.slice(0, 2).map(e => (
                  <div key={e.id} className="text-xs truncate rounded px-1 py-0.5 mb-0.5 text-white"
                    style={{ background: categoryConfig[e.category]?.color ?? e.color }}>{e.title}</div>
                ))}
                {dayEvents.length > 2 && <div className="text-xs" style={{ color: 'var(--muted)' }}>+{dayEvents.length - 2}</div>}
              </div>
            )
          })}
        </div>
      </div>

      {selected && (
        <div className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <h3 className="font-semibold mb-3">{format(selected, 'M月d日 EEEE', { locale: zhTW })}</h3>
          {selectedEvents.length === 0
            ? <p className="text-sm" style={{ color: 'var(--muted)' }}>這天沒有行程</p>
            : selectedEvents.map(e => (
              <div key={e.id} className="flex items-center gap-3 mb-2 p-2 rounded-lg group hover:bg-gray-50">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: categoryConfig[e.category]?.color }} />
                <div className="flex-1">
                  <span className="text-sm font-medium">{e.title}</span>
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full text-white"
                    style={{ background: categoryConfig[e.category]?.color }}>
                    {categoryConfig[e.category]?.label}
                  </span>
                  {!e.all_day && (
                    <span className="text-xs ml-2" style={{ color: 'var(--muted)' }}>
                      {format(new Date(e.start_at), 'HH:mm')}
                    </span>
                  )}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(e)}
                    className="text-xs px-2 py-1 rounded border transition-colors hover:opacity-80"
                    style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>編輯</button>
                  <button onClick={() => deleteEvent(e.id)}
                    className="text-xs px-2 py-1 rounded border transition-colors hover:opacity-80"
                    style={{ borderColor: '#FCA5A5', color: '#EF4444' }}>刪除</button>
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}
