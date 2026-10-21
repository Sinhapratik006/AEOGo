import type { ReactNode } from "react";
import { Logo } from "@/components/ui";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-indigo-50/70 via-white to-white">
      <header className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <Logo />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:pt-12">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">{children}</div>
      </main>
    </div>
  );
}
