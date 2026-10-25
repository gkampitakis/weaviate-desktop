import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertTriangle,
  Braces,
  ChevronDown,
  LoaderCircle,
  Sparkles,
  Table as TableIcon,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import JsonView from "@uiw/react-json-view";
import { GetObject } from "wailsjs/go/weaviate/Weaviate";
import { cn } from "@/lib/utils";
import type { ResultsViewMode } from "@/store/explorer-history-store";
import {
  parseSentinel,
  transformWithExpansions,
  type VectorPillRegistry,
} from "./vectorPillTransform";
import { VectorPill } from "./VectorPill";
import "./json-view-styles.css";

interface Props {
  viewMode: ResultsViewMode;
  onViewModeChange: (mode: ResultsViewMode) => void;
  similarObjectId?: string;
  onClearSimilar?: () => void;
  /** When true, surfaces a banner that the next page would exceed Weaviate's
   * QUERY_MAXIMUM_RESULTS cap (default 10000). */
  capReached?: boolean;
  /** Context needed to fetch the source object behind a "similar to" search.
   *  Optional so callers that don't surface the preview (e.g. tests) can omit. */
  connectionID?: number;
  collectionName?: string;
  tenant?: string;
}

/**
 * Top strip rendered above the objects list/table that hosts:
 *   - the JSON/Table view toggle
 *   - the "showing similar to {id}" banner (only when a nearObject search is
 *     active)
 *   - an inline, lazily-fetched preview of the source object (expand from
 *     the banner's chevron)
 *
 * Kept as a thin presentational component so SingleTenant + MultiTenant can
 * share it without further coupling to Search.tsx.
 */
const ResultsToolbar: React.FC<Props> = ({
  viewMode,
  onViewModeChange,
  similarObjectId,
  onClearSimilar,
  capReached,
  connectionID,
  collectionName,
  tenant,
}) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const canPreview =
    !!similarObjectId && connectionID !== undefined && !!collectionName;

  return (
    <div className="mb-2 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="radiogroup"
          aria-label="Results view"
          className="inline-flex h-7 items-center rounded-md border bg-background p-0.5"
        >
          <ToggleButton
            active={viewMode === "json"}
            onClick={() => onViewModeChange("json")}
            label="JSON"
            icon={<Braces className="h-3 w-3" />}
          />
          <ToggleButton
            active={viewMode === "table"}
            onClick={() => onViewModeChange("table")}
            label="Table"
            icon={<TableIcon className="h-3 w-3" />}
          />
        </div>

        {capReached && (
          <div className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span>
              Reached Weaviate&apos;s pagination cap. Refine your query to see
              more results.
            </span>
          </div>
        )}

        {similarObjectId && (
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-xs">
            <Sparkles className="h-3 w-3 shrink-0 text-primary" />
            <span className="text-muted-foreground">
              Showing objects similar to
            </span>
            <span className="truncate font-mono text-[11px] text-foreground">
              {similarObjectId}
            </span>
            {canPreview && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto h-5 w-5 shrink-0"
                    aria-expanded={previewOpen}
                    aria-label={
                      previewOpen ? "Hide source object" : "Show source object"
                    }
                    onClick={() => setPreviewOpen((v) => !v)}
                  >
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 transition-transform duration-150",
                        previewOpen && "rotate-180"
                      )}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  {previewOpen ? "Hide source object" : "Show source object"}
                </TooltipContent>
              </Tooltip>
            )}
            {onClearSimilar && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-5 w-5 shrink-0",
                      // When the chevron is hidden, push the X to the right.
                      !canPreview && "ml-auto"
                    )}
                    onClick={onClearSimilar}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Clear similar</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>

      {previewOpen && canPreview && (
        <SourceObjectPreview
          connectionID={connectionID!}
          collectionName={collectionName!}
          objectId={similarObjectId!}
          tenant={tenant}
        />
      )}
    </div>
  );
};

const ToggleButton: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}> = ({ active, onClick, label, icon }) => (
  <button
    type="button"
    role="radio"
    aria-checked={active}
    onClick={onClick}
    className={cn(
      "inline-flex h-6 items-center gap-1 rounded-sm px-2 text-[11px] font-medium transition-colors",
      active
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    )}
  >
    {icon}
    {label}
  </button>
);

/* ─────────────────────────  Source object preview  ─────────────────────── */

interface SourceObjectPreviewProps {
  connectionID: number;
  collectionName: string;
  objectId: string;
  tenant?: string;
}

/**
 * Lazily-fetched read-only view of the object that anchors the current
 * nearObject search. Mounts only when the banner is expanded — the parent
 * keys its open/closed state, and TanStack Query handles the request lifecycle
 * (so re-opening with the same id hits the cache instead of re-fetching).
 *
 * Reuses the same JsonView setup (vector pill sentinels included) as the
 * regular ObjectsList so the preview reads consistently with the surrounding
 * result cards.
 */
const SourceObjectPreview: React.FC<SourceObjectPreviewProps> = ({
  connectionID,
  collectionName,
  objectId,
  tenant,
}) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => new Set()
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["object", connectionID, collectionName, objectId, tenant ?? ""],
    queryFn: () =>
      GetObject(connectionID, collectionName, objectId, tenant ?? ""),
    retry: false,
    // Source object data doesn't change while the preview is open — cache
    // forever within the session so re-opening is instant.
    staleTime: Infinity,
  });

  const jsonValue = useMemo(() => {
    if (!data) return null;
    // Mirror ObjectCard: strip metadata fields that are redundant in the
    // preview (class is in the header; score/distance/certainty don't apply
    // to the source object).
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { class: _c, score: _s, distance: _d, certainty: _ct, ...rest } =
      data as unknown as Record<string, unknown> & {
        class?: unknown;
        score?: unknown;
        distance?: unknown;
        certainty?: unknown;
      };
    return rest;
  }, [data]);

  const { transformed, registry } = useMemo(() => {
    const reg: VectorPillRegistry = new Map();
    if (jsonValue == null) return { transformed: null, registry: reg };
    const out = transformWithExpansions(jsonValue, reg, expandedPaths);
    return { transformed: out, registry: reg };
  }, [jsonValue, expandedPaths]);

  const expandVector = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      if (prev.has(path)) return prev;
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  }, []);

  return (
    <div className="rounded-md border border-primary/20 bg-primary/[0.03]">
      <div className="flex items-center gap-1.5 border-b border-primary/15 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Sparkles className="h-3 w-3 text-primary" />
        <span>Source object</span>
        <span className="ml-2 truncate font-mono text-[10px] normal-case tracking-normal text-foreground/80">
          {objectId}
        </span>
      </div>
      <div className="px-3 py-2">
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <LoaderCircle className="h-3 w-3 animate-spin" />
            Loading source object…
          </div>
        )}
        {isError && (
          <div className="flex items-start gap-1.5 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="break-words">
              Could not load source object
              {error instanceof Error ? `: ${error.message}` : "."}
            </span>
          </div>
        )}
        {!isLoading && !isError && transformed != null && (
          <div className="json-view-wrapper">
            <JsonView
              className="select-text"
              displayDataTypes={false}
              displayObjectSize={false}
              enableClipboard={false}
              collapsed={2}
              shortenTextAfterLength={120}
              value={transformed as object}
              highlightUpdates={false}
              style={{
                maxWidth: "100%",
                overflowWrap: "break-word",
                wordBreak: "break-all",
                fontSize: "0.8rem",
                lineHeight: "1.6",
                background: "transparent",
              }}
            >
              <JsonView.String
                render={(props, { value }) => {
                  if (typeof value === "string") {
                    const id = parseSentinel(value);
                    if (id) {
                      const entry = registry.get(id);
                      if (entry) {
                        return (
                          <VectorPill
                            values={entry.values}
                            onExpand={() => expandVector(entry.path)}
                          />
                        );
                      }
                    }
                  }
                  const { children, ...rest } =
                    props as React.HTMLAttributes<HTMLSpanElement> & {
                      children?: React.ReactNode;
                    };
                  return <span {...rest}>{children}</span>;
                }}
              />
            </JsonView>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsToolbar;
