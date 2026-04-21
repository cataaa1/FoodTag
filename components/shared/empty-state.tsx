import { cn } from "@/lib/utils";

export function EmptyState({
  className,
  title,
  description,
}: {
  className?: string;
  title: string;
  description: string;
}) {
  return (
    <div
      className={cn(
        "surface-card flex min-h-40 flex-col items-center justify-center gap-2 px-6 py-8 text-center",
        className,
      )}
    >
      <p className="text-lg font-bold tracking-tight">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
