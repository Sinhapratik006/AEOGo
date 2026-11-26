// Plain module (no "use client") so both Server and Client Components can import the data.
export const DASHBOARD_LINKS = [
  { href: "/dashboard", label: "Websites" },
  { href: "/dashboard/messages", label: "Messages" },
  { href: "/dashboard/billing", label: "Billing" },
  { href: "/dashboard/settings", label: "Settings" },
];

/** Shown only to admins. */
export const ADMIN_LINKS = [
  { href: "/dashboard/admin/messages", label: "Admin messages" },
  { href: "/dashboard/admin/plans", label: "Admin plans" },
];
