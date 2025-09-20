# Módulo de asistencia

Este repositorio incluye el MVP para registrar asistencia diaria por salón.

## Pasos para configurar

1. **Ejecutar el SQL en Supabase**
   - Ve a *SQL Editor* en Supabase Studio.
   - Copia el contenido de `supabase/attendance.sql` y ejecútalo en tu proyecto.
   - Esto creará la tabla `attendance`, los índices, el trigger de `updated_at` y las políticas RLS necesarias.

2. **Configurar docentes y matrículas**
   - En `teacher_classroom` registra cada maestra con los salones que puede atender (`teacher_id` = id del `user_profile`, `classroom_id`).
   - En `enrollment` inscribe a cada estudiante en su salón (`student_id`, `classroom_id`, `school_id`). Estas filas son las que usa la app para mostrar a los alumnos.

3. **Campos esperados en `student`**
   - La interfaz lee `full_name` si existe y, en caso contrario, concatena `first_name` y `last_name`.
   - Asegúrate de capturar también `date_of_birth` cuando esté disponible; se muestra en la vista de asistencia.

4. **Probar la interfaz**
   - Inicia la aplicación (`npm run dev`).
   - Visita `/attendance` para registrar asistencia. Selecciona el salón y la fecha, marca los estados (P/A/R) y agrega notas si es necesario.
   - Usa el botón **Guardar asistencia** para almacenar los cambios. El botón **Exportar CSV** descarga el reporte diario para ese salón.
   - La ruta `/debug/attendance` muestra un JSON con el usuario autenticado, rol detectado, salones cargados, número de alumnos del salón seleccionado y el último error reportado por la pantalla de asistencia.

## Notas

- El guardado utiliza `upsert` respetando la restricción única `(student_id, date)`.
- Las políticas RLS otorgan permisos de lectura y escritura de acuerdo con el rol (`director`, `teacher`, `parent`).
- Los tutores solo tienen acceso de lectura a la asistencia de sus hijos.
