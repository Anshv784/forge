export const PROGRAM_ID =
  process.env.NEXT_PUBLIC_CARAPACE_PROGRAM_ID ?? "GuZ6yoSDkTcYh2PKAeoDdb51ZhP9i7pRhL6MGrZXST8L";

export interface ClusterOption {
  id: string;
  label: string;
  endpoint: string;
  explorerCluster: string; // query param suffix for solscan/explorer links
}

export const CLUSTERS: ClusterOption[] = [
  {
    id: "localnet",
    label: "Localnet",
    endpoint: process.env.NEXT_PUBLIC_LOCALNET_RPC_URL ?? "http://127.0.0.1:8899",
    explorerCluster: "custom&customUrl=http%3A%2F%2F127.0.0.1%3A8899",
  },
  {
    id: "devnet",
    label: "Devnet",
    endpoint: process.env.NEXT_PUBLIC_DEVNET_RPC_URL ?? "https://api.devnet.solana.com",
    explorerCluster: "devnet",
  },
  {
    id: "mainnet-beta",
    label: "Mainnet Beta",
    endpoint: process.env.NEXT_PUBLIC_MAINNET_RPC_URL ?? "https://api.mainnet-beta.solana.com",
    explorerCluster: "",
  },
];

export const DEFAULT_CLUSTER_ID = process.env.NEXT_PUBLIC_DEFAULT_CLUSTER ?? "devnet";

export function solscanTxUrl(signature: string, explorerCluster: string) {
  const suffix = explorerCluster ? `?cluster=${explorerCluster}` : "";
  return `https://solscan.io/tx/${signature}${suffix}`;
}

export function solscanAddressUrl(address: string, explorerCluster: string) {
  const suffix = explorerCluster ? `?cluster=${explorerCluster}` : "";
  return `https://solscan.io/account/${address}${suffix}`;
}
