import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { NodesStatus, GetModules } from "wailsjs/go/weaviate/Weaviate";
import { Card } from "@/components/ui/card";
import { StatusIndicator } from "./components/StatusIndicator";
import { Version } from "./components/Version";
import { ShardsTable } from "./components/ShardsTable";
import RefreshButton from "@/components/ui/refresh-button";
import {
  Database,
  Layers,
  Zap,
  Server,
  Package,
  BarChart3,
} from "lucide-react";
import { nodeStatusQueryKey, refetchNodeStatusInterval } from "../../constants";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";

interface Props {
  connectionID: number;
}

const modulesQueryKey = (connectionID: number) => ["modules", connectionID];

const ClusterInfo = ({ connectionID }: Props) => {
  const {
    data: nodesData,
    isLoading: isNodesLoading,
    isFetching: isNodesFetching,
    refetch: refetchNodes,
  } = useQuery({
    queryKey: nodeStatusQueryKey(connectionID),
    placeholderData: keepPreviousData,
    queryFn: () => NodesStatus(connectionID),
    refetchInterval: refetchNodeStatusInterval,
  });

  const { data: modulesData, isLoading: isModulesLoading } = useQuery({
    queryKey: modulesQueryKey(connectionID),
    queryFn: () => GetModules(connectionID),
    staleTime: 5 * 60 * 1000, // Modules don't change often
  });

  // Calculate cluster-wide statistics
  const clusterStats = useMemo(() => {
    if (!nodesData?.nodes) return null;

    const nodes = nodesData.nodes;
    return {
      totalNodes: nodes.length,
      healthyNodes: nodes.filter((n) => n.status === "HEALTHY").length,
      totalObjects: nodes.reduce(
        (sum, n) => sum + (n.stats?.objectCount || 0),
        0
      ),
      totalShards: nodes.reduce(
        (sum, n) => sum + (n.stats?.shardCount || 0),
        0
      ),
      totalBatchRps: nodes.reduce(
        (sum, n) => sum + (n.batchStats?.ratePerSecond || 0),
        0
      ),
    };
  }, [nodesData]);

  // Parse modules into a list
  const modulesList = useMemo(() => {
    if (!modulesData) return [];
    if (typeof modulesData === "object" && modulesData !== null) {
      return Object.keys(modulesData);
    }
    return [];
  }, [modulesData]);

  const isLoading = isNodesLoading || isModulesLoading;

  return (
    <div className="flex h-full w-full flex-col gap-6 overflow-y-auto p-4">
      {isLoading && (
        <div className="flex h-full w-full items-center justify-center">
          <p className="text-muted-foreground">
            Loading cluster information...
          </p>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Cluster Statistics Section */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 className="text-muted-foreground h-5 w-5" />
              <h2 className="text-lg font-semibold">Cluster Statistics</h2>
            </div>
            <Card className="p-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                <div className="flex flex-col">
                  <p className="text-muted-foreground text-xs">Nodes</p>
                  <p className="text-xl font-semibold">
                    {clusterStats?.healthyNodes}/{clusterStats?.totalNodes}
                  </p>
                  <p className="text-muted-foreground text-xs">healthy</p>
                </div>
                <div className="flex flex-col">
                  <p className="text-muted-foreground text-xs">Total Objects</p>
                  <p className="text-xl font-semibold">
                    {clusterStats?.totalObjects.toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-col">
                  <p className="text-muted-foreground text-xs">Total Shards</p>
                  <p className="text-xl font-semibold">
                    {clusterStats?.totalShards.toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-col">
                  <p className="text-muted-foreground text-xs">Batch RPS</p>
                  <p className="text-xl font-semibold">
                    {clusterStats?.totalBatchRps.toFixed(1)}
                  </p>
                </div>
                <div className="flex flex-col">
                  <p className="text-muted-foreground text-xs">Modules</p>
                  <p className="text-xl font-semibold">{modulesList.length}</p>
                </div>
              </div>
            </Card>
          </section>

          {/* Modules Section */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Package className="text-muted-foreground h-5 w-5" />
              <h2 className="text-lg font-semibold">Modules</h2>
            </div>
            <Card className="p-4">
              {modulesList.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No modules enabled
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {modulesList.map((module) => (
                    <Badge key={module} variant="secondary">
                      {module}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          </section>

          {/* Nodes Section */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Server className="text-muted-foreground h-5 w-5" />
              <h2 className="text-lg font-semibold">Nodes</h2>
              <RefreshButton
                isRefreshing={isNodesFetching}
                refresh={() => refetchNodes({ cancelRefetch: false })}
                tooltipText="Refresh nodes"
              />
            </div>
            <div className="space-y-4">
              {nodesData?.nodes.map((n, id) => (
                <Card
                  key={id}
                  className="p-4 transition-shadow hover:shadow-md"
                >
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
                          <p className="text-muted-foreground text-xs">
                            Objects
                          </p>
                          <p className="text-sm font-medium">
                            {n.stats?.objectCount || 0}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Layers className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-muted-foreground text-xs">
                            Shards
                          </p>
                          <p className="text-sm font-medium">
                            {n.stats?.shardCount || 0}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Zap className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-muted-foreground text-xs">
                            Batch RPS
                          </p>
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
          </section>
        </>
      )}
    </div>
  );
};

export default ClusterInfo;
