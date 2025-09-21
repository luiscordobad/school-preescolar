import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type AttendanceRole = Database["public"]["Tables"]["user_profile"]["Row"]["role"];

export type AttendanceClassroom = {
  id: string;
  name: string;
};

export type TypedSupabaseClient = SupabaseClient<Database>;

export type AttendanceStudent = {
  id: string;
  firstName: string;
  lastName: string;
};

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

  if (role === "teacher" || role === "maestra") {
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

export async function fetchAccessibleStudents(
  supabase: TypedSupabaseClient,
  role: AttendanceRole | null,
  userId: string,
  schoolId: string | null,
  classroomIds: string[] = [],
): Promise<AttendanceStudent[]> {
  if (!role) {
    return [];
  }

  if (role === "director") {
    if (!schoolId) {
      return [];
    }
    const { data, error } = await supabase
      .from("student")
      .select("id, first_name, last_name")
      .eq("school_id", schoolId)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });
    if (error) {
      throw error;
    }
    return (data ?? []).map((row) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
    }));
  }

  if (role === "teacher" || role === "maestra") {
    if (!classroomIds.length) {
      return [];
    }
    const { data, error } = await supabase
      .from("enrollment")
      .select("student:student_id (id, first_name, last_name)")
      .in("classroom_id", classroomIds);
    if (error) {
      throw error;
    }
    const map = new Map<string, AttendanceStudent>();
    for (const item of data ?? []) {
      const student = item.student as { id: string; first_name: string; last_name: string } | null;
      if (!student) {
        continue;
      }
      map.set(student.id, {
        id: student.id,
        firstName: student.first_name,
        lastName: student.last_name,
      });
    }
    return Array.from(map.values()).sort((a, b) => {
      const lastNameComparison = a.lastName.localeCompare(b.lastName, "es", { sensitivity: "base" });
      if (lastNameComparison !== 0) {
        return lastNameComparison;
      }
      return a.firstName.localeCompare(b.firstName, "es", { sensitivity: "base" });
    });
  }

  const { data, error } = await supabase
    .from("guardian")
    .select("student:student_id (id, first_name, last_name)")
    .eq("user_id", userId);
  if (error) {
    throw error;
  }
  const map = new Map<string, AttendanceStudent>();
  for (const guardian of data ?? []) {
    const student = guardian.student as { id: string; first_name: string; last_name: string } | null;
    if (!student) {
      continue;
    }
    map.set(student.id, {
      id: student.id,
      firstName: student.first_name,
      lastName: student.last_name,
    });
  }
  return Array.from(map.values()).sort((a, b) => {
    const lastNameComparison = a.lastName.localeCompare(b.lastName, "es", { sensitivity: "base" });
    if (lastNameComparison !== 0) {
      return lastNameComparison;
    }
    return a.firstName.localeCompare(b.firstName, "es", { sensitivity: "base" });
  });
}
