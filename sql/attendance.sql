create extension if not exists pgcrypto;
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.school(id) on delete cascade,
  classroom_id uuid not null references public.classroom(id) on delete cascade,
  student_id   uuid not null references public.student(id) on delete cascade,
  date date not null,
  status text not null check (status in ('P','A','R')),
  note text,
  taken_by uuid not null references public.user_profile(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, date)
);
create index if not exists idx_attendance_classroom_date on public.attendance(classroom_id, date);
create index if not exists idx_attendance_student_date   on public.attendance(student_id, date);
-- trigger updated_at
create or replace function public.tg_set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists tg_attendance_updated_at on public.attendance;
create trigger tg_attendance_updated_at before update on public.attendance
for each row execute function public.tg_set_updated_at();

alter table public.attendance enable row level security;
-- SELECT
drop policy if exists att_sel_director on public.attendance;
create policy att_sel_director on public.attendance
  for select using (
    exists (select 1 from public.user_profile me
            where me.id = auth.uid()
              and me.role = 'director'
              and me.school_id = attendance.school_id)
  );
drop policy if exists att_sel_teacher on public.attendance;
create policy att_sel_teacher on public.attendance
  for select using (
    exists (select 1 from public.teacher_classroom tc
            where tc.teacher_id = auth.uid()
              and tc.classroom_id = attendance.classroom_id)
  );
drop policy if exists att_sel_parent on public.attendance;
create policy att_sel_parent on public.attendance
  for select using (
    exists (select 1 from public.guardian g
            where g.user_id = auth.uid()
              and g.student_id = attendance.student_id)
  );
-- INSERT / UPDATE (director o maestra asignada)
drop policy if exists att_ins on public.attendance;
create policy att_ins on public.attendance
  for insert with check (
    exists (select 1 from public.user_profile me
            where me.id = auth.uid() and me.role='director' and me.school_id = attendance.school_id)
    or
    exists (select 1 from public.teacher_classroom tc
            where tc.teacher_id = auth.uid() and tc.classroom_id = attendance.classroom_id)
  );
drop policy if exists att_upd on public.attendance;
create policy att_upd on public.attendance
  for update using (
    exists (select 1 from public.user_profile me
            where me.id = auth.uid() and me.role='director' and me.school_id = attendance.school_id)
    or
    exists (select 1 from public.teacher_classroom tc
            where tc.teacher_id = auth.uid() and tc.classroom_id = attendance.classroom_id)
  )
  with check (
    exists (select 1 from public.user_profile me
            where me.id = auth.uid() and me.role='director' and me.school_id = attendance.school_id)
    or
    exists (select 1 from public.teacher_classroom tc
            where tc.teacher_id = auth.uid() and tc.classroom_id = attendance.classroom_id)
  );
-- (Opcional) DELETE solo director:
drop policy if exists att_del_dir on public.attendance;
create policy att_del_dir on public.attendance
  for delete using (
    exists (select 1 from public.user_profile me
            where me.id = auth.uid() and me.role='director' and me.school_id = attendance.school_id)
  );

drop view if exists public.v_attendance_day_classroom;
create or replace view public.v_attendance_day_classroom as
select
  classroom_id,
  date,
  count(*) filter (where status = 'P') as present_count,
  count(*) filter (where status = 'A') as absent_count,
  count(*) filter (where status = 'R') as tardy_count
from public.attendance
group by classroom_id, date;

drop view if exists public.v_attendance_month_student;
create or replace view public.v_attendance_month_student as
select
  student_id,
  date_trunc('month', date)::date as month,
  count(*) filter (where status = 'P') as present_count,
  count(*) filter (where status = 'A') as absent_count,
  count(*) filter (where status = 'R') as tardy_count,
  count(*) as total_days,
  case
    when count(*) = 0 then null
    else round(count(*) filter (where status = 'P')::numeric / nullif(count(*), 0)::numeric * 100, 2)
  end as attendance_percentage
from public.attendance
group by student_id, date_trunc('month', date);
