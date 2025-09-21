import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ClassroomIdRow = Pick<Database["public"]["Tables"]["classroom"]["Row"], "id">;
type StudentIdRow = Pick<Database["public"]["Tables"]["student"]["Row"], "id">;

export const dynamic = "force-dynamic";

export default async function AdminDebugPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("user_profile")
    .select("role, school_id")
    .eq("id", session.user.id)
    .maybeSingle<{ role: string | null; school_id: string | null }>();

  if (profile?.role !== "director") {
    redirect("/dashboard");
  }

  const schoolId = profile?.school_id ?? null;

  if (!schoolId) {
    return (
      <main className="flex flex-1 flex-col gap-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Debug administración</h1>
          <p className="mt-2 text-sm text-slate-500">Asigna una escuela al perfil del director.</p>
        </section>
      </main>
    );
  }

  const { data: classroomRows } = await supabase
    .from("classroom")
    .select("id")
    .eq("school_id", schoolId)
    .returns<ClassroomIdRow[]>();

  const { data: studentRows } = await supabase
    .from("student")
    .select("id")
    .eq("school_id", schoolId)
    .returns<StudentIdRow[]>();

  let teacherClassroomCount = 0;
  let guardianCount = 0;

  const classroomIds = (classroomRows ?? []).map((row) => row.id);
  const studentIds = (studentRows ?? []).map((row) => row.id);

  if (classroomIds.length) {
    const { data: teacherAssignments } = await supabase
      .from("teacher_classroom")
      .select("id")
      .in("classroom_id", classroomIds);
    teacherClassroomCount = teacherAssignments?.length ?? 0;
  }

  if (studentIds.length) {
    const { data: guardianRows } = await supabase
      .from("guardian")
      .select("id")
      .in("student_id", studentIds);
    guardianCount = guardianRows?.length ?? 0;
  }

  const payload = {
    role: profile.role,
    school_id: schoolId,
    counts: {
      classrooms: classroomIds.length,
      students: studentIds.length,
      teacherClassroom: teacherClassroomCount,
      guardian: guardianCount,
    },
  };

  return (
    <main className="flex flex-1 flex-col gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Debug administración</h1>
        <pre className="mt-4 overflow-x-auto rounded bg-slate-900 p-4 text-sm text-slate-100">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </section>
    </main>
  );
}
