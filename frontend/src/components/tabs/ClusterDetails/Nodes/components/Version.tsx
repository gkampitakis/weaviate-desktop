import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { models } from "wailsjs/go/models";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { WLink } from "@/components/ui/wLink";

export const Version = ({
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
        <WLink
          href={`https://github.com/weaviate/weaviate/releases/tag/v${nodeStatus.version}`}
        >
          {nodeStatus.version}
        </WLink>
      </TooltipTrigger>
      <TooltipContent className="flex flex-row items-center gap-2 bg-[oklch(0.21_0.006_285.885)] fill-[oklch(0.21_0.006_285.885)] text-[oklch(0.985_0_0)]">
        {nodeStatus.gitHash}
        <Icon size="1em" className="cursor-pointer" onClick={handleCopy} />
      </TooltipContent>
    </Tooltip>
  );
};
