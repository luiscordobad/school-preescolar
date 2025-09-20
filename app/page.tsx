import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <h1 className="text-3xl font-semibold">Bienvenido a School Preescolar</h1>
      <p className="max-w-xl text-lg text-slate-600">
        Este MVP conecta a directores, maestras y padres con la información esencial de la escuela preescolar.
      </p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white shadow hover:bg-indigo-500"
        >
          Iniciar sesión
        </Link>
        <Link href="/dashboard" className="rounded-md border border-indigo-200 px-4 py-2 font-medium text-indigo-600">
          Ir al panel
        </Link>
      </div>
    </main>
  );
}
