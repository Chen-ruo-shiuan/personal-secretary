'use client'
import { useEffect, useState } from 'react'
import { supabase, type InspirationItem } from '@/lib/supabase'

const sourceLabel: Record<string, string> = { manual: '手動', line: 'LINE', ai: 'AI' }
const sourceColor: Record<string, string> = { manual: '#8B7B74', line: '#06C755', ai: '#C4622D' }

const emptyForm = { content: '', tags: '' }

export default function InspirationPage() {
  const [items, setItems] = useState<InspirationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState<InspirationItem | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [filter, setFilter] = useState<'all' | 'unused' | 'used'>('unused')

  async function load() {
    const { data } = await supabase.from('inspiration_items').select('*').order('created_at', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditingItem(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(item: InspirationItem) {
    setEditingItem(item)
    setForm({ content: item.content, tags: (item.tags ?? []).join('，') })
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingItem(null)
    setForm(emptyForm)
  }

  async function saveItem() {
    if (!form.content.trim()) return
    const tags = form.tags.split(/[,，]/).map(t => t.trim()).filter(Boolean)
    const payload = { content: form.content, tags: tags.length ? tags : null }
    if (editingItem) {
      await supabase.from('inspiration_items').update(payload).eq('id', editingItem.id)
    } else {
      await supabase.from('inspiration_items').insert(payload)
    }
    cancelForm()
    load()
  }

  async function toggleUsed(item: InspirationItem) {
    await supabase.from('inspiration_items').update({ used: !item.used }).eq('id', item.id)
    load()
  }

  async function deleteItem(id: string) {
    await supabase.from('inspiration_items').delete().eq('id', id)
    load()
  }

  const filtered = items.filter(i =>
    filter === 'all' ? true : filter === 'used' ? i.used : !i.used
  )

  if (loading) return <div className="text-sm" style={{ color: 'var(--muted)' }}>載入中…</div>

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">靈感庫</h1>
        <button onClick={openNew}
          className="text-sm px-4 py-2 rounded-lg text-white hover:opacity-80"
          style={{ background: 'var(--brand)' }}>+ 新增素材</button>
      </div>

      {showForm && (
        <div className="rounded-xl border p-5 mb-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <h3 className="font-semibold mb-3 text-sm">{editingItem ? '編輯素材' : '新增素材'}</h3>
          <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            placeholder="記下你的靈感、客人常問的問題、看到的趨勢…"
            rows={4} className="w-full text-sm border rounded-lg px-3 py-2 mb-3 outline-none resize-none"
            style={{ borderColor: 'var(--border)' }} autoFocus />
          <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
            placeholder="標籤（用逗號分隔，例：防曬，衛教，夏季）"
            className="w-full text-sm border rounded-lg px-3 py-2 mb-3 outline-none"
            style={{ borderColor: 'var(--border)' }} />
          <div className="flex gap-2">
            <button onClick={saveItem}
              className="text-sm px-4 py-2 rounded-lg text-white hover:opacity-80"
              style={{ background: 'var(--brand)' }}>{editingItem ? '儲存' : '新增'}</button>
            <button onClick={cancelForm}
              className="text-sm px-4 py-2 rounded-lg border"
              style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>取消</button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-5">
        {(['unused', 'all', 'used'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="text-xs px-3 py-1.5 rounded-full border transition-colors"
            style={{
              background: filter === f ? 'var(--brand)' : 'transparent',
              color: filter === f ? 'white' : 'var(--muted)',
              borderColor: filter === f ? 'var(--brand)' : 'var(--border)',
            }}>
            {f === 'unused' ? '待使用' : f === 'used' ? '已使用' : '全部'}
          </button>
        ))}
        <span className="ml-auto text-xs self-center" style={{ color: 'var(--muted)' }}>{filtered.length} 則</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {filtered.length === 0
          ? <p className="col-span-2 text-sm" style={{ color: 'var(--muted)' }}>沒有素材</p>
          : filtered.map(i => (
            <div key={i.id} className="rounded-xl border p-4 group"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', opacity: i.used ? 0.65 : 1 }}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs px-2 py-0.5 rounded-full text-white"
                  style={{ background: sourceColor[i.source] }}>{sourceLabel[i.source]}</span>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(i)}
                    className="text-xs px-2 py-0.5 rounded border opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>編輯</button>
                  <button onClick={() => deleteItem(i.id)}
                    className="text-xs px-2 py-0.5 rounded border opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ borderColor: '#FCA5A5', color: '#EF4444' }}>刪除</button>
                </div>
              </div>
              <p className="text-sm mb-3 whitespace-pre-wrap">{i.content}</p>
              {i.tags && i.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap mb-3">
                  {i.tags.map(t => (
                    <span key={t} className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--bg)', color: 'var(--muted)' }}>{t}</span>
                  ))}
                </div>
              )}
              <button onClick={() => toggleUsed(i)}
                className="text-xs px-3 py-1 rounded-lg border transition-colors"
                style={{ borderColor: 'var(--border)', color: i.used ? 'var(--muted)' : 'var(--brand)' }}>
                {i.used ? '標為未使用' : '標為已使用'}
              </button>
            </div>
          ))
        }
      </div>
    </div>
  )
}
