'use client'
import { useEffect, useState } from 'react'
import { supabase, type Goal, type Horizon } from '@/lib/supabase'

const horizons: { key: Horizon; label: string; desc: string; color: string }[] = [
  { key: 'long',   label: '長期目標', desc: '1–3 年',   color: '#7B5EA7' },
  { key: 'medium', label: '中期目標', desc: '3–6 個月', color: '#2E86AB' },
  { key: 'short',  label: '短期目標', desc: '1–4 週',   color: '#C4622D' },
  { key: 'near',   label: '近期目標', desc: '本週',      color: '#2A9D4E' },
]

const emptyForm = { title: '', description: '', due_date: '' }

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [adding, setAdding] = useState<Horizon | null>(null)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await supabase.from('goals').select('*').order('created_at')
    setGoals(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd(horizon: Horizon) {
    setEditingGoal(null)
    setForm(emptyForm)
    setAdding(horizon)
  }

  function openEdit(g: Goal) {
    setEditingGoal(g)
    setForm({ title: g.title, description: g.description ?? '', due_date: g.due_date ?? '' })
    setAdding(g.horizon)
  }

  function cancelForm() {
    setAdding(null)
    setEditingGoal(null)
    setForm(emptyForm)
  }

  async function saveGoal(horizon: Horizon) {
    if (!form.title.trim()) return
    const payload = {
      title: form.title,
      description: form.description || null,
      due_date: form.due_date || null,
    }
    if (editingGoal) {
      await supabase.from('goals').update(payload).eq('id', editingGoal.id)
    } else {
      await supabase.from('goals').insert({ ...payload, horizon })
    }
    cancelForm()
    load()
  }

  async function toggleDone(g: Goal) {
    await supabase.from('goals').update({ status: g.status === 'done' ? 'active' : 'done' }).eq('id', g.id)
    load()
  }

  async function deleteGoal(id: string) {
    await supabase.from('goals').delete().eq('id', id)
    load()
  }

  if (loading) return <div className="text-sm" style={{ color: 'var(--muted)' }}>載入中…</div>

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">目標規劃</h1>
      <div className="grid grid-cols-2 gap-6">
        {horizons.map(h => {
          const hGoals = goals.filter(g => g.horizon === h.key)
          const isFormOpen = adding === h.key
          return (
            <section key={h.key} className="rounded-xl border p-5"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="font-semibold text-sm">{h.label}</span>
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full text-white"
                    style={{ background: h.color }}>{h.desc}</span>
                </div>
                <button onClick={() => openAdd(h.key)}
                  className="text-xs px-2 py-1 rounded-lg border transition-colors hover:opacity-80"
                  style={{ borderColor: h.color, color: h.color }}>
                  + 新增
                </button>
              </div>

              {isFormOpen && (
                <div className="mb-4 p-3 rounded-lg" style={{ background: 'var(--bg)' }}>
                  <p className="text-xs font-medium mb-2" style={{ color: h.color }}>
                    {editingGoal ? '編輯目標' : '新增目標'}
                  </p>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="目標名稱" className="w-full text-sm border rounded px-2 py-1.5 mb-2 outline-none"
                    style={{ borderColor: 'var(--border)' }} autoFocus />
                  <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="備註（選填）" className="w-full text-sm border rounded px-2 py-1.5 mb-2 outline-none"
                    style={{ borderColor: 'var(--border)' }} />
                  <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full text-sm border rounded px-2 py-1.5 mb-3 outline-none"
                    style={{ borderColor: 'var(--border)' }} />
                  <div className="flex gap-2">
                    <button onClick={() => saveGoal(h.key)}
                      className="flex-1 text-sm py-1.5 rounded-lg text-white hover:opacity-80"
                      style={{ background: h.color }}>
                      {editingGoal ? '儲存' : '新增'}
                    </button>
                    <button onClick={cancelForm}
                      className="text-sm px-3 py-1.5 rounded-lg border"
                      style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>取消</button>
                  </div>
                </div>
              )}

              {hGoals.length === 0
                ? <p className="text-xs" style={{ color: 'var(--muted)' }}>尚未設定目標</p>
                : hGoals.map(g => (
                  <div key={g.id} className="flex items-start gap-2 mb-3 group p-1.5 rounded-lg hover:bg-gray-50">
                    <button onClick={() => toggleDone(g)}
                      className="mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center"
                      style={{ borderColor: h.color, background: g.status === 'done' ? h.color : 'transparent' }}>
                      {g.status === 'done' && <span className="text-white text-xs">✓</span>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm"
                        style={{ textDecoration: g.status === 'done' ? 'line-through' : 'none', color: g.status === 'done' ? 'var(--muted)' : 'var(--text)' }}>
                        {g.title}
                      </p>
                      {g.description && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{g.description}</p>}
                      {g.due_date && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>截止：{g.due_date}</p>}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => openEdit(g)}
                        className="text-xs px-1.5 py-0.5 rounded border"
                        style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>編輯</button>
                      <button onClick={() => deleteGoal(g.id)}
                        className="text-xs px-1.5 py-0.5 rounded border"
                        style={{ borderColor: '#FCA5A5', color: '#EF4444' }}>刪除</button>
                    </div>
                  </div>
                ))
              }
            </section>
          )
        })}
      </div>
    </div>
  )
}
