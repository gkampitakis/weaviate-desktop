/* eslint-disable react-hooks/incompatible-library */
import { useState } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn, errorReporting, extractWeaviateError } from "@/lib/utils";
import { AddProperty } from "wailsjs/go/weaviate/Weaviate";
import { models } from "wailsjs/go/models";

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
  "geoCoordinates",
  "phoneNumber",
  "object",
  "object[]",
];

const TEXT_TOKENIZATIONS = ["word", "lowercase", "whitespace", "field"];

const PROP_NAME_REGEX = /^[a-z][_0-9a-z]*$/;

const PROP_NAME_DESCRIPTION =
  "Must start with a lowercase letter and contain only lowercase letters, digits, and underscores.";

const RESERVED_PROPERTY_NAMES = new Set(["id", "_additional"]);

const isTextType = (dt: string) => dt === "text" || dt === "text[]";

type RowStatus = "pending" | "success" | "error";

interface PendingRow {
  name: string;
  dataType: string;
  description: string;
  indexFilterable: boolean;
  indexSearchable: boolean;
  indexRangeFilters: boolean;
  tokenization: string;
}

interface FormData {
  pending: PendingRow[];
}

const blankRow = (): PendingRow => ({
  name: "",
  dataType: "text",
  description: "",
  indexFilterable: true,
  indexSearchable: true,
  indexRangeFilters: false,
  tokenization: "word",
});

interface Props {
  connectionID: number;
  collectionName: string;
  properties: models.w_Property[];
  onSuccess: () => void;
}

export const PropertiesSection = ({
  connectionID,
  collectionName,
  properties,
  onSuccess,
}: Props) => {
  const existingNames = properties
    .map((p) => p.name || "")
    .filter(Boolean) as string[];

  const [rowStatuses, setRowStatuses] = useState<RowStatus[]>([]);
  const [rowErrors, setRowErrors] = useState<(string | null)[]>([]);
  const [expandedExisting, setExpandedExisting] = useState<boolean[]>([]);
  const [expandedPending, setExpandedPending] = useState<boolean[]>([]);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<FormData>({ defaultValues: { pending: [] } });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "pending",
  });

  const watchPending = watch("pending");

  const toggleExisting = (i: number) =>
    setExpandedExisting((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });

  const togglePending = (i: number) =>
    setExpandedPending((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });

  const addRow = () => {
    append(blankRow());
    setRowStatuses((prev) => [...prev, "pending"]);
    setRowErrors((prev) => [...prev, null]);
    setExpandedPending((prev) => [...prev, false]);
  };

  const removeRow = (idx: number) => {
    remove(idx);
    setRowStatuses((prev) => prev.filter((_, i) => i !== idx));
    setRowErrors((prev) => prev.filter((_, i) => i !== idx));
    setExpandedPending((prev) => prev.filter((_, i) => i !== idx));
  };

  const cancelAll = () => {
    reset({ pending: [] });
    setRowStatuses([]);
    setRowErrors([]);
    setExpandedPending([]);
    setProgress(null);
  };

  const onSubmit = async (data: FormData) => {
    const total = data.pending.length;
    const newStatuses: RowStatus[] = data.pending.map((_, i) =>
      rowStatuses[i] === "success" ? "success" : "pending"
    );
    const newErrors: (string | null)[] = data.pending.map(() => null);
    setRowErrors(newErrors);
    setProgress({ current: 0, total });

    let succeeded = 0;
    for (let i = 0; i < data.pending.length; i++) {
      if (newStatuses[i] === "success") {
        succeeded++;
        setProgress({ current: succeeded, total });
        continue;
      }
      const row = data.pending[i];
      const property = new models.w_Property({
        name: row.name,
        dataType: [row.dataType],
        description: row.description || undefined,
        indexFilterable: row.indexFilterable,
        indexSearchable: row.indexSearchable,
        indexRangeFilters: row.indexRangeFilters,
        tokenization: isTextType(row.dataType) ? row.tokenization : undefined,
      });

      try {
        await AddProperty(connectionID, collectionName, property);
        newStatuses[i] = "success";
        succeeded++;
        setRowStatuses([...newStatuses]);
        setProgress({ current: succeeded, total });
      } catch (error) {
        newStatuses[i] = "error";
        const msg = extractWeaviateError(error);
        newErrors[i] = msg;
        setRowStatuses([...newStatuses]);
        setRowErrors([...newErrors]);
        setProgress(null);
        toast.error(`Failed to add "${row.name}": ${msg}`);
        errorReporting(error);
        return;
      }
    }
    setProgress(null);
    cancelAll();
    onSuccess();
  };

  const pendingCount = fields.filter(
    (_, i) => rowStatuses[i] !== "success"
  ).length;

  const hasExisting = properties.length > 0;
  const hasPending = fields.length > 0;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
      <div className="mb-1 grid grid-cols-[1fr_140px_130px_90px_24px] items-center gap-2 px-2 text-xs font-medium text-muted-foreground">
        <span>Name</span>
        <span>Data Type</span>
        <span>Tokenization</span>
        <span className="text-center">F / S / R</span>
        <span />
      </div>

      {!hasExisting && !hasPending && (
        <p className="text-muted-foreground border-border rounded-md border border-dashed py-6 text-center text-sm">
          No properties defined.
        </p>
      )}

      {/* Existing properties — read-only rows */}
      {properties.map((p, i) => {
        const dt = p.dataType?.[0] || "text";
        const isText = isTextType(dt);
        const expanded = expandedExisting[i] ?? false;
        return (
          <div
            key={p.name || i}
            className="rounded-md border bg-muted/20 px-2 py-1.5"
          >
            <div className="grid grid-cols-[1fr_140px_130px_90px_24px] items-center gap-2">
              <Input
                value={p.name || ""}
                disabled
                className="h-8 text-sm font-mono"
              />
              <Input
                value={dt}
                disabled
                className="h-8 text-sm font-mono"
              />
              <Input
                value={isText ? p.tokenization || "word" : "—"}
                disabled
                className={cn(
                  "h-8 text-sm",
                  !isText && "text-muted-foreground"
                )}
              />
              <div className="flex items-center justify-center gap-2">
                <Checkbox
                  checked={p.indexFilterable !== false}
                  disabled
                  title="Filterable"
                />
                <Checkbox
                  checked={p.indexSearchable !== false}
                  disabled
                  title="Searchable"
                />
                <Checkbox
                  checked={p.indexRangeFilters === true}
                  disabled
                  title="Range filters"
                />
              </div>
              <span />
            </div>
            <div className="mt-1">
              <button
                type="button"
                onClick={() => toggleExisting(i)}
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
                <Input
                  value={p.description || ""}
                  disabled
                  placeholder="No description"
                  className="mt-1 h-8 text-sm"
                />
              )}
            </div>
          </div>
        );
      })}

      {/* Pending (new) properties — editable rows */}
      {fields.map((field, idx) => {
        const dt = watchPending?.[idx]?.dataType ?? "text";
        const isText = isTextType(dt);
        const isSuccess = rowStatuses[idx] === "success";
        const isError = rowStatuses[idx] === "error";
        const expanded = expandedPending[idx] ?? false;
        const nameError = errors.pending?.[idx]?.name;
        const rowErrorMsg = rowErrors[idx];

        return (
          <div
            key={field.id}
            className={cn(
              "rounded-md border px-2 py-1.5",
              isSuccess
                ? "border-green-500/40 bg-green-500/5 opacity-60"
                : isError
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-border"
            )}
          >
            <div className="grid grid-cols-[1fr_140px_130px_90px_24px] items-center gap-2">
              <div>
                <Controller
                  name={`pending.${idx}.name`}
                  control={control}
                  rules={{
                    required: "Required",
                    pattern: {
                      value: PROP_NAME_REGEX,
                      message: PROP_NAME_DESCRIPTION,
                    },
                    validate: (value) => {
                      if (RESERVED_PROPERTY_NAMES.has(value)) {
                        return `"${value}" is reserved by Weaviate`;
                      }
                      if (existingNames.includes(value)) {
                        return "Already exists";
                      }
                      const others =
                        watchPending
                          ?.map((p) => p.name)
                          .filter((_, i) => i !== idx) ?? [];
                      if (others.includes(value)) {
                        return "Duplicate name";
                      }
                      return true;
                    },
                  }}
                  render={({ field: f }) => (
                    <Input
                      {...f}
                      placeholder="e.g. title"
                      disabled={isSuccess || isSubmitting}
                      className={cn(
                        "h-8 text-sm",
                        nameError ? "border-destructive" : ""
                      )}
                    />
                  )}
                />
                {nameError && (
                  <p className="mt-0.5 text-xs text-destructive">
                    {nameError.message}
                  </p>
                )}
              </div>
              <Controller
                name={`pending.${idx}.dataType`}
                control={control}
                render={({ field: f }) => (
                  <Select
                    value={f.value}
                    onValueChange={f.onChange}
                    disabled={isSuccess || isSubmitting}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIMITIVE_DATA_TYPES.map((d) => (
                        <SelectItem key={d} value={d} className="text-sm">
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <Controller
                name={`pending.${idx}.tokenization`}
                control={control}
                render={({ field: f }) => (
                  <Select
                    value={f.value}
                    onValueChange={f.onChange}
                    disabled={!isText || isSuccess || isSubmitting}
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
                        <SelectItem key={t} value={t} className="text-sm">
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <div className="flex items-center justify-center gap-2">
                <Controller
                  name={`pending.${idx}.indexFilterable`}
                  control={control}
                  render={({ field: f }) => (
                    <Checkbox
                      checked={f.value}
                      onCheckedChange={(c) => f.onChange(c === true)}
                      disabled={isSuccess || isSubmitting}
                      title="Filterable"
                    />
                  )}
                />
                <Controller
                  name={`pending.${idx}.indexSearchable`}
                  control={control}
                  render={({ field: f }) => (
                    <Checkbox
                      checked={f.value}
                      onCheckedChange={(c) => f.onChange(c === true)}
                      disabled={!isText || isSuccess || isSubmitting}
                      title="Searchable (text only)"
                      className={!isText ? "opacity-30" : ""}
                    />
                  )}
                />
                <Controller
                  name={`pending.${idx}.indexRangeFilters`}
                  control={control}
                  render={({ field: f }) => (
                    <Checkbox
                      checked={f.value}
                      onCheckedChange={(c) => f.onChange(c === true)}
                      disabled={isSuccess || isSubmitting}
                      title="Range filters"
                    />
                  )}
                />
              </div>
              {isSuccess ? (
                <span
                  className="flex items-center justify-center text-xs text-green-600"
                  title="Added successfully"
                >
                  ✓
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  disabled={isSubmitting}
                  className="flex items-center justify-center text-muted-foreground hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
                  title="Remove row"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-1">
              <button
                type="button"
                onClick={() => togglePending(idx)}
                disabled={isSuccess || isSubmitting}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:pointer-events-none"
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
                  name={`pending.${idx}.description`}
                  control={control}
                  render={({ field: f }) => (
                    <Input
                      {...f}
                      placeholder="Optional description"
                      disabled={isSuccess || isSubmitting}
                      className="mt-1 h-8 text-sm"
                    />
                  )}
                />
              )}
            </div>
            {rowErrorMsg && (
              <p className="mt-1 text-xs text-destructive">{rowErrorMsg}</p>
            )}
          </div>
        );
      })}

      <div className="flex items-center justify-between pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={addRow}
          disabled={isSubmitting}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add property
        </Button>
        {hasPending && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={cancelAll}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting && progress
                ? `Adding ${progress.current + 1}/${progress.total}...`
                : `Save ${pendingCount > 1 ? `${pendingCount} properties` : "property"}`}
            </Button>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        F = Filterable &nbsp; S = Searchable (text only) &nbsp; R = Range
        filters &nbsp;·&nbsp; {PROP_NAME_DESCRIPTION}
      </p>
    </form>
  );
};
