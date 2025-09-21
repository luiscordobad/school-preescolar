# Módulo de mensajes y avisos

Este módulo agrega las tablas `message_thread` y `message` para publicar avisos generales y por salón. A continuación se describen los pasos para aplicar los cambios en la base de datos y cómo probar los flujos principales para cada rol.

## Aplicar `sql/messages.sql`

1. Asegúrate de tener configurada la CLI de Supabase y acceso a la base de datos del proyecto.
2. Ejecuta el script con cualquiera de las siguientes opciones:
   - Usando la CLI de Supabase en tu entorno local: `supabase db execute --file sql/messages.sql`
   - Usando `psql` directamente contra la base de datos: `psql "$SUPABASE_DB_URL" -f sql/messages.sql`
3. Verifica que las nuevas tablas e índices existan y que las políticas RLS se hayan creado correctamente.

## Pruebas manuales por rol

1. Inicia sesión en la app (`npm run dev` y abre `http://localhost:3000`).
2. Para cada rol utiliza cuentas con permisos apropiados y valida lo siguiente:
   - **Director**: puede ver todos los hilos desde `/messages`, crear avisos generales o por salón desde `/messages/new` y responder en cualquier hilo.
   - **Maestra/teacher**: ve los hilos de sus salones (y los avisos generales), puede crear avisos para los salones asignados y responder en ellos.
   - **Padre/madre/tutor**: solo visualiza los hilos del salón donde está su hijo y puede responder desde `/messages/[id]`.
3. Usa `/debug/messages` para revisar un resumen `{ role, threadsCount, sampleThread, lastError }` y validar que RLS esté devolviendo datos.
4. Opcional: verifica que las páginas manejen mensajes de error cuando el usuario intenta realizar acciones sin permisos.

## Consideraciones adicionales

- Todos los formularios usan acciones del servidor de Next.js; al enviar un mensaje exitoso la página se refresca automáticamente.
- Las políticas RLS permiten que directores y maestras publiquen avisos, y que tutores respondan únicamente en hilos del salón correspondiente.
