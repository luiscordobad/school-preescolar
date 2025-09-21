import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ThreadDetails = {
  id: string;
  title: string;
  created_at: string;
  classroom_id: string | null;
  school_id: string;
  classroom: { name: string } | null;
};

type MessageRow = {
  id: string;
  body: string;
  created_at: string;
  sender: { id: string; display_name: string | null; role: string | null } | null;
};

type SearchParams = {
  error?: string;
};

function isTeacherRole(role: string | null): boolean {
  return role === "teacher" || role === "maestra";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function MessageThreadPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: SearchParams;
}) {
  const supabase = createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const { data: thread } = await supabase
    .from("message_thread")
    .select(
      "id, title, created_at, classroom_id, school_id, classroom:classroom_id (name)",
    )
    .eq("id", params.id)
    .maybeSingle<ThreadDetails>();

  if (!thread) {
    redirect("/messages");
  }

  const { data: profile } = await supabase
    .from("user_profile")
    .select("role, school_id")
    .eq("id", session.user.id)
    .maybeSingle<{ role: string | null; school_id: string | null }>();

  const { data: guardianRows } = await supabase
    .from("guardian")
    .select("student_id")
    .eq("user_id", session.user.id);

  let guardianCanPost = false;
  const studentIds = (guardianRows ?? []).map((row) => row.student_id);
  if (thread.classroom_id && studentIds.length) {
    const { data: enrollmentRows } = await supabase
      .from("enrollment")
      .select("id")
      .eq("classroom_id", thread.classroom_id)
      .in("student_id", studentIds)
      .limit(1);
    guardianCanPost = (enrollmentRows ?? []).length > 0;
  }

  const schoolMatches =
    profile?.school_id && thread.school_id && profile.school_id === thread.school_id;

  const canPost =
    (schoolMatches && (profile?.role === "director" || isTeacherRole(profile?.role ?? null))) ||
    guardianCanPost;

  const { data: messages } = await supabase
    .from("message")
    .select("id, body, created_at, sender:sender_id (id, display_name, role)")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: true })
    .returns<MessageRow[]>();

  const errorMessage = searchParams?.error ?? null;

  async function sendMessage(formData: FormData) {
    "use server";

    const serverClient = createServerSupabaseClient();
    const {
      data: { session: serverSession },
    } = await serverClient.auth.getSession();

    if (!serverSession) {
      redirect("/login");
    }

    const body = String(formData.get("body") ?? "").trim();

    if (!body || body.length < 1) {
      redirect(`/messages/${params.id}?error=${encodeURIComponent("Escribe un mensaje para enviar.")}`);
    }

    const { data: serverProfile, error: serverProfileError } = await serverClient
      .from("user_profile")
      .select("role, school_id")
      .eq("id", serverSession.user.id)
      .maybeSingle<{ role: string | null; school_id: string | null }>();

    if (serverProfileError) {
      redirect(`/messages/${params.id}?error=${encodeURIComponent("No fue posible validar tu perfil.")}`);
    }

    const { data: serverThread } = await serverClient
      .from("message_thread")
      .select("id, classroom_id, school_id")
      .eq("id", params.id)
      .maybeSingle<{ id: string; classroom_id: string | null; school_id: string }>();

    if (!serverThread) {
      redirect("/messages");
    }

    const schoolAllowed =
      serverProfile?.school_id &&
      serverProfile.school_id === serverThread.school_id &&
      (serverProfile.role === "director" || isTeacherRole(serverProfile.role ?? null));

    let guardianAllowed = false;
    if (!schoolAllowed && serverThread.classroom_id) {
      const { data: serverGuardianRows } = await serverClient
        .from("guardian")
        .select("student_id")
        .eq("user_id", serverSession.user.id);
      const guardianStudentIds = (serverGuardianRows ?? []).map((row) => row.student_id);
      if (guardianStudentIds.length) {
        const { data: serverEnrollmentRows } = await serverClient
          .from("enrollment")
          .select("id")
          .eq("classroom_id", serverThread.classroom_id)
          .in("student_id", guardianStudentIds)
          .limit(1);
        guardianAllowed = (serverEnrollmentRows ?? []).length > 0;
      }
    }

    if (!schoolAllowed && !guardianAllowed) {
      redirect(`/messages/${params.id}?error=${encodeURIComponent("No puedes responder en este hilo.")}`);
    }

    const { error: insertError } = await serverClient.from("message").insert({
      thread_id: serverThread.id,
      sender_id: serverSession.user.id,
      body,
    });

    if (insertError) {
      redirect(`/messages/${params.id}?error=${encodeURIComponent("No se pudo enviar tu mensaje.")}`);
    }

    redirect(`/messages/${params.id}`);
  }

  return (
    <main className="flex flex-1 flex-col gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              {thread.classroom?.name ? `Salón: ${thread.classroom.name}` : "Aviso general"}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">{thread.title}</h1>
            <p className="mt-2 text-sm text-slate-500">Creado el {formatDate(thread.created_at)}</p>
          </div>
          <Link
            href="/messages"
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
          >
            Volver a la lista
          </Link>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Mensajes</h2>
        <div className="mt-4 space-y-4">
          {messages?.length ? (
            messages.map((message) => (
              <article key={message.id} className="rounded border border-slate-100 p-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium text-slate-700">
                    {message.sender?.display_name ?? "Usuario"} ({message.sender?.role ?? "rol desconocido"})
                  </span>
                  <span>{formatDate(message.created_at)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700 whitespace-pre-line">{message.body}</p>
              </article>
            ))
          ) : (
            <p className="text-sm text-slate-500">Aún no hay mensajes en este hilo.</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Responder</h2>
        {errorMessage ? <p className="mb-3 text-sm text-rose-600">{errorMessage}</p> : null}
        {canPost ? (
          <form action={sendMessage} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="body">
                Tu mensaje
              </label>
              <textarea
                id="body"
                name="body"
                required
                rows={4}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Escribe tu respuesta"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
            >
              Enviar mensaje
            </button>
          </form>
        ) : (
          <p className="text-sm text-slate-500">
            No tienes permisos para responder en este hilo, pero puedes leer los mensajes anteriores.
          </p>
        )}
      </section>
    </main>
  );
}
