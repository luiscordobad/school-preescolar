import type { AttendanceRole } from "@/lib/attendance/client";

type AttendanceDebugState = {
  role: AttendanceRole | null;
  classroomIds: string[];
  childrenIds: string[];
  date: string | null;
  lastError: string | null;
};

type Listener = (state: AttendanceDebugState) => void;

const listeners = new Set<Listener>();

let state: AttendanceDebugState = {
  role: null,
  classroomIds: [],
  childrenIds: [],
  date: null,
  lastError: null,
};

export function getAttendanceDebugState() {
  return state;
}

export function setAttendanceDebugState(update: Partial<AttendanceDebugState>) {
  state = { ...state, ...update };
  for (const listener of listeners) {
    listener(state);
  }
}

export function subscribeAttendanceDebugState(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
