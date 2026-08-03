"use client";

import { Keypair, PublicKey } from "@solana/web3.js";
import { AlertTriangle, Check, Copy, KeyRound, ShieldPlus } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import type { InitPolicyParams } from "@/hooks/use-carapace-actions";

const LAMPORTS_PER_SOL = 1_000_000_000;
const SPL_DECIMALS = 6;

function CopyableSecret({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <span className="text-[11px] font-medium text-foreground-subtle">{label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
        <code className="flex-1 truncate font-mono text-[12px] text-foreground">{value}</code>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className="shrink-0 text-foreground-subtle hover:text-accent"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

export function InitPolicyForm({
  owner,
  agentIndex,
  pending,
  onSubmit,
}: {
  owner: PublicKey;
  agentIndex: number;
  pending: boolean;
  onSubmit: (params: InitPolicyParams) => void;
}) {
  const [delegateKeypair, setDelegateKeypair] = useState<Keypair | null>(null);
  const [splMintInput, setSplMintInput] = useState("");
  const [mintError, setMintError] = useState<string | null>(null);
  const [caps, setCaps] = useState({
    maxPerTxSol: "0.5",
    maxDailySol: "2",
    approvalThresholdSol: "0.1",
    maxPerTxTok: "0",
    maxDailyTok: "0",
    approvalThresholdTok: "0",
  });

  function generateDelegate() {
    setDelegateKeypair(Keypair.generate());
  }

  function set<K extends keyof typeof caps>(key: K, value: string) {
    setCaps((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    setMintError(null);
    if (!delegateKeypair) return;
    let splMint: PublicKey;
    try {
      splMint = new PublicKey(splMintInput.trim());
    } catch {
      setMintError("Not a valid Solana address");
      return;
    }
    onSubmit({
      agentIndex,
      delegate: delegateKeypair.publicKey,
      splMint,
      maxPerTxLamports: BigInt(Math.round(Number(caps.maxPerTxSol) * LAMPORTS_PER_SOL)),
      maxDailyLamports: BigInt(Math.round(Number(caps.maxDailySol) * LAMPORTS_PER_SOL)),
      approvalThresholdLamports: BigInt(Math.round(Number(caps.approvalThresholdSol) * LAMPORTS_PER_SOL)),
      maxPerTxSpl: BigInt(Math.round(Number(caps.maxPerTxTok) * 10 ** SPL_DECIMALS)),
      maxDailySpl: BigInt(Math.round(Number(caps.maxDailyTok) * 10 ** SPL_DECIMALS)),
      approvalThresholdSpl: BigInt(Math.round(Number(caps.approvalThresholdTok) * 10 ** SPL_DECIMALS)),
      expiresAt: 0n,
    });
  }

  const delegateSecretHex = delegateKeypair
    ? Buffer.from(delegateKeypair.secretKey.slice(0, 32)).toString("hex")
    : null;

  return (
    <Card className="text-left">
      <CardHeader>
        <div>
          <CardTitle>Create your policy</CardTitle>
          <CardDescription>
            One-time setup for owner {owner.toBase58().slice(0, 6)}…, agent #{agentIndex}. Everything below is a
            single on-chain transaction you sign yourself.
          </CardDescription>
        </div>
        <ShieldPlus className="h-4 w-4 shrink-0 text-foreground-subtle" />
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-foreground-muted">Agent delegate key</span>
            <Button variant="outline" size="sm" onClick={generateDelegate}>
              <KeyRound className="h-3.5 w-3.5" /> {delegateKeypair ? "Regenerate" : "Generate"}
            </Button>
          </div>
          {delegateKeypair && delegateSecretHex && (
            <div className="space-y-2 rounded-xl border border-warning/30 bg-warning-tint p-3">
              <div className="flex items-start gap-2 text-[12px] text-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Save the secret key now — it's shown only once and never leaves your browser. Put it in your
                  ZeroClaw config as <code className="font-mono">delegate_secret_key</code>.
                </span>
              </div>
              <CopyableSecret label="Delegate public key" value={delegateKeypair.publicKey.toBase58()} />
              <CopyableSecret label="Delegate secret key (32-byte hex seed)" value={delegateSecretHex} />
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Field label="SPL token mint" hint="An existing SPL Token mint on this cluster — required by the program even if you only plan to move SOL.">
            <Input
              mono
              value={splMintInput}
              onChange={(e) => {
                setSplMintInput(e.target.value);
                setMintError(null);
              }}
              placeholder="Mint address"
            />
          </Field>
          {mintError && <p className="text-[12px] text-danger">{mintError}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Max per tx (SOL)">
            <Input type="number" min="0" step="any" value={caps.maxPerTxSol} onChange={(e) => set("maxPerTxSol", e.target.value)} />
          </Field>
          <Field label="Max per day (SOL)">
            <Input type="number" min="0" step="any" value={caps.maxDailySol} onChange={(e) => set("maxDailySol", e.target.value)} />
          </Field>
          <Field label="Approval threshold (SOL)">
            <Input
              type="number"
              min="0"
              step="any"
              value={caps.approvalThresholdSol}
              onChange={(e) => set("approvalThresholdSol", e.target.value)}
            />
          </Field>
        </div>

        <Button className="w-full" onClick={handleSubmit} loading={pending} disabled={!delegateKeypair}>
          Create policy on-chain
        </Button>
        {!delegateKeypair && (
          <p className="text-center text-[11px] text-foreground-subtle">Generate a delegate key first.</p>
        )}
      </CardContent>
    </Card>
  );
}
