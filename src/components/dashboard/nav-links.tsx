"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../ui";
import { ADMIN_LINKS, DASHBOARD_LINKS } from "./links";

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname.startsWith("/dashboard/websites") || pathname.startsWith("/dashboard/checkout");
  }
  return pathname.startsWith(href);
}

export function NavLinks({ unreadMessages = 0, isAdmin = false }: { unreadMessages?: number; isAdmin?: boolean }) {
  const pathname = usePathname();
  const links = isAdmin ? [...DASHBOARD_LINKS, ...ADMIN_LINKS] : DASHBOARD_LINKS;
  return (
    <>
      {links.map((link) => {
        const active = isActive(pathname, link.href);
        const badge = link.href === "/dashboard/messages" && unreadMessages > 0 ? unreadMessages : null;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition",
              active
                ? "bg-aurora-50 text-aurora-700 shadow-[0_0_16px_-6px_var(--color-aurora-600)] ring-1 ring-aurora-200 ring-inset"
                : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
            )}
          >
            {link.label}
            {badge !== null && (
              <span className="inline-flex min-w-5 animate-glow-pulse items-center justify-center rounded-full bg-aurora-600 px-1.5 text-[11px] leading-5 font-bold text-on-accent">
                {badge > 99 ? "99+" : badge}
                <span className="sr-only"> unread</span>
              </span>
            )}
          </Link>
        );
      })}
    </>
  );
}
