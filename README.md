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

La pantalla de `/login` utiliza el componente oficial de Supabase Auth UI. Al iniciar sesión, la sesión se almacena en cookies manejadas por `@supabase/auth-helpers-nextjs`. Los componentes del dashboard y del detalle de rol verifican la sesión en el servidor y aplican redirecciones a `/login` en caso de no existir.
