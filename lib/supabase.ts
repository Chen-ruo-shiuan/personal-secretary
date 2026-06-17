import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(url, key)

export type Horizon = 'long' | 'medium' | 'short' | 'near'
export type GoalStatus = 'active' | 'done' | 'paused'
export type InspirationSource = 'manual' | 'line' | 'ai'

export interface Event {
  id: string
  title: string
  description?: string
  start_at: string
  end_at?: string
  all_day: boolean
  goal_id?: string
  color: string
  source: string
  created_at: string
}

export interface Goal {
  id: string
  title: string
  description?: string
  horizon: Horizon
  status: GoalStatus
  parent_id?: string
  due_date?: string
  created_at: string
}

export interface InspirationItem {
  id: string
  content: string
  source: InspirationSource
  tags?: string[]
  used: boolean
  week_included_at?: string
  created_at: string
}
