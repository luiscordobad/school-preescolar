import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

type DashboardClassroom = Pick<Database["public"]["Tables"]["classroom"]["Row"], "id" | "name">;

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data: rows, error } = await supabase
    .from("classroom")
    .select("id, name")
    .order("name", { ascending: true })
    .returns<DashboardClassroom[]>();

  if (error) {
    console.error(error);
  }

  return NextResponse.json({ rows, error });
}
