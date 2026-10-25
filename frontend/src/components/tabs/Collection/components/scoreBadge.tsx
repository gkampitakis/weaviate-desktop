import { weaviate } from "wailsjs/go/models";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Picks the most relevant single signal for a result so we can render it in
 * tight spots like the card header or a table cell. Preference order, derived
 * from how Weaviate populates these fields:
 *   score      — bm25 / hybrid (already merged for hybrid)
 *   distance   — nearText / nearVector / nearObject (raw vector distance)
 *   certainty  — nearText / nearVector / nearObject (1 − cosine for cosine
 *                index)
 */
export type ScoreSignal = {
  kind: "score" | "distance" | "certainty";
  value: number;
};

export const pickPrimarySignal = (
  obj: weaviate.w_WeaviateObject
): ScoreSignal | null => {
  if (typeof obj.score === "number") return { kind: "score", value: obj.score };
  if (typeof obj.distance === "number")
    return { kind: "distance", value: obj.distance };
  if (typeof obj.certainty === "number")
    return { kind: "certainty", value: obj.certainty };
  return null;
};

const SIGNAL_LABEL: Record<ScoreSignal["kind"], string> = {
  score: "Score",
  distance: "Distance",
  certainty: "Certainty",
};

// Avoid `toPrecision`/`toExponential` here — they fall back to scientific
// notation for very small distances (e.g. 8.34e-7), which is unreadable in a
// tight badge. Intl.NumberFormat with notation:"standard" keeps fixed-point
// while preserving 3 significant digits.
const smallNumberFormatter = new Intl.NumberFormat("en-US", {
  maximumSignificantDigits: 3,
  notation: "standard",
  useGrouping: false,
});

const formatSignal = (n: number) => {
  if (!Number.isFinite(n)) return String(n);
  if (Math.abs(n) >= 100) return n.toFixed(1);
  if (Math.abs(n) >= 1) return n.toFixed(3);
  return smallNumberFormatter.format(n);
};

interface BadgeProps {
  object: weaviate.w_WeaviateObject;
  className?: string;
}

/**
 * Tiny inline badge showing the most relevant relevance signal. Tooltip
 * spells out every populated field so the user can compare them.
 */
export const ScoreBadge: React.FC<BadgeProps> = ({ object, className }) => {
  const primary = pickPrimarySignal(object);
  if (!primary) return null;

  const tooltipLines: string[] = [];
  if (typeof object.score === "number")
    tooltipLines.push(`Score: ${formatSignal(object.score)}`);
  if (typeof object.distance === "number")
    tooltipLines.push(`Distance: ${formatSignal(object.distance)}`);
  if (typeof object.certainty === "number")
    tooltipLines.push(`Certainty: ${formatSignal(object.certainty)}`);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium text-primary leading-none select-none",
            className
          )}
          data-score-badge
        >
          <span className="text-muted-foreground/80">
            {SIGNAL_LABEL[primary.kind]}
          </span>
          <span className="font-mono tabular-nums">
            {formatSignal(primary.value)}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <div className="flex flex-col gap-0.5">
          {tooltipLines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

export const formatSignalValue = formatSignal;
