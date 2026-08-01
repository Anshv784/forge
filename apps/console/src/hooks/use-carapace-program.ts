"use client";

import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { useMemo } from "react";
import { getCarapaceProgram } from "@/lib/carapace/program";

/** Anchor Program client bound to the current cluster connection and (if
 * connected) the current wallet. Read operations work without a wallet;
 * writes (approve/deny/pause) require one. */
export function useCarapaceProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  return useMemo(() => getCarapaceProgram(connection, wallet), [connection, wallet]);
}
