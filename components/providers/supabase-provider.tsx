"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { SessionContextProvider } from "@supabase/auth-helpers-react";
import { useState, type ReactNode } from "react";
import type { Database } from "@/types/database";

export function SupabaseProvider({
  children
}: {
  children: ReactNode;
}) {
  const [supabaseClient] = useState(() => createClientComponentClient<Database>());

  return <SessionContextProvider supabaseClient={supabaseClient}>{children}</SessionContextProvider>;
}
