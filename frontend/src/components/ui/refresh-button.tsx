import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { LoaderCircle, RefreshCw } from "lucide-react";

interface Props {
  isRefreshing: boolean;
  refresh: () => void;
  tooltipText?: string;
}

const RefreshButton = ({ isRefreshing, tooltipText, refresh }: Props) => {
  const button = (
    <Button
      variant="ghost"
      size="icon"
      onClick={refresh}
      disabled={isRefreshing}
      className="hover:bg-accent h-8 w-8 transition-colors"
    >
      {isRefreshing ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
    </Button>
  );

  if (!tooltipText) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent className="bg-[oklch(0.21_0.006_285.885)] fill-[oklch(0.21_0.006_285.885)] text-[oklch(0.985_0_0)]">
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default RefreshButton;
