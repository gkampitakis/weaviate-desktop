import logo from "@/assets/images/weaviate-logo.svg";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  name: string;
  connectionName?: string;
  tooltip?: boolean;
}

const TabLabel: React.FC<Props> = ({ name, tooltip, connectionName }) => {
  const content = (
    <div
      style={{
        color: "#00a142",
      }}
      className="flex flex-row"
    >
      <img className="w-[15px] mr-2 flex-shrink-0" src={logo} />
      <div className="flex-1 overflow-x-hidden max-w-[120px] text-ellipsis">
        {name}
      </div>
    </div>
  );

  if (!tooltip) {
    return content;
  }

  return (
    <Tooltip delayDuration={900}>
      <TooltipTrigger className="cursor-pointer">{content}</TooltipTrigger>
      <TooltipContent align="start">
        <p className="text-xs">Connection: {connectionName}</p>
        <p className="text-xs">Collection: {name}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default TabLabel;
