"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import {
  fetchAccessibleClassrooms,
  type AttendanceClassroom,
  type AttendanceRole,
  type TypedSupabaseClient,
} from "@/lib/attendance/client";

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  schoolId: string;
};

type ProfileInfo = Pick<
  Database["public"]["Tables"]["user_profile"]["Row"],
  "role" | "school_id"
>;

type EnrollmentWithStudent = {
  school_id: string;
  student: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
};

type AttendanceStatus = Database["public"]["Tables"]["attendance"]["Row"]["status"];

type StudentAttendance = {
  status: AttendanceStatus | null;
  note: string;
};

type AttendanceRecord = Pick<
  Database["public"]["Tables"]["attendance"]["Row"],
  "student_id" | "status" | "note"
>;

type AttendanceInsert = Database["public"]["Tables"]["attendance"]["Insert"];

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; description: string }[] = [
  { value: "P", label: "P", description: "Presente" },
  { value: "A", label: "A", description: "Ausente" },
  { value: "R", label: "R", description: "Retardo" },
];

export default function AttendancePage() {
  const supabase = useMemo(() => createClientSupabaseClient(), []);
  const typedSupabase = supabase as unknown as TypedSupabaseClient;
  const [initializing, setInitializing] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [role, setRole] = useState<AttendanceRole | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [classrooms, setClassrooms] = useState<AttendanceClassroom[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, StudentAttendance>>({});
  const [saving, setSaving] = useState(false);

  const canEdit = role === "director" || role === "teacher";

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
          setFatalError("Inicia sesión para registrar asistencia.");
          return;
        }
        if (ignore) return;
        setUserId(user.id);

        const { data: profile, error: profileError } = await supabase
          .from("user_profile")
          .select("role, school_id")
          .eq("id", user.id)
          .maybeSingle<ProfileInfo>();
        if (profileError) {
          throw profileError;
        }
        const currentRole = profile?.role ?? null;
        if (ignore) return;
        setRole(currentRole);

        const accessible = await fetchAccessibleClassrooms(
          typedSupabase,
          currentRole,
          user.id,
          profile?.school_id ?? null,
        );
        if (ignore) return;
        setClassrooms(accessible);
        if (accessible.length > 0) {
          setSelectedClassroom(accessible[0].id);
        }
      } catch (err) {
        if (ignore) return;
        const message = err instanceof Error ? err.message : "No fue posible cargar tus datos.";
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
  }, [supabase]);

  useEffect(() => {
    let ignore = false;
    async function loadAttendance() {
      if (!selectedClassroom || !date) {
        setStudents([]);
        setAttendance({});
        return;
      }
      setRecordsLoading(true);
      setFatalError(null);
      setFormError(null);
      try {
        const { data: enrollmentData, error: enrollmentError } = await supabase
          .from("enrollment")
          .select("school_id, student:student_id (id, first_name, last_name)")
          .eq("classroom_id", selectedClassroom)
          .returns<EnrollmentWithStudent[]>();
        if (enrollmentError) {
          throw enrollmentError;
        }
        if (ignore) return;
        const studentList: Student[] = (enrollmentData ?? [])
          .map((entry) => {
            const student = entry.student as { id: string; first_name: string; last_name: string } | null;
            if (!student) {
              return null;
            }
            return {
              id: student.id,
              firstName: student.first_name,
              lastName: student.last_name,
              schoolId: entry.school_id,
            };
          })
          .filter((value): value is Student => value !== null)
          .sort((a, b) => {
            const lastNameComparison = a.lastName.localeCompare(b.lastName, "es", { sensitivity: "base" });
            if (lastNameComparison !== 0) return lastNameComparison;
            return a.firstName.localeCompare(b.firstName, "es", { sensitivity: "base" });
          });
        if (ignore) return;
        setStudents(studentList);

        const { data: attendanceRows, error: attendanceError } = await supabase
          .from("attendance")
          .select("student_id, status, note")
          .eq("classroom_id", selectedClassroom)
          .eq("date", date)
          .returns<AttendanceRecord[]>();
        if (attendanceError) {
          throw attendanceError;
        }
        if (ignore) return;
        const map: Record<string, StudentAttendance> = {};
        for (const row of attendanceRows ?? []) {
          map[row.student_id] = {
            status: row.status as AttendanceStatus,
            note: row.note ?? "",
          };
        }
        setAttendance(map);
      } catch (err) {
        if (ignore) return;
        const message = err instanceof Error ? err.message : "No fue posible cargar la asistencia.";
        setFatalError(message);
      } finally {
        if (!ignore) {
          setRecordsLoading(false);
        }
      }
    }
    loadAttendance();
    return () => {
      ignore = true;
    };
  }, [date, selectedClassroom, supabase]);

  const summary = useMemo(() => {
    return students.reduce(
      (acc, student) => {
        const record = attendance[student.id];
        if (record?.status) {
          acc[record.status] += 1;
        }
        return acc;
      },
      { P: 0, A: 0, R: 0 } as Record<AttendanceStatus, number>,
    );
  }, [attendance, students]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    if (!canEdit) return;
    setAttendance((prev) => {
      const previous = prev[studentId];
      const nextStatus = previous?.status === status ? null : status;
      return {
        ...prev,
        [studentId]: {
          status: nextStatus,
          note: previous?.note ?? "",
        },
      };
    });
  };

  const handleNoteChange = (studentId: string, note: string) => {
    if (!canEdit) return;
    setAttendance((prev) => ({
      ...prev,
      [studentId]: {
        status: prev[studentId]?.status ?? null,
        note,
      },
    }));
  };

  const handleSave = async () => {
    if (!canEdit || !userId || !selectedClassroom) {
      return;
    }
    const rows: AttendanceInsert[] = [];
    for (const student of students) {
      const record = attendance[student.id];
      if (!record?.status) {
        continue;
      }
      const payload: AttendanceInsert = {
        school_id: student.schoolId,
        classroom_id: selectedClassroom,
        student_id: student.id,
        date,
        status: record.status,
        note: record.note ? record.note : null,
        taken_by: userId,
      };
      rows.push(payload);
    }

    if (rows.length === 0) {
      setFormError("Selecciona al menos un estado para guardar.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const upsertRows = rows as AttendanceInsert[];
      const { error: upsertError } = await (supabase.from("attendance") as any).upsert(
        upsertRows,
        { onConflict: "student_id,date" },
      );
      if (upsertError) {
        throw upsertError;
      }
      const { data: refreshedRows, error: refreshedError } = await supabase
        .from("attendance")
        .select("student_id, status, note")
        .eq("classroom_id", selectedClassroom)
        .eq("date", date)
        .returns<AttendanceRecord[]>();
      if (refreshedError) {
        throw refreshedError;
      }
      const map: Record<string, StudentAttendance> = {};
      for (const row of refreshedRows ?? []) {
        map[row.student_id] = {
          status: row.status as AttendanceStatus,
          note: row.note ?? "",
        };
      }
      setAttendance(map);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar la asistencia.";
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    if (!selectedClassroom) return;
    const classroomName =
      classrooms.find((classroom) => classroom.id === selectedClassroom)?.name ?? "sin-salon";
    const rows = [
      ["Alumno", "Estado", "Nota"],
      ...students.map((student) => {
        const record = attendance[student.id];
        const statusLabel = record?.status ?? "";
        const note = record?.note ?? "";
        const fullName = `${student.firstName} ${student.lastName}`;
        return [fullName, statusLabel, note];
      }),
    ];
    const csvContent = rows
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-${date}-${classroomName}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderContent = () => {
    if (initializing) {
      return (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Cargando tu información...</p>
        </div>
      );
    }

    if (fatalError) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {fatalError}
        </div>
      );
    }

    if (classrooms.length === 0) {
      return (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">
            No hay salones disponibles para tu perfil. Si crees que es un error, contacta a la dirección.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-2 md:flex-row md:items-end">
              <label className="flex flex-col text-sm text-slate-600">
                Salón
                <select
                  className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-base focus:border-slate-500 focus:outline-none"
                  value={selectedClassroom ?? ""}
                  onChange={(event) => setSelectedClassroom(event.target.value)}
                >
                  {classrooms.map((classroom) => (
                    <option key={classroom.id} value={classroom.id}>
                      {classroom.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col text-sm text-slate-600">
                Fecha
                <input
                  type="date"
                  className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-base focus:border-slate-500 focus:outline-none"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </label>
            </div>
            <div className="flex flex-col gap-3 text-sm text-slate-600 md:flex-row md:items-center md:gap-4">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-700">Resumen:</span>
                <span>P: {summary.P}</span>
                <span>A: {summary.A}</span>
                <span>R: {summary.R}</span>
              </div>
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                onClick={handleExport}
              >
                Exportar CSV
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          {formError ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {formError}
            </div>
          ) : null}
          {recordsLoading ? (
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Cargando alumnos...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-600">
                No se encontraron alumnos inscritos en este salón.
              </p>
            </div>
          ) : (
            <>
              {students.map((student) => {
                const record = attendance[student.id];
                return (
                  <div
                    key={student.id}
                    className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-base font-semibold text-slate-800">
                          {student.firstName} {student.lastName}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {STATUS_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleStatusChange(student.id, option.value)}
                            disabled={!canEdit}
                            className={`rounded-md px-3 py-2 text-sm font-medium shadow-sm transition-colors ${
                              record?.status === option.value
                                ? "bg-slate-900 text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            } ${canEdit ? "" : "opacity-60"}`}
                            title={option.description}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      className="mt-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                      placeholder="Notas adicionales (opcional)"
                      value={record?.note ?? ""}
                      onChange={(event) => handleNoteChange(student.id, event.target.value)}
                      disabled={!canEdit}
                    />
                  </div>
                );
              })}
              {canEdit ? (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {saving ? "Guardando..." : "Guardar asistencia"}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    );
  };

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Asistencia diaria</h1>
        <p className="text-sm text-slate-600">
          Marca la asistencia del salón seleccionado y agrega notas relevantes. Los cambios quedan registrados con tu usuario.
        </p>
      </header>
      {renderContent()}
    </main>
  );
}
