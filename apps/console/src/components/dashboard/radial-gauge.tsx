"use client";

import { cn } from "@/lib/utils";

/** Hand-built SVG radial gauge — no charting library needed for a single
 * ring. `fraction` is remaining/total, clamped to [0, 1]. */
export function RadialGauge({
  fraction,
  size = 88,
  strokeWidth = 8,
  tone = "accent",
  className,
}: {
  fraction: number;
  size?: number;
  strokeWidth?: number;
  tone?: "accent" | "danger" | "warning";
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(1, fraction));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);

  const toneVar = {
    accent: "var(--accent)",
    danger: "var(--danger)",
    warning: "var(--warning)",
  }[tone];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={cn("-rotate-90", className)}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--border)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={toneVar}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.22, 1, 0.36, 1)" }}
      />
    </svg>
  );
}
