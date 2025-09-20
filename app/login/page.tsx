"use client";

import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export default function LoginPage() {
  const supabase = useMemo(() => createClientSupabaseClient(), []);
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    async function loadSession() {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (!ignore && session) {
        router.replace("/dashboard");
      }
      setLoading(false);
    }
    loadSession();
    return () => {
      ignore = true;
    };
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-slate-500">Cargando...</p>
      </div>
    );
  }

  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6">
      <header className="text-center">
        <h1 className="text-3xl font-semibold">Acceso a la plataforma</h1>
        <p className="mt-2 text-sm text-slate-500">
          Usa tu correo corporativo para autenticarte.
        </p>
      </header>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <Auth
          supabaseClient={supabase as unknown as SupabaseClient}
          appearance={{ theme: ThemeSupa }}
          providers={[]}
          redirectTo={redirectTo}
          localization={{
            variables: {
              sign_in: {
                email_label: "Correo",
                password_label: "Contraseña"
              }
            }
          }}
        />
      </div>
    </main>
  );
}
