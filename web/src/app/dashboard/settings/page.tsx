import type { Metadata } from "next";
import { Suspense } from "react";
import { NameForm, PasswordForm } from "@/components/dashboard/account-forms";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { buttonClasses, Card, PageHeader, Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Manage your account details and password." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <SettingsView />
      </Suspense>
    </>
  );
}

async function SettingsView() {
  const user = await requireUser();
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="font-semibold text-slate-900">Profile</h2>
        <p className="mt-1 mb-5 text-sm text-slate-600">Signed in as {user.email}</p>
        <NameForm initialName={user.name} />
      </Card>
      <Card className="p-6">
        <h2 className="mb-5 font-semibold text-slate-900">Password</h2>
        <PasswordForm />
      </Card>
      <Card className="flex items-center justify-between p-6">
        <div>
          <h2 className="font-semibold text-slate-900">Sign out</h2>
          <p className="mt-1 text-sm text-slate-600">Sign out of AEOGo on this device.</p>
        </div>
        <LogoutButton className={buttonClasses("secondary", "sm")} />
      </Card>
    </div>
  );
}
