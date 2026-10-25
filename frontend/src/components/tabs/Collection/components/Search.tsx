import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ChevronDown,
  Columns3,
  History as HistoryIcon,
  Search as SearchIcon,
  Sparkles,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  useExplorerHistoryStore,
  useRecentSearches,
  type RecentSearch,
} from "@/store/explorer-history-store";
import WhereFilterBuilder, {
  isCrossReference,
  leavesToFilter,
  type SchemaProperty,
  type WhereLeaf,
  type WireWhereFilter,
} from "./WhereFilterBuilder";
import { weaviate } from "wailsjs/go/models";

export type SearchType =
  | "bm25"
  | "hybrid"
  | "nearText"
  | "nearVector"
  | "nearObject";

/** User-selectable search types — nearObject is invoked indirectly via the
 * "Show similar" action and intentionally not surfaced as a tab. */
const SEARCH_TABS: ReadonlyArray<Exclude<SearchType, "nearObject">> = [
  "bm25",
  "hybrid",
  "nearText",
  "nearVector",
];

export interface SearchOptions {
  limit: number;
  alpha: number;
  fusionType: string;
  distance: number;
  certainty: number;
  /** UI-side where-filter rows (MVP: implicit AND between rows). */
  whereLeaves?: WhereLeaf[];
  /** Names of properties to project. Empty/undefined = all. */
  properties?: string[];
  /** Named vector(s) to target for nearText/nearVector/hybrid. */
  targetVectors?: string[];
}

/**
 * Produce the wire payload from UI-side SearchOptions. The caller supplies
 * effective `limit`/`offset` (derived from pageSize and current search page),
 * which always override whatever the UI carries on `opts.limit`.
 *
 * Returns a `w_SearchOptions` instance so the Wails binding signature is
 * satisfied (the generated type is a class, not an interface).
 */
export const toWireOptions = (
  opts: SearchOptions,
  page: { limit: number; offset: number }
): weaviate.w_SearchOptions => {
  const where = opts.whereLeaves ? leavesToFilter(opts.whereLeaves) : null;
  return weaviate.w_SearchOptions.createFrom({
    Limit: page.limit,
    Offset: page.offset,
    Alpha: opts.alpha,
    FusionType: opts.fusionType,
    Distance: opts.distance,
    Certainty: opts.certainty,
    ...(where ? { Where: where as WireWhereFilter } : {}),
    ...(opts.properties && opts.properties.length > 0
      ? { Properties: opts.properties }
      : {}),
    ...(opts.targetVectors && opts.targetVectors.length > 0
      ? { TargetVectors: opts.targetVectors }
      : {}),
  });
};

/** Weaviate server-side cap (`QUERY_MAXIMUM_RESULTS`, default 10000). */
export const SEARCH_RESULT_CAP = 10000;

interface Props {
  handleSearch: (query: string, searchType: SearchType, opts: SearchOptions) => void;
  resetSearch: () => void;
  executionTime: string;
  children: React.ReactNode;
  changeId: string;
  connectionId: number;
  collectionName: string;
  tenant?: string;
  /** Schema properties (name + first dataType) used to build the filter/fields pickers. */
  schemaProperties?: SchemaProperty[];
  /** Named vectors on the collection — surfaces a target-vector picker when ≥ 2 keys. */
  vectorTargets?: string[];
  /** When set, the search bar swaps into "similar to <id>" chip mode. The
   *  parent owns this state because the nearObject search is fired outside
   *  the bar (via the Sparkles button on each result row). */
  similarObjectId?: string;
  /** Called when the user dismisses the similar-mode chip — should clear the
   *  nearObject search in the parent. */
  onClearSimilar?: () => void;
  /** Called when the user restores a `nearObject` entry from history — should
   *  re-fire the nearObject search and re-activate the chip in the parent. */
  onRestoreSimilar?: (objectId: string) => void;
}

const DEFAULT_OPTS: SearchOptions = {
  limit: 100,
  alpha: 0.75,
  fusionType: "",
  distance: 0,
  certainty: 0,
  whereLeaves: [],
  properties: [],
  targetVectors: [],
};

/** Default options used when the "Show similar" action fires a nearObject
 * search. Kept here so the caller and the history-restore path agree. */
export const SHOW_SIMILAR_DEFAULT_OPTS: SearchOptions = {
  limit: 100,
  alpha: 0.75,
  fusionType: "",
  distance: 0,
  certainty: 0,
};

/** Trim a UUID-ish object id down to a friendly leading segment for display. */
const shortenObjectId = (id: string): string => {
  const head = id.split("-")[0] ?? id;
  return head.length > 8 ? head.slice(0, 8) : head;
};

const Search: React.FC<Props> = ({
  handleSearch,
  resetSearch,
  executionTime,
  changeId,
  children,
  connectionId,
  collectionName,
  tenant,
  schemaProperties,
  vectorTargets,
  similarObjectId,
  onClearSimilar,
  onRestoreSimilar,
}) => {
  const [lastChangeId, setLastChangeId] = useState(changeId);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<SearchType>("bm25");
  const [opts, setOpts] = useState<SearchOptions>(DEFAULT_OPTS);
  const [searching, setSearching] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [vectorError, setVectorError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const recentSearches = useRecentSearches(connectionId, collectionName, tenant);
  const clearForCollection = useExplorerHistoryStore(
    (s) => s.clearForCollection
  );

  const schema = useMemo(() => schemaProperties ?? [], [schemaProperties]);
  const showTargetVectorPicker =
    (vectorTargets?.length ?? 0) > 1 &&
    (searchType === "nearText" ||
      searchType === "nearVector" ||
      searchType === "hybrid");

  if (changeId !== lastChangeId) {
    setSearchQuery("");
    setOpts(DEFAULT_OPTS);
    setLastChangeId(changeId);
  }

  const handleTypeChange = (value: string) => {
    // Switching tabs while in nearObject ("similar") mode cancels that mode
    // so the user is back to a normal query bar.
    if (similarObjectId) onClearSimilar?.();
    setSearchType(value as SearchType);
    setSearchQuery("");
    // Preserve where/fields/target across search-type switches — they're orthogonal to type.
    setOpts((prev) => ({
      ...DEFAULT_OPTS,
      whereLeaves: prev.whereLeaves,
      properties: prev.properties,
      targetVectors: prev.targetVectors,
    }));
    setVectorError(null);
  };

  const setOpt = <K extends keyof SearchOptions>(key: K, value: SearchOptions[K]) =>
    setOpts((prev) => ({ ...prev, [key]: value }));

  const validateVector = (value: string): string | null => {
    if (!value.trim()) return null;
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return "Must be a JSON array, e.g. [0.1, 0.2, ...]";
      if (parsed.length === 0) return "Array must not be empty";
      if (!parsed.every((v) => typeof v === "number")) return "All elements must be numbers";
      return null;
    } catch {
      return "Invalid JSON — expected a float array, e.g. [0.1, 0.2, ...]";
    }
  };

  const handleReset = () => {
    setSearchQuery("");
    setOpts((prev) => ({
      ...DEFAULT_OPTS,
      // Keep filter/projection/target across a query reset — they aren't search text.
      whereLeaves: prev.whereLeaves,
      properties: prev.properties,
      targetVectors: prev.targetVectors,
    }));
    setSearching(false);
    setVectorError(null);
    resetSearch();
  };

  const trimmedQuery = searchQuery.trim();
  const canSubmit = !similarObjectId && trimmedQuery.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (searchType === "nearVector") {
      const err = validateVector(searchQuery);
      if (err) { setVectorError(err); return; }
    }
    setSearching(true);
    handleSearch(searchQuery, searchType, opts);
  };

  const handleRestore = (entry: RecentSearch) => {
    setHistoryOpen(false);
    // nearObject restores re-enter "similar to" chip mode via the parent —
    // the search bar itself doesn't own the active object id.
    if (entry.searchType === "nearObject") {
      onRestoreSimilar?.(entry.query);
      return;
    }
    setSearchType(entry.searchType);
    setSearchQuery(entry.query);
    setOpts(entry.options);
    setVectorError(null);
    if (entry.searchType === "nearVector") {
      const err = validateVector(entry.query);
      if (err) {
        setVectorError(err);
        return;
      }
    }
    setSearching(true);
    handleSearch(entry.query, entry.searchType, entry.options);
  };

  const placeholder =
    searchType === "nearText" ? "Enter concepts…" :
    searchType === "nearVector" ? "[0.1, 0.23, …]" :
    "Keyword search…";

  // Keep the Options toggle visible across all modes so the footer doesn't
  // jump when the user switches search type. BM25 just renders an empty
  // panel body with a hint.
  const hasOptions = true;

  return (
    <>
      <div className="mb-2 rounded-lg border bg-card shadow-xs">
        {/* Type selector */}
        <div className="border-b px-3 pt-2.5 pb-0">
          <Tabs value={searchType} onValueChange={handleTypeChange}>
            <TabsList className="h-8 gap-0.5 bg-transparent p-0">
              {SEARCH_TABS.map((t) => (
                <TabsTrigger
                  key={t}
                  value={t}
                  className="h-7 rounded-t-md rounded-b-none border-b-2 border-transparent px-3 text-xs font-medium text-muted-foreground transition-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  {t}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Input area */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-1.5 p-2">
          <div className="flex items-start gap-2">
            {/* Input — single-line for every search type so the bar height
                stays constant across mode switches. nearVector accepts long
                arrays via horizontal scroll.

                In "Show similar" mode the input is swapped for a read-only
                chip showing the source object id — the actual nearObject
                query is owned by the parent (fired from the Sparkles button
                on a result row). */}
            <div className="relative flex-1">
              {similarObjectId ? (
                <div
                  className="flex h-9 w-full items-center gap-2 rounded-md border border-primary/30 bg-primary/5 pl-3 pr-1 text-sm"
                  aria-label="Showing objects similar to source object"
                >
                  <Sparkles className="size-3.5 shrink-0 text-primary" />
                  <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-tight text-primary">
                    nearObject
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Similar to
                  </span>
                  <span
                    className="min-w-0 flex-1 truncate font-mono text-xs text-foreground"
                    title={similarObjectId}
                  >
                    {similarObjectId}
                  </span>
                  {onClearSimilar && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={onClearSimilar}
                          aria-label="Clear similar search"
                          className="ml-1 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <X className="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Clear similar</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              ) : (
                <>
                  <div className="relative">
                    <SearchIcon className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      className={`h-9 w-full rounded-md border bg-background pl-8 pr-8 text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:border-ring transition-[color,box-shadow] ${
                        searchType === "nearVector" ? "font-mono text-xs" : ""
                      } ${vectorError ? "border-destructive focus-visible:ring-destructive/20" : ""}`}
                      placeholder={placeholder}
                      autoComplete="off"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (searchType === "nearVector") {
                          setVectorError(validateVector(e.target.value));
                        }
                      }}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={handleReset}
                        className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                  {vectorError && searchType === "nearVector" && (
                    <p className="mt-1 text-xs text-destructive">{vectorError}</p>
                  )}
                </>
              )}
            </div>

            {/* Where-filter builder */}
            {schema.length > 0 && (
              <WhereFilterBuilder
                schema={schema}
                leaves={opts.whereLeaves ?? []}
                onChange={(next) => setOpt("whereLeaves", next)}
              />
            )}

            {/* Field projection */}
            {schema.length > 0 && (
              <FieldsPicker
                schema={schema}
                value={opts.properties ?? []}
                onChange={(next) => setOpt("properties", next)}
              />
            )}

            {/* Target vector picker — only when collection has named vectors */}
            {showTargetVectorPicker && (
              <select
                value={opts.targetVectors?.[0] ?? ""}
                onChange={(e) =>
                  setOpt(
                    "targetVectors",
                    e.target.value ? [e.target.value] : []
                  )
                }
                className="h-9 shrink-0 rounded-md border bg-background px-2 text-xs focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                title="Target vector"
              >
                <option value="">any vector</option>
                {vectorTargets!.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            )}

            {/* Recent searches */}
            <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 shrink-0 px-0"
                      aria-label="Recent searches"
                    >
                      <HistoryIcon className="size-3.5" />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">Recent searches</TooltipContent>
              </Tooltip>
              <PopoverContent
                align="end"
                sideOffset={6}
                className="w-80 p-0"
              >
                <RecentSearchesList
                  entries={recentSearches}
                  onPick={handleRestore}
                  onClear={() =>
                    clearForCollection(connectionId, collectionName, tenant)
                  }
                />
              </PopoverContent>
            </Popover>

            {/* Search button */}
            <Button
              type="submit"
              size="sm"
              className="h-9 shrink-0"
              disabled={!canSubmit}
            >
              Search
            </Button>
          </div>

          {/* Options toggle */}
          {hasOptions && (
            <div>
              <button
                type="button"
                onClick={() => setOptionsOpen((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown
                  className={`size-3 transition-transform duration-150 ${optionsOpen ? "rotate-180" : ""}`}
                />
                Options
              </button>

              {optionsOpen && (
                <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2.5 rounded-md border bg-muted/30 p-3">
                  {searchType === "bm25" && (
                    <p className="col-span-2 text-xs text-muted-foreground">
                      No additional knobs for BM25 — adjust page size from the
                      pagination strip.
                    </p>
                  )}

                  {/* Hybrid-only */}
                  {searchType === "hybrid" && (
                    <>
                      <OptionRow
                        label="Alpha"
                        tooltip="Balance between keyword (BM25) and vector search. 0.0 = pure keyword · 1.0 = pure vector."
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={opts.alpha}
                            onChange={(e) => setOpt("alpha", parseFloat(e.target.value))}
                            className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-muted accent-green-600"
                          />
                          <span className="w-7 text-right text-xs tabular-nums text-muted-foreground">
                            {opts.alpha.toFixed(2)}
                          </span>
                        </div>
                      </OptionRow>

                      <OptionRow
                        label="Fusion type"
                        tooltip="Algorithm used to merge BM25 and vector result sets."
                      >
                        <select
                          value={opts.fusionType}
                          onChange={(e) => setOpt("fusionType", e.target.value)}
                          className="h-7 rounded-md border bg-background px-2 text-xs focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="">default</option>
                          <option value="rankedFusion">rankedFusion</option>
                          <option value="relativeScoreFusion">relativeScoreFusion</option>
                        </select>
                      </OptionRow>
                    </>
                  )}

                  {/* nearText / nearVector */}
                  {(searchType === "nearText" || searchType === "nearVector") && (
                    <>
                      <OptionRow
                        label="Distance"
                        tooltip="Maximum allowed distance between the query and a result vector. Lower = more similar. Leave 0 to skip."
                      >
                        <input
                          type="number"
                          min={0}
                          max={2}
                          step={0.01}
                          value={opts.distance || ""}
                          placeholder="0"
                          onChange={(e) => setOpt("distance", parseFloat(e.target.value) || 0)}
                          className="h-7 w-24 rounded-md border bg-background px-2 text-xs focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                      </OptionRow>

                      <OptionRow
                        label="Certainty"
                        tooltip="Minimum similarity between query and results (0–1). Higher = more similar. Leave 0 to skip."
                      >
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step={0.01}
                          value={opts.certainty || ""}
                          placeholder="0"
                          onChange={(e) => setOpt("certainty", parseFloat(e.target.value) || 0)}
                          className="h-7 w-24 rounded-md border bg-background px-2 text-xs focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                      </OptionRow>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </form>
      </div>

      {children}

      {(searching || similarObjectId) && executionTime && (
        <div className="mt-1 flex justify-end">
          <span className="text-xs text-muted-foreground">
            Query took {executionTime}
          </span>
        </div>
      )}
    </>
  );
};

/* ───────────────────────────────  Fields picker  ─────────────────────────── */

const FieldsPicker: React.FC<{
  schema: SchemaProperty[];
  value: string[];
  onChange: (next: string[]) => void;
}> = ({ schema, value, onChange }) => {
  const names = useMemo(
    () =>
      schema
        .filter((p) => p.name && !isCrossReference(p.dataType))
        .map((p) => p.name),
    [schema]
  );
  // Empty value === "all selected" semantically — we keep the set empty on
  // the wire so the backend short-circuits to full projection.
  const selected = value.length === 0 ? new Set(names) : new Set(value);
  const allSelected = value.length === 0 || selected.size === names.length;
  const label = allSelected
    ? "All fields"
    : `${selected.size} of ${names.length} fields`;

  const toggle = (name: string) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    if (next.size === names.length) onChange([]);
    else onChange([...next]);
  };

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 gap-1.5 px-2.5"
              aria-label="Fields"
            >
              <Columns3 className="size-3.5" />
              {!allSelected && (
                <span className="rounded-full bg-primary px-1.5 py-px text-[10px] font-medium leading-none text-primary-foreground">
                  {selected.size}
                </span>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-64 p-0"
      >
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              All
            </button>
            <button
              type="button"
              onClick={() => onChange([names[0]].filter(Boolean) as string[])}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              None
            </button>
          </div>
        </div>
        <ul className="max-h-72 overflow-y-auto py-1">
          {names.map((name) => {
            const checked = selected.has(name);
            return (
              <li key={name}>
                <label className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(name)}
                    className="size-3.5 accent-green-600"
                  />
                  <span className="truncate font-mono text-[11px]">{name}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
};

// Small helper so each option row is consistent
const OptionRow: React.FC<{
  label: string;
  tooltip: string;
  children: React.ReactNode;
}> = ({ label, tooltip, children }) => (
  <div className="flex items-center justify-between gap-3">
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help select-none text-xs text-muted-foreground underline decoration-dotted underline-offset-2 whitespace-nowrap">
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-56">
        {tooltip}
      </TooltipContent>
    </Tooltip>
    {children}
  </div>
);

/* ────────────────────────────  Recent searches  ──────────────────────────── */

const SEARCH_TYPE_LABEL: Record<SearchType, string> = {
  bm25: "BM25",
  hybrid: "Hybrid",
  nearText: "nearText",
  nearVector: "nearVector",
  nearObject: "Similar",
};

const formatRelativeTime = (ts: number): string => {
  const diff = Date.now() - ts;
  if (diff < 0) return "just now";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days <= 7) return `${days}d ago`;
  return new Date(ts).toISOString().slice(0, 10);
};

const summariseOptions = (entry: RecentSearch): string => {
  const parts: string[] = [`limit ${entry.options.limit}`];
  if (entry.searchType === "hybrid") {
    parts.push(`alpha ${entry.options.alpha.toFixed(2)}`);
    if (entry.options.fusionType) parts.push(entry.options.fusionType);
  }
  if (entry.searchType === "nearText" || entry.searchType === "nearVector") {
    if (entry.options.distance) parts.push(`distance ${entry.options.distance}`);
    if (entry.options.certainty) parts.push(`certainty ${entry.options.certainty}`);
  }
  return parts.join(" · ");
};

const RecentSearchesList: React.FC<{
  entries: RecentSearch[];
  onPick: (entry: RecentSearch) => void;
  onClear: () => void;
}> = ({ entries, onPick, onClear }) => {
  if (entries.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-xs text-muted-foreground">
        No recent searches yet
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="border-b px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Recent searches
      </div>
      <ul className="max-h-72 overflow-y-auto py-1">
        {entries.map((entry) => {
          const displayQuery =
            entry.searchType === "nearObject"
              ? `Similar to ${shortenObjectId(entry.query)}`
              : entry.query.trim()
                ? entry.query
                : "(empty query)";
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onPick(entry)}
                title={summariseOptions(entry)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <span className="shrink-0 rounded border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-tight text-muted-foreground">
                  {SEARCH_TYPE_LABEL[entry.searchType]}
                </span>
                <span className="flex-1 truncate font-mono text-[11px]">
                  {displayQuery}
                </span>
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {formatRelativeTime(entry.timestamp)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="border-t px-3 py-2">
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear history for this collection
        </button>
      </div>
    </div>
  );
};

export default Search;
