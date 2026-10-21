import { ButtonLink, Logo } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <Logo />
      <p className="mt-10 text-sm font-semibold text-indigo-600">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Page not found</h1>
      <p className="mt-3 text-slate-600">The page you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.</p>
      <div className="mt-8 flex gap-3">
        <ButtonLink href="/">Go home</ButtonLink>
        <ButtonLink href="/dashboard" variant="secondary">
          Dashboard
        </ButtonLink>
      </div>
    </main>
  );
}
