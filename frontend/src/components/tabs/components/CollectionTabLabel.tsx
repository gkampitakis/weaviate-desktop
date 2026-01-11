import logo from "@/assets/images/weaviate-logo.svg";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { borderColor } from "@/lib/dynamic-colors";
import { useQuery } from "@tanstack/react-query";
import { ClusterStatus } from "wailsjs/go/weaviate/Weaviate";
import {
  clusterStatusQueryKey,
  refetchClusterStatusInterval,
} from "../constants";

type Props =
  | {
      name: string;
      tooltip: true;
      connectionName: string;
      connectionID: number;
      color?: string;
    }
  | {
      name: string;
      tooltip?: false | undefined;
      connectionName?: undefined;
      connectionID?: undefined;
      color?: undefined;
    };

const CollectionTabLabel: React.FC<Props> = ({
  name,
  tooltip,
  connectionName,
  connectionID,
  color,
}) => {
  const content = (
    <div
      style={{
        color: "#00a142",
      }}
      className="flex flex-row"
    >
      <img className="mr-2 w-[15px] flex-shrink-0" src={logo} />
      <div className="max-w-sm flex-1 overflow-x-hidden text-ellipsis">
        {name}
      </div>
      {color && (
        <div
          className={`absolute right-0 bottom-0 left-0 border-b-4 ${borderColor[color]}`}
        />
      )}
    </div>
  );

  const { data: status } = useQuery({
    queryFn: async () => {
      const data = await ClusterStatus(connectionID!);
      return data;
    },
    queryKey: clusterStatusQueryKey(connectionID!),
    enabled: tooltip,
    refetchInterval: refetchClusterStatusInterval,
  });

  if (!tooltip) {
    return content;
  }

  return (
    <Tooltip delayDuration={900}>
      <TooltipTrigger className="cursor-pointer">{content}</TooltipTrigger>
      <TooltipContent align="start">
        <p className="text-xs">Connection: {connectionName}</p>
        <p className="text-xs">Collection: {name}</p>
        <p className="text-xs">Status: {status ? "Healthy" : "Unhealthy"}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default CollectionTabLabel;
