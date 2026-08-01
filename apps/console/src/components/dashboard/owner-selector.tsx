"use client";

import { Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OwnerSelector({
  ownerInput,
  onOwnerInputChange,
  agentIndex,
  onAgentIndexChange,
  onResetToWallet,
  canReset,
}: {
  ownerInput: string;
  onOwnerInputChange: (value: string) => void;
  agentIndex: number;
  onAgentIndexChange: (value: number) => void;
  onResetToWallet: () => void;
  canReset: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-raised/50 p-3 sm:flex-row sm:items-center">
      <div className="flex flex-1 items-center gap-2">
        <label className="text-[12px] font-medium text-foreground-subtle whitespace-nowrap">Viewing owner</label>
        <input
          value={ownerInput}
          onChange={(e) => onOwnerInputChange(e.target.value)}
          placeholder="Owner wallet address"
          spellCheck={false}
          className="w-full min-w-0 rounded-lg border border-border bg-transparent px-3 py-1.5 font-mono text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        />
        {canReset && (
          <button
            onClick={onResetToWallet}
            title="Reset to my connected wallet"
            className="shrink-0 text-foreground-subtle hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-medium text-foreground-subtle">Agent</span>
        <div className="flex items-center rounded-lg border border-border">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-r-none px-2"
            onClick={() => onAgentIndexChange(Math.max(0, agentIndex - 1))}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-8 text-center font-mono text-[13px]">{agentIndex}</span>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-l-none px-2"
            onClick={() => onAgentIndexChange(agentIndex + 1)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
