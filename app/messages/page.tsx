"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

type SupabaseClient = ReturnType<typeof createClientSupabaseClient>;

type ThreadMessageRow = { body: string; created_at: string };

type ThreadListItem = {
  id: string;
  title: string;
  created_at: string;
  classroom_id: string | null;
  classroom: { id: string; name: string } | null;
  messages: ThreadMessageRow[] | null;
};

type ClassroomOption = {
  id: string;
  name: string;
};

type ProfileInfo = Pick<
  Database["public"]["Tables"]["user_profile"]["Row"],
  "role" | "school_id"
>;

type TeacherClassroomRow = {
  classroom: ClassroomOption | null;
};

type GuardianStudentRow = {
  student_id: string;
};

type EnrollmentClassroomRow = {
  classroom_id: string;
};

type FetchThreadsResult = {
  threads: ThreadListItem[];
  error: string | null;
};

const THREAD_FIELDS =
  "id, title, classroom_id, created_at, classroom:classroom_id (id, name), messages:message(order=created_at.desc,limit=1)(body, created_at)";

function formatDate(value: string) {
  return new Date(value).toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getErrorMessage(error: unknown): string {
  if (!error) {
    return "Ocurrió un error desconocido.";
  }
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  const info = error as { message?: string; details?: string; hint?: string };
  return info.message || info.details || info.hint || "Ocurrió un error desconocido.";
}

function isTeacherRole(role: string | null): boolean {
  return role === "teacher" || role === "maestra";
}

async function getAccessibleClassrooms(
  supabase: SupabaseClient,
  role: string | null,
  userId: string,
  schoolId: string | null,
): Promise<ClassroomOption[]> {
  if (!role || !schoolId) {
    return [];
  }

  if (role === "director") {
    const { data, error } = await supabase
      .from("classroom")
      .select("id, name")
      .eq("school_id", schoolId)
      .order("name", { ascending: true })
      .returns<ClassroomOption[]>();
    if (error) {
      throw error;
    }
    return data ?? [];
  }

  if (isTeacherRole(role)) {
    const { data, error } = await supabase
      .from("teacher_classroom")
      .select("classroom:classroom_id (id, name)")
      .eq("teacher_id", userId)
      .returns<TeacherClassroomRow[]>();
    if (error) {
      throw error;
    }
    const map = new Map<string, ClassroomOption>();
    for (const row of data ?? []) {
      const classroom = row.classroom;
      if (classroom) {
        map.set(classroom.id, classroom);
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
    );
  }

  const { data, error } = await supabase
    .from("guardian")
    .select("student_id")
    .eq("user_id", userId)
    .returns<GuardianStudentRow[]>();
  if (error) {
    throw error;
  }
  const studentIds = (data ?? []).map((row) => row.student_id);
  if (!studentIds.length) {
    return [];
  }
  const { data: enrollments, error: enrollmentError } = await supabase
    .from("enrollment")
    .select("classroom_id")
    .eq("school_id", schoolId)
    .in("student_id", studentIds)
    .returns<EnrollmentClassroomRow[]>();
  if (enrollmentError) {
    throw enrollmentError;
  }
  const map = new Map<string, ClassroomOption>();
  for (const row of enrollments ?? []) {
    const classroomId = row.classroom_id;
    if (!classroomId) continue;
    map.set(classroomId, { id: classroomId, name: "" });
  }
  if (map.size === 0) {
    return [];
  }
  const ids = Array.from(map.keys());
  const { data: classroomRows, error: classroomError } = await supabase
    .from("classroom")
    .select("id, name")
    .in("id", ids)
    .order("name", { ascending: true })
    .returns<ClassroomOption[]>();
  if (classroomError) {
    throw classroomError;
  }
  return classroomRows ?? [];
}

async function fetchThreads(
  supabase: SupabaseClient,
  role: string | null,
  schoolId: string | null,
  userId: string | null,
  selectedClassroomId: string,
): Promise<FetchThreadsResult> {
  if (!userId) {
    return { threads: [], error: "Inicia sesión para ver los avisos." };
  }

  try {
    if (selectedClassroomId === "general") {
      if (!schoolId) {
        return { threads: [], error: null };
      }
      const { data, error } = await supabase
        .from("message_thread")
        .select(THREAD_FIELDS)
        .eq("school_id", schoolId)
        .is("classroom_id", null)
        .order("created_at", { ascending: false })
        .limit(20)
        .returns<ThreadListItem[]>();
      if (error) {
        throw error;
      }
      return { threads: data ?? [], error: null };
    }

    if (selectedClassroomId !== "all") {
      const { data, error } = await supabase
        .from("message_thread")
        .select(THREAD_FIELDS)
        .eq("classroom_id", selectedClassroomId)
        .order("created_at", { ascending: false })
        .limit(50)
        .returns<ThreadListItem[]>();
      if (error) {
        throw error;
      }
      return { threads: data ?? [], error: null };
    }

    const queries: Promise<ThreadListItem[]>[] = [];

    if (schoolId) {
      const generalPromise = supabase
        .from("message_thread")
        .select(THREAD_FIELDS)
        .eq("school_id", schoolId)
        .is("classroom_id", null)
        .order("created_at", { ascending: false })
        .limit(20)
        .returns<ThreadListItem[]>()
        .then((result) => {
          if (result.error) {
            throw result.error;
          }
          return result.data ?? [];
        });
      queries.push(Promise.resolve(generalPromise));
    }

    const isDirector = role === "director";

    if (isDirector && schoolId) {
      const classPromise = supabase
        .from("message_thread")
        .select(THREAD_FIELDS)
        .eq("school_id", schoolId)
        .not("classroom_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(50)
        .returns<ThreadListItem[]>()
        .then((result) => {
          if (result.error) {
            throw result.error;
          }
          return result.data ?? [];
        });
      queries.push(Promise.resolve(classPromise));
    } else if (isTeacherRole(role)) {
      const { data: teacherClassrooms, error: teacherError } = await supabase
        .from("teacher_classroom")
        .select("classroom_id")
        .eq("teacher_id", userId)
        .returns<{ classroom_id: string | null }[]>();
      if (teacherError) {
        throw teacherError;
      }
      const classroomIds = (teacherClassrooms ?? [])
        .map((row) => row.classroom_id)
        .filter((value): value is string => Boolean(value));
      if (classroomIds.length) {
        const classPromise = supabase
          .from("message_thread")
          .select(THREAD_FIELDS)
          .in("classroom_id", classroomIds)
          .order("created_at", { ascending: false })
          .limit(50)
          .returns<ThreadListItem[]>()
          .then((result) => {
            if (result.error) {
              throw result.error;
            }
            return result.data ?? [];
          });
        queries.push(Promise.resolve(classPromise));
      }
    } else {
      const { data: guardianLinks, error: guardianError } = await supabase
        .from("guardian")
        .select("student_id")
        .eq("user_id", userId)
        .returns<GuardianStudentRow[]>();
      if (guardianError) {
        throw guardianError;
      }
      const studentIds = (guardianLinks ?? []).map((row) => row.student_id);
      if (studentIds.length) {
        const { data: enrollments, error: enrollmentError } = await supabase
          .from("enrollment")
          .select("classroom_id")
          .in("student_id", studentIds)
          .returns<EnrollmentClassroomRow[]>();
        if (enrollmentError) {
          throw enrollmentError;
        }
        const classroomIds = Array.from(
          new Set((enrollments ?? []).map((row) => row.classroom_id).filter((value): value is string => Boolean(value))),
        );
        if (classroomIds.length) {
          const classPromise = supabase
            .from("message_thread")
            .select(THREAD_FIELDS)
            .in("classroom_id", classroomIds)
            .order("created_at", { ascending: false })
            .limit(50)
            .returns<ThreadListItem[]>()
            .then((result) => {
              if (result.error) {
                throw result.error;
              }
              return result.data ?? [];
            });
          queries.push(Promise.resolve(classPromise));
        }
      }
    }

    if (!queries.length) {
      return { threads: [], error: null };
    }

    const results = await Promise.all(queries);
    const threads = results
      .flat()
      .sort((a, b) => {
        if (a.created_at === b.created_at) {
          return 0;
        }
        return a.created_at > b.created_at ? -1 : 1;
      });
    return { threads, error: null };
  } catch (error) {
    return { threads: [], error: getErrorMessage(error) };
  }
}

export default function MessagesPage() {
  const supabase = useMemo(() => createClientSupabaseClient(), []);
  const router = useRouter();
  const [initializing, setInitializing] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [classrooms, setClassrooms] = useState<ClassroomOption[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>("all");
  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const canCreate = role === "director" || isTeacherRole(role);

  useEffect(() => {
    let ignore = false;
    async function bootstrap() {
      setInitializing(true);
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) {
          throw userError;
        }
        if (!user) {
          router.replace("/login");
          return;
        }
        if (ignore) return;
        setUserId(user.id);

        const { data: profile, error: profileError } = await supabase
          .from("user_profile")
          .select("role, school_id")
          .eq("id", user.id)
          .maybeSingle<ProfileInfo>();
        if (profileError) {
          throw profileError;
        }
        if (ignore) return;
        const currentRole = profile?.role ?? null;
        const currentSchoolId = profile?.school_id ?? null;
        setRole(currentRole);
        setSchoolId(currentSchoolId);

        const accessible = await getAccessibleClassrooms(
          supabase,
          currentRole,
          user.id,
          currentSchoolId,
        );
        if (ignore) return;
        setClassrooms(accessible);
        setSelectedClassroomId((previous) => {
          if (previous === "all" || previous === "general") {
            return previous;
          }
          return accessible.some((classroom) => classroom.id === previous) ? previous : "all";
        });
      } catch (error) {
        if (ignore) return;
        setLastError(getErrorMessage(error));
      } finally {
        if (!ignore) {
          setInitializing(false);
        }
      }
    }
    bootstrap();
    return () => {
      ignore = true;
    };
  }, [router, supabase]);

  useEffect(() => {
    let ignore = false;
    async function loadThreads() {
      if (initializing) {
        return;
      }
      setThreadsLoading(true);
      setLastError(null);
      const { threads: fetchedThreads, error } = await fetchThreads(
        supabase,
        role,
        schoolId,
        userId,
        selectedClassroomId,
      );
      if (ignore) return;
      if (error) {
        setLastError(error);
      }
      setThreads(fetchedThreads);
      setThreadsLoading(false);
    }
    loadThreads();
    return () => {
      ignore = true;
    };
  }, [initializing, role, schoolId, selectedClassroomId, supabase, userId]);

  const newThreadHref = (() => {
    if (!canCreate) {
      return null;
    }
    const params = new URLSearchParams();
    if (selectedClassroomId !== "all" && selectedClassroomId !== "general") {
      params.set("classroomId", selectedClassroomId);
    }
    const query = params.toString();
    return query ? `/messages/new?${query}` : "/messages/new";
  })();

  const showLoading = initializing || threadsLoading;

  return (
    <main className="flex flex-1 flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mensajes y avisos</h1>
          <p className="mt-2 text-sm text-slate-500">
            Consulta los avisos generales de la escuela y los mensajes por salón.
          </p>
        </div>
        {initializing ? (
          <p className="text-sm text-slate-400">Validando permisos...</p>
        ) : canCreate && newThreadHref ? (
          <Link
            href={newThreadHref}
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
          >
            Nuevo aviso
          </Link>
        ) : (
          <p className="text-sm text-slate-400">Solo directores y maestras pueden crear avisos.</p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Hilos disponibles</h2>
            <p className="mt-2 text-sm text-slate-500">
              Solo se muestran los hilos que puedes ver según tus permisos.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="text-sm font-medium text-slate-700" htmlFor="classroom-filter">
              Filtrar por salón
            </label>
            <select
              id="classroom-filter"
              name="classroom-filter"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:w-48"
              value={selectedClassroomId}
              onChange={(event) => setSelectedClassroomId(event.target.value)}
            >
              <option value="all">Todos</option>
              <option value="general">Generales</option>
              {classrooms.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {lastError ? (
          <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{lastError}</p>
        ) : null}

        <ul className="mt-4 space-y-3">
          {showLoading ? (
            <li className="rounded border border-dashed border-slate-200 p-4 text-sm text-slate-400">
              Cargando avisos...
            </li>
          ) : threads.length ? (
            threads.map((thread) => {
              const lastMessage = thread.messages?.[0] ?? null;
              return (
                <li key={thread.id} className="rounded border border-slate-100 p-4 transition hover:border-indigo-200">
                  <Link href={`/messages/${thread.id}`} className="flex flex-col gap-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium uppercase tracking-wide text-indigo-600">
                          {thread.classroom?.name ? `Salón: ${thread.classroom.name}` : "Aviso general"}
                        </p>
                        <h3 className="text-lg font-semibold text-slate-900">{thread.title}</h3>
                      </div>
                      <span className="text-xs text-slate-500">{formatDate(thread.created_at)}</span>
                    </div>
                    {lastMessage ? (
                      <p className="text-sm text-slate-600">{lastMessage.body}</p>
                    ) : (
                      <p className="text-sm italic text-slate-400">Sin mensajes</p>
                    )}
                  </Link>
                </li>
              );
            })
          ) : (
            <li className="rounded border border-dashed border-slate-200 p-4 text-sm text-slate-400">
              No hay avisos disponibles por el momento.
            </li>
          )}
        </ul>
      </section>
    </main>
  );
}

