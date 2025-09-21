"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import {
  fetchAccessibleClassrooms,
  fetchAccessibleStudents,
  type AttendanceClassroom,
  type AttendanceStudent,
  type TypedSupabaseClient,
} from "@/lib/attendance/client";
import type { Database } from "@/types/database";

type AttendanceDayRow = Database["public"]["Views"]["v_attendance_day_classroom"]["Row"];
type AttendanceMonthRow = Database["public"]["Views"]["v_attendance_month_student"]["Row"];

type ProfileInfo = Pick<Database["public"]["Tables"]["user_profile"]["Row"], "role" | "school_id">;

type SupabaseError = {
  message?: string;
  details?: string;
  hint?: string;
};

const TABS = [
  { id: "classroom" as const, label: "Por salón" },
  { id: "student" as const, label: "Por alumno" },
];

type TabId = (typeof TABS)[number]["id"];

function getFirstDayOfMonth(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(Date.UTC(year, month, 1));
  return first.toISOString().slice(0, 10);
}

function getMonthInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function monthInputToDate(monthValue: string) {
  if (!monthValue) {
    return null;
  }
  return `${monthValue}-01`;
}

function formatDateToLocale(value: string) {
  return new Date(value).toLocaleDateString("es-MX", {
    dateStyle: "medium",
  });
}

function extractErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object") {
    const err = error as SupabaseError;
    if (typeof err.message === "string" && err.message.trim()) {
      return err.message;
    }
    if (typeof err.details === "string" && err.details.trim()) {
      return err.details;
    }
    if (typeof err.hint === "string" && err.hint.trim()) {
      return err.hint;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function downloadCsv(filename: string, rows: string[][]) {
  if (!rows.length) {
    return;
  }
  const csvContent = rows
    .map((columns) =>
      columns
        .map((column) => {
          if (column.includes(",") || column.includes("\n") || column.includes("\"")) {
            return `"${column.replace(/"/g, '""')}"`;
          }
          return column;
        })
        .join(","),
    )
    .join("\n");
  const blob = new Blob([`\ufeff${csvContent}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function AttendanceReportsPage() {
  const supabase = useMemo(() => createClientSupabaseClient(), []);
  const typedSupabase = supabase as unknown as TypedSupabaseClient;
  const [activeTab, setActiveTab] = useState<TabId>("classroom");
  const [initializing, setInitializing] = useState(true);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [classrooms, setClassrooms] = useState<AttendanceClassroom[]>([]);
  const [students, setStudents] = useState<AttendanceStudent[]>([]);
  const today = useMemo(() => new Date(), []);
  const [classroomStartDate, setClassroomStartDate] = useState(() => getFirstDayOfMonth(new Date()));
  const [classroomEndDate, setClassroomEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedClassroom, setSelectedClassroom] = useState<string | null>(null);
  const [classroomRows, setClassroomRows] = useState<AttendanceDayRow[]>([]);
  const [classroomLoading, setClassroomLoading] = useState(false);
  const [classroomError, setClassroomError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => getMonthInputValue(new Date()));
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [studentRow, setStudentRow] = useState<AttendanceMonthRow | null>(null);
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function bootstrap() {
      setInitializing(true);
      setFatalError(null);
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) {
          throw userError;
        }
        if (!user) {
          setFatalError("Inicia sesión para consultar los reportes de asistencia.");
          return;
        }
        const { data: profile, error: profileError } = await supabase
          .from("user_profile")
          .select("role, school_id")
          .eq("id", user.id)
          .maybeSingle<ProfileInfo>();
        if (profileError) {
          throw profileError;
        }
        if (ignore) return;
        const currentRole = profile?.role ?? null;

        const accessibleClassrooms = await fetchAccessibleClassrooms(
          typedSupabase,
          currentRole,
          user.id,
          profile?.school_id ?? null,
        );
        if (ignore) return;
        setClassrooms(accessibleClassrooms);
        if (accessibleClassrooms.length > 0) {
          setSelectedClassroom(accessibleClassrooms[0].id);
        }

        const accessibleStudents = await fetchAccessibleStudents(
          typedSupabase,
          currentRole,
          user.id,
          profile?.school_id ?? null,
          accessibleClassrooms.map((item) => item.id),
        );
        if (ignore) return;
        setStudents(accessibleStudents);
        if (accessibleStudents.length > 0) {
          setSelectedStudent(accessibleStudents[0].id);
        }
      } catch (err) {
        if (ignore) return;
        const message = extractErrorMessage(err, "No fue posible cargar tu información.");
        setFatalError(message);
      } finally {
        if (!ignore) {
          setInitializing(false);
        }
      }
    }
    bootstrap();
    return () => {
      ignore = true;
    };
  }, [supabase, typedSupabase]);

  useEffect(() => {
    let ignore = false;
    async function loadClassroomReport() {
      if (!selectedClassroom || !classroomStartDate || !classroomEndDate) {
        setClassroomError(null);
        setClassroomRows([]);
        setClassroomLoading(false);
        return;
      }
      if (classroomStartDate > classroomEndDate) {
        setClassroomError("El rango de fechas es inválido.");
        setClassroomRows([]);
        setClassroomLoading(false);
        return;
      }
      setClassroomLoading(true);
      setClassroomError(null);
      try {
        const { data, error } = await supabase
          .from("v_attendance_day_classroom")
          .select("classroom_id, date, present_count, absent_count, tardy_count")
          .eq("classroom_id", selectedClassroom)
          .gte("date", classroomStartDate)
          .lte("date", classroomEndDate)
          .order("date", { ascending: true })
          .returns<AttendanceDayRow[]>();
        if (error) {
          throw error;
        }
        if (ignore) return;
        setClassroomRows(data ?? []);
      } catch (err) {
        if (ignore) return;
        const message = extractErrorMessage(err, "No fue posible cargar el reporte por salón.");
        setClassroomError(message);
        setClassroomRows([]);
      } finally {
        if (!ignore) {
          setClassroomLoading(false);
        }
      }
    }
    loadClassroomReport();
    return () => {
      ignore = true;
    };
  }, [supabase, selectedClassroom, classroomStartDate, classroomEndDate]);

  useEffect(() => {
    let ignore = false;
    async function loadStudentReport() {
      if (!selectedStudent || !selectedMonth) {
        setStudentError(null);
        setStudentRow(null);
        setStudentLoading(false);
        return;
      }
      const monthDate = monthInputToDate(selectedMonth);
      if (!monthDate) {
        setStudentError(null);
        setStudentRow(null);
        setStudentLoading(false);
        return;
      }
      setStudentLoading(true);
      setStudentError(null);
      try {
        const { data, error } = await supabase
          .from("v_attendance_month_student")
          .select(
            "student_id, month, present_count, absent_count, tardy_count, total_days, attendance_percentage",
          )
          .eq("student_id", selectedStudent)
          .eq("month", monthDate)
          .maybeSingle<AttendanceMonthRow>();
        if (error) {
          throw error;
        }
        if (ignore) return;
        setStudentRow(data ?? null);
      } catch (err) {
        if (ignore) return;
        const message = extractErrorMessage(err, "No fue posible cargar el reporte por alumno.");
        setStudentError(message);
        setStudentRow(null);
      } finally {
        if (!ignore) {
          setStudentLoading(false);
        }
      }
    }
    loadStudentReport();
    return () => {
      ignore = true;
    };
  }, [supabase, selectedStudent, selectedMonth]);

  if (initializing) {
    return (
      <main className="flex flex-1 flex-col gap-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Reportes de asistencia</h1>
          <p className="mt-2 text-sm text-slate-500">Cargando información...</p>
        </section>
      </main>
    );
  }

  if (fatalError) {
    return (
      <main className="flex flex-1 flex-col gap-6">
        <section className="rounded-lg border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-red-700">No se pudo mostrar el módulo</h1>
          <p className="mt-2 text-sm text-red-600">{fatalError}</p>
        </section>
      </main>
    );
  }

  function handleExportClassroom() {
    if (!selectedClassroom || !classroomRows.length) {
      return;
    }
    const headers = ["Fecha", "Presentes", "Ausentes", "Retardos", "Total"];
    const rows = classroomRows.map((row) => {
      const total = row.present_count + row.absent_count + row.tardy_count;
      return [
        formatDateToLocale(row.date),
        row.present_count.toString(),
        row.absent_count.toString(),
        row.tardy_count.toString(),
        total.toString(),
      ];
    });
    const filename = `reporte_salon_${selectedClassroom}_${classroomStartDate}_${classroomEndDate}.csv`;
    downloadCsv(filename, [headers, ...rows]);
  }

  function handleExportStudent() {
    if (!selectedStudent || !studentRow) {
      return;
    }
    const headers = ["Alumno", "Mes", "Presentes", "Ausentes", "Retardos", "Total", "Porcentaje"];
    const studentInfo = students.find((item) => item.id === selectedStudent);
    const studentName = studentInfo ? `${studentInfo.firstName} ${studentInfo.lastName}` : selectedStudent;
    const monthLabel = new Date(studentRow.month).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
    const percentage =
      typeof studentRow.attendance_percentage === "number"
        ? `${studentRow.attendance_percentage.toFixed(2)}%`
        : "N/A";
    const row = [
      studentName,
      monthLabel,
      studentRow.present_count.toString(),
      studentRow.absent_count.toString(),
      studentRow.tardy_count.toString(),
      studentRow.total_days.toString(),
      percentage,
    ];
    const filename = `reporte_alumno_${selectedStudent}_${studentRow.month}.csv`;
    downloadCsv(filename, [headers, row]);
  }

  const selectedClassroomName = selectedClassroom
    ? classrooms.find((classroom) => classroom.id === selectedClassroom)?.name ?? ""
    : "";

  const studentPercentage =
    studentRow && typeof studentRow.attendance_percentage === "number"
      ? studentRow.attendance_percentage.toFixed(2)
      : null;

  return (
    <main className="flex flex-1 flex-col gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Reportes de asistencia</h1>
        <p className="mt-2 text-sm text-slate-500">
          Consulta tendencias de asistencia por salón o por alumno. Los datos se muestran según tus permisos.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "classroom" ? (
          <div className="mt-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="flex flex-col text-sm font-medium text-slate-700">
                Salón
                <select
                  className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={selectedClassroom ?? ""}
                  onChange={(event) => setSelectedClassroom(event.target.value || null)}
                  disabled={!classrooms.length}
                >
                  {classrooms.length === 0 ? (
                    <option value="">Sin salones disponibles</option>
                  ) : (
                    classrooms.map((classroom) => (
                      <option key={classroom.id} value={classroom.id}>
                        {classroom.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label className="flex flex-col text-sm font-medium text-slate-700">
                Fecha inicial
                <input
                  type="date"
                  className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={classroomStartDate}
                  onChange={(event) => setClassroomStartDate(event.target.value)}
                />
              </label>
              <label className="flex flex-col text-sm font-medium text-slate-700">
                Fecha final
                <input
                  type="date"
                  className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={classroomEndDate}
                  max={today.toISOString().slice(0, 10)}
                  onChange={(event) => setClassroomEndDate(event.target.value)}
                />
              </label>
            </div>

            {classroomError ? (
              <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{classroomError}</div>
            ) : null}

            {classroomLoading ? (
              <p className="text-sm text-slate-500">Cargando datos del salón...</p>
            ) : classroomRows.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th scope="col" className="px-4 py-2 text-left font-semibold text-slate-700">
                        Fecha
                      </th>
                      <th scope="col" className="px-4 py-2 text-left font-semibold text-slate-700">
                        Presentes
                      </th>
                      <th scope="col" className="px-4 py-2 text-left font-semibold text-slate-700">
                        Ausentes
                      </th>
                      <th scope="col" className="px-4 py-2 text-left font-semibold text-slate-700">
                        Retardos
                      </th>
                      <th scope="col" className="px-4 py-2 text-left font-semibold text-slate-700">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {classroomRows.map((row) => {
                      const total = row.present_count + row.absent_count + row.tardy_count;
                      return (
                        <tr key={`${row.classroom_id}-${row.date}`}>
                          <td className="px-4 py-2 text-slate-700">{formatDateToLocale(row.date)}</td>
                          <td className="px-4 py-2 text-slate-700">{row.present_count}</td>
                          <td className="px-4 py-2 text-slate-700">{row.absent_count}</td>
                          <td className="px-4 py-2 text-slate-700">{row.tardy_count}</td>
                          <td className="px-4 py-2 text-slate-700">{total}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No hay registros en el periodo seleccionado.</p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <div className="text-sm text-slate-500">
                {selectedClassroomName
                  ? `Mostrando datos para ${selectedClassroomName}`
                  : "Selecciona un salón para ver el detalle."}
              </div>
              <button
                type="button"
                onClick={handleExportClassroom}
                disabled={!classroomRows.length}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Exportar CSV
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col text-sm font-medium text-slate-700">
                Alumno
                <select
                  className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={selectedStudent ?? ""}
                  onChange={(event) => setSelectedStudent(event.target.value || null)}
                  disabled={!students.length}
                >
                  {students.length === 0 ? (
                    <option value="">Sin alumnos disponibles</option>
                  ) : (
                    students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.firstName} {student.lastName}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label className="flex flex-col text-sm font-medium text-slate-700">
                Mes
                <input
                  type="month"
                  className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={selectedMonth}
                  max={getMonthInputValue(today)}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                />
              </label>
            </div>

            {studentError ? (
              <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{studentError}</div>
            ) : null}

            {studentLoading ? (
              <p className="text-sm text-slate-500">Cargando datos del alumno...</p>
            ) : studentRow ? (
              <div className="grid gap-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Mes</p>
                  <p className="text-base font-semibold text-slate-800">
                    {new Date(studentRow.month).toLocaleDateString("es-MX", { month: "long", year: "numeric" })}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Porcentaje de asistencia</p>
                  <p className="text-base font-semibold text-slate-800">
                    {studentPercentage ? `${studentPercentage}%` : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Presentes</p>
                  <p className="text-base font-semibold text-slate-800">{studentRow.present_count}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Ausentes</p>
                  <p className="text-base font-semibold text-slate-800">{studentRow.absent_count}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Retardos</p>
                  <p className="text-base font-semibold text-slate-800">{studentRow.tardy_count}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Total de registros</p>
                  <p className="text-base font-semibold text-slate-800">{studentRow.total_days}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No hay registros para el mes seleccionado.</p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <div className="text-sm text-slate-500">
                {selectedStudent
                  ? "Los totales consideran únicamente el mes indicado."
                  : "Selecciona un alumno para ver el detalle."}
              </div>
              <button
                type="button"
                onClick={handleExportStudent}
                disabled={!studentRow}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Exportar CSV
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
