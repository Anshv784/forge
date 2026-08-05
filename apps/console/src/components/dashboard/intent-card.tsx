"use client";

import { ArrowRight, Check, Clock, Link2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Address } from "@/components/ui/address";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { IntentAccountData } from "@/hooks/use-intents";
import { cn, formatLamports, formatTokenAmount, formatRelativeTime } from "@/lib/utils";
import { solscanAddressUrl } from "@/lib/config";
import { useCluster } from "@/components/providers/cluster-provider";

const statusTone = {
  pending: "violet",
  approved: "success",
  denied: "danger",
  expired: "danger",
  executed: "success",
} as const;

export function IntentCard({
  intent,
  isOwner,
  explorerCluster,
  onApprove,
  onDeny,
  pendingAction,
}: {
  intent: IntentAccountData;
  isOwner: boolean;
  explorerCluster: string;
  onApprove: () => void;
  onDeny: () => void;
  pendingAction: string | null;
}) {
  const isExpired = intent.status === "pending" && Date.now() / 1000 > intent.expiresAt;
  const amountLabel =
    intent.asset === "sol" ? formatLamports(intent.amount) : formatTokenAmount(intent.amount, 6, "tokens");
  const key = intent.address.toBase58();
  const approving = pendingAction === `approve-${key}`;
  const denying = pendingAction === `deny-${key}`;
  const { cluster } = useCluster();
  const [linkCopied, setLinkCopied] = useState(false);
  const awaitingSignature = isOwner && intent.status === "pending" && !isExpired;

  async function copyBlinkLink() {
    const actionUrl = `${window.location.origin}/api/actions/intent/${key}?cluster=${cluster.id}`;
    const blinkUrl = `https://dial.to/?action=solana-action:${encodeURIComponent(actionUrl)}`;
    await navigator.clipboard.writeText(blinkUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "rounded-xl border border-border bg-surface p-4 shadow-elevation-xs transition-[border-color,box-shadow] duration-200 hover:border-border-strong",
        awaitingSignature && "border-glow-animated"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={isExpired ? "danger" : statusTone[intent.status]} dot>
              {isExpired ? "expired" : intent.status}
            </Badge>
            <span className="font-mono text-[11px] tabular-nums text-foreground-subtle">nonce {intent.nonce.toString()}</span>
            {intent.status === "pending" && !isExpired && (
              <button
                onClick={copyBlinkLink}
                title="Copy a Blink link — approve from any wallet, on any device"
                className="flex items-center gap-1 rounded text-[11px] text-foreground-subtle transition-colors duration-150 hover:text-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
              >
                <Link2 className="h-3 w-3" />
                {linkCopied ? "Copied" : "Blink link"}
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 font-display text-base font-medium tracking-[-0.011em] text-foreground">
            <span className="tabular-nums">{amountLabel}</span>
            <ArrowRight className="h-3.5 w-3.5 text-foreground-subtle" />
            <Address
              value={intent.destination.toBase58()}
              href={solscanAddressUrl(intent.destination.toBase58(), explorerCluster)}
            />
          </div>
          <p className="flex items-center gap-1 text-[12px] text-foreground-subtle">
            <Clock className="h-3 w-3" />
            {intent.status === "pending"
              ? `Expires ${formatRelativeTime(intent.expiresAt)}`
              : `Proposed ${formatRelativeTime(intent.createdAt)}`}
          </p>
        </div>

        <AnimatePresence>
          {isOwner && intent.status === "pending" && !isExpired && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex shrink-0 gap-2"
            >
              <Button size="sm" variant="secondary" onClick={onDeny} loading={denying} disabled={approving}>
                <X className="h-3.5 w-3.5" /> Deny
              </Button>
              <Button size="sm" variant="primary" onClick={onApprove} loading={approving} disabled={denying}>
                <Check className="h-3.5 w-3.5" /> Approve
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
