/* eslint-disable react-hooks/incompatible-library */
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { errorReporting, extractWeaviateError } from "@/lib/utils";
import { NodesStatus, UpdateCollection } from "wailsjs/go/weaviate/Weaviate";
import { models } from "wailsjs/go/models";
import { useFeature } from "@/hooks/use-features";

const DELETION_STRATEGIES = [
  "NoAutomatedResolution",
  "TimeBasedResolution",
  "DeleteOnConflict",
];

const TTL_UNITS: Record<string, number> = {
  minutes: 60,
  hours: 3600,
  days: 86400,
};

const quantizerPatch = (compression: string): Record<string, unknown> => {
  switch (compression) {
    case "bq":
      return { bq: { enabled: true } };
    case "pq":
      return { pq: { enabled: true } };
    case "sq":
      return { sq: { enabled: true } };
    case "rq-8":
      return { rq: { enabled: true, bits: 8 } };
    case "rq-1":
      return { rq: { enabled: true, bits: 1 } };
    case "none":
    default:
      return {
        bq: { enabled: false },
        pq: { enabled: false },
        sq: { enabled: false },
        rq: { enabled: false },
      };
  }
};

const detectCompression = (
  vectorIndexConfig: Record<string, unknown> | undefined
): string => {
  if (!vectorIndexConfig) return "none";
  const vc = vectorIndexConfig as {
    bq?: { enabled?: boolean };
    pq?: { enabled?: boolean };
    sq?: { enabled?: boolean };
    rq?: { enabled?: boolean; bits?: number };
  };
  if (vc.bq?.enabled) return "bq";
  if (vc.pq?.enabled) return "pq";
  if (vc.sq?.enabled) return "sq";
  if (vc.rq?.enabled) return vc.rq.bits === 1 ? "rq-1" : "rq-8";
  return "none";
};

const compressionOptions = (
  rqAvailable: boolean
): { label: string; value: string }[] => {
  const out = [
    { label: "Uncompressed", value: "none" },
    { label: "Binary Quantization (BQ)", value: "bq" },
    { label: "Product Quantization (PQ)", value: "pq" },
    { label: "Scalar Quantization (SQ)", value: "sq" },
  ];
  if (rqAvailable) {
    out.push({ label: "Rotational Quantization 8-bit", value: "rq-8" });
    out.push({ label: "Rotational Quantization 1-bit", value: "rq-1" });
  }
  return out;
};

const secondsToBest = (seconds: number): { value: number; unit: string } => {
  if (seconds % TTL_UNITS.days === 0)
    return { value: seconds / TTL_UNITS.days, unit: "days" };
  if (seconds % TTL_UNITS.hours === 0)
    return { value: seconds / TTL_UNITS.hours, unit: "hours" };
  return { value: Math.max(1, Math.round(seconds / 60)), unit: "minutes" };
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionID: number;
  collection: models.w_Class;
  onSuccess: () => void;
}

interface FormData {
  description: string;
  bm25B: number;
  bm25K1: number;
  cleanupIntervalSeconds: number;
  replicationFactor: number;
  asyncEnabled: boolean;
  deletionStrategy: string;
  autoTenantCreation: boolean;
  autoTenantActivation: boolean;
  compression: string;
  flatCompression: string;
  hnswCompression: string;
  ttlEnabled: boolean;
  ttlValue: number;
  ttlUnit: string;
  ttlDeleteOn: string;
  ttlFilterExpired: boolean;
}

export function EditCollectionDialog({
  open,
  onOpenChange,
  connectionID,
  collection,
  onSuccess,
}: Props) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const mtEnabled = collection.multiTenancyConfig?.enabled === true;
  const ttlSupported = useFeature(connectionID, "objectTTL");
  const rqAvailable = useFeature(connectionID, "rotationalQuantization");

  const vectorIndexType = collection.vectorIndexType || "hnsw";
  const vectorIndexCfg = collection.vectorIndexConfig as
    | Record<string, unknown>
    | undefined;
  const isDynamic = vectorIndexType === "dynamic";
  const isHFresh = vectorIndexType === "hfresh";
  const compressionSeed = detectCompression(vectorIndexCfg);
  const flatCompressionSeed = isDynamic
    ? detectCompression(vectorIndexCfg?.flat as Record<string, unknown>)
    : "none";
  const hnswCompressionSeed = isDynamic
    ? detectCompression(vectorIndexCfg?.hnsw as Record<string, unknown>)
    : "none";
  const compressions = compressionOptions(rqAvailable);

  const { data: nodes } = useQuery({
    queryKey: ["nodes", connectionID],
    queryFn: () => NodesStatus(connectionID),
    enabled: open,
    staleTime: 30_000,
  });
  const nodeCount = nodes?.nodes?.length ?? 1;

  const invertedIndex = collection.invertedIndexConfig as
    | {
        bm25?: { b?: number; k1?: number };
        cleanupIntervalSeconds?: number;
      }
    | undefined;
  const replication = collection.replicationConfig as
    | {
        factor?: number;
        asyncEnabled?: boolean;
        deletionStrategy?: string;
      }
    | undefined;
  const multiTenancy = collection.multiTenancyConfig as
    | {
        enabled?: boolean;
        autoTenantCreation?: boolean;
        autoTenantActivation?: boolean;
      }
    | undefined;
  const ttl = (collection as unknown as {
    objectTtlConfig?: {
      enabled?: boolean;
      defaultTtl?: number;
      deleteOn?: string;
      filterExpiredObjects?: boolean;
    };
  }).objectTtlConfig;

  const ttlSeed = secondsToBest(ttl?.defaultTtl ?? 86400);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<FormData>({
    defaultValues: {
      description: collection.description || "",
      bm25B: invertedIndex?.bm25?.b ?? 0.75,
      bm25K1: invertedIndex?.bm25?.k1 ?? 1.2,
      cleanupIntervalSeconds: invertedIndex?.cleanupIntervalSeconds ?? 60,
      replicationFactor: replication?.factor ?? 1,
      asyncEnabled: replication?.asyncEnabled ?? false,
      deletionStrategy:
        replication?.deletionStrategy || "NoAutomatedResolution",
      autoTenantCreation: multiTenancy?.autoTenantCreation ?? false,
      autoTenantActivation: multiTenancy?.autoTenantActivation ?? false,
      compression: compressionSeed,
      flatCompression: flatCompressionSeed,
      hnswCompression: hnswCompressionSeed,
      ttlEnabled: ttl?.enabled ?? false,
      ttlValue: ttlSeed.value,
      ttlUnit: ttlSeed.unit,
      ttlDeleteOn: ttl?.deleteOn ?? "_creationTimeUnix",
      ttlFilterExpired: ttl?.filterExpiredObjects ?? false,
    },
  });

  const ttlOn = watch("ttlEnabled");
  const filterableProperties = (collection.properties || [])
    .filter((p) => p.indexFilterable !== false && p.name)
    .map((p) => ({ name: p.name as string, dataType: p.dataType?.[0] || "" }))
    .sort((a, b) => {
      const aIsDate = a.dataType === "date" || a.dataType === "date[]";
      const bIsDate = b.dataType === "date" || b.dataType === "date[]";
      if (aIsDate && !bIsDate) return -1;
      if (!aIsDate && bIsDate) return 1;
      return a.name.localeCompare(b.name);
    });

  const onSubmit = async (data: FormData) => {
    if (data.replicationFactor > nodeCount) data.replicationFactor = nodeCount;
    setSubmitError(null);
    try {
      const ttlPatch = ttlSupported
        ? {
            objectTtlConfig: data.ttlEnabled
              ? {
                  enabled: true,
                  defaultTtl: data.ttlValue * (TTL_UNITS[data.ttlUnit] ?? 86400),
                  deleteOn: data.ttlDeleteOn,
                  filterExpiredObjects: data.ttlFilterExpired,
                }
              : { enabled: false, defaultTtl: 0, deleteOn: "_creationTimeUnix", filterExpiredObjects: false },
          }
        : {};

      let vectorIndexPatch: Record<string, unknown> | undefined;
      if (!isHFresh) {
        if (isDynamic) {
          vectorIndexPatch = {
            ...(vectorIndexCfg || {}),
            flat: {
              ...((vectorIndexCfg?.flat as Record<string, unknown>) || {}),
              ...quantizerPatch(data.flatCompression),
            },
            hnsw: {
              ...((vectorIndexCfg?.hnsw as Record<string, unknown>) || {}),
              ...quantizerPatch(data.hnswCompression),
            },
          };
        } else {
          vectorIndexPatch = {
            ...(vectorIndexCfg || {}),
            ...quantizerPatch(data.compression),
          };
        }
      }

      const next = new models.w_Class({
        ...collection,
        description: data.description || undefined,
        invertedIndexConfig: {
          ...(collection.invertedIndexConfig || {}),
          bm25: { b: data.bm25B, k1: data.bm25K1 },
          cleanupIntervalSeconds: data.cleanupIntervalSeconds,
        },
        ...(vectorIndexPatch && { vectorIndexConfig: vectorIndexPatch }),
        replicationConfig: {
          ...(collection.replicationConfig || {}),
          factor: data.replicationFactor,
          asyncEnabled: data.asyncEnabled,
          deletionStrategy: data.deletionStrategy,
        },
        multiTenancyConfig: mtEnabled
          ? {
              ...(collection.multiTenancyConfig || {}),
              autoTenantCreation: data.autoTenantCreation,
              autoTenantActivation: data.autoTenantActivation,
            }
          : collection.multiTenancyConfig,
        ...ttlPatch,
      });

      await UpdateCollection(connectionID, next);

      onSuccess();
      onOpenChange(false);
      reset();
    } catch (error) {
      errorReporting(error);
      setSubmitError(extractWeaviateError(error));
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      reset();
      setSubmitError(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] w-[min(96vw,1100px)] sm:max-w-[min(96vw,1100px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {collection.class}</DialogTitle>
        </DialogHeader>

        <div className="bg-muted/50 text-muted-foreground rounded-md p-3 text-xs">
          Class name, vectorizer, vector index type, sharding, properties and
          module config are immutable after creation. To change them, recreate
          the collection.
        </div>

        {submitError && (
          <div className="bg-destructive/10 border-destructive/30 text-destructive rounded-md border px-4 py-3 text-sm">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  id="edit-description"
                  placeholder="Optional description"
                />
              )}
            />
          </div>

          <fieldset className="space-y-3 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">Inverted index</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-bm25-b">BM25 b</Label>
                <Controller
                  name="bm25B"
                  control={control}
                  rules={{ min: 0, max: 1 }}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="edit-bm25-b"
                      type="number"
                      step="0.05"
                      onChange={(e) =>
                        field.onChange(parseFloat(e.target.value))
                      }
                    />
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-bm25-k1">BM25 k1</Label>
                <Controller
                  name="bm25K1"
                  control={control}
                  rules={{ min: 0 }}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="edit-bm25-k1"
                      type="number"
                      step="0.1"
                      onChange={(e) =>
                        field.onChange(parseFloat(e.target.value))
                      }
                    />
                  )}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-cleanup">Cleanup interval (seconds)</Label>
              <Controller
                name="cleanupIntervalSeconds"
                control={control}
                rules={{ min: 1 }}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="edit-cleanup"
                    type="number"
                    onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                  />
                )}
              />
            </div>
          </fieldset>

          {!isHFresh && (
            <fieldset className="space-y-3 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">
                Vector compression
              </legend>
              <p className="text-muted-foreground text-xs">
                Index type: <code>{vectorIndexType}</code>. Changes here trigger
                a re-index; some transitions may be rejected by the server.
              </p>
              {isDynamic ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="edit-flat-compression">
                      Flat compression
                    </Label>
                    <Controller
                      name="flatCompression"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger id="edit-flat-compression">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {compressions.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-hnsw-compression">
                      HNSW compression
                    </Label>
                    <Controller
                      name="hnswCompression"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger id="edit-hnsw-compression">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {compressions.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="edit-compression">Compression</Label>
                  <Controller
                    name="compression"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger id="edit-compression">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {compressions.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              )}
            </fieldset>
          )}

          <fieldset className="space-y-3 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">Replication</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-replication-factor">Factor</Label>
                <Controller
                  name="replicationFactor"
                  control={control}
                  rules={{
                    min: { value: 1, message: "Must be at least 1" },
                    max: {
                      value: nodeCount,
                      message: `Max ${nodeCount} (cluster has ${nodeCount} node${nodeCount === 1 ? "" : "s"})`,
                    },
                  }}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="edit-replication-factor"
                      type="number"
                      min="1"
                      max={nodeCount}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value, 10))
                      }
                      className={
                        errors.replicationFactor ? "border-destructive" : ""
                      }
                    />
                  )}
                />
                <p className="text-muted-foreground text-xs">
                  {nodeCount} node{nodeCount === 1 ? "" : "s"} available
                </p>
                {errors.replicationFactor && (
                  <p className="text-destructive text-sm">
                    {errors.replicationFactor.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-deletion-strategy">
                  Deletion strategy
                </Label>
                <Controller
                  name="deletionStrategy"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger id="edit-deletion-strategy">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DELETION_STRATEGIES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
            <Controller
              name="asyncEnabled"
              control={control}
              render={({ field }) => (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="edit-async-enabled"
                    checked={field.value}
                    onCheckedChange={(c) => field.onChange(c === true)}
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor="edit-async-enabled"
                    className="cursor-pointer"
                  >
                    Async replication
                  </Label>
                </div>
              )}
            />
          </fieldset>

          {ttlSupported && (
            <fieldset className="space-y-3 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">
                Time to live (TTL)
              </legend>
              <Controller
                name="ttlEnabled"
                control={control}
                render={({ field }) => (
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(c) => field.onChange(c === true)}
                    />
                    Expire objects automatically
                  </label>
                )}
              />
              {ttlOn && (
                <div className="grid grid-cols-2 gap-3 pl-6">
                  <div className="space-y-2">
                    <Label>Expire after</Label>
                    <div className="flex gap-2">
                      <Controller
                        name="ttlValue"
                        control={control}
                        rules={{ min: 1 }}
                        render={({ field }) => (
                          <Input
                            {...field}
                            type="number"
                            min="1"
                            onChange={(e) =>
                              field.onChange(parseInt(e.target.value, 10))
                            }
                          />
                        )}
                      />
                      <Controller
                        name="ttlUnit"
                        control={control}
                        render={({ field }) => (
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="minutes">minutes</SelectItem>
                              <SelectItem value="hours">hours</SelectItem>
                              <SelectItem value="days">days</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Expiry reference</Label>
                    <Controller
                      name="ttlDeleteOn"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_creationTimeUnix">
                              Creation time
                            </SelectItem>
                            <SelectItem value="_lastUpdateTimeUnix">
                              Last update time
                            </SelectItem>
                            {filterableProperties.map((p) => (
                              <SelectItem key={p.name} value={p.name}>
                                {p.name}
                                <span className="text-muted-foreground ml-2 text-xs">
                                  ({p.dataType})
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="col-span-2">
                    <Controller
                      name="ttlFilterExpired"
                      control={control}
                      render={({ field }) => (
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(c) => field.onChange(c === true)}
                          />
                          Exclude expired objects from query results
                        </label>
                      )}
                    />
                  </div>
                </div>
              )}
            </fieldset>
          )}

          {mtEnabled && (
            <fieldset className="space-y-3 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">
                Multi-tenancy
              </legend>
              <Controller
                name="autoTenantCreation"
                control={control}
                render={({ field }) => (
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="edit-auto-tenant-creation"
                      checked={field.value}
                      onCheckedChange={(c) => field.onChange(c === true)}
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor="edit-auto-tenant-creation"
                      className="cursor-pointer"
                    >
                      Auto tenant creation
                    </Label>
                  </div>
                )}
              />
              <Controller
                name="autoTenantActivation"
                control={control}
                render={({ field }) => (
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="edit-auto-tenant-activation"
                      checked={field.value}
                      onCheckedChange={(c) => field.onChange(c === true)}
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor="edit-auto-tenant-activation"
                      className="cursor-pointer"
                    >
                      Auto tenant activation
                    </Label>
                  </div>
                )}
              />
            </fieldset>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
