import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type AttendanceRole = Database["public"]["Tables"]["user_profile"]["Row"]["role"];

export type AttendanceClassroom = {
  id: string;
  name: string;
};

export type AttendanceProfile = Pick<
  Database["public"]["Tables"]["user_profile"]["Row"],
  "id" | "role" | "school_id"
>;

export type AttendanceStudentRow = Pick<
  Database["public"]["Tables"]["student"]["Row"],
  "id" | "school_id" | "first_name" | "last_name" | "full_name" | "date_of_birth"
>;

export type TypedSupabaseClient = SupabaseClient<Database>;

export async function getMyProfile(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<AttendanceProfile | null> {
  const { data, error } = await supabase
    .from("user_profile")
    .select("id, role, school_id")
    .eq("id", userId)
    .maybeSingle<AttendanceProfile>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function getClassroomsForUser(
  supabase: TypedSupabaseClient,
  role: AttendanceRole | null,
  profile: AttendanceProfile | null,
): Promise<AttendanceClassroom[]> {
  if (!role || !profile) {
    return [];
  }

  if (role === "director") {
    if (!profile.school_id) {
      return [];
    }
    const { data, error } = await supabase
      .from("classroom")
      .select("id, name")
      .eq("school_id", profile.school_id)
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  if (role === "teacher") {
    const { data: assignments, error: assignmentsError } = await supabase
      .from("teacher_classroom")
      .select("classroom_id")
      .eq("teacher_id", profile.id);

    if (assignmentsError) {
      throw assignmentsError;
    }

    const classroomIds = (assignments ?? [])
      .map((assignment) => assignment.classroom_id)
      .filter((value): value is string => Boolean(value));

    if (classroomIds.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from("classroom")
      .select("id, name")
      .in("id", classroomIds)
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  if (role === "parent") {
    const { data, error } = await supabase
      .from("guardian")
      .select("student:student_id (enrollments:enrollment (classroom_id))")
      .eq("profile_id", profile.id);

    if (error) {
      throw error;
    }

    const classroomIds = new Set<string>();
    for (const row of data ?? []) {
      const student = row.student as { enrollments: { classroom_id: string | null }[] | null } | null;
      if (!student?.enrollments) continue;
      for (const enrollment of student.enrollments) {
        if (enrollment.classroom_id) {
          classroomIds.add(enrollment.classroom_id);
        }
      }
    }

    if (classroomIds.size === 0) {
      return [];
    }

    const { data: classrooms, error: classroomsError } = await supabase
      .from("classroom")
      .select("id, name")
      .in("id", Array.from(classroomIds))
      .order("name", { ascending: true });

    if (classroomsError) {
      throw classroomsError;
    }

    return classrooms ?? [];
  }

  return [];
}

export async function getStudentsForClassroom(
  supabase: TypedSupabaseClient,
  classroomId: string,
): Promise<AttendanceStudentRow[]> {
  const { data: enrollmentRows, error: enrollmentError } = await supabase
    .from("enrollment")
    .select("student_id")
    .eq("classroom_id", classroomId);

  if (enrollmentError) {
    throw enrollmentError;
  }

  const studentIds = (enrollmentRows ?? []).map((row) => row.student_id).filter((value): value is string => Boolean(value));

  if (studentIds.length === 0) {
    return [];
  }

  const { data: students, error: studentsError } = await supabase
    .from("student")
    .select("id, school_id, first_name, last_name, full_name, date_of_birth")
    .in("id", studentIds);

  if (studentsError) {
    throw studentsError;
  }

  return students ?? [];
}

export function getStudentDisplayName(student: AttendanceStudentRow): string {
  const fromFullName = student.full_name?.trim();
  if (fromFullName) {
    return fromFullName;
  }

  const names = [student.first_name, student.last_name].filter((value) => Boolean(value && value.trim()));
  return names.join(" ").trim();
}
