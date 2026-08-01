"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { AlertTriangle, ShieldOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/header";
import { ConnectPrompt } from "@/components/dashboard/connect-prompt";
import { OwnerSelector } from "@/components/dashboard/owner-selector";
import { PolicyHero } from "@/components/dashboard/policy-hero";
import { AllowanceCard } from "@/components/dashboard/allowance-card";
import { SpendChart } from "@/components/dashboard/spend-chart";
import { PendingIntents } from "@/components/dashboard/pending-intents";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { usePolicy } from "@/hooks/use-policy";
import { useIntents } from "@/hooks/use-intents";
import { useReceipts } from "@/hooks/use-receipts";
import { useCarapaceActions } from "@/hooks/use-carapace-actions";
import { useCluster } from "@/components/providers/cluster-provider";
import { formatLamports, formatTokenAmount } from "@/lib/utils";

export default function Home() {
  const { publicKey } = useWallet();
  const { cluster } = useCluster();

  const [ownerInput, setOwnerInput] = useState("");
  const [agentIndex, setAgentIndex] = useState(0);

  useEffect(() => {
    if (publicKey && !ownerInput) setOwnerInput(publicKey.toBase58());
  }, [publicKey, ownerInput]);

  const ownerPubkey = useMemo(() => {
    try {
      return ownerInput ? new PublicKey(ownerInput) : null;
    } catch {
      return null;
    }
  }, [ownerInput]);

  const { policy, policyAddress, solVaultBalance, loading, notFound, refresh } = usePolicy(
    ownerPubkey,
    agentIndex
  );
  const { intents, refresh: refreshIntents } = useIntents(policyAddress);
  const { receipts, loading: receiptsLoading } = useReceipts(policyAddress);
  const { approveIntent, denyIntent, setPaused, pendingAction, actionError } = useCarapaceActions();

  const isOwner = Boolean(publicKey && policy && publicKey.equals(policy.owner));

  async function handleTogglePause() {
    if (!publicKey || !policyAddress || !policy) return;
    await setPaused(publicKey, policyAddress, !policy.paused);
    refresh();
  }

  async function handleApprove(intentAddress: PublicKey) {
    if (!publicKey || !policyAddress) return;
    await approveIntent(publicKey, policyAddress, intentAddress);
    refreshIntents();
  }

  async function handleDeny(intentAddress: PublicKey) {
    if (!publicKey || !policyAddress) return;
    await denyIntent(publicKey, policyAddress, intentAddress);
    refreshIntents();
  }

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {!publicKey ? (
          <ConnectPrompt />
        ) : (
          <div className="space-y-6">
            <OwnerSelector
              ownerInput={ownerInput}
              onOwnerInputChange={setOwnerInput}
              agentIndex={agentIndex}
              onAgentIndexChange={setAgentIndex}
              onResetToWallet={() => setOwnerInput(publicKey.toBase58())}
              canReset={ownerInput !== publicKey.toBase58()}
            />

            {actionError && (
              <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-tint px-4 py-3 text-[13px] text-danger">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="wrap-break-word">{actionError}</span>
              </div>
            )}

            {loading && !policy ? (
              <div className="space-y-6">
                <Skeleton className="h-40 w-full rounded-2xl" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Skeleton className="h-28 rounded-2xl" />
                  <Skeleton className="h-28 rounded-2xl" />
                </div>
              </div>
            ) : notFound || !policy || !policyAddress ? (
              <EmptyState
                icon={<ShieldOff className="h-5 w-5" />}
                title="No policy found for this owner + agent index"
                description={`Nothing is initialized yet on ${cluster.label}. Run initializePolicy from the setup guide (docs/SETUP.md) to create one.`}
                className="rounded-2xl border border-border bg-surface py-20"
              />
            ) : (
              <>
                <PolicyHero
                  policy={policy}
                  policyAddress={policyAddress}
                  solVaultBalance={solVaultBalance}
                  isOwner={isOwner}
                  explorerCluster={cluster.explorerCluster}
                  onTogglePause={handleTogglePause}
                  pausePending={pendingAction === "pause"}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <AllowanceCard
                    label="SOL allowance"
                    spent={policy.spentTodayLamports}
                    max={policy.maxDailyLamports}
                    formatValue={(v) => formatLamports(v)}
                  />
                  <AllowanceCard
                    label="SPL allowance"
                    spent={policy.spentTodaySpl}
                    max={policy.maxDailySpl}
                    formatValue={(v) => formatTokenAmount(v, 6, "tok")}
                  />
                </div>

                <SpendChart receipts={receipts} />

                <div className="grid gap-6 lg:grid-cols-2">
                  <PendingIntents
                    intents={intents}
                    loading={loading}
                    isOwner={isOwner}
                    explorerCluster={cluster.explorerCluster}
                    pendingAction={pendingAction}
                    onApprove={(intent) => handleApprove(intent.address)}
                    onDeny={(intent) => handleDeny(intent.address)}
                  />
                  <ActivityFeed receipts={receipts} loading={receiptsLoading} explorerCluster={cluster.explorerCluster} />
                </div>
              </>
            )}
          </div>
        )}
      </main>
      <footer className="mx-auto w-full max-w-6xl px-6 py-8 text-center text-[12px] text-foreground-subtle">
        Carapace — on-chain enforced guardrails for autonomous ZeroClaw agents.
      </footer>
    </>
  );
}
