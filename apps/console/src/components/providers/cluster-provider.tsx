"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { CLUSTERS, DEFAULT_CLUSTER_ID, type ClusterOption } from "@/lib/config";

interface ClusterContextValue {
  cluster: ClusterOption;
  setClusterId: (id: string) => void;
  clusters: ClusterOption[];
}

const ClusterContext = createContext<ClusterContextValue | null>(null);

export function ClusterProvider({ children }: { children: React.ReactNode }) {
  const [clusterId, setClusterId] = useState(DEFAULT_CLUSTER_ID);
  const cluster = useMemo(
    () => CLUSTERS.find((c) => c.id === clusterId) ?? CLUSTERS[0],
    [clusterId]
  );

  const value = useMemo(() => ({ cluster, setClusterId, clusters: CLUSTERS }), [cluster]);

  return <ClusterContext.Provider value={value}>{children}</ClusterContext.Provider>;
}

export function useCluster() {
  const ctx = useContext(ClusterContext);
  if (!ctx) throw new Error("useCluster must be used within ClusterProvider");
  return ctx;
}
