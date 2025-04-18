import logo from "@/assets/images/weaviate-logo.svg";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { ClusterStatus } from "wailsjs/go/weaviate/Weaviate";

type Props =
  | {
      name: string;
      tooltip: true;
      connectionName: string;
      connectionID: number;
    }
  | {
      name: string;
      tooltip?: false | undefined;
      connectionName?: undefined;
      connectionID?: undefined;
    };

const TabLabel: React.FC<Props> = ({
  name,
  tooltip,
  connectionName,
  connectionID,
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
    </div>
  );

  const { data: status } = useQuery({
    queryFn: async () => {
      const data = await ClusterStatus(connectionID!);
      return data;
    },
    queryKey: ["status", connectionName],
    enabled: tooltip,
    refetchInterval: 10000,
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

export default TabLabel;
