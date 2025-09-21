"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { toMessage } from "@/lib/errors";
import { createClientSupabaseClient } from "@/lib/supabase/client";

type Profile = {
  role: string | null;
  full_name: string | null;
  school_id: string | null;
};

type CountResult = {
  count: number | null;
  errorMessage: string | null;
};

const zeroTooltip =
  "Si ves 0, revisa: variables NEXT_PUBLIC_SUPABASE_URL/ANON_KEY, tu fila en user_profile y las políticas RLS.";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClientSupabaseClient(), []);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [studentsState, setStudentsState] = useState<CountResult>({
    count: null,
    errorMessage: null
  });
  const [classroomsState, setClassroomsState] = useState<CountResult>({
    count: null,
    errorMessage: null
  });

  const [userEmail, setUserEmail] = useState<string | null>(null);

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

        setUserEmail(user.email ?? null);

        const [{ data: profileData, error: profileError }, classrooms, students] = await Promise.all([
          supabase
            .from("user_profile")
            .select("role, full_name, school_id")
            .eq("id", user.id)
            .maybeSingle<Profile>(),
          supabase
            .from("classroom")
            .select("id", { count: "exact", head: true }),
          supabase
            .from("student")
            .select("id", { count: "exact", head: true })
        ]);

        if (!active) {
          return;
        }

        if (profileError) {
          setProfileError(toMessage(profileError));
        }

        setProfile(profileData ?? null);

        setClassroomsState({
          count: typeof classrooms.count === "number" ? classrooms.count : null,
          errorMessage: classrooms.error ? toMessage(classrooms.error) : null
        });

        setStudentsState({
          count: typeof students.count === "number" ? students.count : null,
          errorMessage: students.error ? toMessage(students.error) : null
        });
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

  const handleSignOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setProfileError(toMessage(error));
      return;
    }
    router.replace("/login");
  }, [router, supabase]);

  const fullName = profile?.full_name ?? undefined;
  const role = profile?.role ?? undefined;

  return (
    <main className="flex flex-1 flex-col gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Panel</h1>
        {profileError ? (
          <p className="mt-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            getMyProfile: {profileError}
          </p>
        ) : null}
        <p className="mt-2 text-sm text-slate-500">
          {loading ? (
            "Cargando tu información..."
          ) : (
            <>
              Bienvenido
              {fullName ? `, ${fullName}` : userEmail ? `, ${userEmail}` : ""}. Tu rol es {" "}
              {role ? <strong>{role}</strong> : <span className="font-semibold text-amber-600">(sin rol)</span>}.
            </>
          )}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Link href="/role" className="text-sm font-medium text-indigo-600 hover:underline">
            Ver detalle por rol
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-sm font-medium text-rose-600 hover:underline"
          >
            Cerrar sesión
          </button>
        </div>
        {!profile && !loading ? (
          <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            No se encontró tu user_profile. Ve a Supabase → Table editor → user_profile e inserta una fila con id =
            tu auth.uid, school_id y role.
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Salones visibles</h2>
          <p className="mt-1 text-sm text-slate-500">Conteo según tus permisos actuales.</p>
          <div
            className="mt-6 text-4xl font-semibold text-slate-900"
            title={classroomsState.count === 0 ? zeroTooltip : undefined}
          >
            {typeof classroomsState.count === "number" ? classroomsState.count : "–"}
          </div>
          {classroomsState.errorMessage ? (
            <p className="mt-3 text-sm text-rose-600">{classroomsState.errorMessage}</p>
          ) : classroomsState.count === 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              Tip: revisa variables de entorno, tu user_profile y que las políticas RLS permitan leer los salones.
            </p>
          ) : null}
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Alumnos visibles</h2>
          <p className="mt-1 text-sm text-slate-500">Número limitado por tus políticas RLS.</p>
          <div
            className="mt-6 text-4xl font-semibold text-slate-900"
            title={studentsState.count === 0 ? zeroTooltip : undefined}
          >
            {typeof studentsState.count === "number" ? studentsState.count : "–"}
          </div>
          {studentsState.errorMessage ? (
            <p className="mt-3 text-sm text-rose-600">{studentsState.errorMessage}</p>
          ) : studentsState.count === 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              Tip: verifica tus variables de entorno, que exista tu user_profile y las políticas RLS de student.
            </p>
          ) : null}
        </article>
      </section>
    </main>
  );
}
