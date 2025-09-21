import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

type DashboardStudent = Pick<Database["public"]["Tables"]["student"]["Row"], "id" | "first_name" | "last_name">;

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data: rows, error } = await supabase
    .from("student")
    .select("id, first_name, last_name")
    .order("first_name", { ascending: true })
    .returns<DashboardStudent[]>();

  if (error) {
    console.error(error);
  }

  return NextResponse.json({ rows, error });
}
