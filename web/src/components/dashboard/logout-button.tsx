"use client";

import { useState } from "react";
import { api } from "@/lib/client/api";
import { buttonClasses } from "../ui";

export function LogoutButton({ className }: { className?: string }) {
  const [pending, setPending] = useState(false);
  async function logout() {
    setPending(true);
    try {
      await api("/api/auth/logout");
    } finally {
      // Full page load on purpose: drops every client-cached dashboard page from the old session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    }
  }
  return (
    <button type="button" onClick={logout} disabled={pending} className={className ?? buttonClasses("ghost", "sm")}>
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
