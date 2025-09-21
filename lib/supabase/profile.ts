import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type ProfileWithOptionalFullName = Pick<
  Database["public"]["Tables"]["user_profile"]["Row"],
  "role" | "school_id"
> & {
  full_name?: string | null;
};

const PROFILE_QUERY = "role, school_id, full_name";
const PROFILE_FALLBACK_QUERY = "role, school_id";

const isMissingColumnError = (error: PostgrestError) =>
  error.code === "42703" && error.message.toLowerCase().includes("does not exist");

export async function getMyProfile(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<ProfileWithOptionalFullName | null> {
  const { data, error } = await supabase
    .from("user_profile")
    .select(PROFILE_QUERY)
    .eq("id", userId)
    .maybeSingle<ProfileWithOptionalFullName>();

  if (!error) {
    return data;
  }

  if (isMissingColumnError(error)) {
    const fallback = await supabase
      .from("user_profile")
      .select(PROFILE_FALLBACK_QUERY)
      .eq("id", userId)
      .maybeSingle<ProfileWithOptionalFullName>();

    if (fallback.error) {
      throw fallback.error;
    }

    return fallback.data;
  }

  throw error;
}
