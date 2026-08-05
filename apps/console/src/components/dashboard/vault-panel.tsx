"use client";

import { PublicKey } from "@solana/web3.js";
import { ArrowDownToLine, ArrowUpFromLine, Wallet } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const LAMPORTS_PER_SOL = 1_000_000_000;
const SPL_DECIMALS = 6;

export function VaultPanel({
  isOwner,
  connectedWallet,
  splMint,
  pendingAction,
  onDepositSol,
  onDepositSpl,
  onWithdrawSol,
  onWithdrawSpl,
}: {
  isOwner: boolean;
  connectedWallet: PublicKey | null;
  splMint: PublicKey;
  pendingAction: string | null;
  onDepositSol: (amountLamports: bigint) => void;
  onDepositSpl: (amountBaseUnits: bigint) => void;
  onWithdrawSol: (destination: PublicKey, amountLamports: bigint) => void;
  onWithdrawSpl: (destination: PublicKey, amountBaseUnits: bigint) => void;
}) {
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [solAmount, setSolAmount] = useState("");
  const [tokAmount, setTokAmount] = useState("");
  const [withdrawTo, setWithdrawTo] = useState(connectedWallet?.toBase58() ?? "");

  const depositing = pendingAction === "deposit-sol" || pendingAction === "deposit-spl";
  const withdrawing = pendingAction === "withdraw-sol" || pendingAction === "withdraw-spl";

  function parseDestination(): PublicKey | null {
    try {
      return new PublicKey((withdrawTo || connectedWallet?.toBase58() || "").trim());
    } catch {
      return null;
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Vault</CardTitle>
          <CardDescription>Funds live here, program-owned — never in the agent's own key.</CardDescription>
        </div>
        <Wallet className="h-4 w-4 shrink-0 text-foreground-subtle" />
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="inline-flex rounded-lg border border-border bg-surface-raised/50 p-0.5">
          <button
            onClick={() => setMode("deposit")}
            className={cn(
              "rounded-md px-3.5 py-1.5 text-[12px] font-medium transition-[background-color,color,box-shadow] duration-150",
              mode === "deposit"
                ? "bg-accent text-accent-foreground shadow-elevation-xs"
                : "text-foreground-muted hover:text-foreground"
            )}
          >
            Deposit
          </button>
          {isOwner && (
            <button
              onClick={() => setMode("withdraw")}
              className={cn(
                "rounded-md px-3.5 py-1.5 text-[12px] font-medium transition-[background-color,color,box-shadow] duration-150",
                mode === "withdraw"
                  ? "bg-accent text-accent-foreground shadow-elevation-xs"
                  : "text-foreground-muted hover:text-foreground"
              )}
            >
              Withdraw
            </button>
          )}
        </div>

        {mode === "withdraw" && (
          <Field label="Destination" hint="Where withdrawn funds go. Defaults to your connected wallet.">
            <Input mono value={withdrawTo} onChange={(e) => setWithdrawTo(e.target.value)} placeholder="Wallet address" />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SOL amount">
            <div className="flex gap-2">
              <Input type="number" min="0" step="any" value={solAmount} onChange={(e) => setSolAmount(e.target.value)} />
              <Button
                variant="secondary"
                loading={mode === "deposit" ? pendingAction === "deposit-sol" : pendingAction === "withdraw-sol"}
                disabled={!solAmount || Number(solAmount) <= 0 || depositing || withdrawing}
                onClick={() => {
                  const lamports = BigInt(Math.round(Number(solAmount) * LAMPORTS_PER_SOL));
                  if (mode === "deposit") {
                    onDepositSol(lamports);
                  } else {
                    const dest = parseDestination();
                    if (dest) onWithdrawSol(dest, lamports);
                  }
                  setSolAmount("");
                }}
              >
                {mode === "deposit" ? <ArrowDownToLine className="h-3.5 w-3.5" /> : <ArrowUpFromLine className="h-3.5 w-3.5" />}
                {mode === "deposit" ? "Deposit" : "Withdraw"}
              </Button>
            </div>
          </Field>
          <Field label="SPL token amount" hint={`Mint: ${splMint.toBase58().slice(0, 8)}… (needs an existing token account)`}>
            <div className="flex gap-2">
              <Input type="number" min="0" step="any" value={tokAmount} onChange={(e) => setTokAmount(e.target.value)} />
              <Button
                variant="secondary"
                loading={mode === "deposit" ? pendingAction === "deposit-spl" : pendingAction === "withdraw-spl"}
                disabled={!tokAmount || Number(tokAmount) <= 0 || depositing || withdrawing}
                onClick={() => {
                  const baseUnits = BigInt(Math.round(Number(tokAmount) * 10 ** SPL_DECIMALS));
                  if (mode === "deposit") {
                    onDepositSpl(baseUnits);
                  } else {
                    const dest = parseDestination();
                    if (dest) onWithdrawSpl(dest, baseUnits);
                  }
                  setTokAmount("");
                }}
              >
                {mode === "deposit" ? <ArrowDownToLine className="h-3.5 w-3.5" /> : <ArrowUpFromLine className="h-3.5 w-3.5" />}
                {mode === "deposit" ? "Deposit" : "Withdraw"}
              </Button>
            </div>
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}
