create table if not exists public.staff_members (
  id uuid primary key,
  full_name text not null,
  role text not null check (role in ('titolare', 'dipendente')),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.daily_sales (
  id uuid primary key,
  sale_date date not null,
  staff_member_id uuid not null references public.staff_members(id) on delete restrict,
  regular_amount numeric(10, 2) not null default 0,
  test_amount numeric(10, 2) not null default 0,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists daily_sales_sale_date_idx on public.daily_sales (sale_date desc);
create index if not exists daily_sales_staff_member_idx on public.daily_sales (staff_member_id);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.staff_members to anon, authenticated;
grant select, insert, update, delete on public.daily_sales to anon, authenticated;

alter table public.staff_members enable row level security;
alter table public.daily_sales enable row level security;

drop policy if exists "staff_members_public_select" on public.staff_members;
create policy "staff_members_public_select"
on public.staff_members
for select
to anon, authenticated
using (true);

drop policy if exists "staff_members_public_insert" on public.staff_members;
create policy "staff_members_public_insert"
on public.staff_members
for insert
to anon, authenticated
with check (true);

drop policy if exists "staff_members_public_update" on public.staff_members;
create policy "staff_members_public_update"
on public.staff_members
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "staff_members_public_delete" on public.staff_members;
create policy "staff_members_public_delete"
on public.staff_members
for delete
to anon, authenticated
using (true);

drop policy if exists "daily_sales_public_select" on public.daily_sales;
create policy "daily_sales_public_select"
on public.daily_sales
for select
to anon, authenticated
using (true);

drop policy if exists "daily_sales_public_insert" on public.daily_sales;
create policy "daily_sales_public_insert"
on public.daily_sales
for insert
to anon, authenticated
with check (true);

drop policy if exists "daily_sales_public_update" on public.daily_sales;
create policy "daily_sales_public_update"
on public.daily_sales
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "daily_sales_public_delete" on public.daily_sales;
create policy "daily_sales_public_delete"
on public.daily_sales
for delete
to anon, authenticated
using (true);
