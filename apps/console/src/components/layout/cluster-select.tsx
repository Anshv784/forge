"use client";

import { ChevronDown } from "lucide-react";
import { useCluster } from "@/components/providers/cluster-provider";

export function ClusterSelect() {
  const { cluster, setClusterId, clusters } = useCluster();

  return (
    <div className="relative">
      <select
        value={cluster.id}
        onChange={(e) => setClusterId(e.target.value)}
        className="peer h-9 appearance-none rounded-lg border border-border bg-transparent pl-3 pr-8 text-[13px] font-medium text-foreground-muted outline-none transition-colors hover:border-border-strong hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        {clusters.map((c) => (
          <option key={c.id} value={c.id} className="bg-surface text-foreground">
            {c.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-subtle peer-hover:text-foreground" />
    </div>
  );
}
