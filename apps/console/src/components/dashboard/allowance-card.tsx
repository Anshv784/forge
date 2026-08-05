"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
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
  const usedFraction = max > 0n ? Number(spent) / Number(max) : 0;
  const isNearCap = usedFraction >= 0.8;
  const isSpl = label.toLowerCase().includes("spl");

  // Animate the displayed "remaining" figure toward its new value instead of
  // snapping, rounding back to a whole unit for display each frame. Bigints
  // above Number.MAX_SAFE_INTEGER can't round-trip through a MotionValue
  // without losing precision, so those fall back to an exact, unanimated
  // render instead of a silently-wrong number.
  const canAnimate = remaining <= BigInt(Number.MAX_SAFE_INTEGER);
  const remainingNumber = canAnimate ? Number(remaining) : 0;
  const motionRemaining = useMotionValue(remainingNumber);
  const springRemaining = useSpring(motionRemaining, { stiffness: 210, damping: 26, mass: 0.5 });
  const displayRemaining = useTransform(springRemaining, (v) =>
    formatValue(BigInt(Math.max(0, Math.round(v))))
  );

  useEffect(() => {
    if (canAnimate) motionRemaining.set(remainingNumber);
  }, [remainingNumber, motionRemaining, canAnimate]);

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 shadow-elevation-xs",
        "transition-[border-color,box-shadow] duration-200 hover:border-border-strong hover:shadow-elevation-sm",
        className
      )}
    >
      <div className="relative shrink-0">
        <RadialGauge fraction={fraction} tone={tone} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-sm font-medium tabular-nums text-foreground">
            {Math.round(fraction * 100)}%
          </span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-foreground-subtle">{label}</p>
        <motion.p className="mt-1 truncate font-display text-lg font-medium tracking-[-0.011em] tabular-nums text-foreground">
          {canAnimate ? displayRemaining : formatValue(remaining)}
        </motion.p>
        <p className="text-[12.5px] text-foreground-subtle">of {formatValue(max)} remaining today</p>
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
          <motion.div
            className={cn(
              "h-full rounded-full",
              isNearCap
                ? "animate-progress-sweep"
                : isSpl
                  ? "bg-linear-to-r from-accent-emerald/60 to-accent-emerald"
                  : "bg-linear-to-r from-accent/60 to-accent"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.round(usedFraction * 100))}%` }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>
    </div>
  );
}
