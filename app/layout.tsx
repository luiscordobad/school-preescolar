import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { SupabaseProvider } from "@/components/providers/supabase-provider";

export const metadata: Metadata = {
  title: "School Preescolar",
  description: "MVP del sistema escolar preescolar"
};

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <SupabaseProvider>
          <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6">
            {children}
          </div>
        </SupabaseProvider>
      </body>
    </html>
  );
}
