import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const statusColors: Record<string, string> = {
  HEALTHY: "bg-green-500",
  UNHEALTHY: "bg-red-500",
  UNAVAILABLE: "bg-red-500",
  INDEXING: "bg-orange-400",
};

export const StatusIndicator = ({ status }: { status?: string }) => {
  return (
    <Tooltip>
      <TooltipTrigger>
        <div className="flex items-center gap-2">
          <span
            className={`h-4 w-4 rounded-full ${
              status ? statusColors[status] : "bg-gray-400"
            }`}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent className="bg-[oklch(0.21_0.006_285.885)] fill-[oklch(0.21_0.006_285.885)] text-[oklch(0.985_0_0)]">
        {sentenceCase(status || "Unknown")}
      </TooltipContent>
    </Tooltip>
  );
};

function sentenceCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
