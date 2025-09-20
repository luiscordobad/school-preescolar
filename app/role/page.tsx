import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const roleDescriptions: Record<string, { title: string; description: string; focus: string[] }> = {
  director: {
    title: "Directora / Director",
    description:
      "Puede ver toda la información asociada a su escuela: salones, estudiantes, tutores y personal docente.",
    focus: [
      "Gestionar la configuración general de la escuela",
      "Supervisar la matrícula y asignaciones",
      "Acompañar a maestras y familias"
    ]
  },
  teacher: {
    title: "Maestra",
    description:
      "Acceso restringido únicamente a los salones donde ha sido asignada y a los estudiantes inscritos en ellos.",
    focus: [
      "Revisar alumnos y tutores de su salón",
      "Actualizar información diaria del aula",
      "Comunicar novedades a las familias"
    ]
  },
  parent: {
    title: "Padre / Madre / Tutor",
    description:
      "Puede consultar exclusivamente los datos de sus hijos registrados en la plataforma.",
    focus: [
      "Revisar el progreso académico y comunicados",
      "Actualizar información de contacto",
      "Enviar mensajes a la escuela"
    ]
  }
};

export default async function RolePage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const { data: profileData } = await supabase
    .from("user_profile")
    .select("role, school:school_id(name)")
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

  const descriptor = roleDescriptions[profile?.role ?? ""];

  return (
    <main className="flex flex-1 flex-col gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Detalle de rol</h1>
        {descriptor ? (
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm uppercase tracking-wide text-slate-500">Tu rol</p>
              <h2 className="text-xl font-semibold">{descriptor.title}</h2>
              {profile?.school?.name ? (
                <p className="mt-1 text-sm text-slate-500">Escuela: {profile.school.name}</p>
              ) : null}
            </div>
            <p className="text-base text-slate-600">{descriptor.description}</p>
            <div>
              <p className="text-sm font-medium text-slate-500">Responsabilidades principales</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {descriptor.focus.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Aún no se ha configurado tu rol. Solicita asistencia a la dirección.
          </p>
        )}
      </section>
    </main>
  );
}
