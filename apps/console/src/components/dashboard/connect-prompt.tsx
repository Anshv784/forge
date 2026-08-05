import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { ShellMark } from "@/components/layout/shell-mark";

const points = [
  { icon: KeyRound, text: "Agent funds live in a program-owned vault, never in a key it controls." },
  { icon: ShieldCheck, text: "Every transfer is checked on-chain against caps, allow-lists, and approvals." },
  { icon: LockKeyhole, text: "Above-threshold actions wait for your signature — from any device." },
];

export function ConnectPrompt() {
  return (
    <div className="ambient-glow flex flex-col items-center justify-center gap-9 rounded-3xl py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface text-accent shadow-elevation-sm">
        <ShellMark size={32} />
      </div>
      <div className="max-w-md space-y-2.5">
        <h1 className="font-display text-[28px] font-medium tracking-[-0.018em] text-foreground">
          Connect a wallet to view your agent
        </h1>
        <p className="text-[15px] leading-relaxed text-foreground-subtle">
          Carapace shows the live on-chain policy for whichever wallet you connect — spending caps,
          pending approvals, and a full audit trail your agent&apos;s host can&apos;t fake.
        </p>
      </div>
      <div className="grid w-full max-w-lg gap-3 sm:grid-cols-3">
        {points.map(({ icon: Icon, text }) => (
          <div
            key={text}
            className="flex flex-col items-center gap-2.5 rounded-2xl border border-border bg-surface p-4 shadow-elevation-xs transition-[border-color,box-shadow] duration-200 hover:border-border-strong hover:shadow-elevation-sm"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-tint text-accent">
              <Icon className="h-4 w-4" />
            </div>
            <p className="text-[12px] leading-snug text-foreground-subtle">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
