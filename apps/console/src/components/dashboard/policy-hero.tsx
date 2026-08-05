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
    <div className="ambient-glow relative overflow-hidden rounded-2xl border border-border bg-surface shadow-elevation-sm">
      <div className="relative flex flex-col gap-7 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div className="space-y-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={policy.paused ? "danger" : "success"} dot>
              {policy.paused ? "Paused" : "Active"}
            </Badge>
            <span className="text-[12.5px] text-foreground-subtle">Agent #{policy.agentIndex}</span>
          </div>
          <h1 className="font-display text-[32px] font-medium leading-none tracking-[-0.02em] tabular-nums text-foreground">
            <span className="gradient-text-brand">
              {solVaultBalance !== null ? formatLamports(solVaultBalance) : "—"}
            </span>
            <span className="ml-2.5 font-sans text-sm font-normal tracking-normal text-foreground-subtle">
              in vault
            </span>
          </h1>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-[13px] sm:flex sm:gap-8">
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
              <dd className="font-mono tabular-nums text-foreground-muted">{policy.totalExecutedCount.toString()}×</dd>
            </div>
          </dl>
          {policy.expiresAt > 0 && (
            <p className="text-[12.5px] text-foreground-subtle">
              Policy expires {formatRelativeTime(policy.expiresAt)}
            </p>
          )}
        </div>

        {isOwner && (
          <div className="flex shrink-0 flex-col items-start gap-2.5 sm:items-end">
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
            <p className="max-w-55 text-right text-[11.5px] leading-relaxed text-foreground-subtle">
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
