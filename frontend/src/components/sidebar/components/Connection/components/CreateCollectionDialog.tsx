import React, { useState } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  ChevronDown,
  ChevronRight,
  Trash2,
  Plus,
  Copy,
  FileJson,
  FormInput,
} from "lucide-react";
import { errorReporting, extractWeaviateError, cn } from "@/lib/utils";
import {
  CreateCollection,
  GetCollection,
  GetCollections,
  GetModules,
  NodesStatus,
} from "wailsjs/go/weaviate/Weaviate";
import { models } from "wailsjs/go/models";
import { useFeature } from "@/hooks/use-features";

const PRIMITIVE_DATA_TYPES = [
  "text",
  "text[]",
  "int",
  "int[]",
  "number",
  "number[]",
  "boolean",
  "boolean[]",
  "date",
  "date[]",
  "uuid",
  "uuid[]",
  "blob",
];

const BASE_INDEX_TYPES = ["hnsw", "flat", "dynamic"];

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

const NAME_REGEX = /^[A-Z][a-zA-Z0-9_]*$/;

const PROP_NAME_REGEX = /^[a-z][_0-9a-z]*$/;

const PROP_NAME_DESCRIPTION =
  "Must start with a lowercase letter and contain only lowercase letters, digits, and underscores.";

const RESERVED_PROPERTY_NAMES = new Set(["id", "_additional"]);

type Mode = "form" | "clone" | "json";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionID: number;
  existingClassNames: string[];
  onSuccess: () => void;
}

const TEXT_TOKENIZATIONS = ["word", "lowercase", "whitespace", "field"];

interface PropertyRow {
  name: string;
  dataType: string;
  description: string;
  indexFilterable: boolean;
  indexSearchable: boolean;
  indexRangeFilters: boolean;
  tokenization: string;
}

interface ModuleConfigEntry {
  key: string;
  value: string;
}

interface FormData {
  name: string;
  description: string;
  vectorizer: string;
  moduleConfig: ModuleConfigEntry[];
  vectorIndexType: string;
  compression: string;
  flatCompression: string;
  hnswCompression: string;
  replicationFactor: number;
  asyncEnabled: boolean;
  deletionStrategy: string;
  multiTenancyEnabled: boolean;
  ttlEnabled: boolean;
  ttlValue: number;
  ttlUnit: keyof typeof TTL_UNITS;
  ttlDeleteOn: string;
  ttlFilterExpired: boolean;
  properties: PropertyRow[];
}

const blankProperty = (): PropertyRow => ({
  name: "",
  dataType: "text",
  description: "",
  indexFilterable: true,
  indexSearchable: true,
  indexRangeFilters: false,
  tokenization: "word",
});

const isTextType = (dt: string) => dt === "text" || dt === "text[]";

const defaults = (): FormData => ({
  name: "",
  description: "",
  vectorizer: "none",
  moduleConfig: [],
  vectorIndexType: "hnsw",
  compression: "none",
  flatCompression: "none",
  hnswCompression: "none",
  replicationFactor: 1,
  asyncEnabled: false,
  deletionStrategy: "NoAutomatedResolution",
  multiTenancyEnabled: false,
  ttlEnabled: false,
  ttlValue: 1,
  ttlUnit: "days",
  ttlDeleteOn: "_creationTimeUnix",
  ttlFilterExpired: false,
  properties: [blankProperty()],
});

const quantizerConfig = (
  compression: string
): Record<string, unknown> | undefined => {
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
    default:
      return undefined;
  }
};

const buildVectorIndexConfig = (
  indexType: string,
  compression: string,
  flatCompression: string,
  hnswCompression: string
): Record<string, unknown> | undefined => {
  if (indexType === "hfresh") return undefined;
  if (indexType === "dynamic") {
    return {
      flat: { ...(quantizerConfig(flatCompression) || {}) },
      hnsw: { ...(quantizerConfig(hnswCompression) || {}) },
    };
  }
  return quantizerConfig(compression);
};

const moduleConfigFromEntries = (
  vectorizer: string,
  entries: ModuleConfigEntry[]
): Record<string, unknown> | undefined => {
  if (vectorizer === "none") return undefined;
  const cfg: Record<string, string> = {};
  for (const { key, value } of entries) {
    if (key.trim().length === 0) continue;
    cfg[key.trim()] = value;
  }
  if (Object.keys(cfg).length === 0) return undefined;
  return { [vectorizer]: cfg };
};

const classFromForm = (data: FormData): models.w_Class => {
  const props = data.properties
    .filter((p) => p.name.trim().length > 0)
    .map(
      (p) =>
        new models.w_Property({
          name: p.name,
          dataType: [p.dataType],
          description: p.description || undefined,
          indexFilterable: p.indexFilterable,
          indexSearchable: p.indexSearchable,
          indexRangeFilters: p.indexRangeFilters,
          tokenization: isTextType(p.dataType) ? p.tokenization : undefined,
        })
    );

  const ttlSeconds = data.ttlValue * TTL_UNITS[data.ttlUnit];

  return new models.w_Class({
    class: data.name,
    description: data.description || undefined,
    vectorizer: data.vectorizer,
    vectorIndexType: data.vectorIndexType,
    vectorIndexConfig: buildVectorIndexConfig(
      data.vectorIndexType,
      data.compression,
      data.flatCompression,
      data.hnswCompression
    ),
    moduleConfig: moduleConfigFromEntries(data.vectorizer, data.moduleConfig),
    replicationConfig: {
      factor: data.replicationFactor,
      asyncEnabled: data.asyncEnabled,
      deletionStrategy: data.deletionStrategy,
    },
    multiTenancyConfig: { enabled: data.multiTenancyEnabled },
    properties: props,
    ...(data.ttlEnabled && {
      objectTtlConfig: {
        enabled: true,
        defaultTtl: ttlSeconds,
        deleteOn: data.ttlDeleteOn,
        filterExpiredObjects: data.ttlFilterExpired,
      },
    }),
  });
};

const formFromClass = (c: models.w_Class): FormData => {
  const mc = c.moduleConfig as
    | Record<string, Record<string, unknown>>
    | undefined;
  const vectorizer = c.vectorizer || "none";
  const mcEntries: ModuleConfigEntry[] =
    mc && vectorizer !== "none" && mc[vectorizer]
      ? Object.entries(mc[vectorizer]).map(([k, v]) => ({
          key: k,
          value: typeof v === "string" ? v : JSON.stringify(v),
        }))
      : [];

  const replication = c.replicationConfig as
    | { factor?: number; asyncEnabled?: boolean; deletionStrategy?: string }
    | undefined;

  const vectorIndexConfig = c.vectorIndexConfig as
    | {
        bq?: { enabled?: boolean };
        pq?: { enabled?: boolean };
        sq?: { enabled?: boolean };
        rq?: { enabled?: boolean; bits?: number };
      }
    | undefined;

  let compression = "none";
  if (vectorIndexConfig?.bq?.enabled) compression = "bq";
  else if (vectorIndexConfig?.pq?.enabled) compression = "pq";
  else if (vectorIndexConfig?.sq?.enabled) compression = "sq";
  else if (vectorIndexConfig?.rq?.enabled)
    compression = vectorIndexConfig.rq.bits === 1 ? "rq-1" : "rq-8";

  return {
    name: "",
    description: c.description || "",
    vectorizer,
    moduleConfig: mcEntries,
    vectorIndexType: c.vectorIndexType || "hnsw",
    compression,
    flatCompression: "none",
    hnswCompression: "none",
    replicationFactor: replication?.factor ?? 1,
    asyncEnabled: replication?.asyncEnabled ?? false,
    deletionStrategy: replication?.deletionStrategy || "NoAutomatedResolution",
    multiTenancyEnabled:
      (c.multiTenancyConfig as { enabled?: boolean })?.enabled === true,
    ttlEnabled: false,
    ttlValue: 1,
    ttlUnit: "days",
    ttlDeleteOn: "_creationTimeUnix",
    ttlFilterExpired: false,
    properties:
      c.properties && c.properties.length > 0
        ? c.properties.map((p) => ({
            name: p.name || "",
            dataType: p.dataType?.[0] || "text",
            description: p.description || "",
            indexFilterable: p.indexFilterable ?? true,
            indexSearchable: p.indexSearchable ?? true,
            indexRangeFilters: p.indexRangeFilters ?? false,
            tokenization: p.tokenization || "word",
          }))
        : [blankProperty()],
  };
};

const compressionOptions = (
  serverVersion: string,
  rqAvailable: boolean
): { label: string; value: string }[] => {
  const out = [
    { label: "Uncompressed", value: "none" },
    { label: "Binary Quantization (BQ)", value: "bq" },
  ];
  if (rqAvailable) {
    out.push({ label: "Rotational Quantization 8-bit", value: "rq-8" });
    out.push({ label: "Rotational Quantization 1-bit", value: "rq-1" });
  }
  // PQ / SQ deprecated from 1.34 onwards
  if (serverVersion && parseFloat(serverVersion) < 1.34) {
    out.push({ label: "Product Quantization (PQ)", value: "pq" });
    out.push({ label: "Scalar Quantization (SQ)", value: "sq" });
  }
  return out;
};

// ---------------------------------------------------------------------------
// Section header — collapsible accordion-style row
// ---------------------------------------------------------------------------

interface SectionHeaderProps {
  title: string;
  open: boolean;
  badge?: string;
}

function SectionHeader({ title, open, badge }: SectionHeaderProps) {
  return (
    <div className="flex w-full items-center gap-2 py-2 text-left">
      {open ? (
        <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
      ) : (
        <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
      )}
      <span className="text-sm font-medium">{title}</span>
      {badge && (
        <span className="bg-muted text-muted-foreground ml-auto rounded px-1.5 py-0.5 text-xs">
          {badge}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------

export function CreateCollectionDialog({
  open,
  onOpenChange,
  connectionID,
  existingClassNames,
  onSuccess,
}: Props) {
  const [mode, setMode] = useState<Mode>("form");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [cloneSource, setCloneSource] = useState<string>("");
  const [submittingJson, setSubmittingJson] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Section open states — Basics is open by default, rest collapsed
  const [vectorOpen, setVectorOpen] = useState(false);
  const [replicationOpen, setReplicationOpen] = useState(false);
  const [ttlSectionOpen, setTtlSectionOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<boolean[]>([]);

  const toggleDescription = (idx: number) =>
    setExpandedDescriptions((prev) => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });

  const hfreshEnabled = useFeature(connectionID, "hfreshIndex");
  const ttlEnabled = useFeature(connectionID, "objectTTL");
  const rqAvailable = useFeature(connectionID, "rotationalQuantization");

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
  } = useForm<FormData>({ defaultValues: defaults() });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "properties",
  });

  const {
    fields: moduleConfigFields,
    append: appendModuleConfig,
    remove: removeModuleConfig,
  } = useFieldArray({
    control,
    name: "moduleConfig",
  });

  const vectorizer = watch("vectorizer");
  const vectorIndexType = watch("vectorIndexType");
  const ttlOn = watch("ttlEnabled");
  const replicationFactor = watch("replicationFactor");

  const { data: modules } = useQuery({
    queryKey: ["modules", connectionID],
    queryFn: () => GetModules(connectionID),
    enabled: open,
  });

  const { data: nodes } = useQuery({
    queryKey: ["nodes", connectionID],
    queryFn: () => NodesStatus(connectionID),
    enabled: open,
    staleTime: 30_000,
  });

  const { data: collectionNames } = useQuery({
    queryKey: ["collection-names", connectionID],
    queryFn: async () => {
      const classes = await GetCollections(connectionID);
      return classes.map((c) => c.class).filter(Boolean) as string[];
    },
    enabled: open && mode === "clone",
  });

  const { data: serverVersion } = useQuery({
    queryKey: ["server-version", connectionID],
    queryFn: async () => {
      const ns = await NodesStatus(connectionID);
      return ns.nodes?.[0]?.version || "";
    },
    enabled: open,
    staleTime: 60_000,
  });

  const vectorizerOptions = buildVectorizerOptions(modules);
  const nodeCount = nodes?.nodes?.length ?? 1;
  const indexTypeOptions = hfreshEnabled
    ? [...BASE_INDEX_TYPES, "hfresh"]
    : BASE_INDEX_TYPES;
  const compressions = compressionOptions(serverVersion || "", rqAvailable);

  const filterableProperties = fields
    .map((_, idx) => ({
      name: watch(`properties.${idx}.name`) || "",
      dataType: watch(`properties.${idx}.dataType`) || "",
      filterable: watch(`properties.${idx}.indexFilterable`) ?? false,
    }))
    .filter((p) => p.name.length > 0 && p.filterable)
    .sort((a, b) => {
      const aIsDate = a.dataType === "date" || a.dataType === "date[]";
      const bIsDate = b.dataType === "date" || b.dataType === "date[]";
      if (aIsDate && !bIsDate) return -1;
      if (!aIsDate && bIsDate) return 1;
      return a.name.localeCompare(b.name);
    });

  const onFormSubmit = async (data: FormData) => {
    if (data.replicationFactor > nodeCount) {
      data.replicationFactor = nodeCount;
    }
    setSubmitError(null);
    try {
      await CreateCollection(connectionID, classFromForm(data));
      onSuccess();
      handleOpenChange(false);
    } catch (error) {
      errorReporting(error);
      setSubmitError(extractWeaviateError(error));
    }
  };

  const onJsonSubmit = async () => {
    setJsonError(null);
    setSubmitError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      setJsonError(`Invalid JSON: ${(e as Error).message}`);
      return;
    }
    if (!parsed || typeof parsed !== "object") {
      setJsonError("JSON must be an object");
      return;
    }
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.class !== "string" || obj.class.length === 0) {
      setJsonError('Missing required string field "class"');
      return;
    }

    setSubmittingJson(true);
    try {
      await CreateCollection(connectionID, new models.w_Class(obj));
      onSuccess();
      handleOpenChange(false);
    } catch (error) {
      errorReporting(error);
      setSubmitError(extractWeaviateError(error));
    } finally {
      setSubmittingJson(false);
    }
  };

  const applyClone = async () => {
    if (!cloneSource) return;
    try {
      const source = await GetCollection(connectionID, cloneSource);
      reset(formFromClass(source));
      setMode("form");
    } catch (error) {
      errorReporting(error);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      reset(defaults());
      setMode("form");
      setVectorOpen(false);
      setReplicationOpen(false);
      setTtlSectionOpen(false);
      setAdvancedOpen(false);
      setJsonText("");
      setJsonError(null);
      setCloneSource("");
      setSubmitError(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] w-[min(96vw,900px)] sm:max-w-[min(96vw,900px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Collection</DialogTitle>
        </DialogHeader>

        <ModeSelector
          value={mode}
          onChange={(m) => {
            setMode(m);
            setSubmitError(null);
          }}
        />

        {submitError && (
          <div className="bg-destructive/10 border-destructive/30 text-destructive rounded-md border px-4 py-3 text-sm">
            {submitError}
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Clone mode                                                          */}
        {/* ------------------------------------------------------------------ */}
        {mode === "clone" && (
          <div className="space-y-3 py-2">
            <Label htmlFor="clone-source">Source collection</Label>
            <div className="flex gap-2">
              <Select value={cloneSource} onValueChange={setCloneSource}>
                <SelectTrigger id="clone-source" className="flex-1">
                  <SelectValue placeholder="Pick a collection to clone..." />
                </SelectTrigger>
                <SelectContent>
                  {(collectionNames || []).map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                onClick={applyClone}
                disabled={!cloneSource}
              >
                Use as template
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Loads the schema into the form. Set a new name before creating.
            </p>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* JSON mode                                                           */}
        {/* ------------------------------------------------------------------ */}
        {mode === "json" && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="paste-json">Class definition (JSON)</Label>
              <textarea
                id="paste-json"
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                rows={20}
                spellCheck={false}
                className="border-input bg-background w-full rounded-md border p-2 font-mono text-xs"
                placeholder={'{\n  "class": "Movies",\n  "vectorizer": "none",\n  "properties": [{"name": "title", "dataType": ["text"]}]\n}'}
              />
              {jsonError && (
                <p className="text-destructive text-sm">{jsonError}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={submittingJson}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={onJsonSubmit}
                disabled={submittingJson || jsonText.trim().length === 0}
              >
                {submittingJson ? "Creating..." : "Create Collection"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Form mode                                                           */}
        {/* ------------------------------------------------------------------ */}
        {mode === "form" && (
          <form
            onSubmit={handleSubmit(onFormSubmit)}
            className="space-y-0 py-2"
          >
            {/* ---- BASICS (always visible) ---- */}
            <div className="space-y-4 pb-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="collection-name">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Controller
                    name="name"
                    control={control}
                    rules={{
                      required: "Name is required",
                      pattern: {
                        value: NAME_REGEX,
                        message:
                          "Must start with an uppercase letter and contain only letters, numbers, and underscores",
                      },
                      validate: (v) =>
                        !existingClassNames.includes(v) ||
                        "A collection with this name already exists",
                    }}
                    render={({ field }) => (
                      <Input
                        {...field}
                        id="collection-name"
                        placeholder="e.g. Movies"
                        className={errors.name ? "border-destructive" : ""}
                      />
                    )}
                  />
                  {errors.name && (
                    <p className="text-destructive text-xs">
                      {errors.name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="collection-description">Description</Label>
                  <Controller
                    name="description"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        id="collection-description"
                        placeholder="Optional description"
                      />
                    )}
                  />
                </div>
              </div>

              {/* ---- Properties table ---- */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Properties</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append(blankProperty())}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add property
                  </Button>
                </div>

                {fields.length === 0 ? (
                  <p className="text-muted-foreground border-border rounded-md border border-dashed py-6 text-center text-sm">
                    No properties yet. Add one above.
                  </p>
                ) : (
                  <>
                    <div className="mb-1 grid grid-cols-[1fr_140px_130px_90px_24px] items-center gap-2 px-2 text-xs font-medium text-muted-foreground">
                      <span>Name <span className="text-destructive">*</span></span>
                      <span>Data Type</span>
                      <span>Tokenization</span>
                      <span className="text-center">F / S / R</span>
                      <span />
                    </div>
                    <div className="space-y-1">
                      {fields.map((field, idx) => {
                        const dt = watch(`properties.${idx}.dataType`);
                        const isText = isTextType(dt);
                        const expanded = expandedDescriptions[idx] ?? false;
                        const nameError = errors.properties?.[idx]?.name;
                        return (
                          <div
                            key={field.id}
                            className="rounded-md border px-2 py-1.5"
                          >
                            <div className="grid grid-cols-[1fr_140px_130px_90px_24px] items-center gap-2">
                              <div>
                                <Controller
                                  name={`properties.${idx}.name`}
                                  control={control}
                                  rules={{
                                    pattern: {
                                      value: PROP_NAME_REGEX,
                                      message: PROP_NAME_DESCRIPTION,
                                    },
                                    validate: (value) => {
                                      if (!value) return true;
                                      if (RESERVED_PROPERTY_NAMES.has(value)) {
                                        return `"${value}" is reserved by Weaviate`;
                                      }
                                      return true;
                                    },
                                  }}
                                  render={({ field: f }) => (
                                    <Input
                                      {...f}
                                      placeholder="e.g. title"
                                      className={cn(
                                        "h-8 text-sm",
                                        nameError ? "border-destructive" : ""
                                      )}
                                    />
                                  )}
                                />
                                {nameError && (
                                  <p className="text-destructive mt-0.5 text-xs">
                                    {nameError.message}
                                  </p>
                                )}
                              </div>
                              <Controller
                                name={`properties.${idx}.dataType`}
                                control={control}
                                render={({ field: f }) => (
                                  <Select
                                    value={f.value}
                                    onValueChange={f.onChange}
                                  >
                                    <SelectTrigger className="h-8 text-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {PRIMITIVE_DATA_TYPES.map((d) => (
                                        <SelectItem
                                          key={d}
                                          value={d}
                                          className="text-sm"
                                        >
                                          {d}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                              <Controller
                                name={`properties.${idx}.tokenization`}
                                control={control}
                                render={({ field: f }) => (
                                  <Select
                                    value={f.value}
                                    onValueChange={f.onChange}
                                    disabled={!isText}
                                  >
                                    <SelectTrigger
                                      className={cn(
                                        "h-8 text-sm",
                                        !isText && "opacity-30"
                                      )}
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {TEXT_TOKENIZATIONS.map((t) => (
                                        <SelectItem
                                          key={t}
                                          value={t}
                                          className="text-sm"
                                        >
                                          {t}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                              <div className="flex items-center justify-center gap-2">
                                <Controller
                                  name={`properties.${idx}.indexFilterable`}
                                  control={control}
                                  render={({ field: f }) => (
                                    <Checkbox
                                      checked={f.value}
                                      onCheckedChange={(c) =>
                                        f.onChange(c === true)
                                      }
                                      title="Filterable"
                                    />
                                  )}
                                />
                                <Controller
                                  name={`properties.${idx}.indexSearchable`}
                                  control={control}
                                  render={({ field: f }) => (
                                    <Checkbox
                                      checked={f.value}
                                      onCheckedChange={(c) =>
                                        f.onChange(c === true)
                                      }
                                      disabled={!isText}
                                      title="Searchable (text only)"
                                      className={!isText ? "opacity-30" : ""}
                                    />
                                  )}
                                />
                                <Controller
                                  name={`properties.${idx}.indexRangeFilters`}
                                  control={control}
                                  render={({ field: f }) => (
                                    <Checkbox
                                      checked={f.value}
                                      onCheckedChange={(c) =>
                                        f.onChange(c === true)
                                      }
                                      title="Range filters"
                                    />
                                  )}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => remove(idx)}
                                disabled={fields.length === 1}
                                className="flex items-center justify-center text-muted-foreground hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
                                title="Remove row"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="mt-1">
                              <button
                                type="button"
                                onClick={() => toggleDescription(idx)}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                              >
                                {expanded ? (
                                  <ChevronDown className="h-3 w-3" />
                                ) : (
                                  <ChevronRight className="h-3 w-3" />
                                )}
                                Description
                              </button>
                              {expanded && (
                                <Controller
                                  name={`properties.${idx}.description`}
                                  control={control}
                                  render={({ field: f }) => (
                                    <Input
                                      {...f}
                                      placeholder="Optional description"
                                      className="mt-1 h-8 text-sm"
                                    />
                                  )}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                <p className="text-muted-foreground text-xs">
                  F = Filterable &nbsp; S = Searchable (text only) &nbsp; R =
                  Range filters &nbsp;·&nbsp; {PROP_NAME_DESCRIPTION}
                </p>
              </div>
            </div>

            <Separator />

            {/* ---- VECTOR CONFIGURATION ---- */}
            <Collapsible open={vectorOpen} onOpenChange={setVectorOpen}>
              <CollapsibleTrigger className="w-full">
                <SectionHeader
                  title="Vector configuration"
                  open={vectorOpen}
                  badge={vectorizer !== "none" ? vectorizer : undefined}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pb-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="collection-vectorizer">Vectorizer</Label>
                    <Controller
                      name="vectorizer"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={(v) => {
                            field.onChange(v);
                            setValue("moduleConfig", []);
                          }}
                        >
                          <SelectTrigger
                            id="collection-vectorizer"
                            className="w-full"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {vectorizerOptions.map((v) => (
                              <SelectItem key={v} value={v}>
                                {v}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vector-index-type">Index type</Label>
                    <Controller
                      name="vectorIndexType"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger
                            id="vector-index-type"
                            className="w-full"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {indexTypeOptions.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>

                {/* Compression — per-index-type */}
                {vectorIndexType === "hnsw" && (
                  <div className="space-y-2">
                    <Label htmlFor="compression">Vector compression</Label>
                    <Controller
                      name="compression"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger id="compression" className="w-full">
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

                {vectorIndexType === "flat" && (
                  <div className="space-y-2">
                    <Label htmlFor="compression-flat">Vector compression</Label>
                    <Controller
                      name="compression"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger
                            id="compression-flat"
                            className="w-full"
                          >
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

                {vectorIndexType === "dynamic" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="compression-dyn-flat">
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
                            <SelectTrigger
                              id="compression-dyn-flat"
                              className="w-full"
                            >
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
                      <p className="text-muted-foreground text-xs">
                        Applied while the index runs in flat mode.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="compression-dyn-hnsw">
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
                            <SelectTrigger
                              id="compression-dyn-hnsw"
                              className="w-full"
                            >
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
                      <p className="text-muted-foreground text-xs">
                        Applied after the index transitions to HNSW.
                      </p>
                    </div>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* ---- REPLICATION & MULTI-TENANCY ---- */}
            <Collapsible
              open={replicationOpen}
              onOpenChange={setReplicationOpen}
            >
              <CollapsibleTrigger className="w-full">
                <SectionHeader
                  title="Replication & multi-tenancy"
                  open={replicationOpen}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pb-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="replication-factor">
                      Replication factor
                    </Label>
                    <Controller
                      name="replicationFactor"
                      control={control}
                      rules={{
                        min: { value: 1, message: "Min 1" },
                        max: {
                          value: nodeCount,
                          message: `Max ${nodeCount} (cluster has ${nodeCount} node${nodeCount === 1 ? "" : "s"})`,
                        },
                      }}
                      render={({ field }) => (
                        <Input
                          {...field}
                          id="replication-factor"
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
                      <p className="text-destructive text-xs">
                        {errors.replicationFactor.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deletion-strategy">
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
                          <SelectTrigger
                            id="deletion-strategy"
                            className="w-full"
                          >
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

                <div className="flex flex-wrap gap-6">
                  <Controller
                    name="asyncEnabled"
                    control={control}
                    render={({ field }) => (
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(c) => field.onChange(c === true)}
                        />
                        Async replication
                      </label>
                    )}
                  />
                  <Controller
                    name="multiTenancyEnabled"
                    control={control}
                    render={({ field }) => (
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(c) => field.onChange(c === true)}
                        />
                        Enable multi-tenancy
                      </label>
                    )}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* ---- OBJECT TTL (feature-gated) ---- */}
            {ttlEnabled && (
              <>
                <Collapsible
                  open={ttlSectionOpen}
                  onOpenChange={setTtlSectionOpen}
                >
                  <CollapsibleTrigger className="w-full">
                    <SectionHeader
                      title="Object TTL"
                      open={ttlSectionOpen}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 pb-4 pt-2">
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
                      <div className="space-y-4 pl-6">
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
                                  className="w-24"
                                  onChange={(e) =>
                                    field.onChange(
                                      parseInt(e.target.value, 10)
                                    )
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
                                    <SelectItem value="minutes">
                                      minutes
                                    </SelectItem>
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
                                <SelectTrigger className="w-full">
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
                          <p className="text-muted-foreground text-xs">
                            Lists filterable properties from above. Weaviate
                            only honours <code>date</code> properties for TTL,
                            but the server will reject non-date values with a
                            clear error.
                          </p>
                        </div>

                        <Controller
                          name="ttlFilterExpired"
                          control={control}
                          render={({ field }) => (
                            <label className="flex cursor-pointer items-center gap-2 text-sm">
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={(c) =>
                                  field.onChange(c === true)
                                }
                              />
                              Exclude expired objects from query results
                            </label>
                          )}
                        />
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
                <Separator />
              </>
            )}

            {/* ---- ADVANCED (module config) ---- */}
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger className="w-full">
                <SectionHeader
                  title="Advanced"
                  open={advancedOpen}
                  badge={
                    moduleConfigFields.length > 0
                      ? `${moduleConfigFields.length} module config entr${moduleConfigFields.length === 1 ? "y" : "ies"}`
                      : undefined
                  }
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pb-4 pt-2">
                {vectorizer !== "none" ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Module configuration</p>
                      <p className="text-muted-foreground text-xs">
                        Key/value pairs sent under{" "}
                        <code className="text-xs">
                          moduleConfig.{vectorizer}
                        </code>
                        . Common keys:{" "}
                        <code className="text-xs">model</code>,{" "}
                        <code className="text-xs">dimensions</code>,{" "}
                        <code className="text-xs">baseURL</code>,{" "}
                        <code className="text-xs">vectorizeClassName</code>.
                      </p>
                    </div>

                    {moduleConfigFields.length > 0 && (
                      <div className="border-border rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead>Key</TableHead>
                              <TableHead>Value</TableHead>
                              <TableHead className="w-10" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {moduleConfigFields.map((mcField, idx) => (
                              <TableRow key={mcField.id}>
                                <TableCell className="py-1.5">
                                  <Controller
                                    name={`moduleConfig.${idx}.key`}
                                    control={control}
                                    render={({ field }) => (
                                      <Input
                                        {...field}
                                        placeholder="key"
                                        className="h-8 text-sm"
                                      />
                                    )}
                                  />
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <Controller
                                    name={`moduleConfig.${idx}.value`}
                                    control={control}
                                    render={({ field }) => (
                                      <Input
                                        {...field}
                                        placeholder="value"
                                        className="h-8 text-sm"
                                      />
                                    )}
                                  />
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => removeModuleConfig(idx)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {moduleConfigFields.length === 0 && (
                      <p className="text-muted-foreground text-xs italic">
                        No overrides — module defaults will be used.
                      </p>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        appendModuleConfig({ key: "", value: "" })
                      }
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add config entry
                    </Button>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Module configuration is only available when a vectorizer
                    other than <code>none</code> is selected.
                  </p>
                )}
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || replicationFactor > nodeCount}
              >
                {isSubmitting ? "Creating..." : "Create Collection"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// ModeSelector
// ---------------------------------------------------------------------------

interface ModeSelectorProps {
  value: Mode;
  onChange: (m: Mode) => void;
}

function ModeSelector({ value, onChange }: ModeSelectorProps) {
  const items: { value: Mode; label: string; icon: React.ElementType }[] = [
    { value: "form", label: "Form", icon: FormInput },
    { value: "clone", label: "Clone existing", icon: Copy },
    { value: "json", label: "Paste JSON", icon: FileJson },
  ];

  return (
    <div className="bg-muted text-muted-foreground inline-flex w-fit items-center rounded-md p-1 text-sm">
      {items.map((item) => {
        const Icon = item.icon;
        const active = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-sm px-3 py-1 transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vectorizer options builder
// ---------------------------------------------------------------------------

const VECTORIZER_PREFIXES = [
  "text2vec-",
  "multi2vec-",
  "img2vec-",
  "ref2vec-",
];

function buildVectorizerOptions(modules: unknown): string[] {
  const out = new Set<string>(["none"]);
  if (modules && typeof modules === "object") {
    for (const name of Object.keys(modules as Record<string, unknown>)) {
      if (VECTORIZER_PREFIXES.some((p) => name.startsWith(p))) {
        out.add(name);
      }
    }
  }
  return Array.from(out);
}
