alter table public.staff_members
add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.daily_sales
add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.attendance_entries
add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.staff_members
alter column user_id set default auth.uid();

alter table public.daily_sales
alter column user_id set default auth.uid();

alter table public.attendance_entries
alter column user_id set default auth.uid();

create index if not exists staff_members_user_id_idx on public.staff_members (user_id);
create index if not exists daily_sales_user_id_idx on public.daily_sales (user_id);
create index if not exists attendance_entries_user_id_idx on public.attendance_entries (user_id);

drop policy if exists "staff_members_public_select" on public.staff_members;
drop policy if exists "staff_members_public_insert" on public.staff_members;
drop policy if exists "staff_members_public_update" on public.staff_members;
drop policy if exists "staff_members_public_delete" on public.staff_members;

drop policy if exists "daily_sales_public_select" on public.daily_sales;
drop policy if exists "daily_sales_public_insert" on public.daily_sales;
drop policy if exists "daily_sales_public_update" on public.daily_sales;
drop policy if exists "daily_sales_public_delete" on public.daily_sales;

drop policy if exists "attendance_entries_public_select" on public.attendance_entries;
drop policy if exists "attendance_entries_public_insert" on public.attendance_entries;
drop policy if exists "attendance_entries_public_update" on public.attendance_entries;
drop policy if exists "attendance_entries_public_delete" on public.attendance_entries;

drop policy if exists "app_settings_public_select" on public.app_settings;
drop policy if exists "app_settings_public_insert" on public.app_settings;
drop policy if exists "app_settings_public_update" on public.app_settings;
drop policy if exists "app_settings_public_delete" on public.app_settings;

drop policy if exists "staff_members_owner_select" on public.staff_members;
create policy "staff_members_owner_select"
on public.staff_members
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "staff_members_owner_insert" on public.staff_members;
create policy "staff_members_owner_insert"
on public.staff_members
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "staff_members_owner_update" on public.staff_members;
create policy "staff_members_owner_update"
on public.staff_members
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "staff_members_owner_delete" on public.staff_members;
create policy "staff_members_owner_delete"
on public.staff_members
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "daily_sales_owner_select" on public.daily_sales;
create policy "daily_sales_owner_select"
on public.daily_sales
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "daily_sales_owner_insert" on public.daily_sales;
create policy "daily_sales_owner_insert"
on public.daily_sales
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "daily_sales_owner_update" on public.daily_sales;
create policy "daily_sales_owner_update"
on public.daily_sales
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "daily_sales_owner_delete" on public.daily_sales;
create policy "daily_sales_owner_delete"
on public.daily_sales
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "attendance_entries_owner_select" on public.attendance_entries;
create policy "attendance_entries_owner_select"
on public.attendance_entries
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "attendance_entries_owner_insert" on public.attendance_entries;
create policy "attendance_entries_owner_insert"
on public.attendance_entries
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "attendance_entries_owner_update" on public.attendance_entries;
create policy "attendance_entries_owner_update"
on public.attendance_entries
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "attendance_entries_owner_delete" on public.attendance_entries;
create policy "attendance_entries_owner_delete"
on public.attendance_entries
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "app_settings_owner_select" on public.app_settings;
drop policy if exists "app_settings_authenticated_select" on public.app_settings;
create policy "app_settings_authenticated_select"
on public.app_settings
for select
to authenticated
using (true);

drop policy if exists "app_settings_owner_insert" on public.app_settings;
drop policy if exists "app_settings_authenticated_insert" on public.app_settings;
create policy "app_settings_authenticated_insert"
on public.app_settings
for insert
to authenticated
with check (true);

drop policy if exists "app_settings_owner_update" on public.app_settings;
drop policy if exists "app_settings_authenticated_update" on public.app_settings;
create policy "app_settings_authenticated_update"
on public.app_settings
for update
to authenticated
using (true)
with check (true);

drop policy if exists "app_settings_owner_delete" on public.app_settings;
drop policy if exists "app_settings_authenticated_delete" on public.app_settings;
create policy "app_settings_authenticated_delete"
on public.app_settings
for delete
to authenticated
using (true);
