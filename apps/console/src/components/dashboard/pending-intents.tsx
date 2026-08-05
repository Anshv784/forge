"use client";

import { AnimatePresence, motion, type Variants } from "framer-motion";
import { Inbox } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { IntentCard } from "./intent-card";
import type { IntentAccountData } from "@/hooks/use-intents";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export function PendingIntents({
  intents,
  loading,
  isOwner,
  explorerCluster,
  pendingAction,
  onApprove,
  onDeny,
}: {
  intents: IntentAccountData[];
  loading: boolean;
  isOwner: boolean;
  explorerCluster: string;
  pendingAction: string | null;
  onApprove: (intent: IntentAccountData) => void;
  onDeny: (intent: IntentAccountData) => void;
}) {
  const actionable = intents.filter((i) => i.status === "pending");

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Pending approval</CardTitle>
          <CardDescription>Actions above the threshold, waiting on you.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && intents.length === 0 ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : actionable.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-5 w-5" />}
            title="Nothing waiting on you"
            description="When the agent proposes an above-threshold action, it'll show up here for you to approve or deny."
          />
        ) : (
          <AnimatePresence initial={false}>
            {actionable.map((intent, index) => (
              <motion.div
                key={intent.address.toBase58()}
                layout
                variants={fadeUp}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, y: -6 }}
                custom={index * 0.05}
              >
                <IntentCard
                  intent={intent}
                  isOwner={isOwner}
                  explorerCluster={explorerCluster}
                  pendingAction={pendingAction}
                  onApprove={() => onApprove(intent)}
                  onDeny={() => onDeny(intent)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </CardContent>
    </Card>
  );
}
