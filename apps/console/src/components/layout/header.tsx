"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import { ShellMark } from "./shell-mark";
import { ThemeToggle } from "./theme-toggle";
import { ClusterSelect } from "./cluster-select";
import { cn } from "@/lib/utils";

// The wallet button touches browser-only APIs (window.solana, etc.) during
// its first render; loading it without SSR avoids a hydration mismatch.
const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

export function Header() {
  const { connected } = useWallet();

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 shadow-elevation-xs backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2.5 px-4 py-3.5 sm:px-6">
        <div className="group flex items-center gap-2.5 text-accent">
          <ShellMark size={26} />
          <span className="font-display text-[17px] font-medium tracking-[-0.014em] text-foreground transition-colors duration-150 group-hover:text-accent">
            Carapace
          </span>
          <span className="hidden rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle transition-colors duration-150 group-hover:border-accent/30 group-hover:text-accent sm:inline-block">
            Console
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          <ClusterSelect />
          <ThemeToggle />
          <div className={cn("rounded-lg", !connected && "pulse-glow")}>
            <WalletMultiButton />
          </div>
        </div>
      </div>
    </header>
  );
}
