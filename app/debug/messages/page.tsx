import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DebugMessagesPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  let role: string | null = null;
  let threadsCount: number | null = null;
  let sampleThread: unknown = null;
  let lastError: string | null = null;

  try {
    const { data: profile, error: profileError } = await supabase
      .from("user_profile")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle<{ role: string | null }>();
    if (profileError) {
      throw profileError;
    }
    role = profile?.role ?? null;

    const { count, error: countError } = await supabase
      .from("message_thread")
      .select("id", { count: "exact", head: true });
    if (countError) {
      throw countError;
    }
    threadsCount = count ?? 0;

    const { data: sample, error: sampleError } = await supabase
      .from("message_thread")
      .select("id, title, classroom_id, created_at")
      .order("created_at", { ascending: false })
      .limit(1);
    if (sampleError) {
      throw sampleError;
    }
    sampleThread = sample?.[0] ?? null;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
  }

  return (
    <main className="flex flex-1 flex-col gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Debug mensajes</h1>
        <p className="mt-2 text-sm text-slate-500">
          Información resumida para validar el acceso a los avisos y mensajes por salón.
        </p>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <pre className="whitespace-pre-wrap text-sm text-slate-700">
          {JSON.stringify(
            {
              role,
              threadsCount,
              sampleThread,
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
