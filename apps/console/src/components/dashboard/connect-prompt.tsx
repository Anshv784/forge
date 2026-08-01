import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { ShellMark } from "@/components/layout/shell-mark";

const points = [
  { icon: KeyRound, text: "Agent funds live in a program-owned vault, never in a key it controls." },
  { icon: ShieldCheck, text: "Every transfer is checked on-chain against caps, allow-lists, and approvals." },
  { icon: LockKeyhole, text: "Above-threshold actions wait for your signature — from any device." },
];

export function ConnectPrompt() {
  return (
    <div className="flex flex-col items-center justify-center gap-8 py-24 text-center">
      <div className="text-accent">
        <ShellMark size={56} />
      </div>
      <div className="max-w-md space-y-2">
        <h1 className="font-display text-2xl font-medium tracking-tight text-foreground">
          Connect a wallet to view your agent
        </h1>
        <p className="text-[15px] text-foreground-subtle">
          Carapace shows the live on-chain policy for whichever wallet you connect — spending caps,
          pending approvals, and a full audit trail your agent's host can't fake.
        </p>
      </div>
      <div className="grid w-full max-w-lg gap-3 sm:grid-cols-3">
        {points.map(({ icon: Icon, text }) => (
          <div key={text} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-4">
            <Icon className="h-4 w-4 text-accent" />
            <p className="text-[12px] leading-snug text-foreground-subtle">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
