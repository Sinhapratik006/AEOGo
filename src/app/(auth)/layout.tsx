import type { ReactNode } from "react";
import { AuroraBackdrop, Logo } from "@/components/ui";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-hidden">
      <AuroraBackdrop grid />
      <header className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <Logo />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:pt-12">
        <div className="animate-fade-up w-full max-w-md rounded-2xl border border-ink-200 bg-surface/80 p-8 shadow-[0_30px_80px_-40px_var(--color-aurora-600)] backdrop-blur-xl">
          {children}
        </div>
      </main>
    </div>
  );
}
