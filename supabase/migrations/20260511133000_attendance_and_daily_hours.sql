alter table public.staff_members
add column if not exists default_daily_hours numeric(4, 2) default 0;

alter table public.staff_members
add column if not exists weekly_schedule jsonb default '{}'::jsonb;

update public.staff_members
set default_daily_hours = 0
where default_daily_hours is null;

alter table public.staff_members
alter column default_daily_hours set default 0;

alter table public.staff_members
alter column default_daily_hours set not null;

update public.staff_members
set weekly_schedule = '{}'::jsonb
where weekly_schedule is null;

alter table public.staff_members
alter column weekly_schedule set default '{}'::jsonb;

alter table public.staff_members
alter column weekly_schedule set not null;

create table if not exists public.app_settings (
  id text primary key,
  company_closure_days jsonb not null default '["domenica"]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.attendance_entries (
  id uuid primary key,
  staff_member_id uuid not null references public.staff_members(id) on delete restrict,
  entry_date date not null,
  entry_type text not null check (entry_type in ('lavoro', 'festivo', 'ferie', 'permesso', 'malattia')),
  worked_hours numeric(4, 2) not null default 0,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists attendance_entries_date_idx on public.attendance_entries (entry_date desc);
create index if not exists attendance_entries_staff_member_idx on public.attendance_entries (staff_member_id);

grant select, insert, update, delete on public.attendance_entries to anon, authenticated;
grant select, insert, update, delete on public.app_settings to anon, authenticated;

alter table public.attendance_entries enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "attendance_entries_public_select" on public.attendance_entries;
create policy "attendance_entries_public_select"
on public.attendance_entries
for select
to anon, authenticated
using (true);

drop policy if exists "attendance_entries_public_insert" on public.attendance_entries;
create policy "attendance_entries_public_insert"
on public.attendance_entries
for insert
to anon, authenticated
with check (true);

drop policy if exists "attendance_entries_public_update" on public.attendance_entries;
create policy "attendance_entries_public_update"
on public.attendance_entries
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "attendance_entries_public_delete" on public.attendance_entries;
create policy "attendance_entries_public_delete"
on public.attendance_entries
for delete
to anon, authenticated
using (true);

drop policy if exists "app_settings_public_select" on public.app_settings;
create policy "app_settings_public_select"
on public.app_settings
for select
to anon, authenticated
using (true);

drop policy if exists "app_settings_public_insert" on public.app_settings;
create policy "app_settings_public_insert"
on public.app_settings
for insert
to anon, authenticated
with check (true);

drop policy if exists "app_settings_public_update" on public.app_settings;
create policy "app_settings_public_update"
on public.app_settings
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "app_settings_public_delete" on public.app_settings;
create policy "app_settings_public_delete"
on public.app_settings
for delete
to anon, authenticated
using (true);

insert into public.app_settings (id, company_closure_days)
values ('global', '["domenica"]'::jsonb)
on conflict (id) do nothing;
