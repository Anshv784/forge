"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { ChevronDown } from "lucide-react";
import { useCluster } from "@/components/providers/cluster-provider";
import { cn } from "@/lib/utils";

export function ClusterSelect() {
  const { cluster, setClusterId, clusters } = useCluster();
  const { connected } = useWallet();

  return (
    <div className="relative flex items-center">
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-2.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full",
          connected ? "animate-shell-pulse bg-accent-emerald" : "bg-foreground-subtle/50"
        )}
        title={connected ? "Wallet connected" : "No wallet connected"}
      />
      <select
        value={cluster.id}
        onChange={(e) => setClusterId(e.target.value)}
        className="peer h-9 appearance-none rounded-lg border border-border bg-transparent py-0 pl-6 pr-8 text-[12.5px] font-medium text-foreground-muted outline-none transition-[color,border-color] duration-150 hover:border-border-strong hover:text-foreground focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent/15"
      >
        {clusters.map((c) => (
          <option key={c.id} value={c.id} className="bg-surface text-foreground">
            {c.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-subtle transition-[color,transform] duration-200 peer-hover:text-foreground peer-focus-visible:rotate-180 peer-focus-visible:text-accent" />
    </div>
  );
}
