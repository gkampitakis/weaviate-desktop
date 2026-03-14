import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronDown, Search as SearchIcon, X } from "lucide-react";
import { useState } from "react";

export type SearchType = "bm25" | "hybrid" | "nearText" | "nearVector";

export interface SearchOptions {
  limit: number;
  alpha: number;
  fusionType: string;
  distance: number;
  certainty: number;
}

interface Props {
  handleSearch: (query: string, searchType: SearchType, opts: SearchOptions) => void;
  resetSearch: () => void;
  searchObjects: number;
  executionTime: string;
  children: React.ReactNode;
  changeId: string;
}

const DEFAULT_OPTS: SearchOptions = {
  limit: 100,
  alpha: 0.75,
  fusionType: "",
  distance: 0,
  certainty: 0,
};

const Search: React.FC<Props> = ({
  handleSearch,
  resetSearch,
  searchObjects,
  executionTime,
  changeId,
  children,
}) => {
  const [lastChangeId, setLastChangeId] = useState(changeId);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<SearchType>("bm25");
  const [opts, setOpts] = useState<SearchOptions>(DEFAULT_OPTS);
  const [searching, setSearching] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [vectorError, setVectorError] = useState<string | null>(null);

  if (changeId !== lastChangeId) {
    setSearchQuery("");
    setOpts(DEFAULT_OPTS);
    setLastChangeId(changeId);
  }

  const handleTypeChange = (value: string) => {
    setSearchType(value as SearchType);
    setSearchQuery("");
    setOpts(DEFAULT_OPTS);
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
    setOpts(DEFAULT_OPTS);
    setSearching(false);
    setVectorError(null);
    resetSearch();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchType === "nearVector") {
      const err = validateVector(searchQuery);
      if (err) { setVectorError(err); return; }
    }
    setSearching(true);
    handleSearch(searchQuery, searchType, opts);
  };

  const placeholder =
    searchType === "nearText" ? "Enter concepts…" :
    searchType === "nearVector" ? "[0.1, 0.23, …]" :
    "Keyword search…";

  const hasOptions = true;

  return (
    <>
      <div className="mb-2 rounded-lg border bg-card shadow-xs">
        {/* Type selector */}
        <div className="border-b px-3 pt-2.5 pb-0">
          <Tabs value={searchType} onValueChange={handleTypeChange}>
            <TabsList className="h-8 gap-0.5 bg-transparent p-0">
              {(["bm25", "hybrid", "nearText", "nearVector"] as SearchType[]).map((t) => (
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
            {/* Input / textarea */}
            <div className="relative flex-1">
              {searchType === "nearVector" ? (
                <>
                  <textarea
                    className={`w-full resize-none rounded-md border bg-background px-3 py-2 font-mono text-xs leading-relaxed placeholder:text-muted-foreground focus:outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:border-ring transition-[color,box-shadow] ${vectorError ? "border-destructive focus-visible:ring-destructive/20" : ""}`}
                    placeholder={placeholder}
                    autoComplete="off"
                    rows={2}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setVectorError(validateVector(e.target.value));
                    }}
                  />
                  {vectorError && (
                    <p className="mt-1 text-xs text-destructive">{vectorError}</p>
                  )}
                </>
              ) : (
                <div className="relative">
                  <SearchIcon className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    className="h-9 w-full rounded-md border bg-background pl-8 pr-8 text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:border-ring transition-[color,box-shadow]"
                    placeholder={placeholder}
                    autoComplete="off"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
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
              )}
            </div>

            {/* Search button */}
            <Button type="submit" size="sm" className="h-9 shrink-0">
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

                  {/* Limit — all types */}
                  <OptionRow
                    label="Limit"
                    tooltip="Maximum number of results to return."
                  >
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={opts.limit}
                      onChange={(e) => setOpt("limit", parseInt(e.target.value) || 100)}
                      className="h-7 w-24 rounded-md border bg-background px-2 text-xs focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </OptionRow>

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

      {searching && (
        <div className="mt-1 flex justify-between">
          <span className="text-xs text-muted-foreground">
            {searchObjects} results displayed
          </span>
          <span className="text-xs text-muted-foreground">
            Query took {executionTime}
          </span>
        </div>
      )}
    </>
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

export default Search;
