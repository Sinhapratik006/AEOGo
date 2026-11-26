import type { ReactNode } from "react";

// Templates remount on navigation, so each dashboard page fades in.
export default function DashboardTemplate({ children }: { children: ReactNode }) {
  return <div className="animate-fade-up">{children}</div>;
}
