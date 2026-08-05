import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3.5 px-6 py-12 text-center", className)}>
      {icon && (
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border text-foreground-subtle shadow-elevation-xs"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, color-mix(in srgb, var(--accent) 10%, var(--surface-raised)), var(--surface-raised))",
          }}
        >
          {icon}
        </div>
      )}
      <div className="space-y-1.5">
        <p className="text-[13.5px] font-medium tracking-[-0.006em] text-foreground">{title}</p>
        {description && (
          <p className="max-w-xs text-[13px] leading-relaxed text-foreground-subtle">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
