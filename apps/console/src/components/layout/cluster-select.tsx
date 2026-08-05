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
        className="peer h-9 appearance-none rounded-lg border border-border bg-transparent pl-3 pr-8 text-[12.5px] font-medium text-foreground-muted outline-none transition-[color,border-color] duration-150 hover:border-border-strong hover:text-foreground focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent/15"
      >
        {clusters.map((c) => (
          <option key={c.id} value={c.id} className="bg-surface text-foreground">
            {c.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-subtle transition-colors duration-150 peer-hover:text-foreground" />
    </div>
  );
}
