"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { AnimatePresence, motion, type Variants } from "framer-motion";
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
import { AllowlistPanel } from "@/components/dashboard/allowlist-panel";
import { LimitsPanel } from "@/components/dashboard/limits-panel";
import { VaultPanel } from "@/components/dashboard/vault-panel";
import { DelegatePanel } from "@/components/dashboard/delegate-panel";
import { InitPolicyForm } from "@/components/dashboard/init-policy-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { usePolicy } from "@/hooks/use-policy";
import { useIntents } from "@/hooks/use-intents";
import { useReceipts } from "@/hooks/use-receipts";
import { useAllowlist } from "@/hooks/use-allowlist";
import { useCarapaceActions } from "@/hooks/use-carapace-actions";
import { useCluster } from "@/components/providers/cluster-provider";
import { useToast } from "@/components/providers/toast-provider";
import { formatLamports, formatTokenAmount } from "@/lib/utils";
import { solscanTxUrl } from "@/lib/config";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export default function Home() {
  const { publicKey } = useWallet();
  const { cluster } = useCluster();
  const { show: showToast } = useToast();

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
  const { receipts, loading: receiptsLoading, refresh: refreshReceipts } = useReceipts(policyAddress);
  const { entries: allowlistEntries, loading: allowlistLoading, refresh: refreshAllowlist } = useAllowlist(policyAddress);
  const actions = useCarapaceActions();
  const { pendingAction, actionError } = actions;

  const isOwner = Boolean(publicKey && policy && publicKey.equals(policy.owner));
  const isViewingOwnPolicy = Boolean(publicKey && ownerPubkey && publicKey.equals(ownerPubkey));

  function refreshAll() {
    refresh();
    refreshIntents();
    refreshReceipts();
    refreshAllowlist();
  }

  async function withToast(label: string, fn: () => Promise<string>) {
    try {
      const sig = await fn();
      showToast({ tone: "success", title: label, href: solscanTxUrl(sig, cluster.explorerCluster) });
      refreshAll();
      return sig;
    } catch (e) {
      showToast({ tone: "error", title: `${label} failed`, description: e instanceof Error ? e.message : String(e) });
      throw e;
    }
  }

  async function handleTogglePause() {
    if (!publicKey || !policyAddress || !policy) return;
    await withToast(policy.paused ? "Agent resumed" : "Agent paused", () =>
      actions.setPaused(publicKey, policyAddress, !policy.paused)
    );
  }

  async function handleApprove(intentAddress: PublicKey) {
    if (!publicKey || !policyAddress) return;
    await withToast("Intent approved", () => actions.approveIntent(publicKey, policyAddress, intentAddress));
  }

  async function handleDeny(intentAddress: PublicKey) {
    if (!publicKey || !policyAddress) return;
    await withToast("Intent denied", () => actions.denyIntent(publicKey, policyAddress, intentAddress));
  }

  async function handleAddAllowlist(destination: PublicKey) {
    if (!publicKey || !policyAddress) return;
    return withToast("Destination allow-listed", () => actions.addAllowlistEntry(publicKey, policyAddress, destination));
  }

  async function handleRemoveAllowlist(destination: PublicKey) {
    if (!publicKey || !policyAddress) return;
    await withToast("Destination removed", () => actions.removeAllowlistEntry(publicKey, policyAddress, destination));
  }

  async function handleSaveLimits(params: Parameters<typeof actions.updateLimits>[2]) {
    if (!publicKey || !policyAddress) return;
    await withToast("Limits updated", () => actions.updateLimits(publicKey, policyAddress, params));
  }

  async function handleRotateDelegate(newDelegate: PublicKey) {
    if (!publicKey || !policyAddress) return;
    return withToast("Delegate rotated", () => actions.rotateDelegate(publicKey, policyAddress, newDelegate));
  }

  async function handleDepositSol(amount: bigint) {
    if (!publicKey || !policyAddress) return;
    await withToast("Deposited to vault", () => actions.depositSol(publicKey, policyAddress, amount));
  }

  async function handleDepositSpl(amount: bigint) {
    if (!publicKey || !policyAddress || !policy) return;
    await withToast("Deposited to vault", () => actions.depositSpl(publicKey, policyAddress, policy.splMint, amount));
  }

  async function handleWithdrawSol(destination: PublicKey, amount: bigint) {
    if (!publicKey || !policyAddress) return;
    await withToast("Withdrawn from vault", () => actions.withdrawSol(publicKey, policyAddress, destination, amount));
  }

  async function handleWithdrawSpl(destination: PublicKey, amount: bigint) {
    if (!publicKey || !policyAddress || !policy) return;
    const destinationTokenAccount = getAssociatedTokenAddressSync(policy.splMint, destination);
    await withToast("Withdrawn from vault", () =>
      actions.withdrawSpl(publicKey, policyAddress, policy.splMint, destinationTokenAccount, amount)
    );
  }

  async function handleInitPolicy(params: Parameters<typeof actions.initializePolicy>[1]) {
    if (!publicKey) return;
    await withToast("Policy created", () => actions.initializePolicy(publicKey, params));
  }

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        {!publicKey ? (
          <ConnectPrompt />
        ) : (
          <div className="space-y-7">
            <OwnerSelector
              ownerInput={ownerInput}
              onOwnerInputChange={setOwnerInput}
              agentIndex={agentIndex}
              onAgentIndexChange={setAgentIndex}
              onResetToWallet={() => setOwnerInput(publicKey.toBase58())}
              canReset={ownerInput !== publicKey.toBase58()}
            />

            <AnimatePresence>
              {actionError && (
                <motion.div
                  initial={{ opacity: 0, y: -6, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-start gap-2.5 overflow-hidden rounded-xl border border-danger/30 bg-danger-tint px-4 py-3 text-[13px] leading-relaxed text-danger"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="wrap-break-word">{actionError}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {loading && !policy ? (
              <div className="space-y-6">
                <Skeleton className="h-40 w-full rounded-2xl" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Skeleton className="h-28 rounded-2xl" />
                  <Skeleton className="h-28 rounded-2xl" />
                </div>
              </div>
            ) : notFound || !policy || !policyAddress ? (
              isViewingOwnPolicy && ownerPubkey ? (
                <InitPolicyForm
                  owner={ownerPubkey}
                  agentIndex={agentIndex}
                  pending={pendingAction === "initialize-policy"}
                  onSubmit={handleInitPolicy}
                />
              ) : (
                <EmptyState
                  icon={<ShieldOff className="h-5 w-5" />}
                  title="No policy found for this owner + agent index"
                  description={`Nothing is initialized yet on ${cluster.label}.`}
                  className="rounded-2xl border border-border bg-surface py-20 shadow-elevation-xs"
                />
              )
            ) : (
              <>
                <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0}>
                  <PolicyHero
                    policy={policy}
                    policyAddress={policyAddress}
                    solVaultBalance={solVaultBalance}
                    isOwner={isOwner}
                    explorerCluster={cluster.explorerCluster}
                    onTogglePause={handleTogglePause}
                    pausePending={pendingAction === "pause"}
                  />
                </motion.div>

                <motion.div
                  variants={fadeUp}
                  initial="hidden"
                  animate="show"
                  custom={0.05}
                  className="grid gap-4 sm:grid-cols-2"
                >
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
                </motion.div>

                <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0.1}>
                  <SpendChart receipts={receipts} />
                </motion.div>

                <motion.div
                  variants={fadeUp}
                  initial="hidden"
                  animate="show"
                  custom={0.15}
                  className="grid gap-6 lg:grid-cols-2"
                >
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
                </motion.div>

                <motion.div initial="hidden" animate="show" custom={0.2} variants={fadeUp} className="space-y-4 pt-2">
                  <div className="flex items-center gap-3">
                    <h2 className="font-display text-[15px] font-medium tracking-[-0.011em] text-foreground">
                      Manage
                    </h2>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <AllowlistPanel
                      entries={allowlistEntries}
                      loading={allowlistLoading}
                      isOwner={isOwner}
                      explorerCluster={cluster.explorerCluster}
                      pendingAction={pendingAction}
                      onAdd={handleAddAllowlist}
                      onRemove={handleRemoveAllowlist}
                    />
                    <VaultPanel
                      isOwner={isOwner}
                      connectedWallet={publicKey}
                      splMint={policy.splMint}
                      pendingAction={pendingAction}
                      onDepositSol={handleDepositSol}
                      onDepositSpl={handleDepositSpl}
                      onWithdrawSol={handleWithdrawSol}
                      onWithdrawSpl={handleWithdrawSpl}
                    />
                  </div>

                  <LimitsPanel
                    policy={policy}
                    isOwner={isOwner}
                    pending={pendingAction === "update-limits"}
                    onSave={handleSaveLimits}
                  />

                  <DelegatePanel
                    currentDelegate={policy.delegate}
                    isOwner={isOwner}
                    explorerCluster={cluster.explorerCluster}
                    pending={pendingAction === "rotate-delegate"}
                    onRotate={handleRotateDelegate}
                  />
                </motion.div>
              </>
            )}
          </div>
        )}
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-6 py-7 text-center text-[12px] text-foreground-subtle">
          Carapace — on-chain enforced guardrails for autonomous ZeroClaw agents.
        </div>
      </footer>
    </>
  );
}
