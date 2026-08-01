"use client";

import dynamic from "next/dynamic";
import { ShellMark } from "./shell-mark";
import { ThemeToggle } from "./theme-toggle";
import { ClusterSelect } from "./cluster-select";

// The wallet button touches browser-only APIs (window.solana, etc.) during
// its first render; loading it without SSR avoids a hydration mismatch.
const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2.5 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5 text-accent">
          <ShellMark size={26} />
          <span className="font-display text-[17px] font-medium tracking-tight text-foreground">
            Carapace
          </span>
          <span className="hidden rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-foreground-subtle sm:inline-block">
            Console
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          <ClusterSelect />
          <ThemeToggle />
          <WalletMultiButton />
        </div>
      </div>
    </header>
  );
}
