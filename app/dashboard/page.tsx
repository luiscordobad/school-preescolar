import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/supabase/profile";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

type DashboardClassroom = Pick<Database["public"]["Tables"]["classroom"]["Row"], "id" | "name">;

type DashboardStudent = Pick<Database["public"]["Tables"]["student"]["Row"], "id" | "first_name" | "last_name">;

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

  const profile = await getMyProfile(supabase, session.user.id);

  let schoolName: string | null = null;

  if (profile?.school_id) {
    const { data: school } = await supabase
      .from("school")
      .select("name")
      .eq("id", profile.school_id)
      .maybeSingle<{ name: string }>();

    schoolName = school?.name ?? null;
  }

  const { data: classrooms } = await supabase
    .from("classroom")
    .select("id, name")
    .order("name", { ascending: true })
    .returns<DashboardClassroom[]>();

  const { data: students } = await supabase
    .from("student")
    .select("id, first_name, last_name")
    .order("first_name", { ascending: true })
    .returns<DashboardStudent[]>();

  return (
    <main className="flex flex-1 flex-col gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Panel</h1>
        <p className="mt-2 text-sm text-slate-500">
          Bienvenido{profile ? `, ${profile.full_name ?? "(sin nombre)"}` : ""}. Tu rol es <strong>{profile?.role}</strong>
          {schoolName ? ` en ${schoolName}` : ""}.
        </p>
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
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Alumnos</h2>
          <p className="mt-2 text-sm text-slate-500">
            Visualización limitada por las políticas RLS configuradas.
          </p>
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
        </article>
      </section>
    </main>
  );
}
