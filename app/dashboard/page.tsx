import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

type DashboardProfile = Pick<
  Database["public"]["Tables"]["user_profile"]["Row"],
  "id" | "display_name" | "role"
> & {
  school: { name: string } | null;
};

type DashboardClassroom = Pick<Database["public"]["Tables"]["classroom"]["Row"], "id" | "name">;

type DashboardStudent = Pick<Database["public"]["Tables"]["student"]["Row"], "id" | "first_name" | "last_name">;

type QueryError = {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
} | null;

function getErrorMessage(error: QueryError) {
  if (!error) {
    return null;
  }
  return error.message || error.details || error.hint || "(sin mensaje)";
}

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  async function signOut() {
    "use server";
    const serverClient = createServerSupabaseClient();
    await serverClient.auth.signOut();
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profile")
    .select("id, display_name, role, school(name)")
    .eq("id", session.user.id)
    .maybeSingle<DashboardProfile>();

  if (profileError) {
    console.error(profileError);
  }

  const { data: classrooms, error: classroomsError } = await supabase
    .from("classroom")
    .select("id, name")
    .order("name", { ascending: true })
    .returns<DashboardClassroom[]>();

  if (classroomsError) {
    console.error(classroomsError);
  }

  const { data: students, error: studentsError } = await supabase
    .from("student")
    .select("id, first_name, last_name")
    .order("first_name", { ascending: true })
    .returns<DashboardStudent[]>();

  if (studentsError) {
    console.error(studentsError);
  }

  const profileErrorMessage = getErrorMessage(profileError);
  const classroomsErrorMessage = getErrorMessage(classroomsError);
  const studentsErrorMessage = getErrorMessage(studentsError);

  return (
    <main className="flex flex-1 flex-col gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Panel</h1>
        <p className="mt-2 text-sm text-slate-500">
          Bienvenido{profile?.display_name ? `, ${profile.display_name}` : ""}. Tu rol es <strong>{profile?.role}</strong>
          {profile?.school?.name ? ` en ${profile.school.name}` : ""}.
        </p>
        {profileErrorMessage ? (
          <p className="mt-2 text-sm text-rose-600">
            Error al cargar tu perfil: {profileErrorMessage}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Link href="/role" className="text-sm font-medium text-indigo-600 hover:underline">
            Ver detalle por rol
          </Link>
          <form action={signOut}>
            <button type="submit" className="text-sm font-medium text-rose-600 hover:underline">
              Cerrar sesión
            </button>
          </form>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Salones accesibles</h2>
          <p className="mt-2 text-sm text-slate-500">
            Listado según tus permisos en Supabase.
          </p>
          {classroomsErrorMessage ? (
            <p className="mt-4 text-sm text-rose-600">Error al cargar salones: {classroomsErrorMessage}</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {classrooms?.length ? (
                classrooms.map((classroom) => (
                  <li key={classroom.id} className="rounded border border-slate-100 px-3 py-2">
                    {classroom.name}
                  </li>
                ))
              ) : (
                <li className="text-sm text-slate-400">Sin salones disponibles</li>
              )}
            </ul>
          )}
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Alumnos</h2>
          <p className="mt-2 text-sm text-slate-500">
            Visualización limitada por las políticas RLS configuradas.
          </p>
          {studentsErrorMessage ? (
            <p className="mt-4 text-sm text-rose-600">Error al cargar alumnos: {studentsErrorMessage}</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {students?.length ? (
                students.map((student) => (
                  <li key={student.id} className="rounded border border-slate-100 px-3 py-2">
                    {student.first_name} {student.last_name}
                  </li>
                ))
              ) : (
                <li className="text-sm text-slate-400">Sin alumnos asignados</li>
              )}
            </ul>
          )}
        </article>
      </section>
    </main>
  );
}
