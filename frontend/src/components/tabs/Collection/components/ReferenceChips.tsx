import { Fragment, useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { weaviate } from "wailsjs/go/models";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { formatReferenceValue, referenceLabel } from "./referenceTransform";

const MAX_INLINE_CHIPS = 3;

const CopyId: React.FC<{ id: string }> = ({ id }) => {
  const [copied, setCopied] = useState(false);
  const Icon = copied ? Check : Copy;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (copied) return;
    navigator.clipboard
      .writeText(id)
      .then(() => {
        setCopied(true);
        toast("Copied", { duration: 1500 });
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        toast.error("Failed to copy to clipboard");
      });
  };

  return (
    <button
      type="button"
      className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      onClick={handleCopy}
      title="Copy object id"
    >
      <Icon className={copied ? "h-3 w-3 text-green-600" : "h-3 w-3"} />
    </button>
  );
};

const ReferenceDetails: React.FC<{ target: weaviate.w_ReferenceTarget }> = ({
  target,
}) => {
  const properties = target.properties ?? {};
  const names = Object.keys(properties);

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">Referenced object</span>
        {target.collection && (
          <Badge variant="outline" className="font-mono text-[10px]">
            {target.collection}
          </Badge>
        )}
      </div>
      <Separator />
      <div className="flex items-center gap-1">
        <span className="min-w-0 flex-1 font-mono text-[11px] break-all text-foreground/90">
          {target.id}
        </span>
        <CopyId id={target.id} />
      </div>
      {names.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-1">
            {names.map((name) => (
              <div key={name} className="flex items-baseline gap-2">
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {name}
                </span>
                <span className="min-w-0 break-words text-[11px] text-foreground/90">
                  {formatReferenceValue(properties[name])}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const ReferenceChip: React.FC<{ target: weaviate.w_ReferenceTarget }> = ({
  target,
}) => (
  <Popover>
    <PopoverTrigger asChild>
      <button
        type="button"
        className="inline-flex max-w-[160px] items-center gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5 align-middle text-[10px] text-muted-foreground select-none hover:bg-muted hover:text-foreground"
        onClick={(e) => e.stopPropagation()}
        title={target.collection ? `${target.collection} ${target.id}` : target.id}
      >
        <Link2 className="h-3 w-3 shrink-0 opacity-70" />
        <span className="truncate font-mono">{referenceLabel(target)}</span>
      </button>
    </PopoverTrigger>
    <PopoverContent className="w-72 p-3" align="start">
      <ReferenceDetails target={target} />
    </PopoverContent>
  </Popover>
);

const MoreTargets: React.FC<{
  targets: weaviate.w_ReferenceTarget[];
  hidden: number;
}> = ({ targets, hidden }) => (
  <Popover>
    <PopoverTrigger asChild>
      <button
        type="button"
        className="shrink-0 rounded-md border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        +{hidden}
      </button>
    </PopoverTrigger>
    <PopoverContent
      className="max-h-72 w-72 overflow-auto p-3"
      align="start"
    >
      <div className="flex flex-col gap-3">
        {targets.map((target, i) => (
          <Fragment key={`${target.collection}-${target.id}`}>
            {i > 0 && <Separator />}
            <ReferenceDetails target={target} />
          </Fragment>
        ))}
      </div>
    </PopoverContent>
  </Popover>
);

export const ReferenceChips: React.FC<{
  reference?: weaviate.w_ObjectReference;
}> = ({ reference }) => {
  const targets = reference?.targets ?? [];
  if (targets.length === 0) {
    return <span className="text-muted-foreground/60">—</span>;
  }

  const visible = targets.slice(0, MAX_INLINE_CHIPS);
  const hidden = targets.length - visible.length;

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      {visible.map((target) => (
        <ReferenceChip
          key={`${target.collection}-${target.id}`}
          target={target}
        />
      ))}
      {hidden > 0 && <MoreTargets targets={targets} hidden={hidden} />}
    </span>
  );
};
