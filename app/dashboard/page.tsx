"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  getClassroomsForUser,
  getMyProfile,
  getStudentDisplayName,
  type AttendanceClassroom,
  type AttendanceRole,
  type TypedSupabaseClient,
} from "@/lib/attendance/client";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type AttendanceStatus = Database["public"]["Tables"]["attendance"]["Row"]["status"];

type DashboardProfileDetails = {
  display_name: string | null;
  school: { name: string } | null;
};

type ClassroomSummary = {
  classroomId: string;
  classroomName: string;
  counts: Record<AttendanceStatus, number>;
};

type LatestAttendanceRow = {
  id: string;
  date: string;
  status: AttendanceStatus | null;
  classroomName: string;
  studentName: string;
};

function formatQueryError(query: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `${query}: ${message}`;
}

export default function DashboardPage() {
  const supabase = useMemo(() => createClientSupabaseClient(), []);
  const typedSupabase = supabase as unknown as TypedSupabaseClient;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<AttendanceRole | null>(null);
  const [profileDetails, setProfileDetails] = useState<DashboardProfileDetails | null>(null);
  const [classrooms, setClassrooms] = useState<AttendanceClassroom[]>([]);
  const [totalStudents, setTotalStudents] = useState<number>(0);
  const [attendanceToday, setAttendanceToday] = useState<ClassroomSummary[]>([]);
  const [latestAttendance, setLatestAttendance] = useState<LatestAttendanceRow[]>([]);

  useEffect(() => {
    let ignore = false;

    async function loadDashboard() {
      setLoading(true);
      setError(null);

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw new Error(formatQueryError("auth.getSession", sessionError));
        }

        const user = session?.user ?? null;
        if (!user) {
          router.replace("/login");
          return;
        }

        if (ignore) return;

        const profileBasics = await getMyProfile(typedSupabase, user.id).catch((error) => {
          throw new Error(formatQueryError("getMyProfile", error));
        });

        if (ignore) return;

        if (!profileBasics) {
          throw new Error("getMyProfile: No encontramos tu perfil.");
        }

        const currentRole = profileBasics.role ?? null;
        setRole(currentRole);

        const { data: profileRow, error: profileRowError } = await supabase
          .from("user_profile")
          .select("display_name, school:school_id (name)")
          .eq("id", user.id)
          .maybeSingle<DashboardProfileDetails>();

        if (profileRowError) {
          throw new Error(formatQueryError("user_profile.select", profileRowError));
        }

        if (ignore) return;

        setProfileDetails(profileRow ?? null);

        const accessibleClassrooms = await getClassroomsForUser(
          typedSupabase,
          currentRole,
          profileBasics,
        ).catch((error) => {
          throw new Error(formatQueryError("getClassroomsForUser", error));
        });

        if (ignore) return;

        setClassrooms(accessibleClassrooms);

        const { count: studentsCount, error: studentsCountError } = await supabase
          .from("student")
          .select("id", { count: "exact", head: true });

        if (studentsCountError) {
          throw new Error(formatQueryError("student.count", studentsCountError));
        }

        if (ignore) return;

        setTotalStudents(studentsCount ?? 0);

        if (accessibleClassrooms.length > 0) {
          const classroomIds = accessibleClassrooms.map((classroom) => classroom.id);
          const today = new Date().toISOString().slice(0, 10);
          const { data: attendanceRows, error: attendanceError } = await supabase
            .from("attendance")
            .select("classroom_id, status")
            .eq("date", today)
            .in("classroom_id", classroomIds);

          if (attendanceError) {
            if (attendanceError.code !== "42P01") {
              throw new Error(formatQueryError("attendance.select", attendanceError));
            }
          }

          if (ignore) return;

          if (attendanceRows) {
            const summaryMap = new Map<string, ClassroomSummary>();
            for (const classroom of accessibleClassrooms) {
              summaryMap.set(classroom.id, {
                classroomId: classroom.id,
                classroomName: classroom.name,
                counts: { P: 0, A: 0, R: 0 },
              });
            }

            for (const row of attendanceRows) {
              const summary = summaryMap.get(row.classroom_id);
              if (!summary) continue;
              if (row.status && summary.counts[row.status] !== undefined) {
                summary.counts[row.status] += 1;
              }
            }

            setAttendanceToday(Array.from(summaryMap.values()));
          } else {
            setAttendanceToday([]);
          }

          const { data: latestRows, error: latestError } = await supabase
            .from("attendance")
            .select(
              "id, date, status, classroom:classroom_id (name), student:student_id (id, school_id, full_name, first_name, last_name)",
            )
            .order("date", { ascending: false })
            .limit(5);

          if (latestError) {
            if (latestError.code !== "42P01") {
              throw new Error(formatQueryError("attendance.latest", latestError));
            }
          }

          if (ignore) return;

          if (latestRows) {
            const rows: LatestAttendanceRow[] = latestRows.map((row) => {
              const classroomName = (row.classroom as { name: string } | null)?.name ?? "Sin salón";
              const studentRecord = row.student as
                | {
                    id: string;
                    school_id: string;
                    full_name: string | null;
                    first_name: string;
                    last_name: string;
                  }
                | null;
              const studentName = studentRecord
                ? getStudentDisplayName({
                    id: studentRecord.id,
                    school_id: studentRecord.school_id,
                    first_name: studentRecord.first_name,
                    last_name: studentRecord.last_name,
                    full_name: studentRecord.full_name,
                    date_of_birth: null,
                  })
                : "Sin alumno";
              return {
                id: row.id,
                date: row.date,
                status: (row.status as AttendanceStatus) ?? null,
                classroomName,
                studentName,
              };
            });
            setLatestAttendance(rows);
          } else {
            setLatestAttendance([]);
          }
        } else {
          setAttendanceToday([]);
          setLatestAttendance([]);
        }
      } catch (err) {
        if (ignore) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      ignore = true;
    };
  }, [router, supabase, typedSupabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <main className="flex flex-1 flex-col gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Panel</h1>
        {profileDetails ? (
          <p className="mt-2 text-sm text-slate-500">
            Bienvenido
            {profileDetails.display_name ? `, ${profileDetails.display_name}` : ""}. Tu rol es
            <strong> {role ?? "desconocido"}</strong>
            {profileDetails.school?.name ? ` en ${profileDetails.school.name}` : ""}.
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            Cargando información de tu perfil...
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Link href="/role" className="text-sm font-medium text-indigo-600 hover:underline">
            Ver detalle por rol
          </Link>
          <Link href="/attendance" className="text-sm font-medium text-emerald-600 hover:underline">
            Ir a asistencia
          </Link>
          <button type="button" onClick={handleSignOut} className="text-sm font-medium text-rose-600 hover:underline">
            Cerrar sesión
          </button>
        </div>
      </section>

      {error ? (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</section>
      ) : null}

      {loading ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Cargando datos...</p>
        </section>
      ) : (
        <section className="grid gap-6 md:grid-cols-2">
          <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Resumen general</h2>
            <p className="mt-2 text-sm text-slate-500">Conteos sujetos a las políticas RLS de tu rol.</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li>Total de alumnos accesibles: {totalStudents}</li>
              <li>Total de salones accesibles: {classrooms.length}</li>
            </ul>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Asistencia de hoy</h2>
            <p className="mt-2 text-sm text-slate-500">
              Conteo de estados por salón para la fecha actual.
            </p>
            {attendanceToday.length > 0 ? (
              <ul className="mt-4 space-y-3 text-sm text-slate-700">
                {attendanceToday.map((summary) => (
                  <li key={summary.classroomId} className="rounded border border-slate-100 px-3 py-2">
                    <div className="font-semibold text-slate-800">{summary.classroomName}</div>
                    <div className="mt-1 flex gap-3 text-xs text-slate-500">
                      <span>P: {summary.counts.P}</span>
                      <span>A: {summary.counts.A}</span>
                      <span>R: {summary.counts.R}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Sin registros de asistencia hoy.</p>
            )}
          </article>
        </section>
      )}

      {!loading ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Últimas asistencias capturadas</h2>
          <p className="mt-2 text-sm text-slate-500">Muestra los últimos 5 registros según tu rol.</p>
          {latestAttendance.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {latestAttendance.map((row) => (
                <li key={row.id} className="rounded border border-slate-100 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">{row.studentName}</span>
                    <span className="text-xs text-slate-500">{row.date}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>Salón: {row.classroomName}</span>
                    <span>Estado: {row.status ?? "Sin estado"}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Sin registros recientes disponibles.</p>
          )}
        </section>
      ) : null}
    </main>
  );
}
