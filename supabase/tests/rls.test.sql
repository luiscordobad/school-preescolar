begin;

select plan(6);

set local role service_role;

insert into public.school (id, name)
values ('11111111-1111-1111-1111-111111111111', 'Kinder Luz');

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'director@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'teacher@example.com'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'parent@example.com');

insert into public.user_profile (id, role, school_id, display_name)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'director', '11111111-1111-1111-1111-111111111111', 'Directora Demo'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'teacher', '11111111-1111-1111-1111-111111111111', 'Maestra Demo'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'parent', '11111111-1111-1111-1111-111111111111', 'Mamá Demo');

insert into public.classroom (id, school_id, name)
values
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Sala Azul'),
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'Sala Verde');

insert into public.student (id, school_id, first_name, last_name)
values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Ana', 'Pérez'),
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Luis', 'García'),
  ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Mia', 'López');

insert into public.teacher_classroom (teacher_id, classroom_id)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222');

insert into public.enrollment (school_id, classroom_id, student_id)
values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333'),
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444'),
  ('11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', '66666666-6666-6666-6666-666666666666');

insert into public.guardian (profile_id, student_id)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333');

reset role;

-- Director puede ver a los tres alumnos
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  (select count(*) from public.student),
  3::bigint,
  'La dirección ve todos los alumnos de su escuela'
);

-- Maestra sólo ve sus alumnos asignados (2 de 3)
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  (select count(*) from public.student),
  2::bigint,
  'La maestra ve únicamente alumnos de sus salones'
);

-- Tutor únicamente ve a su hijo
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  (select count(*) from public.student),
  1::bigint,
  'El tutor ve únicamente a sus hijos registrados'
);

-- Registrar asistencia como maestra
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
insert into public.attendance (school_id, classroom_id, student_id, date, status, note, taken_by)
values (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '2024-02-20',
  'P',
  'Llegó puntual',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
)
on conflict (student_id, date) do update set
  status = excluded.status,
  note = excluded.note,
  taken_by = excluded.taken_by;

select is(
  (
    select status
    from public.attendance
    where student_id = '33333333-3333-3333-3333-333333333333'
      and date = '2024-02-20'
  ),
  'P'::text,
  'La maestra puede registrar asistencia de su salón'
);

-- Actualizar asistencia mediante upsert
insert into public.attendance (school_id, classroom_id, student_id, date, status, note, taken_by)
values (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '2024-02-20',
  'A',
  'Ausente por cita médica',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
)
on conflict (student_id, date) do update set
  status = excluded.status,
  note = excluded.note,
  taken_by = excluded.taken_by;

select is(
  (
    select status
    from public.attendance
    where student_id = '33333333-3333-3333-3333-333333333333'
      and date = '2024-02-20'
  ),
  'A'::text,
  'El upsert actualiza la asistencia existente'
);

-- Un tutor no puede escribir asistencia
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select throws_like(
  $$
    insert into public.attendance (school_id, classroom_id, student_id, date, status, taken_by)
    values (
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333',
      '2024-02-21',
      'P',
      'cccccccc-cccc-cccc-cccc-cccccccccccc'
    )
  $$,
  'violates row-level security policy',
  'Los tutores no tienen permisos para escribir asistencia'
);

select finish();
rollback;
