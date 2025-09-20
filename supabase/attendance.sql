set check_function_bodies = off;

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school (id) on delete cascade,
  classroom_id uuid not null references public.classroom (id) on delete cascade,
  student_id uuid not null references public.student (id) on delete cascade,
  date date not null,
  status text not null check (status in ('P', 'A', 'R')),
  note text,
  taken_by uuid not null references public.user_profile (id) on delete restrict,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (student_id, date)
);

create index if not exists attendance_classroom_idx on public.attendance (classroom_id);
create index if not exists attendance_date_idx on public.attendance (date);

create or replace function public.set_attendance_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create trigger attendance_set_updated_at
before update on public.attendance
for each row
execute procedure public.set_attendance_updated_at();

alter table public.attendance enable row level security;

create policy "Directors manage attendance" on public.attendance
  for all
  using (
    exists (
      select 1
      from public.user_profile director
      where director.id = auth.uid()
        and director.role = 'director'
        and director.school_id = attendance.school_id
    )
  )
  with check (
    exists (
      select 1
      from public.user_profile director
      where director.id = auth.uid()
        and director.role = 'director'
        and director.school_id = attendance.school_id
    )
  );

create policy "Teachers insert attendance" on public.attendance
  for insert
  with check (
    attendance.taken_by = auth.uid()
    and exists (
      select 1
      from public.teacher_classroom tc
      where tc.teacher_id = auth.uid()
        and tc.classroom_id = attendance.classroom_id
    )
  );

create policy "Teachers update attendance" on public.attendance
  for update
  using (
    exists (
      select 1
      from public.teacher_classroom tc
      where tc.teacher_id = auth.uid()
        and tc.classroom_id = attendance.classroom_id
    )
  )
  with check (
    attendance.taken_by = auth.uid()
    and exists (
      select 1
      from public.teacher_classroom tc
      where tc.teacher_id = auth.uid()
        and tc.classroom_id = attendance.classroom_id
    )
  );

create policy "Teachers delete attendance" on public.attendance
  for delete
  using (
    exists (
      select 1
      from public.teacher_classroom tc
      where tc.teacher_id = auth.uid()
        and tc.classroom_id = attendance.classroom_id
    )
  );

create policy "Teachers read attendance" on public.attendance
  for select
  using (
    exists (
      select 1
      from public.teacher_classroom tc
      where tc.teacher_id = auth.uid()
        and tc.classroom_id = attendance.classroom_id
    )
  );

create policy "Guardians read attendance" on public.attendance
  for select
  using (
    exists (
      select 1
      from public.guardian g
      where g.profile_id = auth.uid()
        and g.student_id = attendance.student_id
    )
  );

create policy "Directors read attendance" on public.attendance
  for select
  using (
    exists (
      select 1
      from public.user_profile director
      where director.id = auth.uid()
        and director.role = 'director'
        and director.school_id = attendance.school_id
    )
  );
