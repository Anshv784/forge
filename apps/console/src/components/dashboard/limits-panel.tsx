"use client";

import { Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import type { PolicyAccountData } from "@/hooks/use-policy";
import type { LimitsParams } from "@/hooks/use-carapace-actions";

const LAMPORTS_PER_SOL = 1_000_000_000;
const SPL_DECIMALS = 6; // matches the rest of the dashboard's display convention

function lamportsToSol(v: bigint) {
  return (Number(v) / LAMPORTS_PER_SOL).toString();
}
function solToLamports(v: string): bigint {
  return BigInt(Math.round(Number(v || "0") * LAMPORTS_PER_SOL));
}
function baseUnitsToTokens(v: bigint) {
  return (Number(v) / 10 ** SPL_DECIMALS).toString();
}
function tokensToBaseUnits(v: string): bigint {
  return BigInt(Math.round(Number(v || "0") * 10 ** SPL_DECIMALS));
}

export function LimitsPanel({
  policy,
  isOwner,
  pending,
  onSave,
}: {
  policy: PolicyAccountData;
  isOwner: boolean;
  pending: boolean;
  onSave: (params: LimitsParams) => void;
}) {
  const [form, setForm] = useState({
    maxPerTxSol: lamportsToSol(policy.maxPerTxLamports),
    maxDailySol: lamportsToSol(policy.maxDailyLamports),
    approvalThresholdSol: lamportsToSol(policy.approvalThresholdLamports),
    maxPerTxTok: baseUnitsToTokens(policy.maxPerTxSpl),
    maxDailyTok: baseUnitsToTokens(policy.maxDailySpl),
    approvalThresholdTok: baseUnitsToTokens(policy.approvalThresholdSpl),
  });

  // Re-sync the form whenever fresh on-chain data lands (e.g. after a save,
  // or after another owner session changed limits) — but only while the
  // user isn't actively mid-edit of a field with a pending write.
  useEffect(() => {
    if (pending) return;
    setForm({
      maxPerTxSol: lamportsToSol(policy.maxPerTxLamports),
      maxDailySol: lamportsToSol(policy.maxDailyLamports),
      approvalThresholdSol: lamportsToSol(policy.approvalThresholdLamports),
      maxPerTxTok: baseUnitsToTokens(policy.maxPerTxSpl),
      maxDailyTok: baseUnitsToTokens(policy.maxDailySpl),
      approvalThresholdTok: baseUnitsToTokens(policy.approvalThresholdSpl),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    policy.maxPerTxLamports,
    policy.maxDailyLamports,
    policy.approvalThresholdLamports,
    policy.maxPerTxSpl,
    policy.maxDailySpl,
    policy.approvalThresholdSpl,
  ]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    onSave({
      maxPerTxLamports: solToLamports(form.maxPerTxSol),
      maxDailyLamports: solToLamports(form.maxDailySol),
      approvalThresholdLamports: solToLamports(form.approvalThresholdSol),
      maxPerTxSpl: tokensToBaseUnits(form.maxPerTxTok),
      maxDailySpl: tokensToBaseUnits(form.maxDailyTok),
      approvalThresholdSpl: tokensToBaseUnits(form.approvalThresholdTok),
    });
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Spending limits</CardTitle>
          <CardDescription>Hard caps enforced by the program on every transfer.</CardDescription>
        </div>
        <Settings2 className="h-4 w-4 shrink-0 text-foreground-subtle" />
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Max per transaction (SOL)">
            <Input
              type="number"
              min="0"
              step="any"
              disabled={!isOwner}
              value={form.maxPerTxSol}
              onChange={(e) => set("maxPerTxSol", e.target.value)}
            />
          </Field>
          <Field label="Max per day (SOL)">
            <Input
              type="number"
              min="0"
              step="any"
              disabled={!isOwner}
              value={form.maxDailySol}
              onChange={(e) => set("maxDailySol", e.target.value)}
            />
          </Field>
          <Field label="Approval threshold (SOL)" hint="Above this, an Intent must be approved first.">
            <Input
              type="number"
              min="0"
              step="any"
              disabled={!isOwner}
              value={form.approvalThresholdSol}
              onChange={(e) => set("approvalThresholdSol", e.target.value)}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Max per transaction (SPL)">
            <Input
              type="number"
              min="0"
              step="any"
              disabled={!isOwner}
              value={form.maxPerTxTok}
              onChange={(e) => set("maxPerTxTok", e.target.value)}
            />
          </Field>
          <Field label="Max per day (SPL)">
            <Input
              type="number"
              min="0"
              step="any"
              disabled={!isOwner}
              value={form.maxDailyTok}
              onChange={(e) => set("maxDailyTok", e.target.value)}
            />
          </Field>
          <Field label="Approval threshold (SPL)">
            <Input
              type="number"
              min="0"
              step="any"
              disabled={!isOwner}
              value={form.approvalThresholdTok}
              onChange={(e) => set("approvalThresholdTok", e.target.value)}
            />
          </Field>
        </div>
        {isOwner && (
          <div className="flex justify-end">
            <Button onClick={handleSave} loading={pending}>
              Save changes
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
