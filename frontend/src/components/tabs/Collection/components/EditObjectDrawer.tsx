import { useMemo, useState } from "react";
import { useForm, Controller, type FieldValues } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GetCollection, UpdateObject } from "wailsjs/go/weaviate/Weaviate";
import { weaviate, models } from "wailsjs/go/models";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { extractWeaviateError } from "@/lib/utils";
import { collectionDetailsQueryKey } from "./constants";
import { ReferenceChips } from "./ReferenceChips";
import { referencesByProperty } from "./referenceTransform";

type EditableInputType = "text" | "int" | "number" | "boolean" | "date";

const PRIMITIVE_TYPES = new Set<string>([
  "text",
  "string",
  "int",
  "number",
  "boolean",
  "date",
]);

interface EditableField {
  name: string;
  dataType: string;
  inputType: EditableInputType;
  description?: string;
  currentValue: unknown;
}

interface ReadOnlyField {
  name: string;
  dataType: string;
  reason: string;
}

interface PartitionedFields {
  editable: EditableField[];
  readOnly: ReadOnlyField[];
}

/**
 * Decide whether a property is editable in v1 of in-place editing.
 *
 * Rules:
 *  - Only primitive scalar types are editable (text/string, int, number,
 *    boolean, date).
 *  - Arrays (e.g. text[]) and class references (dataType[0] starts with an
 *    uppercase letter) are read-only.
 *  - Geo/blob/phoneNumber/object are read-only.
 *  - Properties starting with `_` are skipped entirely.
 */
const classifyProperty = (
  prop: models.w_Property
): { editable: false; reason: string } | { editable: true; inputType: EditableInputType } => {
  const dt = prop.dataType?.[0];
  if (!dt) return { editable: false, reason: "Unknown data type" };
  if (dt.endsWith("[]")) return { editable: false, reason: "Arrays not supported in v1" };
  // Cross references in Weaviate use class names which start uppercase.
  if (/^[A-Z]/.test(dt)) return { editable: false, reason: "Cross-reference" };
  switch (dt) {
    case "text":
    case "string":
      return { editable: true, inputType: "text" };
    case "int":
      return { editable: true, inputType: "int" };
    case "number":
      return { editable: true, inputType: "number" };
    case "boolean":
      return { editable: true, inputType: "boolean" };
    case "date":
      return { editable: true, inputType: "date" };
    case "geoCoordinates":
      return { editable: false, reason: "Geo coordinates not supported" };
    case "phoneNumber":
      return { editable: false, reason: "Phone numbers not supported" };
    case "blob":
      return { editable: false, reason: "Blobs not supported" };
    case "object":
      return { editable: false, reason: "Nested objects not supported" };
    case "uuid":
      return { editable: false, reason: "UUIDs not supported" };
    default:
      if (PRIMITIVE_TYPES.has(dt)) {
        return { editable: true, inputType: "text" };
      }
      return { editable: false, reason: "Not editable" };
  }
};

/**
 * Convert a Weaviate RFC3339 date string to the value format expected by
 * `<input type="datetime-local">` ("YYYY-MM-DDTHH:mm"). Returns "" on failure.
 */
const dateToInputValue = (raw: unknown): string => {
  if (typeof raw !== "string" || !raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Convert a `datetime-local` form value back to a Weaviate-friendly RFC3339
 * date string. Returns null when the value can't be parsed.
 */
const inputValueToDate = (raw: string): string | null => {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

const buildFields = (
  properties: models.w_Property[] | undefined,
  current: Record<string, unknown>
): PartitionedFields => {
  const editable: EditableField[] = [];
  const readOnly: ReadOnlyField[] = [];

  for (const prop of properties || []) {
    const name = prop.name;
    if (!name || name.startsWith("_")) continue;
    const dt = prop.dataType?.[0] || "unknown";
    const classification = classifyProperty(prop);
    if (classification.editable) {
      editable.push({
        name,
        dataType: dt,
        inputType: classification.inputType,
        description: prop.description,
        currentValue: current[name],
      });
    } else {
      readOnly.push({ name, dataType: dt, reason: classification.reason });
    }
  }

  return { editable, readOnly };
};

const buildDefaults = (fields: EditableField[]): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    switch (f.inputType) {
      case "text":
        out[f.name] = typeof f.currentValue === "string" ? f.currentValue : "";
        break;
      case "int":
      case "number":
        out[f.name] =
          typeof f.currentValue === "number" ? f.currentValue : "";
        break;
      case "boolean":
        out[f.name] =
          typeof f.currentValue === "boolean" ? f.currentValue : false;
        break;
      case "date":
        out[f.name] = dateToInputValue(f.currentValue);
        break;
    }
  }
  return out;
};

/**
 * Build the merge-payload from dirty form fields only. Empty/blank values are
 * sent verbatim — we don't try to distinguish "cleared" from "untouched"; the
 * `dirtyFields` set from react-hook-form does that for us.
 */
const buildPayload = (
  fields: EditableField[],
  values: FieldValues,
  dirtyFields: Partial<Record<string, boolean>>
): { payload: Record<string, unknown>; errors: string[] } => {
  const payload: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const f of fields) {
    if (!dirtyFields[f.name]) continue;
    const raw = values[f.name];
    switch (f.inputType) {
      case "text":
        payload[f.name] = typeof raw === "string" ? raw : "";
        break;
      case "int": {
        if (raw === "" || raw === null || raw === undefined) {
          payload[f.name] = null;
          break;
        }
        const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
        if (!Number.isFinite(n)) {
          errors.push(`${f.name}: not a valid integer`);
          break;
        }
        payload[f.name] = Math.trunc(n);
        break;
      }
      case "number": {
        if (raw === "" || raw === null || raw === undefined) {
          payload[f.name] = null;
          break;
        }
        const n = typeof raw === "number" ? raw : parseFloat(String(raw));
        if (!Number.isFinite(n)) {
          errors.push(`${f.name}: not a valid number`);
          break;
        }
        payload[f.name] = n;
        break;
      }
      case "boolean":
        payload[f.name] = Boolean(raw);
        break;
      case "date": {
        const iso = inputValueToDate(String(raw || ""));
        if (raw && iso === null) {
          errors.push(`${f.name}: invalid date`);
          break;
        }
        payload[f.name] = iso;
        break;
      }
    }
  }

  return { payload, errors };
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionID: number;
  object: weaviate.w_WeaviateObject;
  tenant?: string;
  /**
   * Called after a successful save so the parent can refetch / invalidate the
   * list query and pick up authoritative values from the server.
   */
  onSaved?: () => void;
}

/**
 * Drawer-style editor for primitive object properties.
 *
 * Optimistic-update strategy:
 *  1. Capture all "objects-list-like" cached queries that contain this
 *     object (by id) for the active connection.
 *  2. Patch the matching `w_WeaviateObject` in each cache with the merged
 *     properties + bump `lastUpdateTimeUnix` so any TTL/timestamp UI
 *     updates immediately.
 *  3. Call `UpdateObject`. On error revert every patched cache entry to its
 *     pre-patch snapshot and surface the server error.
 *  4. On success invalidate (refetch) the affected queries so the server is
 *     the source of truth (catches vectorizer module rewrites etc.).
 */
const EditObjectDrawer: React.FC<Props> = ({
  open,
  onOpenChange,
  connectionID,
  object,
  tenant = "",
  onSaved,
}) => {
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);

  // The collection schema drives which fields are editable. We rely on the
  // same query key the CollectionDetails component populates, so flipping
  // between Objects and Details doesn't refetch.
  const className = object.class;
  const {
    data: collection,
    isLoading: loadingSchema,
    error: schemaError,
  } = useQuery({
    queryKey: collectionDetailsQueryKey(connectionID, className),
    queryFn: () => GetCollection(connectionID, className),
    enabled: open && !!className,
    staleTime: 60_000,
  });

  const currentProperties = useMemo(() => {
    const p = object.properties;
    return p && typeof p === "object" && !Array.isArray(p)
      ? (p as Record<string, unknown>)
      : {};
  }, [object.properties]);

  const { editable, readOnly } = useMemo(
    () => buildFields(collection?.properties, currentProperties),
    [collection?.properties, currentProperties]
  );

  const references = useMemo(() => referencesByProperty(object), [object]);

  const defaultValues = useMemo(() => buildDefaults(editable), [editable]);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty, dirtyFields, isSubmitting },
  } = useForm<FieldValues>({
    defaultValues,
    values: defaultValues,
  });

  const hasVectorizer =
    !!collection?.vectorizer && collection.vectorizer !== "none";

  const handleClose = (next: boolean) => {
    if (!next) {
      reset(defaultValues);
      setSubmitError(null);
    }
    onOpenChange(next);
  };

  const onSubmit = async (values: FieldValues) => {
    setSubmitError(null);
    const { payload, errors } = buildPayload(
      editable,
      values,
      dirtyFields as Partial<Record<string, boolean>>
    );

    if (errors.length > 0) {
      setSubmitError(errors.join("; "));
      return;
    }

    if (Object.keys(payload).length === 0) {
      // Nothing to send — pretend it succeeded.
      handleClose(false);
      return;
    }

    // Find every cached query that holds a list of objects from this
    // connection and contains the edited object. We're conservative: match
    // by the well-known "objects" cache key prefix so we don't accidentally
    // poke unrelated caches.
    const affected = queryClient.getQueriesData<
      weaviate.w_WeaviateObject[] | undefined
    >({
      predicate: (q) => {
        const k = q.queryKey;
        return (
          Array.isArray(k) &&
          k[0] === "objects" &&
          k[1] === connectionID &&
          k[2] === className
        );
      },
    });

    // Snapshot for rollback.
    const snapshots: Array<{
      key: unknown[];
      previous: weaviate.w_WeaviateObject[] | undefined;
    }> = [];

    const mergedProperties = { ...currentProperties, ...payload };

    for (const [key, previous] of affected) {
      snapshots.push({ key: key as unknown[], previous });
      if (!previous) continue;
      const next = previous.map((item) =>
        item.id === object.id
          ? ({
              ...item,
              properties: mergedProperties,
              lastUpdateTimeUnix: Date.now(),
            } as weaviate.w_WeaviateObject)
          : item
      );
      queryClient.setQueryData(key, next);
    }

    try {
      await UpdateObject(connectionID, className, object.id, tenant, payload);
      toast.success("Updated", {
        description: `${className} ${object.id.slice(0, 8)}… saved`,
        duration: 3000,
      });
      // Refetch from the server so module rewrites (vector regen, normalised
      // dates, etc.) flow back into the UI.
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey;
          return (
            Array.isArray(k) &&
            k[0] === "objects" &&
            k[1] === connectionID &&
            k[2] === className
          );
        },
      });
      onSaved?.();
      handleClose(false);
    } catch (err) {
      // Roll back optimistic patches.
      for (const snap of snapshots) {
        queryClient.setQueryData(snap.key, snap.previous);
      }
      const msg = extractWeaviateError(err);
      setSubmitError(msg);
      toast.error("Failed to update object", {
        description: msg,
        duration: 5000,
        closeButton: true,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="fixed top-0 right-0 left-auto z-50 grid h-screen max-h-screen w-full max-w-[min(96vw,560px)] translate-x-0 translate-y-0 grid-rows-[auto_1fr_auto] gap-0 rounded-none border-l p-0 shadow-xl sm:max-w-[min(96vw,560px)] data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right"
      >
        <DialogHeader className="border-b p-4">
          <DialogTitle>Edit object</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {object.id}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto p-4">
          {loadingSchema && (
            <div className="flex h-32 items-center justify-center">
              <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {schemaError && (
            <div className="bg-destructive/10 border-destructive/30 text-destructive rounded-md border px-3 py-2 text-sm">
              Failed loading collection schema: {extractWeaviateError(schemaError)}
            </div>
          )}
          {!loadingSchema && !schemaError && collection && (
            <form
              id="edit-object-form"
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-4"
            >
              {editable.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  This collection has no editable primitive properties.
                </p>
              )}

              {editable.map((field) => (
                <div key={field.name} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={`edit-${field.name}`}
                      className="text-sm font-medium"
                    >
                      {field.name}
                    </Label>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {field.dataType}
                    </Badge>
                  </div>
                  {field.description && (
                    <p className="text-muted-foreground text-xs">
                      {field.description}
                    </p>
                  )}
                  <Controller
                    name={field.name}
                    control={control}
                    render={({ field: rhf }) => {
                      switch (field.inputType) {
                        case "boolean":
                          return (
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`edit-${field.name}`}
                                checked={Boolean(rhf.value)}
                                onCheckedChange={(c) => rhf.onChange(c === true)}
                              />
                              <Label
                                htmlFor={`edit-${field.name}`}
                                className="cursor-pointer text-sm"
                              >
                                {rhf.value ? "true" : "false"}
                              </Label>
                            </div>
                          );
                        case "int":
                          return (
                            <Input
                              id={`edit-${field.name}`}
                              type="number"
                              step="1"
                              value={rhf.value as string | number}
                              onChange={(e) => {
                                const v = e.target.value;
                                rhf.onChange(v === "" ? "" : parseInt(v, 10));
                              }}
                            />
                          );
                        case "number":
                          return (
                            <Input
                              id={`edit-${field.name}`}
                              type="number"
                              step="any"
                              value={rhf.value as string | number}
                              onChange={(e) => {
                                const v = e.target.value;
                                rhf.onChange(v === "" ? "" : parseFloat(v));
                              }}
                            />
                          );
                        case "date":
                          return (
                            <Input
                              id={`edit-${field.name}`}
                              type="datetime-local"
                              value={String(rhf.value ?? "")}
                              onChange={(e) => rhf.onChange(e.target.value)}
                            />
                          );
                        case "text":
                        default:
                          return (
                            <Input
                              id={`edit-${field.name}`}
                              type="text"
                              value={String(rhf.value ?? "")}
                              onChange={(e) => rhf.onChange(e.target.value)}
                            />
                          );
                      }
                    }}
                  />
                </div>
              ))}

              {readOnly.length > 0 && (
                <Collapsible className="border-t pt-3">
                  <CollapsibleTrigger className="group flex w-full items-center justify-between text-left text-xs font-medium text-muted-foreground hover:text-foreground">
                    <span>
                      Read-only properties ({readOnly.length})
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-3">
                    {readOnly.map((field) => (
                      <div
                        key={field.name}
                        className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{field.name}</span>
                          <Badge
                            variant="outline"
                            className="font-mono text-[10px]"
                          >
                            {field.dataType}
                          </Badge>
                        </div>
                        {references.has(field.name) ? (
                          <div className="flex min-w-0 justify-end">
                            <ReferenceChips
                              reference={references.get(field.name)}
                            />
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            {field.reason}
                          </span>
                        )}
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {hasVectorizer && (
                <p className="text-muted-foreground border-t pt-3 text-xs">
                  Vectorized properties will trigger re-embedding on save.
                </p>
              )}

              {submitError && (
                <div className="bg-destructive/10 border-destructive/30 text-destructive rounded-md border px-3 py-2 text-sm">
                  {submitError}
                </div>
              )}
            </form>
          )}
        </div>

        <DialogFooter className="border-t p-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-object-form"
            disabled={
              !isDirty || isSubmitting || loadingSchema || editable.length === 0
            }
          >
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditObjectDrawer;
