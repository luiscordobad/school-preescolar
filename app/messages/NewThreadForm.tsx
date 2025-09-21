"use client";

import { useState, type FormHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

type ClassroomOption = {
  id: string;
  name: string;
};

type ThreadType = "general" | "classroom";

type NewThreadFormProps = {
  classrooms: ClassroomOption[];
  action: FormHTMLAttributes<HTMLFormElement>["action"];
  errorMessage?: string | null;
  allowGeneral: boolean;
};

const TYPES: { value: ThreadType; label: string }[] = [
  { value: "general", label: "Aviso general de escuela" },
  { value: "classroom", label: "Aviso por salón" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-4 inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      {pending ? "Guardando..." : "Publicar aviso"}
    </button>
  );
}

export function NewThreadForm({ classrooms, action, errorMessage, allowGeneral }: NewThreadFormProps) {
  const typeOptions = allowGeneral ? TYPES : TYPES.filter((option) => option.value !== "general");
  const [type, setType] = useState<ThreadType>(() => (allowGeneral ? "general" : "classroom"));
  const showClassroomSelect = type === "classroom";

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="type">
          Tipo de aviso
        </label>
        <select
          id="type"
          name="type"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          value={type}
          onChange={(event) => setType(event.target.value as ThreadType)}
        >
          {typeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {showClassroomSelect ? (
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="classroomId">
            Salón
          </label>
          <select
            id="classroomId"
            name="classroomId"
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Selecciona un salón</option>
            {classrooms.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>
                {classroom.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="title">
          Título del aviso
        </label>
        <input
          id="title"
          name="title"
          required
          minLength={3}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="Ej. Reunión de padres"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="body">
          Primer mensaje
        </label>
        <textarea
          id="body"
          name="body"
          required
          rows={4}
          minLength={5}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="Escribe el detalle del aviso"
        />
      </div>

      {errorMessage ? (
        <p className="text-sm text-rose-600">{errorMessage}</p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
