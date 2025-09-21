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

const msg = (e: any) => e?.message || e?.details || e?.hint || JSON.stringify(e ?? {});

type ProfileInfo = Pick<Database["public"]["Tables"]["user_profile"]["Row"], "role" | "school_id">;

type DebugAttendanceRow = Pick<
  Database["public"]["Tables"]["attendance"]["Row"],
  "id" | "student_id" | "classroom_id" | "date" | "status" | "taken_by"
>;

type GuardianLink = {
  student_id: string;
};

const GUARDIAN_ROLES = new Set(["padre", "madre", "tutor", "parent"]);

type DebugState = {
  loading: boolean;
  userId: string | null;
  role: AttendanceRole | null;
  classroomId: string | null;
  date: string;
  sampleRows: DebugAttendanceRow[] | null;
  serverError: string | null;
  childrenIds: string[];
  selectedStudentId: string | null;
  lastError: string | null;
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
    serverError: null,
    childrenIds: [],
    selectedStudentId: null,
    lastError: null,
  }));

  useEffect(() => {
    let ignore = false;
    async function loadDebug() {
      setState((prev) => ({ ...prev, loading: true }));
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
        let serverError: string | null = null;
        let lastError: string | null = null;

        if (userId) {
          const { data: profile, error: profileError } = await supabase
            .from("user_profile")
            .select("role, school_id")
            .eq("id", userId)
            .maybeSingle<ProfileInfo>();
          if (profileError) {
            const message = msg(profileError);
            serverError = message;
            lastError = lastError ?? message;
          } else {
            role = profile?.role ?? null;
            schoolId = profile?.school_id ?? null;
          }
        }

        let classroomId: string | null = null;
        let sampleRows: DebugAttendanceRow[] | null = null;

        if (userId && role && !GUARDIAN_ROLES.has(role)) {
          try {
            const classrooms = await fetchAccessibleClassrooms(
              typedSupabase,
              role,
              userId,
              schoolId,
            );
            classroomId = classrooms[0]?.id ?? null;
          } catch (classroomError) {
            const message = msg(classroomError);
            serverError = serverError ?? message;
            lastError = lastError ?? message;
          }
        }

        if (classroomId) {
          const { data: sampleData, error: sampleError } = await supabase
            .from("attendance")
            .select("id, student_id, classroom_id, date, status, taken_by")
            .eq("classroom_id", classroomId)
            .eq("date", defaultDate)
            .limit(5)
            .returns<DebugAttendanceRow[]>();
          if (sampleError) {
            const message = msg(sampleError);
            serverError = serverError ?? message;
            lastError = lastError ?? message;
          } else {
            sampleRows = sampleData ?? [];
          }
        }

        let childrenIds: string[] = [];
        let selectedStudentId: string | null = null;
        if (userId && role && GUARDIAN_ROLES.has(role)) {
          const { data: links, error: linksError } = await supabase
            .from("guardian")
            .select("student_id")
            .eq("profile_id", userId)
            .returns<GuardianLink[]>();
          if (linksError) {
            const message = msg(linksError);
            lastError = lastError ?? message;
          } else {
            childrenIds = (links ?? []).map((link) => link.student_id);
            selectedStudentId = childrenIds[0] ?? null;
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
          serverError,
          childrenIds,
          selectedStudentId,
          lastError,
        });
      } catch (error) {
        if (ignore) return;
        const message = msg(error);
        setState({
          loading: false,
          userId: null,
          role: null,
          classroomId: null,
          date: defaultDate,
          sampleRows: null,
          serverError: message,
          childrenIds: [],
          selectedStudentId: null,
          lastError: message,
        });
      }
    }
    loadDebug();
    return () => {
      ignore = true;
    };
  }, [defaultDate, supabase, typedSupabase]);

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Debug asistencia</h1>
        <p className="text-sm text-slate-600">
          Información útil para revisar el alcance de las políticas RLS en la tabla de asistencia.
        </p>
      </header>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Estado del cliente</h2>
        <pre className="mt-4 whitespace-pre-wrap text-sm text-slate-700">
          {JSON.stringify(
            {
              role: state.role,
              childrenIds: state.childrenIds,
              selectedStudentId: state.selectedStudentId,
              date: state.date,
              lastError: state.lastError,
            },
            null,
            2,
          )}
        </pre>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Estado del servidor</h2>
        <pre className="mt-4 whitespace-pre-wrap text-sm text-slate-700">
          {JSON.stringify(
            {
              loading: state.loading,
              userId: state.userId,
              role: state.role,
              classroomId: state.classroomId,
              date: state.date,
              sampleRows: state.sampleRows,
              error: state.serverError,
            },
            null,
            2,
          )}
        </pre>
      </section>
    </main>
  );
}
