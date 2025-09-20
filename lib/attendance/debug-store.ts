import type { AttendanceClassroom, AttendanceRole } from "./client";

type AttendanceDebugUser = {
  id: string | null;
  email: string | null;
};

type AttendanceDebugState = {
  user: AttendanceDebugUser;
  role: AttendanceRole | null;
  classrooms: AttendanceClassroom[];
  studentsCountSelected: number;
  lastError: string | null;
};

const defaultState: AttendanceDebugState = {
  user: { id: null, email: null },
  role: null,
  classrooms: [],
  studentsCountSelected: 0,
  lastError: null,
};

let state: AttendanceDebugState = defaultState;
const listeners = new Set<() => void>();

export function getAttendanceDebugState(): AttendanceDebugState {
  return state;
}

export function subscribeAttendanceDebugState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function updateAttendanceDebugState(partial: Partial<AttendanceDebugState>): void {
  state = {
    ...state,
    ...partial,
  };
  for (const listener of listeners) {
    listener();
  }
}

export function resetAttendanceDebugState(): void {
  state = defaultState;
  for (const listener of listeners) {
    listener();
  }
}
