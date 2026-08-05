import { History } from "lucide-react";
import { motion, type Variants } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityItem } from "./activity-item";
import type { ReceiptEvent } from "@/hooks/use-receipts";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export function ActivityFeed({
  receipts,
  loading,
  explorerCluster,
}: {
  receipts: ReceiptEvent[];
  loading: boolean;
  explorerCluster: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Activity</CardTitle>
          <CardDescription>Verifiable on-chain — not this dashboard&apos;s word for it.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {loading && receipts.length === 0 ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : receipts.length === 0 ? (
          <EmptyState
            icon={<History className="h-5 w-5" />}
            title="No activity yet"
            description="Every proposal, approval, and executed transfer will show up here, decoded straight from transaction logs."
          />
        ) : (
          <div className="divide-y divide-border">
            {receipts.map((event, i) => (
              <motion.div
                key={`${event.signature}-${i}`}
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={Math.min(i, 8) * 0.04}
                className="-mx-2 rounded-lg px-2 py-3 transition-colors duration-150 first:pt-0 last:pb-0 hover:bg-surface-raised/50"
              >
                <ActivityItem event={event} explorerCluster={explorerCluster} />
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
