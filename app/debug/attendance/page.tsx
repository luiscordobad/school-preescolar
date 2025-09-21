"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import {
  fetchAccessibleClassrooms,
  type AttendanceClassroom,
  type ExtendedAttendanceRole,
  type TypedSupabaseClient,
} from "@/lib/attendance/client";
import {
  getAttendanceDebugState,
  subscribeAttendanceDebugState,
} from "@/lib/attendance/debug-store";
import type { Database } from "@/types/database";

type ProfileInfo = {
  role: ExtendedAttendanceRole | null;
  school_id: string | null;
};

type DebugAttendanceRow = Pick<
  Database["public"]["Tables"]["attendance"]["Row"],
  "id" | "student_id" | "classroom_id" | "date" | "status" | "taken_by"
>;

type DebugState = {
  loading: boolean;
  userId: string | null;
  role: ExtendedAttendanceRole | null;
  classroomsDisponibles: AttendanceClassroom[];
  sampleQuery: DebugAttendanceRow[] | null;
  error: string | null;
};

const initialState: DebugState = {
  loading: true,
  userId: null,
  role: null,
  classroomsDisponibles: [],
  sampleQuery: null,
  error: null,
};

export default function DebugAttendancePage() {
  const supabase = useMemo(() => createClientSupabaseClient(), []);
  const typedSupabase = supabase as unknown as TypedSupabaseClient;
  const [state, setState] = useState<DebugState>(initialState);
  const realtimeState = useSyncExternalStore(
    subscribeAttendanceDebugState,
    getAttendanceDebugState,
    getAttendanceDebugState,
  );

  useEffect(() => {
    let ignore = false;
    async function loadDebug() {
      try {
        setState(initialState);
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) {
          throw userError;
        }
        if (ignore) return;
        const userId = user?.id ?? null;
        let role: ExtendedAttendanceRole | null = null;
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

        let classrooms: AttendanceClassroom[] = [];
        if (userId && role) {
          try {
            classrooms = await fetchAccessibleClassrooms(typedSupabase, role, userId, schoolId);
          } catch (classroomError) {
            errorMessage = classroomError instanceof Error ? classroomError.message : String(classroomError);
          }
        }

        const { data: sampleData, error: sampleError } = await supabase
          .from("attendance")
          .select("id, student_id, classroom_id, date, status, taken_by")
          .limit(5)
          .returns<DebugAttendanceRow[]>();
        if (sampleError && !errorMessage) {
          errorMessage = sampleError.message;
        }

        if (ignore) return;
        setState({
          loading: false,
          userId,
          role,
          classroomsDisponibles: classrooms,
          sampleQuery: sampleData ?? null,
          error: errorMessage,
        });
      } catch (err) {
        if (ignore) return;
        const message = err instanceof Error ? err.message : String(err);
        setState({
          loading: false,
          userId: null,
          role: null,
          classroomsDisponibles: [],
          sampleQuery: null,
          error: message,
        });
      }
    }
    loadDebug();
    return () => {
      ignore = true;
    };
  }, [supabase, typedSupabase]);

  const payload: Record<string, unknown> = {
    role: realtimeState.role,
    childrenIds: realtimeState.childrenIds,
    classroomIds: realtimeState.classroomIds,
    date: realtimeState.date,
    lastError: realtimeState.lastError,
  };

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Debug asistencia</h1>
        <p className="text-sm text-slate-600">
          Información útil para revisar el alcance de las políticas RLS y el estado del cliente de asistencia.
        </p>
      </header>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-slate-800">Estado del cliente</h2>
        <pre className="whitespace-pre-wrap text-sm text-slate-700">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-slate-800">Estado del servidor</h2>
        <pre className="whitespace-pre-wrap text-sm text-slate-700">
          {JSON.stringify(
            {
              userId: state.userId,
              role: state.role,
              classroomsDisponibles: state.classroomsDisponibles,
              sampleQuery: state.sampleQuery,
              error: state.error,
              loading: state.loading,
            },
            null,
            2,
          )}
        </pre>
      </section>
    </main>
  );
}
