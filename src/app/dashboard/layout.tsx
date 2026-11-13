import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { DASHBOARD_LINKS } from "@/components/dashboard/links";
import { NavLinks } from "@/components/dashboard/nav-links";
import { Logo, Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · AEOGo" },
  robots: { index: false, follow: false },
};

function StaticNavLinks() {
  return (
    <>
      {DASHBOARD_LINKS.map((link) => (
        <Link key={link.href} href={link.href} className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
          {link.label}
        </Link>
      ))}
    </>
  );
}

async function UserMenu() {
  const user = await requireUser();
  return (
    <div className="flex items-center gap-3">
      <span className="hidden max-w-48 truncate text-sm text-slate-600 sm:inline" title={user.email}>
        {user.email}
      </span>
      <LogoutButton />
    </div>
  );
}

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Logo href="/dashboard" />
            <nav aria-label="Dashboard" className="hidden items-center gap-1 sm:flex">
              <Suspense fallback={<StaticNavLinks />}>
                <NavLinks />
              </Suspense>
            </nav>
          </div>
          <Suspense fallback={<Skeleton className="h-8 w-40" />}>
            <UserMenu />
          </Suspense>
        </div>
        <nav aria-label="Dashboard" className="flex gap-1 overflow-x-auto border-t border-slate-100 px-2 py-1 sm:hidden">
          <Suspense fallback={<StaticNavLinks />}>
            <NavLinks />
          </Suspense>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
