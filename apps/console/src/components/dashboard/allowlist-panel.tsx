"use client";

import { AnimatePresence, motion } from "framer-motion";
import { PublicKey } from "@solana/web3.js";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Address } from "@/components/ui/address";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { AllowlistEntryData } from "@/hooks/use-allowlist";
import { solscanAddressUrl } from "@/lib/config";

export function AllowlistPanel({
  entries,
  loading,
  isOwner,
  explorerCluster,
  pendingAction,
  onAdd,
  onRemove,
}: {
  entries: AllowlistEntryData[];
  loading: boolean;
  isOwner: boolean;
  explorerCluster: string;
  pendingAction: string | null;
  onAdd: (destination: PublicKey) => Promise<unknown>;
  onRemove: (destination: PublicKey) => void;
}) {
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  async function handleAdd() {
    setInputError(null);
    let destination: PublicKey;
    try {
      destination = new PublicKey(input.trim());
    } catch {
      setInputError("Not a valid Solana address");
      return;
    }
    try {
      await onAdd(destination);
      setInput("");
    } catch {
      // surfaced via actionError elsewhere
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Allow-listed destinations</CardTitle>
          <CardDescription>Only these addresses can ever receive a transfer — enforced on-chain.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isOwner && (
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <Input
                mono
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setInputError(null);
                }}
                placeholder="Destination wallet address"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <Button
                variant="secondary"
                onClick={handleAdd}
                loading={pendingAction === "allowlist-add"}
                disabled={!input.trim()}
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
            {inputError && <p className="text-[12px] text-danger">{inputError}</p>}
          </div>
        )}

        {loading && entries.length === 0 ? (
          <div className="space-y-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<ListChecks className="h-5 w-5" />}
            title="Nothing allow-listed yet"
            description="The agent can't pay anyone until you add at least one destination here."
          />
        ) : (
          <AnimatePresence initial={false}>
            <ul className="space-y-2">
              {entries.map((entry) => {
                const key = entry.destination.toBase58();
                const removing = pendingAction === `allowlist-remove-${key}`;
                return (
                  <motion.li
                    key={key}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-raised/50 px-3.5 py-2.5"
                  >
                    <Address value={key} href={solscanAddressUrl(key, explorerCluster)} chars={6} />
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={removing}
                        onClick={() => onRemove(entry.destination)}
                        aria-label="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </motion.li>
                );
              })}
            </ul>
          </AnimatePresence>
        )}
      </CardContent>
    </Card>
  );
}
