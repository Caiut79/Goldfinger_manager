create table if not exists public.staff_members (
  id uuid primary key,
  user_id uuid default auth.uid() references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('titolare', 'dipendente')),
  is_active boolean not null default true,
  default_daily_hours numeric(4, 2) not null default 0,
  weekly_schedule jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.app_settings (
  id text primary key,
  company_closure_days jsonb not null default '["domenica"]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.daily_sales (
  id uuid primary key,
  user_id uuid default auth.uid() references auth.users(id) on delete cascade,
  sale_date date not null,
  staff_member_id uuid not null references public.staff_members(id) on delete restrict,
  regular_amount numeric(10, 2) not null default 0,
  test_amount numeric(10, 2) not null default 0,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.attendance_entries (
  id uuid primary key,
  user_id uuid default auth.uid() references auth.users(id) on delete cascade,
  staff_member_id uuid not null references public.staff_members(id) on delete restrict,
  entry_date date not null,
  entry_type text not null check (entry_type in ('lavoro', 'festivo', 'ferie', 'permesso', 'malattia')),
  worked_hours numeric(4, 2) not null default 0,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists daily_sales_sale_date_idx on public.daily_sales (sale_date desc);
create index if not exists daily_sales_staff_member_idx on public.daily_sales (staff_member_id);
create index if not exists staff_members_user_id_idx on public.staff_members (user_id);
create index if not exists daily_sales_user_id_idx on public.daily_sales (user_id);
create index if not exists attendance_entries_date_idx on public.attendance_entries (entry_date desc);
create index if not exists attendance_entries_staff_member_idx on public.attendance_entries (staff_member_id);
create index if not exists attendance_entries_user_id_idx on public.attendance_entries (user_id);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.staff_members to anon, authenticated;
grant select, insert, update, delete on public.daily_sales to anon, authenticated;
grant select, insert, update, delete on public.attendance_entries to anon, authenticated;
grant select, insert, update, delete on public.app_settings to anon, authenticated;

alter table public.staff_members enable row level security;
alter table public.daily_sales enable row level security;
alter table public.attendance_entries enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "staff_members_public_select" on public.staff_members;
drop policy if exists "staff_members_owner_select" on public.staff_members;
create policy "staff_members_owner_select"
on public.staff_members
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "staff_members_public_insert" on public.staff_members;
drop policy if exists "staff_members_owner_insert" on public.staff_members;
create policy "staff_members_owner_insert"
on public.staff_members
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "staff_members_public_update" on public.staff_members;
drop policy if exists "staff_members_owner_update" on public.staff_members;
create policy "staff_members_owner_update"
on public.staff_members
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "staff_members_public_delete" on public.staff_members;
drop policy if exists "staff_members_owner_delete" on public.staff_members;
create policy "staff_members_owner_delete"
on public.staff_members
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "daily_sales_public_select" on public.daily_sales;
drop policy if exists "daily_sales_owner_select" on public.daily_sales;
create policy "daily_sales_owner_select"
on public.daily_sales
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "daily_sales_public_insert" on public.daily_sales;
drop policy if exists "daily_sales_owner_insert" on public.daily_sales;
create policy "daily_sales_owner_insert"
on public.daily_sales
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "daily_sales_public_update" on public.daily_sales;
drop policy if exists "daily_sales_owner_update" on public.daily_sales;
create policy "daily_sales_owner_update"
on public.daily_sales
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "daily_sales_public_delete" on public.daily_sales;
drop policy if exists "daily_sales_owner_delete" on public.daily_sales;
create policy "daily_sales_owner_delete"
on public.daily_sales
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "attendance_entries_public_select" on public.attendance_entries;
drop policy if exists "attendance_entries_owner_select" on public.attendance_entries;
create policy "attendance_entries_owner_select"
on public.attendance_entries
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "attendance_entries_public_insert" on public.attendance_entries;
drop policy if exists "attendance_entries_owner_insert" on public.attendance_entries;
create policy "attendance_entries_owner_insert"
on public.attendance_entries
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "attendance_entries_public_update" on public.attendance_entries;
drop policy if exists "attendance_entries_owner_update" on public.attendance_entries;
create policy "attendance_entries_owner_update"
on public.attendance_entries
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "attendance_entries_public_delete" on public.attendance_entries;
drop policy if exists "attendance_entries_owner_delete" on public.attendance_entries;
create policy "attendance_entries_owner_delete"
on public.attendance_entries
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "app_settings_public_select" on public.app_settings;
drop policy if exists "app_settings_owner_select" on public.app_settings;
drop policy if exists "app_settings_authenticated_select" on public.app_settings;
create policy "app_settings_authenticated_select"
on public.app_settings
for select
to authenticated
using (true);

drop policy if exists "app_settings_public_insert" on public.app_settings;
drop policy if exists "app_settings_owner_insert" on public.app_settings;
drop policy if exists "app_settings_authenticated_insert" on public.app_settings;
create policy "app_settings_authenticated_insert"
on public.app_settings
for insert
to authenticated
with check (true);

drop policy if exists "app_settings_public_update" on public.app_settings;
drop policy if exists "app_settings_owner_update" on public.app_settings;
drop policy if exists "app_settings_authenticated_update" on public.app_settings;
create policy "app_settings_authenticated_update"
on public.app_settings
for update
to authenticated
using (true)
with check (true);

drop policy if exists "app_settings_public_delete" on public.app_settings;
drop policy if exists "app_settings_owner_delete" on public.app_settings;
drop policy if exists "app_settings_authenticated_delete" on public.app_settings;
create policy "app_settings_authenticated_delete"
on public.app_settings
for delete
to authenticated
using (true);

insert into public.app_settings (id, company_closure_days)
values ('global', '["domenica"]'::jsonb)
on conflict (id) do nothing;
