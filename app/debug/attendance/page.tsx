"use client";

export const dynamic = "force-dynamic";

import { useSyncExternalStore } from "react";
import {
  getAttendanceDebugState,
  subscribeAttendanceDebugState,
} from "@/lib/attendance/debug-store";

export default function DebugAttendancePage() {
  const debugState = useSyncExternalStore(subscribeAttendanceDebugState, getAttendanceDebugState);

  const payload = {
    user: debugState.user,
    role: debugState.role,
    classrooms: debugState.classrooms,
    studentsCountSelected: debugState.studentsCountSelected,
    lastError: debugState.lastError,
  };

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Debug asistencia</h1>
        <p className="text-sm text-slate-600">
          Estado compartido desde la pantalla de asistencia para validar datos de Supabase y RLS.
        </p>
      </header>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <pre className="whitespace-pre-wrap break-words text-sm text-slate-700">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </section>
    </main>
  );
}
