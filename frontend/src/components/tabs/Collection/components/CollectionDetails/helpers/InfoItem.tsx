import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface Props {
  label: string;
  value: React.ReactNode;
  tooltip?: string;
}

export const InfoItem = ({ label, value, tooltip }: Props) => (
  <div className="space-y-1">
    <div className="flex items-center gap-1">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      {tooltip && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="text-muted-foreground h-3 w-3 cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
    <div className="text-sm font-medium">{value || "-"}</div>
  </div>
);
