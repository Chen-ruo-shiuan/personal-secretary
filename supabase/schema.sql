-- 行事曆事件
create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean default false,
  goal_id uuid,              -- 連結到哪個目標（可空）
  color text default '#C4622D',
  source text default 'web', -- 'web' | 'line'
  created_at timestamptz default now()
);

-- 目標規劃（四個時間層）
create table goals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  horizon text not null check (horizon in ('long','medium','short','near')),
  -- long=1-3年, medium=3-6月, short=1-4週, near=本週
  status text default 'active' check (status in ('active','done','paused')),
  parent_id uuid references goals(id), -- 長目標可拆解成短目標
  due_date date,
  created_at timestamptz default now()
);

-- 靈感素材庫
create table inspiration_items (
  id uuid primary key default gen_random_uuid(),
  content text not null,       -- 素材內文
  source text default 'manual' check (source in ('manual','line','ai')),
  -- manual=自己輸入, line=LINE傳入, ai=AI抓取
  tags text[],                 -- 標籤，例如 ['防曬','夏季','衛教']
  used boolean default false,  -- 是否已用於發文
  week_included_at date,       -- 被納入哪一週的靈感包
  created_at timestamptz default now()
);

-- 每週靈感包（AI 整理後的推播內容）
create table weekly_digests (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique, -- 當週週一日期
  content jsonb not null,          -- { topics: [], angles: [], reminder: '' }
  sent_at timestamptz,             -- 推播給 LINE 的時間
  created_at timestamptz default now()
);

-- 啟用 Row Level Security（之後加上驗證時用）
alter table events enable row level security;
alter table goals enable row level security;
alter table inspiration_items enable row level security;
alter table weekly_digests enable row level security;

-- 暫時允許所有操作（個人使用，之後可加 auth）
create policy "allow all" on events for all using (true) with check (true);
create policy "allow all" on goals for all using (true) with check (true);
create policy "allow all" on inspiration_items for all using (true) with check (true);
create policy "allow all" on weekly_digests for all using (true) with check (true);
