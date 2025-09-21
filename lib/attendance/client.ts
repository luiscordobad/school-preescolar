import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type AttendanceRole = Database["public"]["Tables"]["user_profile"]["Row"]["role"];

export type AttendanceClassroom = {
  id: string;
  name: string;
};

export type TypedSupabaseClient = SupabaseClient<Database>;

export async function fetchAccessibleClassrooms(
  supabase: TypedSupabaseClient,
  role: AttendanceRole | null,
  userId: string,
  schoolId: string | null
): Promise<AttendanceClassroom[]> {
  if (!role) {
    return [];
  }

  if (role === "director") {
    if (!schoolId) {
      return [];
    }
    const { data, error } = await supabase
      .from("classroom")
      .select("id, name")
      .eq("school_id", schoolId)
      .order("name", { ascending: true });
    if (error) {
      throw error;
    }
    return data ?? [];
  }

  if (role === "teacher") {
    const { data, error } = await supabase
      .from("teacher_classroom")
      .select("classroom:classroom_id (id, name)")
      .eq("teacher_id", userId);
    if (error) {
      throw error;
    }
    const map = new Map<string, AttendanceClassroom>();
    for (const item of data ?? []) {
      const classroom = item.classroom as { id: string; name: string } | null;
      if (classroom) {
        map.set(classroom.id, classroom);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  // Guardian role
  const { data, error } = await supabase
    .from("guardian")
    .select(
      "student:student_id (enrollments:enrollment (classroom:classroom_id (id, name)))",
    )
    .eq("user_id", userId);
  if (error) {
    throw error;
  }
  const map = new Map<string, AttendanceClassroom>();
  for (const guardian of data ?? []) {
    const student = guardian.student as
      | {
          enrollments: { classroom: { id: string; name: string } | null }[] | null;
        }
      | null;
    if (!student?.enrollments) {
      continue;
    }
    for (const enrollment of student.enrollments) {
      const classroom = enrollment.classroom;
      if (classroom) {
        map.set(classroom.id, classroom);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}
