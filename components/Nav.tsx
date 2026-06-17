'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: '總覽', icon: '🏠' },
  { href: '/calendar', label: '行事曆', icon: '📅' },
  { href: '/goals', label: '目標規劃', icon: '🎯' },
  { href: '/inspiration', label: '靈感庫', icon: '💡' },
]

export default function Nav() {
  const path = usePathname()
  return (
    <nav className="fixed left-0 top-0 h-full w-56 flex flex-col p-4 gap-1 border-r"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="mb-6 px-2 pt-2">
        <div className="text-sm font-bold" style={{ color: 'var(--brand)' }}>私人行動秘書</div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>NiNi の 皮膚療癒所</div>
      </div>
      {links.map(l => (
        <Link key={l.href} href={l.href}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors"
          style={{
            background: path === l.href ? '#FDF0E8' : 'transparent',
            color: path === l.href ? 'var(--brand)' : 'var(--text)',
            fontWeight: path === l.href ? 600 : 400,
          }}>
          <span>{l.icon}</span>
          {l.label}
        </Link>
      ))}
    </nav>
  )
}
