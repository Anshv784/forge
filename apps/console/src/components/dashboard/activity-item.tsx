import { ArrowUpRight, Ban, CheckCircle2, CircleDot, Settings2, ShieldAlert } from "lucide-react";
import type { ReceiptEvent } from "@/hooks/use-receipts";
import { Address } from "@/components/ui/address";
import { formatLamports, formatTokenAmount, formatRelativeTime } from "@/lib/utils";
import { solscanAddressUrl, solscanTxUrl } from "@/lib/config";

function assetAmount(asset: unknown, amount: unknown): string {
  const isSpl = typeof asset === "object" && asset !== null && "spl" in asset;
  const value = BigInt((amount as { toString(): string }).toString());
  return isSpl ? formatTokenAmount(value, 6, "tokens") : formatLamports(value);
}

function describe(event: ReceiptEvent, explorerCluster: string): { icon: React.ReactNode; text: React.ReactNode } {
  const d = event.data as Record<string, { toBase58?: () => string; toString(): string }>;
  const addr = (key: string) => (d[key] as { toBase58: () => string })?.toBase58?.() ?? "";

  switch (event.name) {
    case "transferExecuted":
      return {
        icon: <ArrowUpRight className="h-3.5 w-3.5 text-success" />,
        text: (
          <>
            Executed <span className="font-medium tabular-nums text-foreground">{assetAmount(d.asset, d.amount)}</span> to{" "}
            <Address value={addr("destination")} href={solscanAddressUrl(addr("destination"), explorerCluster)} />
          </>
        ),
      };
    case "intentProposed":
      return {
        icon: <CircleDot className="h-3.5 w-3.5 text-warning" />,
        text: (
          <>
            Proposed <span className="font-medium tabular-nums text-foreground">{assetAmount(d.asset, d.amount)}</span> to{" "}
            <Address value={addr("destination")} href={solscanAddressUrl(addr("destination"), explorerCluster)} />
          </>
        ),
      };
    case "intentApproved":
      return {
        icon: <CheckCircle2 className="h-3.5 w-3.5 text-info" />,
        text: <>Approved intent #{d.nonce?.toString()}</>,
      };
    case "intentDenied":
      return {
        icon: <Ban className="h-3.5 w-3.5 text-danger" />,
        text: <>Denied intent #{d.nonce?.toString()}</>,
      };
    case "pausedSet":
      return {
        icon: <ShieldAlert className="h-3.5 w-3.5 text-danger" />,
        text: <>{(d.paused as unknown as boolean) ? "Paused" : "Resumed"} the agent</>,
      };
    case "limitsUpdated":
      return { icon: <Settings2 className="h-3.5 w-3.5 text-foreground-subtle" />, text: <>Updated spending limits</> };
    default:
      return { icon: <CircleDot className="h-3.5 w-3.5 text-foreground-subtle" />, text: <>{event.name}</> };
  }
}

export function ActivityItem({ event, explorerCluster }: { event: ReceiptEvent; explorerCluster: string }) {
  const { icon, text } = describe(event, explorerCluster);
  return (
    <div className="flex items-start gap-3 py-3 transition-colors duration-150 first:pt-0 last:pb-0">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-raised">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-relaxed text-foreground-muted">{text}</p>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-foreground-subtle">
          {event.blockTime && <span>{formatRelativeTime(event.blockTime)}</span>}
          <a
            href={solscanTxUrl(event.signature, explorerCluster)}
            target="_blank"
            rel="noreferrer"
            className="rounded font-mono transition-colors duration-150 hover:text-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
          >
            {event.signature.slice(0, 8)}…
          </a>
        </div>
      </div>
    </div>
  );
}
