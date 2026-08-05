"use client";

import { motion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { ReceiptEvent } from "@/hooks/use-receipts";
import { formatLamports, formatAbsoluteTime } from "@/lib/utils";
import { LineChart as LineChartIcon } from "lucide-react";

interface Point {
  time: number;
  spentToday: number;
  label: string;
}

function buildSeries(receipts: ReceiptEvent[]): Point[] {
  return receipts
    .filter((e) => e.name === "transferExecuted" && e.blockTime)
    .map((e) => {
      const data = e.data as Record<string, { toString(): string }>;
      return {
        time: e.blockTime as number,
        spentToday: Number(data.spentToday?.toString() ?? "0"),
        label: formatAbsoluteTime(e.blockTime as number),
      };
    })
    .sort((a, b) => a.time - b.time);
}

export function SpendChart({ receipts }: { receipts: ReceiptEvent[] }) {
  const series = buildSeries(receipts);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>SOL spent today, over time</CardTitle>
          <CardDescription>Resets on the first transfer after the 24h window rolls — see docs/SECURITY.md.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {series.length < 2 ? (
          <EmptyState
            icon={<LineChartIcon className="h-5 w-5" />}
            title="Not enough data yet"
            description="This fills in once a few SOL transfers have executed."
            className="py-8"
          />
        ) : (
          <motion.div
            className="h-56 w-full origin-bottom"
            initial={{ opacity: 0, scaleY: 0.92 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide />
                <YAxis
                  tickFormatter={(v) => formatLamports(v)}
                  width={72}
                  tick={{ fill: "var(--foreground-subtle)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => formatLamports(Number(value))}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ""}
                  cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
                  contentStyle={{
                    background: "var(--surface-raised)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    boxShadow: "var(--shadow-md)",
                    fontSize: 12,
                    color: "var(--foreground)",
                  }}
                />
                <Area
                  type="stepAfter"
                  dataKey="spentToday"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  fill="url(#spendFill)"
                  animationDuration={600}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
