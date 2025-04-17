import { useQuery } from "@tanstack/react-query";
import TabContainer from "./components/TabContainer";
import { NodesStatus } from "wailsjs/go/weaviate/Weaviate";
import { Check, Copy, LoaderCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { models } from "wailsjs/go/models";
import { useState } from "react";

export const ClusterInformationName = "ClusterInformation";

interface Props {
  connectionID: number;
}

const ClusterInformation = ({ connectionID }: Props) => {
  const { data, isLoading } = useQuery({
    queryKey: [connectionID],
    queryFn: async () => {
      return NodesStatus(connectionID);
    },
  });

  return (
    <TabContainer className="flex flex-col">
      {isLoading && (
        <LoaderCircle size="1.3em" className="animate-spin text-green-600" />
      )}
      {!isLoading &&
        data?.nodes.map((n, id) => (
          <Card key={id} className="mb-4 bg-gray-100">
            <CardHeader>
              <CardTitle className="flex justify-between">
                <span>{n.name}</span>
                <StatusIndicator status={n.status} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p>Card Content</p>
            </CardContent>
            <CardFooter className="flex justify-between">
              <p>Card Footer</p>
              <VersionToolTip nodeStatus={n} />
            </CardFooter>
          </Card>
        ))}
    </TabContainer>
  );
};

export default ClusterInformation;

const statusColors: Record<string, string> = {
  HEALTHY: "bg-green-500",
  UNHEALTHY: "bg-red-500",
  UNAVAILABLE: "bg-red-500",
  INDEXING: "bg-orange-400",
};

const StatusIndicator = ({ status }: { status?: string }) => {
  return (
    <Tooltip>
      <TooltipTrigger>
        <div className="flex items-center gap-2">
          <span
            className={`w-4 h-4 rounded-full ${
              status ? statusColors[status] : "bg-gray-400"
            }`}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent className="bg-[oklch(0.21_0.006_285.885)] fill-[oklch(0.21_0.006_285.885)] text-[oklch(0.985_0_0)]">
        {sentenceCase(status || "Undefined")}
      </TooltipContent>
    </Tooltip>
  );
};

function sentenceCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

const VersionToolTip = ({
  nodeStatus,
}: {
  nodeStatus: models.w_NodeStatus;
}) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const Icon = copySuccess ? Check : Copy;

  const handleCopy = () => {
    if (copySuccess) {
      return;
    }

    setCopySuccess(true);
    navigator.clipboard.writeText(nodeStatus.gitHash!);
    setTimeout(() => {
      setCopySuccess(false);
    }, 2000);
  };

  if (!nodeStatus.gitHash) {
    return <span>{nodeStatus.version}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger>
        <span>{nodeStatus.version}</span>
      </TooltipTrigger>
      <TooltipContent className="bg-[oklch(0.21_0.006_285.885)] fill-[oklch(0.21_0.006_285.885)] text-[oklch(0.985_0_0)] flex flex-row items-center gap-2">
        {nodeStatus.gitHash}
        <Icon size="1em" className="cursor-pointer" onClick={handleCopy} />
      </TooltipContent>
    </Tooltip>
  );
};
