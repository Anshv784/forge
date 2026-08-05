import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { motion, type Variants } from "framer-motion";
import { ShellMark } from "@/components/layout/shell-mark";

const points = [
  { icon: KeyRound, text: "Agent funds live in a program-owned vault, never in a key it controls." },
  { icon: ShieldCheck, text: "Every transfer is checked on-chain against caps, allow-lists, and approvals." },
  { icon: LockKeyhole, text: "Above-threshold actions wait for your signature — from any device." },
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export function ConnectPrompt() {
  return (
    <div className="aurora-backdrop noise-texture flex flex-col items-center justify-center gap-9 rounded-3xl py-24 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="gradient-orb gradient-orb-purple -left-12 -top-16 h-64 w-64" />
        <div className="gradient-orb gradient-orb-blue right-0 top-1/3 h-56 w-56" style={{ animationDelay: "-6s" }} />
        <div className="gradient-orb gradient-orb-green bottom-0 left-1/3 h-72 w-72" style={{ animationDelay: "-12s" }} />
      </div>
      <div className="glass-panel relative flex h-16 w-16 items-center justify-center rounded-2xl text-accent shadow-elevation-sm">
        <ShellMark size={32} />
      </div>
      <div className="relative max-w-md space-y-2.5">
        <h1 className="gradient-text-brand font-display text-[28px] font-medium tracking-[-0.018em]">
          Connect a wallet to view your agent
        </h1>
        <p className="text-[15px] leading-relaxed text-foreground-subtle">
          Carapace shows the live on-chain policy for whichever wallet you connect — spending caps,
          pending approvals, and a full audit trail your agent&apos;s host can&apos;t fake.
        </p>
      </div>
      <div className="relative grid w-full max-w-lg gap-3 sm:grid-cols-3">
        {points.map(({ icon: Icon, text }, i) => (
          <motion.div
            key={text}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={0.1 + i * 0.08}
            className="glass-panel flex flex-col items-center gap-2.5 rounded-2xl p-4 shadow-elevation-xs transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:shadow-elevation-sm"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-tint text-accent">
              <Icon className="h-4 w-4" />
            </div>
            <p className="text-[12px] leading-snug text-foreground-subtle">{text}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
