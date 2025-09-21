"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import {
  fetchAccessibleClassrooms,
  type AttendanceRole,
  type TypedSupabaseClient,
} from "@/lib/attendance/client";
import type { Database } from "@/types/database";

type ProfileInfo = Pick<
  Database["public"]["Tables"]["user_profile"]["Row"],
  "role" | "school_id"
>;

type DebugAttendanceRow = Pick<
  Database["public"]["Tables"]["attendance"]["Row"],
  "id" | "student_id" | "classroom_id" | "date" | "status" | "taken_by"
>;

type DebugState = {
  loading: boolean;
  userId: string | null;
  role: AttendanceRole | null;
  classroomId: string | null;
  date: string;
  sampleRows: DebugAttendanceRow[] | null;
  error: string | null;
};

export default function DebugAttendancePage() {
  const supabase = useMemo(() => createClientSupabaseClient(), []);
  const typedSupabase = supabase as unknown as TypedSupabaseClient;
  const defaultDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [state, setState] = useState<DebugState>(() => ({
    loading: true,
    userId: null,
    role: null,
    classroomId: null,
    date: defaultDate,
    sampleRows: null,
    error: null,
  }));

  useEffect(() => {
    let ignore = false;
    async function loadDebug() {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) {
          throw userError;
        }
        if (ignore) return;
        const userId = user?.id ?? null;
        let role: AttendanceRole | null = null;
        let schoolId: string | null = null;
        let errorMessage: string | null = null;

        if (userId) {
          const { data: profile, error: profileError } = await supabase
            .from("user_profile")
            .select("role, school_id")
            .eq("id", userId)
            .maybeSingle<ProfileInfo>();
          if (profileError) {
            errorMessage = profileError.message;
          } else {
            role = profile?.role ?? null;
            schoolId = profile?.school_id ?? null;
          }
        }

        let classroomId: string | null = null;
        if (userId && role) {
          try {
            const classrooms = await fetchAccessibleClassrooms(typedSupabase, role, userId, schoolId);
            classroomId = classrooms[0]?.id ?? null;
          } catch (classroomError) {
            errorMessage = classroomError instanceof Error ? classroomError.message : String(classroomError);
          }
        }

        let sampleRows: DebugAttendanceRow[] | null = null;
        if (classroomId) {
          const { data: sampleData, error: sampleError } = await supabase
            .from("attendance")
            .select("id, student_id, classroom_id, date, status, taken_by")
            .eq("classroom_id", classroomId)
            .eq("date", defaultDate)
            .limit(5)
            .returns<DebugAttendanceRow[]>();
          if (sampleError) {
            errorMessage = errorMessage ?? sampleError.message;
          } else {
            sampleRows = sampleData ?? [];
          }
        }

        if (ignore) return;
        setState({
          loading: false,
          userId,
          role,
          classroomId,
          date: defaultDate,
          sampleRows,
          error: errorMessage,
        });
      } catch (err) {
        if (ignore) return;
        const message = err instanceof Error ? err.message : String(err);
        setState({
          loading: false,
          userId: null,
          role: null,
          classroomId: null,
          date: defaultDate,
          sampleRows: null,
          error: message,
        });
      }
    }
    loadDebug();
    return () => {
      ignore = true;
    };
  }, [defaultDate, supabase]);

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Debug asistencia</h1>
        <p className="text-sm text-slate-600">
          Información útil para revisar el alcance de las políticas RLS en la tabla de asistencia.
        </p>
      </header>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <pre className="whitespace-pre-wrap text-sm text-slate-700">
          {JSON.stringify(
            {
              userId: state.userId,
              role: state.role,
              classroomId: state.classroomId,
              date: state.date,
              sampleRows: state.sampleRows,
              error: state.error,
            },
            null,
            2,
          )}
        </pre>
      </section>
    </main>
  );
}
