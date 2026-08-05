"use client";

import { motion } from "framer-motion";
import { useId } from "react";
import { cn } from "@/lib/utils";

/** Hand-built SVG radial gauge — no charting library needed for a single
 * ring. `fraction` is remaining/total, clamped to [0, 1]. */
export function RadialGauge({
  fraction,
  size = 88,
  strokeWidth = 7,
  tone = "accent",
  className,
}: {
  fraction: number;
  size?: number;
  strokeWidth?: number;
  tone?: "accent" | "danger" | "warning";
  className?: string;
}) {
  const gradientId = useId();
  const clamped = Math.max(0, Math.min(1, fraction));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);

  const toneStroke = {
    accent: `url(#${gradientId})`,
    danger: "var(--danger)",
    warning: "var(--warning)",
  }[tone];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={cn("-rotate-90", className)}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--solana-purple)" />
          <stop offset="100%" stopColor="var(--solana-green)" />
        </linearGradient>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--border)"
        strokeWidth={strokeWidth}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={toneStroke}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeLinecap="round"
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        style={{ transition: "stroke 0.3s ease" }}
      />
    </svg>
  );
}
