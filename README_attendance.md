# Módulo de asistencia

Este repositorio incluye el MVP para registrar asistencia diaria por salón.

## Pasos para configurar

1. **Ejecutar el SQL en Supabase**
   - Ve a *SQL Editor* en Supabase Studio.
   - Copia el contenido de `sql/attendance.sql` y ejecútalo en tu proyecto.
   - Esto creará la tabla `attendance`, los índices, el trigger de `updated_at` y las políticas RLS necesarias.

2. **Asignar maestras a salones**
   - Usa la tabla `teacher_classroom` para vincular perfiles de maestras con sus salones.
   - Cada registro debe incluir `teacher_id` (id del `user_profile` de la maestra) y `classroom_id`.
   - Recuerda que las maestras solo podrán tomar asistencia en los salones que tengan asignados.

3. **Probar la interfaz**
   - Inicia la aplicación (`npm run dev`).
   - Visita `/attendance` para registrar asistencia. Selecciona el salón y la fecha, marca los estados (P/A/R) y agrega notas si es necesario.
   - Usa el botón **Guardar asistencia** para almacenar los cambios. El botón **Exportar CSV** descarga el reporte diario para ese salón.
   - La ruta `/debug/attendance` muestra información de depuración ({ userId, role, classroomId, date, sampleRows, error }) para validar las políticas RLS.

## Notas

- El guardado utiliza `upsert` respetando la restricción única `(student_id, date)`.
- Las políticas RLS otorgan permisos de lectura y escritura de acuerdo con el rol (`director`, `teacher`, `parent`).
- Los tutores solo tienen acceso de lectura a la asistencia de sus hijos.
