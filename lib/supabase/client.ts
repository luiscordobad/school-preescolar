import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const createClientSupabaseClient = () =>
  createClientComponentClient<Database>({
    ...(supabaseUrl ? { supabaseUrl } : {}),
    ...(supabaseAnonKey ? { supabaseKey: supabaseAnonKey } : {})
  });
