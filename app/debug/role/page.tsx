"use client";

import { useEffect, useMemo, useState } from "react";

import { createClientSupabaseClient } from "@/lib/supabase/client";

interface DebugProfile {
  role: string | null;
  full_name: string | null;
  school_id: string | null;
}

interface DebugState {
  userId: string | null;
  email: string | null;
  profile: DebugProfile | null;
  error: string | null;
}

const initialState: DebugState = {
  userId: null,
  email: null,
  profile: null,
  error: null,
};

export default function DebugRolePage() {
  const supabase = useMemo(() => createClientSupabaseClient(), []);
  const [state, setState] = useState<DebugState>(initialState);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      if (authError || !user) {
        setState({
          userId: null,
          email: null,
          profile: null,
          error: authError?.message ?? "User not found",
        });
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("user_profile")
        .select("role, full_name, school_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      setState({
        userId: user.id,
        email: user.email ?? null,
        profile: profile ?? null,
        error: profileError?.message ?? null,
      });
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  return (
    <main className="p-4">
      <pre>{JSON.stringify(state, null, 2)}</pre>
    </main>
  );
}
