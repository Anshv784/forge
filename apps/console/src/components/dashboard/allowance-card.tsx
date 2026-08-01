import { RadialGauge } from "./radial-gauge";
import { cn } from "@/lib/utils";

export function AllowanceCard({
  label,
  spent,
  max,
  formatValue,
  className,
}: {
  label: string;
  spent: bigint;
  max: bigint;
  formatValue: (v: bigint) => string;
  className?: string;
}) {
  const remaining = max > spent ? max - spent : 0n;
  const fraction = max > 0n ? Number(remaining) / Number(max) : 0;
  const tone = fraction < 0.15 ? "danger" : fraction < 0.4 ? "warning" : "accent";

  return (
    <div className={cn("flex items-center gap-4 rounded-2xl border border-border bg-surface p-5", className)}>
      <div className="relative shrink-0">
        <RadialGauge fraction={fraction} tone={tone} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-sm font-medium text-foreground">
            {Math.round(fraction * 100)}%
          </span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-foreground-subtle">{label}</p>
        <p className="mt-1 truncate font-display text-lg font-medium text-foreground">
          {formatValue(remaining)}
        </p>
        <p className="text-[13px] text-foreground-subtle">of {formatValue(max)} remaining today</p>
      </div>
    </div>
  );
}
