import { models, weaviate } from "wailsjs/go/models";
import {
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DeleteObject } from "wailsjs/go/weaviate/Weaviate";
import { cn, errorReporting } from "@/lib/utils";
import { computeExpiry, type ExpiryStatus } from "./formatExpiry";
import { VectorPill } from "./VectorPill";
import { VECTOR_PILL_THRESHOLD } from "./vectorPillTransform";
import { ScoreBadge, pickPrimarySignal } from "./scoreBadge";
import EditObjectDrawer from "./EditObjectDrawer";

interface Props {
  objects: weaviate.w_WeaviateObject[];
  tenant?: string;
  connectionID: number;
  refetch: () => void;
  loading: boolean;
  isSearch: boolean;
  objectTtlConfig?: models.w_ObjectTTLConfig;
  ref: React.Ref<HTMLDivElement> | undefined;
  onShowSimilar?: (objectId: string) => void;
}

const ROW_HEIGHT = 40;

const expiryIconClass: Record<ExpiryStatus, string> = {
  ok: "text-muted-foreground",
  soon: "text-amber-500",
  imminent: "text-destructive",
  expired: "text-destructive",
};

const META_KEYS = new Set([
  "id",
  "class",
  "tenant",
  "lastUpdateTimeUnix",
  "creationTimeUnix",
  "score",
  "distance",
  "certainty",
]);

const collectPropertyColumns = (
  objects: weaviate.w_WeaviateObject[]
): string[] => {
  const seen = new Set<string>();
  const order: string[] = [];
  const limit = Math.min(objects.length, 200);
  for (let i = 0; i < limit; i++) {
    const props = objects[i].properties;
    if (!props || typeof props !== "object") continue;
    for (const k of Object.keys(props as Record<string, unknown>)) {
      if (META_KEYS.has(k)) continue;
      if (!seen.has(k)) {
        seen.add(k);
        order.push(k);
      }
    }
  }
  return order;
};

const ObjectsTable: React.FC<Props> = ({
  objects,
  tenant,
  connectionID,
  loading,
  isSearch,
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
        (ref as React.RefObject<HTMLDivElement | null>).current = node;
      }
    },
    [ref]
  );

  const propertyColumns = useMemo(
    () => collectPropertyColumns(objects),
    [objects]
  );

  const hasAnyScore = useMemo(
    () => objects.some((o) => pickPrimarySignal(o) !== null),
    [objects]
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: objects.length,
    getScrollElement: () => internalRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  if (!objects.length) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4">
        {loading ? (
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
      className="min-h-0 flex-1 overflow-auto rounded-lg border bg-card"
      style={{ contain: "strict" }}
      data-objects-table-scroll
    >
      {/*
        Sticky <thead> + row virtualization requires us to drop table layout
        in favour of flex rows so <tr style="translateY(...)"> works. Column
        widths are explicit and must match between header and body cells.
      */}
      <table
        className="w-full border-collapse text-xs"
        style={{ display: "block" }}
      >
        <thead
          className="sticky top-0 z-10 bg-muted/70 backdrop-blur supports-[backdrop-filter]:bg-muted/60"
          style={{ display: "block" }}
        >
          <tr className="flex w-full border-b text-left">
            <th
              className="shrink-0 px-3 py-2 font-medium text-muted-foreground"
              style={{ width: 320 }}
            >
              ID
            </th>
            {hasAnyScore && (
              <th
                className="shrink-0 px-3 py-2 font-medium text-muted-foreground"
                style={{ width: 110 }}
              >
                Score
              </th>
            )}
            {propertyColumns.map((col) => (
              <th
                key={col}
                className="shrink-0 truncate px-3 py-2 font-mono font-medium text-muted-foreground"
                style={{ width: 200 }}
                title={col}
              >
                {col}
              </th>
            ))}
            <th
              className="ml-auto shrink-0 px-3 py-2 text-right font-medium text-muted-foreground"
              style={{ width: 110 }}
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody
          style={{
            display: "block",
            position: "relative",
            height: virtualizer.getTotalSize(),
          }}
        >
          {items.map((virtualRow) => {
            const obj = objects[virtualRow.index];
            return (
              <ObjectRow
                key={virtualRow.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                rowRef={virtualizer.measureElement}
                index={virtualRow.index}
                object={obj}
                propertyColumns={propertyColumns}
                hasAnyScore={hasAnyScore}
                tenant={tenant}
                connectionID={connectionID}
                objectTtlConfig={objectTtlConfig}
                refetch={refetch}
                onShowSimilar={onShowSimilar}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

interface RowProps {
  object: weaviate.w_WeaviateObject;
  propertyColumns: string[];
  hasAnyScore: boolean;
  tenant?: string;
  connectionID: number;
  objectTtlConfig?: models.w_ObjectTTLConfig;
  refetch: () => void;
  onShowSimilar?: (objectId: string) => void;
  style: React.CSSProperties;
  rowRef: (node: Element | null) => void;
  index: number;
}

const ObjectRow: React.FC<RowProps> = ({
  object,
  propertyColumns,
  hasAnyScore,
  tenant = "",
  connectionID,
  objectTtlConfig,
  refetch,
  onShowSimilar,
  style,
  rowRef,
  index,
}) => {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

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

  const expiry = computeExpiry(object, objectTtlConfig);
  const props = (object.properties as Record<string, unknown>) || {};
  const primary = pickPrimarySignal(object);
  const CopyIcon = copied ? Check : Copy;

  return (
    <>
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

      <tr
        ref={rowRef}
        data-index={index}
        style={style}
        className="flex w-full items-stretch border-b hover:bg-muted/40"
      >
        <td
          className="flex shrink-0 items-center gap-1.5 px-3 py-2"
          style={{ width: 320 }}
        >
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {object.id}
          </span>
          {expiry && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex shrink-0 items-center">
                  <Clock
                    className={cn("h-3 w-3", expiryIconClass[expiry.status])}
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
        </td>
        {hasAnyScore && (
          <td
            className="flex shrink-0 items-center px-3 py-2"
            style={{ width: 110 }}
          >
            {primary ? <ScoreBadge object={object} /> : null}
          </td>
        )}
        {propertyColumns.map((col) => (
          <td
            key={col}
            className="flex shrink-0 items-center px-3 py-2 text-[11px]"
            style={{ width: 200 }}
          >
            <PropertyCell value={props[col]} />
          </td>
        ))}
        <td
          className="ml-auto flex shrink-0 items-center justify-end gap-0.5 px-3 py-2"
          style={{ width: 110 }}
        >
          {onShowSimilar && object.id && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onShowSimilar(object.id!)}
                >
                  <Sparkles className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Find similar objects</TooltipContent>
            </Tooltip>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleCopy}
            title="Copy as JSON"
          >
            <CopyIcon className={cn("h-3 w-3", copied && "text-green-600")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setEditOpen(true)}
            title="Edit properties"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={() => setOpen(true)}
            title="Delete object"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </td>
      </tr>
      <EditObjectDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        connectionID={connectionID}
        object={object}
        tenant={tenant}
        onSaved={refetch}
      />
    </>
  );
};

const PREVIEW_CHARS = 240;

const isPureNumberArray = (v: unknown): v is number[] => {
  if (!Array.isArray(v)) return false;
  if (v.length <= VECTOR_PILL_THRESHOLD) return false;
  for (let i = 0; i < v.length; i++) {
    if (typeof v[i] !== "number") return false;
  }
  return true;
};

const PropertyCell: React.FC<{ value: unknown }> = ({ value }) => {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground/60">—</span>;
  }
  if (isPureNumberArray(value)) {
    return <VectorPill values={value} onExpand={() => {}} />;
  }
  if (Array.isArray(value)) {
    return <NestedPreview label={`[ ${value.length} ]`} value={value} />;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    return (
      <NestedPreview
        label={`{ ${keys.length} ${keys.length === 1 ? "field" : "fields"} }`}
        value={value}
      />
    );
  }
  if (typeof value === "boolean") {
    return (
      <span className="font-mono text-muted-foreground">
        {value ? "true" : "false"}
      </span>
    );
  }
  if (typeof value === "number") {
    return <span className="font-mono tabular-nums">{value}</span>;
  }
  // String — always set `title` so the native browser tooltip surfaces the
  // full value on hover, even when only the first few characters are visible
  // in the column. Cheap and discoverable; no JS tooltip overhead per row.
  const s = String(value);
  return (
    <span className="truncate" title={s}>
      {s}
    </span>
  );
};

const NestedPreview: React.FC<{ label: string; value: unknown }> = ({
  label,
  value,
}) => {
  const [open, setOpen] = useState(false);
  const preview = useMemo(() => {
    try {
      const j = JSON.stringify(value, null, 2);
      return j.length > PREVIEW_CHARS ? j.slice(0, PREVIEW_CHARS) + "…" : j;
    } catch {
      return "(unserializable)";
    }
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-muted"
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="max-h-72 w-80 overflow-auto p-2"
        align="start"
      >
        <pre className="font-mono text-[11px] whitespace-pre-wrap break-all">
          {preview}
        </pre>
      </PopoverContent>
    </Popover>
  );
};

export default ObjectsTable;
