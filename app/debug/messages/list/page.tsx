import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = {
  selectedClassroomId?: string;
};

type Totals = {
  general: number;
  porSalon: number;
};

type ProfileInfo = {
  role: string | null;
  school_id: string | null;
};

type TeacherClassroomRow = {
  classroom_id: string | null;
};

type GuardianStudentRow = {
  student_id: string;
};

type EnrollmentClassroomRow = {
  classroom_id: string;
};

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

export default async function DebugMessagesListPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const supabase = createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const selectedClassroomIdParam =
    searchParams && typeof searchParams.selectedClassroomId === "string"
      ? searchParams.selectedClassroomId.trim()
      : "";
  const selectedClassroomId = selectedClassroomIdParam || null;

  let role: string | null = null;
  const totals: Totals = { general: 0, porSalon: 0 };
  let lastError: string | null = null;

  try {
    const { data: profile, error: profileError } = await supabase
      .from("user_profile")
      .select("role, school_id")
      .eq("id", session.user.id)
      .maybeSingle<ProfileInfo>();
    if (profileError) {
      throw profileError;
    }
    role = profile?.role ?? null;
    const schoolId = profile?.school_id ?? null;

    if (selectedClassroomId === "general") {
      if (schoolId) {
        const { count, error } = await supabase
          .from("message_thread")
          .select("id", { count: "exact", head: true })
          .eq("school_id", schoolId)
          .is("classroom_id", null);
        if (error) {
          throw error;
        }
        totals.general = count ?? 0;
      }
    } else if (selectedClassroomId && selectedClassroomId !== "all") {
      const { count, error } = await supabase
        .from("message_thread")
        .select("id", { count: "exact", head: true })
        .eq("classroom_id", selectedClassroomId);
      if (error) {
        throw error;
      }
      totals.porSalon = count ?? 0;
    } else {
      if (schoolId) {
        const { count, error } = await supabase
          .from("message_thread")
          .select("id", { count: "exact", head: true })
          .eq("school_id", schoolId)
          .is("classroom_id", null);
        if (error) {
          throw error;
        }
        totals.general = count ?? 0;
      }

      if (role === "director" && schoolId) {
        const { count, error } = await supabase
          .from("message_thread")
          .select("id", { count: "exact", head: true })
          .eq("school_id", schoolId)
          .not("classroom_id", "is", null);
        if (error) {
          throw error;
        }
        totals.porSalon = count ?? 0;
      } else if (isTeacherRole(role)) {
        const { data: teacherClassrooms, error: teacherError } = await supabase
          .from("teacher_classroom")
          .select("classroom_id")
          .eq("teacher_id", session.user.id)
          .returns<TeacherClassroomRow[]>();
        if (teacherError) {
          throw teacherError;
        }
        const classroomIds = (teacherClassrooms ?? [])
          .map((row) => row.classroom_id)
          .filter((value): value is string => Boolean(value));
        if (classroomIds.length) {
          const { count, error } = await supabase
            .from("message_thread")
            .select("id", { count: "exact", head: true })
            .in("classroom_id", classroomIds);
          if (error) {
            throw error;
          }
          totals.porSalon = count ?? 0;
        }
      } else {
        const { data: guardianLinks, error: guardianError } = await supabase
          .from("guardian")
          .select("student_id")
          .eq("user_id", session.user.id)
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
            const { count, error } = await supabase
              .from("message_thread")
              .select("id", { count: "exact", head: true })
              .in("classroom_id", classroomIds);
            if (error) {
              throw error;
            }
            totals.porSalon = count ?? 0;
          }
        }
      }
    }
  } catch (error) {
    lastError = getErrorMessage(error);
  }

  return (
    <main className="flex flex-1 flex-col gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Debug mensajes - lista</h1>
        <p className="mt-2 text-sm text-slate-500">
          Información para validar los filtros aplicados en la lista de mensajes.
        </p>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <pre className="whitespace-pre-wrap text-sm text-slate-700">
          {JSON.stringify(
            {
              role,
              selectedClassroomId,
              totals,
              lastError,
            },
            null,
            2,
          )}
        </pre>
      </section>
    </main>
  );
}

