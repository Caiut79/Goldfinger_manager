alter table public.staff_members
add column if not exists is_active boolean default true;

update public.staff_members
set is_active = true
where is_active is null;

alter table public.staff_members
alter column is_active set default true;

alter table public.staff_members
alter column is_active set not null;

alter table public.daily_sales
drop constraint if exists daily_sales_staff_member_id_fkey;

alter table public.daily_sales
add constraint daily_sales_staff_member_id_fkey
foreign key (staff_member_id)
references public.staff_members (id)
on delete restrict;
