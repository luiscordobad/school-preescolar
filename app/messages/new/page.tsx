import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { NewThreadForm } from "../NewThreadForm";

export const dynamic = "force-dynamic";

type ClassroomOption = {
  id: string;
  name: string;
};

type TeacherClassroomRow = {
  classroom: ClassroomOption | null;
};

type GuardianStudentRow = {
  student_id: string;
};

type EnrollmentClassroomRow = {
  classroom: ClassroomOption | null;
};

type SearchParams = {
  error?: string;
  classroomId?: string;
};

function encodeError(message: string) {
  return `/messages/new?error=${encodeURIComponent(message)}`;
}

function isTeacherRole(role: string | null): boolean {
  return role === "teacher" || role === "maestra";
}

async function getAccessibleClassrooms(
  supabase: ReturnType<typeof createServerSupabaseClient>,
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
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
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
    .select("classroom:classroom_id (id, name)")
    .eq("school_id", schoolId)
    .in("student_id", studentIds)
    .returns<EnrollmentClassroomRow[]>();
  if (enrollmentError) {
    throw enrollmentError;
  }
  const map = new Map<string, ClassroomOption>();
  for (const row of enrollments ?? []) {
    const classroom = row.classroom;
    if (classroom) {
      map.set(classroom.id, classroom);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
}

export default async function NewMessagePage({ searchParams }: { searchParams?: SearchParams }) {
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

  const role = profile?.role ?? null;
  const schoolId = profile?.school_id ?? null;

  const canCreate = role === "director" || isTeacherRole(role);

  if (!canCreate) {
    return (
      <main className="flex flex-1 flex-col gap-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Nuevo aviso</h1>
          <p className="mt-2 text-sm text-slate-500">
            Solo directores y maestras pueden crear avisos.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Puedes regresar a la lista de avisos desde{" "}
            <a href="/messages" className="font-medium text-indigo-600 hover:underline">
              mensajes y avisos
            </a>
            .
          </p>
        </section>
      </main>
    );
  }

  const classrooms = await getAccessibleClassrooms(supabase, role, session.user.id, schoolId);
  const errorMessage = searchParams?.error ?? null;
  const requestedClassroomId =
    searchParams && typeof searchParams.classroomId === "string" && searchParams.classroomId
      ? searchParams.classroomId
      : null;
  const preselectedClassroomId = requestedClassroomId && classrooms.some((room) => room.id === requestedClassroomId)
    ? requestedClassroomId
    : null;
  const invalidClassroomRequested = Boolean(requestedClassroomId && !preselectedClassroomId);
  const allowGeneral = role === "director";

  async function createThread(formData: FormData) {
    "use server";

    const serverClient = createServerSupabaseClient();
    const {
      data: { session: serverSession },
    } = await serverClient.auth.getSession();

    if (!serverSession) {
      redirect("/login");
    }

    const type = String(formData.get("type") ?? "");
    const title = String(formData.get("title") ?? "").trim();
    const body = String(formData.get("body") ?? "").trim();
    const classroomIdValue = formData.get("classroomId");

    if (!title || title.length < 3) {
      redirect(encodeError("El título debe tener al menos 3 caracteres."));
    }

    if (!body || body.length < 5) {
      redirect(encodeError("El mensaje debe tener al menos 5 caracteres."));
    }

    const { data: serverProfile, error: profileError } = await serverClient
      .from("user_profile")
      .select("role, school_id")
      .eq("id", serverSession.user.id)
      .maybeSingle<{ role: string | null; school_id: string | null }>();

    if (profileError) {
      redirect(encodeError("No fue posible validar tu perfil."));
    }

    const currentRole = serverProfile?.role ?? null;
    const currentSchoolId = serverProfile?.school_id ?? null;

    if (!currentRole || !currentSchoolId) {
      redirect(encodeError("Necesitas pertenecer a una escuela para publicar avisos."));
    }

    if (currentRole !== "director" && !isTeacherRole(currentRole)) {
      redirect(encodeError("No tienes permisos para crear avisos."));
    }

    const allowedClassrooms = await getAccessibleClassrooms(
      serverClient,
      currentRole,
      serverSession.user.id,
      currentSchoolId,
    );

    let classroomId: string | null = null;

    if (type === "classroom") {
      const selected = typeof classroomIdValue === "string" ? classroomIdValue : "";
      if (!selected) {
        redirect(encodeError("Selecciona un salón para el aviso."));
      }
      if (!allowedClassrooms.some((classroom) => classroom.id === selected)) {
        redirect(encodeError("No tienes acceso a ese salón."));
      }
      classroomId = selected;
    } else if (type === "general") {
      if (currentRole !== "director") {
        redirect(encodeError("Solo la dirección puede crear avisos generales."));
      }
    } else {
      redirect(encodeError("Selecciona un tipo de aviso válido."));
    }

    const threadPayload = {
      school_id: currentSchoolId,
      classroom_id: classroomId,
      title,
      created_by: serverSession.user.id,
    } satisfies Database["public"]["Tables"]["message_thread"]["Insert"];

    const { data: thread, error: threadError } = await (serverClient.from("message_thread") as any)
      .insert(threadPayload)
      .select("id")
      .single();

    if (threadError || !thread) {
      redirect(encodeError("No fue posible crear el aviso."));
    }

    const initialMessagePayload = {
      thread_id: thread.id,
      sender_id: serverSession.user.id,
      body,
    } satisfies Database["public"]["Tables"]["message"]["Insert"];

    const { error: messageError } = await (serverClient.from("message") as any).insert(initialMessagePayload);

    if (messageError) {
      redirect(encodeError("El aviso se creó sin mensaje. Intenta nuevamente."));
    }

    redirect(`/messages/${thread.id}`);
  }

  return (
    <main className="flex flex-1 flex-col gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Nuevo aviso</h1>
        <p className="mt-2 text-sm text-slate-500">
          Crea un nuevo hilo de mensajes para compartir información con tu comunidad escolar.
        </p>
        <div className="mt-6">
          {!allowGeneral && classrooms.length === 0 ? (
            <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              No tienes salones asignados actualmente. Comunícate con la dirección si necesitas acceso para publicar avisos.
            </p>
          ) : null}
          {invalidClassroomRequested ? (
            <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              El salón seleccionado ya no está disponible. Puedes elegir otro en el formulario.
            </p>
          ) : null}
          <NewThreadForm
            classrooms={classrooms}
            action={createThread}
            errorMessage={errorMessage}
            allowGeneral={allowGeneral}
            defaultType={preselectedClassroomId ? "classroom" : undefined}
            defaultClassroomId={preselectedClassroomId}
          />
        </div>
      </section>
    </main>
  );
}
