import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

export const createServerSupabaseClient = () =>
  createServerComponentClient<Database>({
    cookies
  }) as unknown as SupabaseClient<Database>;
