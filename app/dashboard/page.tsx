import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

  const { data: profileData } = await supabase
    .from("user_profile")
    .select("id, display_name, role, school:school_id(name)")
    .eq("id", session.user.id)
    .maybeSingle();

  const profile = profileData
    ? {
        ...profileData,
        school: Array.isArray(profileData.school)
          ? profileData.school[0] ?? null
          : profileData.school ?? null
      }
    : null;

  const { data: classrooms } = await supabase
    .from("classroom")
    .select("id, name")
    .order("name", { ascending: true });

  const { data: students } = await supabase
    .from("student")
    .select("id, first_name, last_name")
    .order("first_name", { ascending: true });

  return (
    <main className="flex flex-1 flex-col gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Panel</h1>
        <p className="mt-2 text-sm text-slate-500">
          Bienvenido{profile?.display_name ? `, ${profile.display_name}` : ""}. Tu rol es <strong>{profile?.role}</strong>
          {profile?.school?.name ? ` en ${profile.school.name}` : ""}.
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
