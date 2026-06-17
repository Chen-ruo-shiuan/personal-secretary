import type { Metadata } from 'next'
import './globals.css'
import Nav from '@/components/Nav'

export const metadata: Metadata = {
  title: '私人行動秘書',
  description: 'NiNi 專屬行動秘書',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW" className="h-full">
      <body className="min-h-full flex">
        <Nav />
        <main className="flex-1 ml-56 p-8 min-h-screen" style={{ background: 'var(--bg)' }}>
          {children}
        </main>
      </body>
    </html>
  )
}
