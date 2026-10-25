import { models, weaviate } from "wailsjs/go/models";
import JsonView from "@uiw/react-json-view";
import {
  AlertTriangle,
  Check,
  Clock,
  Copy,
  Database,
  LoaderCircle,
  Pencil,
  SearchX,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import "./json-view-styles.css";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DeleteObject } from "wailsjs/go/weaviate/Weaviate";
import { cn, errorReporting } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import EditObjectDrawer from "./EditObjectDrawer";
import { computeExpiry, type ExpiryStatus } from "./formatExpiry";
import { VectorPill } from "./VectorPill";
import {
  parseSentinel,
  transformWithExpansions,
  type VectorPillRegistry,
} from "./vectorPillTransform";
import { ScoreBadge, pickPrimarySignal } from "./scoreBadge";

interface Props {
  objects: weaviate.w_WeaviateObject[];
  tenant?: string;
  connectionID: number;
  refetch: () => void;
  loading: boolean;
  isSearch: boolean;
  searchError?: string;
  objectTtlConfig?: models.w_ObjectTTLConfig;
  ref: React.Ref<HTMLDivElement> | undefined;
  onShowSimilar?: (objectId: string) => void;
}

const expiryIconClass: Record<ExpiryStatus, string> = {
  ok: "text-muted-foreground",
  soon: "text-amber-500",
  imminent: "text-destructive",
  expired: "text-destructive",
};

const ObjectsList: React.FC<Props> = ({
  objects,
  tenant,
  connectionID,
  loading,
  isSearch,
  searchError,
  objectTtlConfig,
  refetch,
  ref,
  onShowSimilar,
}) => {
  const internalRef = useRef<HTMLDivElement>(null);
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      internalRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref && "current" in ref) {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [ref]
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: objects.length,
    getScrollElement: () => internalRef.current,
    estimateSize: () => 240,
    overscan: 4,
  });

  if (!objects.length) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4">
        {searchError ? (
          <>
            <AlertTriangle className="text-destructive h-12 w-12" />
            <div className="max-w-md text-center">
              <p className="text-lg font-medium">Search failed</p>
              <p className="text-muted-foreground text-sm break-words">
                {searchError}
              </p>
            </div>
          </>
        ) : loading ? (
          <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <>
            {isSearch ? (
              <SearchX className="h-12 w-12 text-muted-foreground" />
            ) : (
              <Database className="h-12 w-12 text-muted-foreground" />
            )}
            <div className="text-center">
              <p className="text-lg font-medium">
                {isSearch ? "No results found" : "No objects yet"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isSearch
                  ? "Try refining your query to get results back."
                  : "This collection has no data."}
              </p>
            </div>
          </>
        )}
      </div>
    );
  }

  const items = virtualizer.getVirtualItems();

  return (
    <div
      ref={setRefs}
      className="min-h-0 flex-1 overflow-y-auto"
      style={{ contain: "strict" }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {items.map((virtualRow) => {
          const obj = objects[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: 8,
              }}
            >
              <ObjectCard
                connectionID={connectionID}
                object={obj}
                tenant={tenant}
                refetch={refetch}
                objectTtlConfig={objectTtlConfig}
                onShowSimilar={onShowSimilar}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface ObjectCardProps {
  object: weaviate.w_WeaviateObject;
  tenant?: string;
  connectionID: number;
  refetch: () => void;
  objectTtlConfig?: models.w_ObjectTTLConfig;
  onShowSimilar?: (objectId: string) => void;
}

const ObjectCard: React.FC<ObjectCardProps> = ({
  object,
  tenant = "",
  connectionID,
  refetch,
  objectTtlConfig,
  onShowSimilar,
}) => {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => new Set()
  );
  const CopyIcon = copied ? Check : Copy;

  // Strip metadata fields from the rendered JSON body. `class` is implicit
  // (already in the breadcrumb) and `score`/`distance`/`certainty` are
  // surfaced by the <ScoreBadge> in the header — duplicating them here is
  // noise.
  const jsonValue = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { class: _c, score: _s, distance: _d, certainty: _ct, ...rest } =
      object;
    return rest;
  }, [object]);

  // Re-build the transformed tree (with vector arrays replaced by sentinels)
  // every time the value or the set of expanded paths changes. The registry
  // is recreated alongside it so stale ids don't leak between renders.
  const { transformed, registry } = useMemo(() => {
    const reg: VectorPillRegistry = new Map();
    const out = transformWithExpansions(jsonValue, reg, expandedPaths);
    return { transformed: out, registry: reg };
  }, [jsonValue, expandedPaths]);

  const expiry = computeExpiry(object, objectTtlConfig);
  const primarySignal = pickPrimarySignal(object);

  const handleCopy = () => {
    if (copied) return;
    setCopied(true);
    navigator.clipboard.writeText(JSON.stringify(object, null, "  "));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = () =>
    DeleteObject(connectionID, object.class!, object.id!, tenant)
      .catch(errorReporting)
      .finally(() => {
        refetch();
        setOpen(false);
      });

  const expandVector = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      if (prev.has(path)) return prev;
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  }, []);

  return (
    <>
      <EditObjectDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        connectionID={connectionID}
        object={object}
        tenant={tenant}
        onSaved={refetch}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove object</DialogTitle>
            <DialogDescription>
              This will remove the object from the collection. This action
              cannot be undone. Are you sure you want to proceed?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="justify-between!">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate font-mono text-xs text-muted-foreground">
              {object.id}
            </span>
            {expiry && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex shrink-0 items-center">
                    <Clock
                      className={cn(
                        "h-3.5 w-3.5",
                        expiryIconClass[expiry.status]
                      )}
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <div className="flex flex-col gap-0.5">
                    <span>{expiry.relative}</span>
                    <span className="text-[10px] opacity-80">
                      {expiry.absolute}
                    </span>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
            {primarySignal && <ScoreBadge object={object} />}
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleCopy}
              title="Copy as JSON"
            >
              <CopyIcon
                className={`h-3.5 w-3.5 ${copied ? "text-green-600" : ""}`}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setEditOpen(true)}
              title="Edit properties"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {onShowSimilar && object.id && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onShowSimilar(object.id!)}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Find similar objects
                </TooltipContent>
              </Tooltip>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={() => setOpen(true)}
              title="Delete object"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <Separator />
        <div className="json-view-wrapper p-3">
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
                // Fall back to the library's default rendering. The render
                // prop signature expects us to spread the props back onto a
                // <span>.
                const {
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  children,
                  ...rest
                } = props as React.HTMLAttributes<HTMLSpanElement> & {
                  children?: React.ReactNode;
                };
                return <span {...rest}>{children}</span>;
              }}
            />
          </JsonView>
        </div>
      </div>
    </>
  );
};

export default ObjectsList;
