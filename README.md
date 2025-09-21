# School Preescolar – MVP 1

Bootstrap inicial de la plataforma escolar preescolar construida con Next.js, Tailwind CSS y Supabase.

## Requisitos previos

- Node.js >= 18
- npm >= 9
- [Supabase CLI](https://supabase.com/docs/guides/cli) (opcional pero recomendado para ejecutar pruebas locales)

## Configuración local

1. Clona el repositorio y entra a la carpeta del proyecto:

   ```bash
   git clone <url-del-repo>
   cd school-preescolar
   ```

2. Copia el archivo de variables de entorno y completa los valores correspondientes a tu proyecto de Supabase:

   ```bash
   cp .env.example .env.local
   ```

3. Instala las dependencias (requiere acceso a npm):

   ```bash
   npm install
   ```

4. Levanta el entorno de desarrollo:

   ```bash
   npm run dev
   ```

   La aplicación estará disponible en `http://localhost:3000`.

## Crear un proyecto en Supabase

1. Ingresa a [Supabase](https://supabase.com/) y crea una organización (si aún no tienes una).
2. Crea un nuevo proyecto de base de datos Postgres. Guarda la **Project URL** y el **anon public key**, se utilizarán en `.env.local`.
3. Desde la interfaz de SQL de Supabase o usando el CLI, ejecuta las migraciones ubicadas en `supabase/migrations` siguiendo el orden cronológico:

   ```bash
   supabase migration up
   ```

4. (Opcional) Ejecuta las pruebas de RLS para validar los permisos:

   ```bash
   npm run test:rls
   ```

   Este comando requiere que el Supabase CLI esté autenticado (`supabase login`) y que exista un archivo `supabase/config.toml` apuntando a tu proyecto.

## Estructura del proyecto

- `app/` – Rutas del App Router de Next.js (`/`, `/login`, `/dashboard`, `/role`).
- `components/` – Proveedores y componentes compartidos.
- `lib/` – Inicialización de clientes de Supabase (server y client).
- `supabase/migrations/` – Definición de tablas y políticas RLS.
- `supabase/tests/` – Pruebas SQL para validar Row Level Security.
- `types/` – Tipos generados manualmente para la base de datos.

## Scripts disponibles

- `npm run dev` – Inicia el servidor de desarrollo de Next.js.
- `npm run build` – Compila la aplicación para producción.
- `npm run start` – Ejecuta la build en modo producción.
- `npm run lint` – Ejecuta ESLint con la configuración de Next.js.
- `npm run test:rls` – Ejecuta las pruebas SQL utilizando Supabase CLI.

## Nota sobre autenticación

La pantalla de `/login` utiliza el componente oficial de Supabase Auth UI. Al iniciar sesión, la sesión se almacena en cookies manejadas por `@supabase/auth-helpers-nextjs`. Las páginas de `/dashboard`, `/role` y `/debug/profile` leen la sesión con el cliente de Supabase del lado del navegador y redirigen a `/login` si no existe una sesión válida.

## Si ves "getMyProfile" en rojo

1. Verifica que las variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` estén configuradas en tu entorno (por ejemplo, en Vercel → Project Settings → Environment Variables) y que coincidan con tu proyecto de Supabase.
2. Asegúrate de que exista una fila en la tabla `user_profile` con `id` igual a tu `auth.uid` (el UUID del usuario autenticado), `school_id` y `role` definidos. Puedes crearla desde Supabase → Table editor.
3. Confirma que la política RLS permita leer tu propio perfil. Un ejemplo mínimo es:

   ```sql
   alter table public.user_profile enable row level security;
   drop policy if exists up_self on public.user_profile;
   create policy up_self on public.user_profile
   for select using (id = auth.uid());
   ```

4. Con la sesión iniciada, visita `/debug/profile` para obtener un JSON de diagnóstico que confirma tu usuario, los valores encontrados en `user_profile` y si las variables de entorno públicas están disponibles.
