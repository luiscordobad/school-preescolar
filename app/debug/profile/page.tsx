"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { toMessage } from "@/lib/errors";
import { createClientSupabaseClient } from "@/lib/supabase/client";

type Profile = {
  role: string | null;
  school_id: string | null;
  full_name: string | null;
};

export default function DebugProfilePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClientSupabaseClient(), []);
  const [payload, setPayload] = useState({
    userId: null as string | null,
    email: null as string | null,
    profile: null as Profile | null,
    errorMessage: null as string | null,
    loading: true
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const {
          data: { user },
          error
        } = await supabase.auth.getUser();

        if (!active) {
          return;
        }

        if (error) {
          setPayload((prev) => ({ ...prev, loading: false, errorMessage: toMessage(error) }));
          return;
        }

        if (!user) {
          router.replace("/login");
          return;
        }

        const { data, error: profileError } = await supabase
          .from("user_profile")
          .select("role, school_id, full_name")
          .eq("id", user.id)
          .maybeSingle<Profile>();

        if (!active) {
          return;
        }

        setPayload({
          userId: user.id,
          email: user.email ?? null,
          profile: data ?? null,
          errorMessage: profileError ? toMessage(profileError) : null,
          loading: false
        });
      } catch (error) {
        if (!active) {
          return;
        }
        setPayload((prev) => ({
          ...prev,
          loading: false,
          errorMessage: toMessage(error)
        }));
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  const env = {
    hasURL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasAnon: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  };

  const body = {
    userId: payload.userId,
    email: payload.email,
    profile: payload.profile,
    errorMessage: payload.errorMessage,
    env,
    loading: payload.loading
  };

  return (
    <main className="flex flex-1 flex-col gap-4">
      <pre className="overflow-auto rounded border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">
        {JSON.stringify(body, null, 2)}
      </pre>
    </main>
  );
}
