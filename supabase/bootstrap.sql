-- Bootstrap schema and RLS policies
set check_function_bodies = off;

create extension if not exists "pgcrypto" with schema public;

-- Drop existing policies and tables to ensure idempotent setup
-- Adjust drops as needed for your environment

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where c.relname = 'user_profile'
      and n.nspname = 'public'
  ) then
    execute 'drop policy if exists "Allow all" on public.user_profile';
  end if;
end
$$;

-- Tables
 drop table if exists public.teacher_classroom cascade;
 drop table if exists public.enrollment cascade;
 drop table if exists public.guardian cascade;
 drop table if exists public.student cascade;
 drop table if exists public.classroom cascade;
 drop table if exists public.user_profile cascade;
 drop table if exists public.school cascade;

create table public.school (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table public.user_profile (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role text not null default 'parent' check (role in ('director', 'teacher', 'parent')),
  school_id uuid references public.school (id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table public.classroom (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index classroom_school_idx on public.classroom (school_id);

create table public.student (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index student_school_idx on public.student (school_id);

create table public.guardian (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.user_profile (id) on delete cascade,
  student_id uuid not null references public.student (id) on delete cascade,
  relationship text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (profile_id, student_id)
);

create index guardian_profile_idx on public.guardian (profile_id);
create index guardian_student_idx on public.guardian (student_id);

create table public.enrollment (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school (id) on delete cascade,
  classroom_id uuid not null references public.classroom (id) on delete cascade,
  student_id uuid not null references public.student (id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (classroom_id, student_id)
);

create index enrollment_school_idx on public.enrollment (school_id);
create index enrollment_classroom_idx on public.enrollment (classroom_id);
create index enrollment_student_idx on public.enrollment (student_id);

create table public.teacher_classroom (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.user_profile (id) on delete cascade,
  classroom_id uuid not null references public.classroom (id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (teacher_id, classroom_id)
);

create index teacher_classroom_teacher_idx on public.teacher_classroom (teacher_id);
create index teacher_classroom_classroom_idx on public.teacher_classroom (classroom_id);

alter table public.school enable row level security;
alter table public.user_profile enable row level security;
alter table public.classroom enable row level security;
alter table public.student enable row level security;
alter table public.guardian enable row level security;
alter table public.enrollment enable row level security;
alter table public.teacher_classroom enable row level security;

create policy "Members read their school" on public.school
  for select
  using (
    exists (
      select 1
      from public.user_profile up
      where up.id = auth.uid()
        and up.school_id = school.id
    )
  );

create policy "Self manage profile" on public.user_profile
  for select using (id = auth.uid())
  with check (id = auth.uid());

create policy "Directors manage profiles" on public.user_profile
  for select
  using (
    exists (
      select 1
      from public.user_profile director
      where director.id = auth.uid()
        and director.role = 'director'
        and director.school_id = user_profile.school_id
    )
  );

create policy "Directors read classrooms" on public.classroom
  for select
  using (
    exists (
      select 1
      from public.user_profile director
      where director.id = auth.uid()
        and director.role = 'director'
        and director.school_id = classroom.school_id
    )
  );

create policy "Teachers read assigned classrooms" on public.classroom
  for select
  using (
    exists (
      select 1
      from public.teacher_classroom tc
      where tc.teacher_id = auth.uid()
        and tc.classroom_id = classroom.id
    )
  );

create policy "Directors read students" on public.student
  for select
  using (
    exists (
      select 1
      from public.user_profile director
      where director.id = auth.uid()
        and director.role = 'director'
        and director.school_id = student.school_id
    )
  );

create policy "Teachers read their students" on public.student
  for select
  using (
    exists (
      select 1
      from public.teacher_classroom tc
      join public.enrollment en on en.classroom_id = tc.classroom_id
      where tc.teacher_id = auth.uid()
        and en.student_id = student.id
    )
  );

create policy "Guardians read their students" on public.student
  for select
  using (
    exists (
      select 1
      from public.guardian g
      where g.profile_id = auth.uid()
        and g.student_id = student.id
    )
  );

create policy "Directors read guardians" on public.guardian
  for select
  using (
    exists (
      select 1
      from public.user_profile director
      join public.student s on s.id = guardian.student_id
      where director.id = auth.uid()
        and director.role = 'director'
        and director.school_id = s.school_id
    )
  );

create policy "Guardians read themselves" on public.guardian
  for select
  using (guardian.profile_id = auth.uid());

create policy "Directors read enrollments" on public.enrollment
  for select
  using (
    exists (
      select 1
      from public.user_profile director
      where director.id = auth.uid()
        and director.role = 'director'
        and director.school_id = enrollment.school_id
    )
  );

create policy "Teachers read enrollments" on public.enrollment
  for select
  using (
    exists (
      select 1
      from public.teacher_classroom tc
      where tc.teacher_id = auth.uid()
        and tc.classroom_id = enrollment.classroom_id
    )
  );

create policy "Directors read teacher assignments" on public.teacher_classroom
  for select
  using (
    exists (
      select 1
      from public.user_profile director
      join public.classroom c on c.id = teacher_classroom.classroom_id
      where director.id = auth.uid()
        and director.role = 'director'
        and director.school_id = c.school_id
    )
  );

create policy "Teachers read their assignments" on public.teacher_classroom
  for select
  using (teacher_classroom.teacher_id = auth.uid());
