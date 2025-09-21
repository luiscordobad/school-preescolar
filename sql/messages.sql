create extension if not exists pgcrypto;

create table if not exists public.message_thread (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  classroom_id uuid references public.classroom(id) on delete set null,
  title text not null,
  created_by uuid not null references public.user_profile(id),
  created_at timestamptz not null default now()
);

create table if not exists public.message (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_thread(id) on delete cascade,
  sender_id uuid not null references public.user_profile(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_message_thread_school on public.message_thread(school_id, classroom_id);
create index if not exists idx_message_thread_created on public.message_thread(created_at desc);
create index if not exists idx_message_thread_id on public.message(thread_id, created_at);

alter table public.message_thread enable row level security;
drop policy if exists mt_sel on public.message_thread;
create policy mt_sel on public.message_thread
for select using (
  exists (
    select 1
    from public.user_profile me
    where me.id = auth.uid()
      and me.role = 'director'
      and me.school_id = message_thread.school_id
  )
  or exists (
    select 1
    from public.teacher_classroom tc
    where tc.teacher_id = auth.uid()
      and tc.classroom_id = message_thread.classroom_id
  )
  or exists (
    select 1
    from public.guardian g
    join public.enrollment e on e.student_id = g.student_id
    where g.user_id = auth.uid()
      and e.classroom_id = message_thread.classroom_id
  )
  or (
    message_thread.classroom_id is null
    and exists (
      select 1
      from public.user_profile me
      where me.id = auth.uid()
        and me.school_id = message_thread.school_id
    )
  )
);

drop policy if exists mt_ins on public.message_thread;
create policy mt_ins on public.message_thread
for insert with check (
  created_by = auth.uid()
  and (
    exists (
      select 1
      from public.user_profile me
      where me.id = auth.uid()
        and me.role = 'director'
        and me.school_id = message_thread.school_id
    )
    or exists (
      select 1
      from public.teacher_classroom tc
      where tc.teacher_id = auth.uid()
        and tc.classroom_id = message_thread.classroom_id
    )
  )
);

alter table public.message enable row level security;
drop policy if exists msg_sel on public.message;
create policy msg_sel on public.message
for select using (
  exists (
    select 1
    from public.message_thread t
    where t.id = message.thread_id
      and (
        exists (
          select 1
          from public.user_profile me
          where me.id = auth.uid()
            and me.role = 'director'
            and me.school_id = t.school_id
        )
        or exists (
          select 1
          from public.teacher_classroom tc
          where tc.teacher_id = auth.uid()
            and tc.classroom_id = t.classroom_id
        )
        or exists (
          select 1
          from public.guardian g
          join public.enrollment e on e.student_id = g.student_id
          where g.user_id = auth.uid()
            and e.classroom_id = t.classroom_id
        )
        or (
          t.classroom_id is null
          and exists (
            select 1
            from public.user_profile me
            where me.id = auth.uid()
              and me.school_id = t.school_id
          )
        )
      )
  )
);

drop policy if exists msg_ins on public.message;
create policy msg_ins on public.message
for insert with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.message_thread t
    where t.id = message.thread_id
      and (
        exists (
          select 1
          from public.user_profile me
          where me.id = auth.uid()
            and me.role in ('director', 'maestra', 'teacher')
            and me.school_id = t.school_id
        )
        or exists (
          select 1
          from public.teacher_classroom tc
          where tc.teacher_id = auth.uid()
            and tc.classroom_id = t.classroom_id
        )
        or exists (
          select 1
          from public.guardian g
          join public.enrollment e on e.student_id = g.student_id
          where g.user_id = auth.uid()
            and e.classroom_id = t.classroom_id
        )
      )
  )
);
