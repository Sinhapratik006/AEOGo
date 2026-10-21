import { Skeleton } from "@/components/ui";

export function AuthFormFallback({ fields = 2 }: { fields?: number }) {
  return (
    <div className="space-y-5" aria-hidden="true">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      <Skeleton className="h-12 w-full" />
    </div>
  );
}
