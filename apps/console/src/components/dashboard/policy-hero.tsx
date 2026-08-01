"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";
import type { PublicKey } from "@solana/web3.js";
import { Address } from "@/components/ui/address";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PolicyAccountData } from "@/hooks/use-policy";
import { formatLamports, formatRelativeTime } from "@/lib/utils";
import { solscanAddressUrl } from "@/lib/config";

export function PolicyHero({
  policy,
  policyAddress,
  solVaultBalance,
  isOwner,
  explorerCluster,
  onTogglePause,
  pausePending,
}: {
  policy: PolicyAccountData;
  policyAddress: PublicKey;
  solVaultBalance: number | null;
  isOwner: boolean;
  explorerCluster: string;
  onTogglePause: () => void;
  pausePending: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface">
      <div
        className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full opacity-[0.15] blur-3xl"
        style={{ background: "var(--accent)" }}
      />
      <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={policy.paused ? "danger" : "success"} dot>
              {policy.paused ? "Paused" : "Active"}
            </Badge>
            <span className="text-[13px] text-foreground-subtle">Agent #{policy.agentIndex}</span>
          </div>
          <h1 className="font-display text-2xl font-medium tracking-tight text-foreground">
            {solVaultBalance !== null ? formatLamports(solVaultBalance) : "—"}
            <span className="ml-2 text-sm font-normal text-foreground-subtle">in vault</span>
          </h1>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-[13px] sm:flex sm:gap-8">
            <div className="flex items-baseline gap-2">
              <dt className="text-foreground-subtle">Owner</dt>
              <dd>
                <Address value={policy.owner.toBase58()} href={solscanAddressUrl(policy.owner.toBase58(), explorerCluster)} />
              </dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="text-foreground-subtle">Delegate</dt>
              <dd>
                <Address
                  value={policy.delegate.toBase58()}
                  href={solscanAddressUrl(policy.delegate.toBase58(), explorerCluster)}
                />
              </dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="text-foreground-subtle">Policy</dt>
              <dd>
                <Address value={policyAddress.toBase58()} href={solscanAddressUrl(policyAddress.toBase58(), explorerCluster)} />
              </dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="text-foreground-subtle">Executed</dt>
              <dd className="font-mono text-foreground-muted">{policy.totalExecutedCount.toString()}×</dd>
            </div>
          </dl>
          {policy.expiresAt > 0 && (
            <p className="text-[13px] text-foreground-subtle">
              Policy expires {formatRelativeTime(policy.expiresAt)}
            </p>
          )}
        </div>

        {isOwner && (
          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
            <Button
              variant={policy.paused ? "primary" : "danger"}
              onClick={onTogglePause}
              loading={pausePending}
            >
              {policy.paused ? (
                <>
                  <ShieldCheck className="h-4 w-4" /> Resume agent
                </>
              ) : (
                <>
                  <ShieldAlert className="h-4 w-4" /> Pause agent
                </>
              )}
            </Button>
            <p className="max-w-[220px] text-right text-[11px] text-foreground-subtle">
              {policy.paused
                ? "The delegate cannot propose or execute anything until resumed."
                : "Instantly blocks the delegate from proposing or executing. You can still withdraw."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
