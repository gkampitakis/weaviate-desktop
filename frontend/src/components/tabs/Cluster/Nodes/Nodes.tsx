import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { NodesStatus } from "wailsjs/go/weaviate/Weaviate";
import { Card } from "@/components/ui/card";
import { StatusIndicator } from "./components/StatusIndicator";
import { Version } from "./components/Version";
import { ShardsTable } from "./components/ShardsTable";
import RefreshButton from "@/components/ui/refresh-button";
import { Database, Layers, Zap } from "lucide-react";

interface Props {
  connectionID: number;
}

const Nodes = ({ connectionID }: Props) => {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["cluster", connectionID],
    placeholderData: keepPreviousData,
    queryFn: () => NodesStatus(connectionID),
    refetchInterval: 5 * 60000,
  });

  return (
    <div className="flex h-full w-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-row items-center gap-2">
          <h2 className="text-xl font-semibold">Nodes</h2>
          <RefreshButton
            isRefreshing={isFetching}
            refresh={() => refetch({ cancelRefetch: false })}
            tooltipText="Refresh nodes"
          />
        </div>
      </div>
      {isLoading && (
        <div className="flex h-full w-full items-center justify-center">
          <p className="text-muted-foreground">Loading nodes...</p>
        </div>
      )}

      {!isLoading && (
        <div className="flex-1 space-y-4">
          {data?.nodes.map((n, id) => (
            <Card key={id} className="p-4 transition-shadow hover:shadow-md">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-semibold">{n.name}</h3>
                  <div className="flex items-center gap-2">
                    <Version nodeStatus={n} />
                    <StatusIndicator status={n.status} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-start gap-2">
                    <Database className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-muted-foreground text-xs">Objects</p>
                      <p className="text-sm font-medium">
                        {n.stats?.objectCount || 0}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Layers className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-muted-foreground text-xs">Shards</p>
                      <p className="text-sm font-medium">
                        {n.stats?.shardCount || 0}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Zap className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-muted-foreground text-xs">Batch RPS</p>
                      <p className="text-sm font-medium">
                        {n.batchStats?.ratePerSecond || 0}
                      </p>
                    </div>
                  </div>
                </div>
                {n.shards && n.shards.length > 0 && (
                  <div className="border-t pt-4">
                    <ShardsTable shards={n.shards} />
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Nodes;
