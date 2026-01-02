import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { NodesStatus } from "wailsjs/go/weaviate/Weaviate";
import { LoaderCircle, RefreshCcw } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusIndicator } from "./StatusIndicator";
import { Version } from "./Version";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ShardsTable } from "./ShardsTable";
import { Button } from "@/components/ui/button";

interface Props {
  connectionID: number;
}

const Nodes = ({ connectionID }: Props) => {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["clusterInformation", connectionID],
    placeholderData: keepPreviousData,
    queryFn: () => NodesStatus(connectionID),
    // 5 minutes
    refetchInterval: 5 * 60000,
  });

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="icon"
          onClick={() => refetch({ cancelRefetch: false })}
          disabled={isFetching}
        >
          {isFetching ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <RefreshCcw />
          )}
        </Button>
      </div>
      {isLoading && (
        <LoaderCircle size="1.3em" className="animate-spin text-green-600" />
      )}
      {!isLoading &&
        data?.nodes.map((n, id) => (
          <Card key={id} className="mb-2 bg-gray-100">
            <CardHeader>
              <CardTitle className="flex justify-between">
                <span>{n.name}</span>
                <div className="flex justify-end gap-2">
                  <Version nodeStatus={n} />
                  <StatusIndicator status={n.status} />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <h3 className="scroll-m-20 text-lg font-bold tracking-tight">
                Stats
              </h3>
              <div className="mt-2 flex flex-row gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger className="text-lg">📦</TooltipTrigger>
                    <TooltipContent className="bg-[oklch(0.21_0.006_285.885)] fill-[oklch(0.21_0.006_285.885)] text-[oklch(0.985_0_0)]">
                      Objects
                    </TooltipContent>
                  </Tooltip>
                  <span>{n.stats?.objectCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger className="text-lg">📂</TooltipTrigger>
                    <TooltipContent className="bg-[oklch(0.21_0.006_285.885)] fill-[oklch(0.21_0.006_285.885)] text-[oklch(0.985_0_0)]">
                      Shards
                    </TooltipContent>
                  </Tooltip>
                  <span>{n.stats?.shardCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger className="text-lg">⚡</TooltipTrigger>
                    <TooltipContent className="bg-[oklch(0.21_0.006_285.885)] fill-[oklch(0.21_0.006_285.885)] text-[oklch(0.985_0_0)]">
                      Batch RPS
                    </TooltipContent>
                  </Tooltip>
                  <span>{n.batchStats?.ratePerSecond}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <ShardsTable shards={n.shards} />
            </CardFooter>
          </Card>
        ))}
    </div>
  );
};

export default Nodes;
