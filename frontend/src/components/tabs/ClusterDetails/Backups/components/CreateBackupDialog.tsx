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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MultiSelect } from "@/components/ui/multi-select";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { errorReporting } from "@/lib/utils";
import { CreateBackup, GetCollections } from "wailsjs/go/weaviate/Weaviate";
import { useConnectionStore } from "@/store/connection-store";
import { useFeature } from "@/hooks/use-features";
import MarkdownCode from "@/components/ui/md_code";
import { collectionsQueryKey } from "../constants";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionID: number;
  backends: string[];
  onSuccess: () => void;
  backupIds: string[];
  baseBackupCandidates: string[];
}

// Enum taken from Weaviate
const COMPRESSION_LEVELS = [
  { label: "Default Compression", value: "DefaultCompression" },
  { label: "Best Speed", value: "BestSpeed" },
  { label: "Best Compression", value: "BestCompression" },
  { label: "Zstd Default Compression", value: "ZstdDefaultCompression" },
  { label: "Zstd Best Speed", value: "ZstdBestSpeed" },
  { label: "Zstd Best Compression", value: "ZstdBestCompression" },
  { label: "No Compression", value: "NoCompression" },
];

interface FormData {
  backupId: string;
  backend: string;
  includeClasses: string[];
  excludeClasses: string[];
  compressionLevel: string;
  cpuPercentage: number;
  incremental: boolean;
  incrementalBaseBackupID: string;
}

export function CreateBackupDialog({
  open,
  backends,
  onOpenChange,
  connectionID,
  onSuccess,
  backupIds,
  baseBackupCandidates,
}: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const patchConnection = useConnectionStore((state) => state.patch);
  const incrementalBackupSupported = useFeature(
    connectionID,
    "incrementalBackup"
  );

  // Fetch collections only when advanced options is opened
  const { data: collectionData, isLoading: isLoadingCollections } = useQuery({
    queryKey: collectionsQueryKey(connectionID),
    queryFn: async () => {
      const classes = await GetCollections(connectionID);
      return classes
        .filter((c) => c.class)
        .map((c) => ({
          label: c.class!,
          value: c.class!,
        }));
    },
    enabled: advancedOpen,
  });

  const collections = collectionData || [];

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
  } = useForm<FormData>({
    defaultValues: {
      backupId: "",
      backend: backends[0] || "",
      includeClasses: [],
      excludeClasses: [],
      compressionLevel: "DefaultCompression",
      cpuPercentage: 50,
      incremental: false,
      incrementalBaseBackupID: "",
    },
  });

  const includeClasses = watch("includeClasses");
  const excludeClasses = watch("excludeClasses");
  const incremental = watch("incremental");

  const generateBackupId = () => {
    const now = new Date();
    const date = now.toISOString().split("T")[0];
    const timestamp = Math.floor(now.getTime() / 1000);
    const id = `weaviate-desktop-${date}-${timestamp}`;
    setValue("backupId", id, { shouldValidate: true });
  };

  const onSubmit = async (data: FormData) => {
    try {
      await CreateBackup(connectionID, {
        backend: data.backend,
        id: data.backupId,
        include:
          data.includeClasses.length > 0 ? data.includeClasses : undefined,
        exclude:
          data.excludeClasses.length > 0 ? data.excludeClasses : undefined,
        compressionLevel: data.compressionLevel || undefined,
        cpuPercentage: data.cpuPercentage,
        incrementalBaseBackupID:
          data.incremental && data.incrementalBaseBackupID
            ? data.incrementalBaseBackupID
            : undefined,
      });

      // Success - close dialog and refresh
      onSuccess();
      onOpenChange(false);
      patchConnection(connectionID, { backupInProgress: true });
      reset();
      setAdvancedOpen(false);
    } catch (error) {
      errorReporting(error);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      reset();
      setAdvancedOpen(false);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Backup</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="backup-id">
              Backup ID <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <Controller
                name="backupId"
                control={control}
                rules={{
                  required: "Backup ID is required",
                  pattern: {
                    value: /^[a-z0-9_-]+$/,
                    message:
                      "Only lowercase letters, numbers, underscore, and minus characters are allowed",
                  },
                  validate: (value) => {
                    if (backupIds.includes(value)) {
                      return "A backup with this ID already exists";
                    }
                    return true;
                  },
                }}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="backup-id"
                    placeholder="Enter backup ID"
                    className={errors.backupId ? "border-destructive" : ""}
                  />
                )}
              />
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={generateBackupId}
                className="shrink-0"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            {errors.backupId && (
              <p className="text-destructive text-sm">
                {errors.backupId.message}
              </p>
            )}
            <p className="text-muted-foreground text-xs">
              Only lowercase letters, numbers, underscore (_), and minus (-) are
              allowed
            </p>
          </div>
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-between p-0 hover:bg-transparent"
              >
                <span className="text-sm font-medium">Advanced Options</span>
                {advancedOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              {errors.root?.classes && (
                <div className="bg-destructive/10 rounded-md p-3">
                  <p className="text-destructive text-sm">
                    {errors.root.classes.message}
                  </p>
                </div>
              )}
              {incrementalBackupSupported && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <Controller
                      name="incremental"
                      control={control}
                      render={({ field }) => (
                        <Checkbox
                          id="incremental"
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            const next = checked === true;
                            field.onChange(next);
                            if (!next) {
                              setValue("incrementalBaseBackupID", "");
                            }
                          }}
                          disabled={baseBackupCandidates.length === 0}
                          className="mt-0.5"
                        />
                      )}
                    />
                    <div className="space-y-1">
                      <Label htmlFor="incremental" className="cursor-pointer">
                        Incremental backup
                      </Label>
                      <p className="text-muted-foreground text-xs">
                        Only files changed since the base backup will be
                        included.
                        {baseBackupCandidates.length === 0 &&
                          " Requires at least one successful backup as a base."}
                      </p>
                    </div>
                  </div>
                  {incremental && (
                    <div className="space-y-2 pl-6">
                      <Label htmlFor="base-backup">
                        Base backup{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Controller
                        name="incrementalBaseBackupID"
                        control={control}
                        rules={{
                          validate: (value) =>
                            !incremental ||
                            value.length > 0 ||
                            "Base backup is required for incremental backups",
                        }}
                        render={({ field }) => (
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger id="base-backup">
                              <SelectValue placeholder="Select a base backup..." />
                            </SelectTrigger>
                            <SelectContent>
                              {baseBackupCandidates.map((id) => (
                                <SelectItem key={id} value={id}>
                                  {id}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {errors.incrementalBaseBackupID && (
                        <p className="text-destructive text-sm">
                          {errors.incrementalBaseBackupID.message}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {backends.length > 1 && (
                <div className="space-y-2">
                  <Label htmlFor="backend">Backend</Label>
                  <Controller
                    name="backend"
                    control={control}
                    rules={{ required: "Backend is required" }}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger id="backend">
                          <SelectValue placeholder="Select backend..." />
                        </SelectTrigger>
                        <SelectContent>
                          {backends.map((backend) => (
                            <SelectItem key={backend} value={backend}>
                              {backend}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.backend && (
                    <p className="text-destructive text-sm">
                      {errors.backend.message}
                    </p>
                  )}
                  <p className="text-muted-foreground text-xs">
                    Select the backup backend to use
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="include-collections">Include Collections</Label>
                <Controller
                  name="includeClasses"
                  control={control}
                  render={({ field }) => (
                    <MultiSelect
                      options={collections}
                      selected={field.value}
                      onChange={field.onChange}
                      placeholder={
                        isLoadingCollections
                          ? "Loading collections..."
                          : "Select collections to include..."
                      }
                      emptyText="No collections found"
                      disabled={
                        excludeClasses.length > 0 || isLoadingCollections
                      }
                    />
                  )}
                />
                <p className="text-muted-foreground text-xs">
                  List of collections to include in the backup creation process.
                  If not set, all collections are included. Cannot be used
                  together with <MarkdownCode text="exclude" />.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="exclude-collections">Exclude Collections</Label>
                <Controller
                  name="excludeClasses"
                  control={control}
                  render={({ field }) => (
                    <MultiSelect
                      options={collections}
                      selected={field.value}
                      onChange={field.onChange}
                      placeholder={
                        isLoadingCollections
                          ? "Loading collections..."
                          : "Select collections to exclude..."
                      }
                      emptyText="No collections found"
                      disabled={
                        includeClasses.length > 0 || isLoadingCollections
                      }
                    />
                  )}
                />
                <p className="text-muted-foreground text-xs">
                  List of collections to exclude from the backup creation
                  process. If not set, all collections are included. Cannot be
                  used together with <MarkdownCode text="include" />.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="compression-level">Compression Level</Label>
                <Controller
                  name="compressionLevel"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="compression-level">
                        <SelectValue placeholder="Select compression level..." />
                      </SelectTrigger>
                      <SelectContent>
                        {COMPRESSION_LEVELS.map((level) => (
                          <SelectItem key={level.value} value={level.value}>
                            {level.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <p className="text-muted-foreground text-xs">
                  Compression level used by compression algorithm
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpu-percentage">CPU Percentage</Label>
                <Controller
                  name="cpuPercentage"
                  control={control}
                  rules={{
                    min: {
                      value: 1,
                      message: "CPU percentage must be at least 1",
                    },
                    max: {
                      value: 80,
                      message: "CPU percentage must be at most 80",
                    },
                  }}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="cpu-percentage"
                      type="number"
                      min="1"
                      max="80"
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value, 10))
                      }
                      className={
                        errors.cpuPercentage ? "border-destructive" : ""
                      }
                    />
                  )}
                />
                {errors.cpuPercentage && (
                  <p className="text-destructive text-sm">
                    {errors.cpuPercentage.message}
                  </p>
                )}
                <p className="text-muted-foreground text-xs">
                  Desired CPU core utilization (1-80, default: 50)
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

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
              {isSubmitting ? "Creating..." : "Create Backup"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
