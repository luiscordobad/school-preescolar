import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type SupabaseClientType = SupabaseClient<Database>;

type ClassroomRow = Pick<Database["public"]["Tables"]["classroom"]["Row"], "id" | "name">;
type StudentRow = Pick<
  Database["public"]["Tables"]["student"]["Row"],
  "id" | "first_name" | "last_name" | "date_of_birth"
>;
type TeacherOption = Pick<Database["public"]["Tables"]["user_profile"]["Row"], "id" | "display_name" | "role">;
type GuardianOption = TeacherOption;

type TeacherAssignmentRow = {
  id: string;
  teacher: TeacherOption | null;
  classroom: ClassroomRow | null;
};

type GuardianLinkRow = {
  id: string;
  relationship: string | null;
  user: GuardianOption | null;
  student: Pick<StudentRow, "id" | "first_name" | "last_name"> | null;
};

type SearchParams = {
  tab?: string;
  error?: string;
  classroomId?: string;
  studentId?: string;
};

type TabKey = "classrooms" | "students" | "teacher" | "guardians";

const tabs: { key: TabKey; label: string; description: string }[] = [
  { key: "classrooms", label: "Salones", description: "Gestiona los salones de tu escuela." },
  { key: "students", label: "Alumnos", description: "Da de alta y edita alumnos." },
  {
    key: "teacher",
    label: "Asignar maestras",
    description: "Relaciona maestras con los salones disponibles.",
  },
  {
    key: "guardians",
    label: "Vincular padres",
    description: "Asocia tutores con los alumnos registrados.",
  },
];

const allowedTeacherRoles = ["maestra", "teacher"];
const allowedGuardianRoles = ["padre", "madre", "tutor", "parent"];

export const dynamic = "force-dynamic";

function parseTab(value: string | undefined): TabKey {
  if (value === "students" || value === "teacher" || value === "guardians") {
    return value;
  }
  return "classrooms";
}

function buildAdminUrl(tab: TabKey, params: Record<string, string | null | undefined> = {}) {
  const searchParams = new URLSearchParams({ tab });
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }
  const query = searchParams.toString();
  return `/admin${query ? `?${query}` : ""}`;
}

async function ensureDirectorSession(tab: TabKey): Promise<{ supabase: SupabaseClientType; schoolId: string }> {
  const supabase = createServerSupabaseClient();
  const typedSupabase = supabase as unknown as SupabaseClientType;
  const {
    data: { session },
  } = await typedSupabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await typedSupabase
    .from("user_profile")
    .select("role, school_id")
    .eq("id", session.user.id)
    .maybeSingle<{ role: string | null; school_id: string | null }>();

  if (profileError) {
    redirect(buildAdminUrl(tab, { error: "No se pudo validar tu perfil." }));
  }

  if (profile?.role !== "director") {
    redirect("/dashboard");
  }

  const schoolId = profile?.school_id ?? null;

  if (!schoolId) {
    redirect(buildAdminUrl(tab, { error: "Necesitas asociar una escuela antes de continuar." }));
  }

  return { supabase: typedSupabase, schoolId };
}

async function saveClassroom(formData: FormData) {
  "use server";

  const tab: TabKey = "classrooms";
  const { supabase, schoolId } = await ensureDirectorSession(tab);

  const idValue = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    redirect(buildAdminUrl(tab, { classroomId: idValue || undefined, error: "El nombre del salón es obligatorio." }));
  }

  const payload: Database["public"]["Tables"]["classroom"]["Insert"] = {
    name,
    school_id: schoolId,
  };

  if (idValue) {
    payload.id = idValue;
  }

  const { error } = await supabase.from("classroom").upsert(payload);

  if (error) {
    const message = error.message || error.details || error.hint || "No se pudo guardar el salón.";
    redirect(buildAdminUrl(tab, { classroomId: idValue || undefined, error: message }));
  }

  revalidatePath("/admin");
  redirect(buildAdminUrl(tab));
}

async function saveStudent(formData: FormData) {
  "use server";

  const tab: TabKey = "students";
  const { supabase, schoolId } = await ensureDirectorSession(tab);

  const idValue = String(formData.get("id") ?? "").trim();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const dateOfBirth = String(formData.get("dateOfBirth") ?? "").trim();

  if (!firstName || !lastName) {
    redirect(
      buildAdminUrl(tab, {
        studentId: idValue || undefined,
        error: "Nombre y apellidos son obligatorios.",
      }),
    );
  }

  const payload: Database["public"]["Tables"]["student"]["Insert"] = {
    first_name: firstName,
    last_name: lastName,
    school_id: schoolId,
    date_of_birth: dateOfBirth || null,
  };

  if (idValue) {
    payload.id = idValue;
  }

  const { error } = await supabase.from("student").upsert(payload);

  if (error) {
    const message = error.message || error.details || error.hint || "No se pudo guardar el alumno.";
    redirect(buildAdminUrl(tab, { studentId: idValue || undefined, error: message }));
  }

  revalidatePath("/admin");
  redirect(buildAdminUrl(tab));
}

async function saveTeacherAssignment(formData: FormData) {
  "use server";

  const tab: TabKey = "teacher";
  const { supabase, schoolId } = await ensureDirectorSession(tab);

  const teacherId = String(formData.get("teacherId") ?? "").trim();
  const classroomId = String(formData.get("classroomId") ?? "").trim();

  if (!teacherId || !classroomId) {
    redirect(buildAdminUrl(tab, { error: "Selecciona maestra y salón." }));
  }

  const { data: classroom } = await supabase
    .from("classroom")
    .select("id")
    .eq("id", classroomId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!classroom) {
    redirect(buildAdminUrl(tab, { error: "El salón seleccionado no pertenece a tu escuela." }));
  }

  const payload: Database["public"]["Tables"]["teacher_classroom"]["Insert"] = {
    teacher_id: teacherId,
    classroom_id: classroomId,
  };

  const { error } = await supabase.from("teacher_classroom").upsert(payload, { onConflict: "teacher_id,classroom_id" });

  if (error) {
    const message = error.message || error.details || error.hint || "No se pudo asignar la maestra.";
    redirect(buildAdminUrl(tab, { error: message }));
  }

  revalidatePath("/admin");
  redirect(buildAdminUrl(tab));
}

async function saveGuardianLink(formData: FormData) {
  "use server";

  const tab: TabKey = "guardians";
  const { supabase, schoolId } = await ensureDirectorSession(tab);

  const userId = String(formData.get("userId") ?? "").trim();
  const studentId = String(formData.get("studentId") ?? "").trim();
  const relationship = String(formData.get("relationship") ?? "").trim() || null;

  if (!userId || !studentId) {
    redirect(buildAdminUrl(tab, { error: "Selecciona tutor y alumno." }));
  }

  const { data: student } = await supabase
    .from("student")
    .select("id")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!student) {
    redirect(buildAdminUrl(tab, { error: "El alumno seleccionado no pertenece a tu escuela." }));
  }

  const payload: Database["public"]["Tables"]["guardian"]["Insert"] = {
    user_id: userId,
    student_id: studentId,
    relationship,
  };

  const { error } = await supabase.from("guardian").upsert(payload, { onConflict: "user_id,student_id" });

  if (error) {
    const message = error.message || error.details || error.hint || "No se pudo vincular el tutor.";
    redirect(buildAdminUrl(tab, { error: message }));
  }

  revalidatePath("/admin");
  redirect(buildAdminUrl(tab));
}

export default async function AdminPage({ searchParams }: { searchParams?: SearchParams }) {
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

  const activeTab = parseTab(searchParams?.tab);
  const errorMessage = searchParams?.error ?? null;
  const editingClassroomId = searchParams?.classroomId ?? null;
  const editingStudentId = searchParams?.studentId ?? null;

  if (!schoolId) {
    return (
      <main className="flex flex-1 flex-col gap-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Administración escolar</h1>
          <p className="mt-2 text-sm text-slate-500">
            Necesitas asociar una escuela a tu perfil para gestionar recursos.
          </p>
        </section>
      </main>
    );
  }

  const { data: classrooms } = await supabase
    .from("classroom")
    .select("id, name")
    .eq("school_id", schoolId)
    .order("name", { ascending: true })
    .returns<ClassroomRow[]>();

  const { data: students } = await supabase
    .from("student")
    .select("id, first_name, last_name, date_of_birth")
    .eq("school_id", schoolId)
    .order("first_name", { ascending: true })
    .returns<StudentRow[]>();

  const editingClassroomResponse = editingClassroomId
    ? await supabase
        .from("classroom")
        .select("id, name")
        .eq("id", editingClassroomId)
        .eq("school_id", schoolId)
        .maybeSingle<ClassroomRow>()
    : null;
  const editingClassroom = editingClassroomResponse?.data ?? null;

  const editingStudentResponse = editingStudentId
    ? await supabase
        .from("student")
        .select("id, first_name, last_name, date_of_birth")
        .eq("id", editingStudentId)
        .eq("school_id", schoolId)
        .maybeSingle<StudentRow>()
    : null;
  const editingStudent = editingStudentResponse?.data ?? null;

  let teachers: TeacherOption[] = [];
  let teacherAssignments: TeacherAssignmentRow[] = [];

  if (activeTab === "teacher") {
    const { data: teacherRows } = await supabase
      .from("user_profile")
      .select("id, display_name, role")
      .eq("school_id", schoolId)
      .in("role", allowedTeacherRoles)
      .order("display_name", { ascending: true })
      .returns<TeacherOption[]>();
    teachers = teacherRows ?? [];

    if (classrooms?.length) {
      const classroomIds = classrooms.map((item) => item.id);
      const { data: assignmentRows } = await supabase
        .from("teacher_classroom")
        .select("id, teacher:teacher_id (id, display_name, role), classroom:classroom_id (id, name)")
        .in("classroom_id", classroomIds)
        .returns<TeacherAssignmentRow[]>();
      teacherAssignments = (assignmentRows ?? []).filter(
        (assignment) => assignment.classroom && assignment.teacher,
      );
    }
  }

  let guardians: GuardianOption[] = [];
  let guardianLinks: GuardianLinkRow[] = [];

  if (activeTab === "guardians") {
    const { data: guardianRows } = await supabase
      .from("user_profile")
      .select("id, display_name, role")
      .eq("school_id", schoolId)
      .in("role", allowedGuardianRoles)
      .order("display_name", { ascending: true })
      .returns<GuardianOption[]>();
    guardians = guardianRows ?? [];

    if (students?.length) {
      const studentIds = students.map((item) => item.id);
      const { data: guardianRowData } = await supabase
        .from("guardian")
        .select(
          "id, relationship, user:user_id (id, display_name, role), student:student_id (id, first_name, last_name)",
        )
        .in("student_id", studentIds)
        .returns<GuardianLinkRow[]>();
      guardianLinks = (guardianRowData ?? []).filter(
        (link) => link.user && link.student,
      );
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Administración escolar</h1>
        <p className="mt-2 text-sm text-slate-500">
          Gestiona recursos clave de la escuela. Solo directores tienen acceso a esta vista.
        </p>
      </section>

      <nav className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <Link
              key={tab.key}
              href={buildAdminUrl(tab.key)}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {errorMessage ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {errorMessage}
        </p>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">
          {tabs.find((tab) => tab.key === activeTab)?.label ?? ""}
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          {tabs.find((tab) => tab.key === activeTab)?.description ?? ""}
        </p>

        {activeTab === "classrooms" ? (
          <ClassroomsTab classrooms={classrooms ?? []} editingClassroom={editingClassroom} />
        ) : null}
        {activeTab === "students" ? (
          <StudentsTab students={students ?? []} editingStudent={editingStudent} />
        ) : null}
        {activeTab === "teacher" ? (
          <TeacherAssignmentsTab
            classrooms={classrooms ?? []}
            teachers={teachers}
            assignments={teacherAssignments}
          />
        ) : null}
        {activeTab === "guardians" ? (
          <GuardianLinksTab
            students={students ?? []}
            guardians={guardians}
            links={guardianLinks}
          />
        ) : null}
      </section>
    </main>
  );
}

function ClassroomsTab({
  classrooms,
  editingClassroom,
}: {
  classrooms: ClassroomRow[];
  editingClassroom: ClassroomRow | null;
}) {
  return (
    <div className="mt-6 grid gap-6 md:grid-cols-2">
      <div>
        <h3 className="text-lg font-semibold">Salones registrados</h3>
        <ul className="mt-4 space-y-2 text-sm">
          {classrooms.length ? (
            classrooms.map((classroom) => (
              <li
                key={classroom.id}
                className="flex items-center justify-between rounded border border-slate-200 px-3 py-2"
              >
                <span>{classroom.name}</span>
                <Link
                  href={buildAdminUrl("classrooms", { classroomId: classroom.id })}
                  className="text-indigo-600 hover:underline"
                >
                  Editar
                </Link>
              </li>
            ))
          ) : (
            <li className="text-slate-500">Aún no hay salones registrados.</li>
          )}
        </ul>
      </div>
      <div>
        <h3 className="text-lg font-semibold">
          {editingClassroom ? "Editar salón" : "Crear nuevo salón"}
        </h3>
        <form action={saveClassroom} className="mt-4 space-y-4">
          <input type="hidden" name="id" defaultValue={editingClassroom?.id ?? ""} />
          <div className="space-y-1">
            <label htmlFor="classroom-name" className="text-sm font-medium text-slate-600">
              Nombre del salón
            </label>
            <input
              id="classroom-name"
              name="name"
              defaultValue={editingClassroom?.name ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="Ej. Sala de osos"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Guardar
          </button>
        </form>
      </div>
    </div>
  );
}

function StudentsTab({
  students,
  editingStudent,
}: {
  students: StudentRow[];
  editingStudent: StudentRow | null;
}) {
  return (
    <div className="mt-6 grid gap-6 md:grid-cols-2">
      <div>
        <h3 className="text-lg font-semibold">Alumnos registrados</h3>
        <ul className="mt-4 space-y-2 text-sm">
          {students.length ? (
            students.map((student) => (
              <li
                key={student.id}
                className="flex items-center justify-between rounded border border-slate-200 px-3 py-2"
              >
                <span>
                  {student.first_name} {student.last_name}
                  {student.date_of_birth ? (
                    <span className="ml-2 text-xs text-slate-500">
                      {new Date(student.date_of_birth).toLocaleDateString("es-MX")}
                    </span>
                  ) : null}
                </span>
                <Link
                  href={buildAdminUrl("students", { studentId: student.id })}
                  className="text-indigo-600 hover:underline"
                >
                  Editar
                </Link>
              </li>
            ))
          ) : (
            <li className="text-slate-500">Aún no hay alumnos registrados.</li>
          )}
        </ul>
      </div>
      <div>
        <h3 className="text-lg font-semibold">
          {editingStudent ? "Editar alumno" : "Registrar nuevo alumno"}
        </h3>
        <form action={saveStudent} className="mt-4 space-y-4">
          <input type="hidden" name="id" defaultValue={editingStudent?.id ?? ""} />
          <div className="space-y-1">
            <label htmlFor="student-first-name" className="text-sm font-medium text-slate-600">
              Nombre
            </label>
            <input
              id="student-first-name"
              name="firstName"
              defaultValue={editingStudent?.first_name ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="Ej. Ana"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="student-last-name" className="text-sm font-medium text-slate-600">
              Apellidos
            </label>
            <input
              id="student-last-name"
              name="lastName"
              defaultValue={editingStudent?.last_name ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="Ej. López"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="student-date" className="text-sm font-medium text-slate-600">
              Fecha de nacimiento
            </label>
            <input
              id="student-date"
              type="date"
              name="dateOfBirth"
              defaultValue={editingStudent?.date_of_birth ?? ""}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Guardar
          </button>
        </form>
      </div>
    </div>
  );
}

function TeacherAssignmentsTab({
  classrooms,
  teachers,
  assignments,
}: {
  classrooms: ClassroomRow[];
  teachers: TeacherOption[];
  assignments: TeacherAssignmentRow[];
}) {
  return (
    <div className="mt-6 grid gap-6 md:grid-cols-2">
      <div>
        <h3 className="text-lg font-semibold">Asignaciones actuales</h3>
        <ul className="mt-4 space-y-2 text-sm">
          {assignments.length ? (
            assignments.map((assignment) => (
              <li
                key={assignment.id}
                className="rounded border border-slate-200 px-3 py-2"
              >
                <p className="font-medium text-slate-700">
                  {assignment.teacher?.display_name ?? "Sin nombre"}
                </p>
                <p className="text-xs text-slate-500">{assignment.classroom?.name}</p>
              </li>
            ))
          ) : (
            <li className="text-slate-500">No hay maestras asignadas.</li>
          )}
        </ul>
      </div>
      <div>
        <h3 className="text-lg font-semibold">Asignar maestra a salón</h3>
        <form action={saveTeacherAssignment} className="mt-4 space-y-4">
          <div className="space-y-1">
            <label htmlFor="teacher-select" className="text-sm font-medium text-slate-600">
              Maestra
            </label>
            <select
              id="teacher-select"
              name="teacherId"
              defaultValue=""
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="" disabled>
                Selecciona una maestra
              </option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.display_name ?? "Sin nombre"} ({teacher.role})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="classroom-select" className="text-sm font-medium text-slate-600">
              Salón
            </label>
            <select
              id="classroom-select"
              name="classroomId"
              defaultValue=""
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="" disabled>
                Selecciona un salón
              </option>
              {classrooms.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Guardar
          </button>
        </form>
      </div>
    </div>
  );
}

function GuardianLinksTab({
  students,
  guardians,
  links,
}: {
  students: StudentRow[];
  guardians: GuardianOption[];
  links: GuardianLinkRow[];
}) {
  return (
    <div className="mt-6 grid gap-6 md:grid-cols-2">
      <div>
        <h3 className="text-lg font-semibold">Tutores registrados</h3>
        <ul className="mt-4 space-y-2 text-sm">
          {links.length ? (
            links.map((link) => (
              <li key={link.id} className="rounded border border-slate-200 px-3 py-2">
                <p className="font-medium text-slate-700">
                  {link.user?.display_name ?? "Sin nombre"}
                </p>
                <p className="text-xs text-slate-500">
                  {link.student ? `${link.student.first_name} ${link.student.last_name}` : ""}
                </p>
                {link.relationship ? (
                  <p className="text-xs text-slate-400">Relación: {link.relationship}</p>
                ) : null}
              </li>
            ))
          ) : (
            <li className="text-slate-500">No hay tutores vinculados.</li>
          )}
        </ul>
      </div>
      <div>
        <h3 className="text-lg font-semibold">Vincular tutor con alumno</h3>
        <form action={saveGuardianLink} className="mt-4 space-y-4">
          <div className="space-y-1">
            <label htmlFor="guardian-select" className="text-sm font-medium text-slate-600">
              Tutor
            </label>
            <select
              id="guardian-select"
              name="userId"
              defaultValue=""
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="" disabled>
                Selecciona un tutor
              </option>
              {guardians.map((guardian) => (
                <option key={guardian.id} value={guardian.id}>
                  {guardian.display_name ?? "Sin nombre"} ({guardian.role})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="guardian-student-select" className="text-sm font-medium text-slate-600">
              Alumno
            </label>
            <select
              id="guardian-student-select"
              name="studentId"
              defaultValue=""
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="" disabled>
                Selecciona un alumno
              </option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.first_name} {student.last_name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="guardian-relationship" className="text-sm font-medium text-slate-600">
              Relación
            </label>
            <input
              id="guardian-relationship"
              name="relationship"
              placeholder="Ej. Madre"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Guardar
          </button>
        </form>
      </div>
    </div>
  );
}
