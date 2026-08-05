"use client";

import { PublicKey } from "@solana/web3.js";
import { AlertTriangle, KeyRound } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Address } from "@/components/ui/address";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { solscanAddressUrl } from "@/lib/config";

export function DelegatePanel({
  currentDelegate,
  isOwner,
  explorerCluster,
  pending,
  onRotate,
}: {
  currentDelegate: PublicKey;
  isOwner: boolean;
  explorerCluster: string;
  pending: boolean;
  onRotate: (newDelegate: PublicKey) => Promise<unknown>;
}) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function openConfirm() {
    setError(null);
    try {
      new PublicKey(input.trim());
      setConfirmOpen(true);
    } catch {
      setError("Not a valid Solana address");
    }
  }

  async function handleConfirm() {
    try {
      await onRotate(new PublicKey(input.trim()));
      setInput("");
      setConfirmOpen(false);
    } catch {
      setConfirmOpen(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Delegate key</CardTitle>
          <CardDescription>The agent's session key — the only key it ever holds.</CardDescription>
        </div>
        <KeyRound className="h-4 w-4 shrink-0 text-foreground-subtle" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface-raised/50 px-3.5 py-2.5">
          <span className="text-[11.5px] font-medium uppercase tracking-wide text-foreground-subtle">Current</span>
          <Address value={currentDelegate.toBase58()} href={solscanAddressUrl(currentDelegate.toBase58(), explorerCluster)} chars={6} />
        </div>

        {isOwner && (
          <div className="space-y-1.5">
            <Field label="Rotate to a new delegate" hint="Use this if the current key ever leaks — it revokes the old one instantly.">
              <div className="flex gap-2">
                <Input
                  mono
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    setError(null);
                  }}
                  placeholder="New delegate public key"
                />
                <Button variant="secondary" onClick={openConfirm} disabled={!input.trim()} loading={pending}>
                  Rotate
                </Button>
              </div>
            </Field>
            {error && <p className="text-[12px] text-danger">{error}</p>}
          </div>
        )}
      </CardContent>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Rotate the delegate key?"
        description="Your current agent will stop working immediately — it holds the old key and has no way to get the new one automatically."
      >
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-tint px-3.5 py-3 text-[12px] leading-relaxed text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>You&apos;ll need to update your agent&apos;s config with the new delegate&apos;s secret key before it can act again.</span>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirm} loading={pending}>
            Rotate delegate
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
