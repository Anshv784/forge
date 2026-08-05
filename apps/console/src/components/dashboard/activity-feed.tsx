import { History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityItem } from "./activity-item";
import type { ReceiptEvent } from "@/hooks/use-receipts";

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
              <ActivityItem key={`${event.signature}-${i}`} event={event} explorerCluster={explorerCluster} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
