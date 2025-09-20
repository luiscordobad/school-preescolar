"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { toMessage } from "@/lib/errors";
import { createClientSupabaseClient } from "@/lib/supabase/client";

type RoleProfile = {
  role: string | null;
  full_name: string | null;
  school_id: string | null;
};

type RoleDescriptor = {
  title: string;
  description: string;
  focus: string[];
};

const roleDescriptions: Record<string, RoleDescriptor> = {
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
  maestra: {
    title: "Maestra",
    description:
      "Acceso restringido únicamente a los salones donde ha sido asignada y a los estudiantes inscritos en ellos.",
    focus: [
      "Revisar alumnos y tutores de su salón",
      "Actualizar información diaria del aula",
      "Comunicar novedades a las familias"
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
  padre: {
    title: "Padre / Madre / Tutor",
    description:
      "Puede consultar exclusivamente los datos de sus hijos registrados en la plataforma.",
    focus: [
      "Revisar el progreso académico y comunicados",
      "Actualizar información de contacto",
      "Enviar mensajes a la escuela"
    ]
  },
  madre: {
    title: "Padre / Madre / Tutor",
    description:
      "Puede consultar exclusivamente los datos de sus hijos registrados en la plataforma.",
    focus: [
      "Revisar el progreso académico y comunicados",
      "Actualizar información de contacto",
      "Enviar mensajes a la escuela"
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

export default function RolePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClientSupabaseClient(), []);
  const [profile, setProfile] = useState<RoleProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setProfileError(null);
      try {
        const {
          data: { user },
          error: userError
        } = await supabase.auth.getUser();

        if (!active) {
          return;
        }

        if (userError) {
          setProfileError(toMessage(userError));
          return;
        }

        if (!user) {
          router.replace("/login");
          return;
        }

        const { data, error } = await supabase
          .from("user_profile")
          .select("role, full_name, school_id")
          .eq("id", user.id)
          .maybeSingle<RoleProfile>();

        if (!active) {
          return;
        }

        if (error) {
          setProfileError(toMessage(error));
        }

        setProfile(data ?? null);
      } catch (error) {
        if (!active) {
          return;
        }
        setProfileError(toMessage(error));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  const descriptor = profile?.role ? roleDescriptions[profile.role] : undefined;

  return (
    <main className="flex flex-1 flex-col gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Detalle de rol</h1>
        {profileError ? (
          <p className="mt-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            getMyProfile: {profileError}
          </p>
        ) : null}
        {!profile && !loading ? (
          <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            No se encontró tu user_profile. Ve a Supabase → Table editor → user_profile e inserta una fila con id = tu auth.uid,
            school_id y role.
          </p>
        ) : null}
        {profile?.full_name ? (
          <p className="mt-4 text-sm text-slate-600">Nombre: {profile.full_name}</p>
        ) : null}
        {descriptor ? (
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm uppercase tracking-wide text-slate-500">Tu rol</p>
              <h2 className="text-xl font-semibold">{descriptor.title}</h2>
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
        ) : !loading ? (
          <p className="mt-4 text-sm text-slate-500">
            Aún no se ha configurado tu rol. Solicita asistencia a la dirección.
          </p>
        ) : null}
      </section>
    </main>
  );
}
