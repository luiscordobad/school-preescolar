import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ThreadListItem = {
  id: string;
  title: string;
  created_at: string;
  classroom: { name: string } | null;
  messages: { body: string; created_at: string }[] | null;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function MessagesPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const { data: threads } = await supabase
    .from("message_thread")
    .select(
      "id, title, created_at, classroom:classroom_id(name), messages:message(order=created_at.desc,limit=1)(body, created_at)",
    )
    .order("created_at", { ascending: false })
    .returns<ThreadListItem[]>();

  return (
    <main className="flex flex-1 flex-col gap-6">
      <section className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold">Mensajes y avisos</h1>
          <p className="mt-2 text-sm text-slate-500">
            Consulta los avisos generales de la escuela y los mensajes por salón.
          </p>
        </div>
        <Link
          href="/messages/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
        >
          Nuevo aviso
        </Link>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Hilos disponibles</h2>
        <p className="mt-2 text-sm text-slate-500">
          Solo se muestran los hilos que puedes ver según tus permisos.
        </p>
        <ul className="mt-4 space-y-3">
          {threads?.length ? (
            threads.map((thread) => {
              const lastMessage = thread.messages?.[0] ?? null;
              return (
                <li key={thread.id} className="rounded border border-slate-100 p-4 transition hover:border-indigo-200">
                  <Link href={`/messages/${thread.id}`} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium uppercase tracking-wide text-indigo-600">
                          {thread.classroom?.name ? `Salón: ${thread.classroom.name}` : "Aviso general"}
                        </p>
                        <h3 className="text-lg font-semibold text-slate-900">{thread.title}</h3>
                      </div>
                      <span className="text-xs text-slate-500">{formatDate(thread.created_at)}</span>
                    </div>
                    {lastMessage ? (
                      <p className="text-sm text-slate-600">
                        {lastMessage.body}
                      </p>
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
