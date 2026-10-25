import { useState } from "react";
import { Check, Copy, Maximize2, Sigma } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

const numberFormatter = new Intl.NumberFormat();

interface VectorPillProps {
  values: number[];
  onExpand: () => void;
}

/**
 * Renders a compact pill in place of a large numeric array (e.g. a 1536-float
 * vector). Provides preview, copy, and expand actions on hover.
 */
export const VectorPill: React.FC<VectorPillProps> = ({ values, onExpand }) => {
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (copied) return;
    navigator.clipboard
      .writeText(JSON.stringify(values))
      .then(() => {
        setCopied(true);
        toast("Copied", { duration: 1500 });
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        toast.error("Failed to copy to clipboard");
      });
  };

  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    onExpand();
  };

  const CopyIcon = copied ? Check : Copy;

  return (
    <span
      className="group/vec inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-1.5 py-0.5 align-middle text-xs font-medium text-primary select-none"
      onClick={(e) => e.stopPropagation()}
      data-vector-pill
    >
      <Sigma className="h-3 w-3 opacity-70" />
      <span className="font-mono text-[11px]">
        [{numberFormatter.format(values.length)} floats]
      </span>
      <span className="ml-0.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/vec:opacity-100">
        <Popover open={previewOpen} onOpenChange={setPreviewOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="rounded p-0.5 hover:bg-primary/10"
              title="Preview values"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="block text-[10px] leading-none">…</span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-72 p-3"
            align="start"
            onClick={(e) => e.stopPropagation()}
          >
            <VectorPreview values={values} />
          </PopoverContent>
        </Popover>
        <button
          type="button"
          className="rounded p-0.5 hover:bg-primary/10"
          onClick={handleCopy}
          title="Copy as JSON"
        >
          <CopyIcon className="h-3 w-3" />
        </button>
        <button
          type="button"
          className="rounded p-0.5 hover:bg-primary/10"
          onClick={handleExpand}
          title="Expand inline"
        >
          <Maximize2 className="h-3 w-3" />
        </button>
      </span>
    </span>
  );
};

const VectorPreview: React.FC<{ values: number[] }> = ({ values }) => {
  const head = values.slice(0, 8);
  const tail = values.slice(-4);

  let min = values[0];
  let max = values[0];
  for (let i = 1; i < values.length; i++) {
    const v = values[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const fmt = (n: number) =>
    Number.isFinite(n) ? n.toPrecision(6).replace(/\.?0+$/, "") : String(n);

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">Vector preview</span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {numberFormatter.format(values.length)} items
        </span>
      </div>
      <Separator />
      <div className="flex flex-col gap-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          First {head.length}
        </div>
        <div className="font-mono text-[11px] break-all text-foreground/90">
          {head.map(fmt).join(", ")}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Last {tail.length}
        </div>
        <div className="font-mono text-[11px] break-all text-foreground/90">
          {tail.map(fmt).join(", ")}
        </div>
      </div>
      <Separator />
      <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
        <span>min: {fmt(min)}</span>
        <span>max: {fmt(max)}</span>
      </div>
    </div>
  );
};
