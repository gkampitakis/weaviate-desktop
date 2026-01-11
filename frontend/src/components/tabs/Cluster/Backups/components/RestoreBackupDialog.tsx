/* eslint-disable react-hooks/incompatible-library */
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Trash2,
} from "lucide-react";
import { errorReporting, intersection } from "@/lib/utils";
import { GetCollections, RestoreBackup } from "wailsjs/go/weaviate/Weaviate";
import { toast } from "sonner";
import { useConnectionStore } from "@/store/connection-store";
import { useQuery } from "@tanstack/react-query";
import { useShallow } from "zustand/shallow";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionID: number;
  backend: string;
  backupID: string;
  backupClasses: string[];
}

interface FormData {
  includeClasses: string[];
  excludeClasses: string[];
  includeRBACAndUsers: boolean;
  overwriteAlias: boolean;
  cpuPercentage: number;
  deleteExistingClasses: boolean;
}

export function RestoreBackupDialog({
  open,
  onOpenChange,
  connectionID,
  backend,
  backupID,
  backupClasses,
}: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedClassesToDelete, setSelectedClassesToDelete] = useState<
    string[]
  >([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletionProgress, setDeletionProgress] = useState({
    current: 0,
    total: 0,
  });
  const { patchConnection, deleteCollection } = useConnectionStore(
    useShallow((state) => ({
      patchConnection: state.patch,
      deleteCollection: state.deleteCollection,
    }))
  );

  // Convert classes array to options for multi-select
  const classOptions = backupClasses.map((c) => ({
    label: c,
    value: c,
  }));

  const { data: collectionData } = useQuery({
    queryKey: ["collections", connectionID],
    queryFn: async () => {
      const classes = await GetCollections(connectionID);
      return classes.filter((c) => c.class);
    },
  });

  const collections = collectionData || [];

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<FormData>({
    defaultValues: {
      includeClasses: [],
      excludeClasses: [],
      includeRBACAndUsers: false,
      overwriteAlias: false,
      cpuPercentage: 50,
      deleteExistingClasses: false,
    },
  });

  const includeClasses = watch("includeClasses");
  const excludeClasses = watch("excludeClasses");

  const onSubmit = async (data: FormData) => {
    try {
      if (selectedClassesToDelete.length > 0) {
        setIsDeleting(true);
        setDeletionProgress({
          current: 0,
          total: selectedClassesToDelete.length,
        });

        for (let i = 0; i < selectedClassesToDelete.length; i++) {
          const className = selectedClassesToDelete[i];
          try {
            await deleteCollection(connectionID, className);
            setDeletionProgress({
              current: i + 1,
              total: selectedClassesToDelete.length,
            });
          } catch (error) {
            errorReporting(
              `Failed to delete collection "${className}": ${error}`
            );
            setIsDeleting(false);
            return;
          }
        }

        setIsDeleting(false);
      }

      await RestoreBackup(connectionID, {
        backend,
        id: backupID,
        include:
          data.includeClasses.length > 0 ? data.includeClasses : undefined,
        exclude:
          data.excludeClasses.length > 0 ? data.excludeClasses : undefined,
        includeRBACAndUsers: data.includeRBACAndUsers || undefined,
        overwriteAlias: data.overwriteAlias || undefined,
        cpuPercentage: data.cpuPercentage,
      });

      toast.success(`Backup "${backupID}" restore initiated successfully`);

      patchConnection(connectionID, {
        backupRestore: {
          id: backupID,
          backend: backend,
          include: data.includeClasses,
          exclude: data.excludeClasses,
          includeRBACAndUsers: data.includeRBACAndUsers,
          overwriteAlias: data.overwriteAlias,
        },
      });
      onOpenChange(false);
      reset();
      setAdvancedOpen(false);
      setSelectedClassesToDelete([]);
      setDeletionProgress({ current: 0, total: 0 });
    } catch (error) {
      errorReporting(error);
      setIsDeleting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isSubmitting && !isDeleting) {
      reset();
      setAdvancedOpen(false);
      setSelectedClassesToDelete([]);
      setDeletionProgress({ current: 0, total: 0 });
    }
    if (!isSubmitting && !isDeleting) {
      onOpenChange(newOpen);
    }
  };

  const getOverlappingClasses = () => {
    if (!collections || collections.length === 0) {
      return [];
    }

    let comparator = backupClasses;

    if (includeClasses.length > 0) {
      comparator = includeClasses;
    }

    if (excludeClasses.length > 0) {
      comparator = backupClasses.filter((c) => !excludeClasses.includes(c));
    }

    return [
      ...intersection(
        new Set(comparator),
        new Set(collections.map((c) => c.class!))
      ),
    ];
  };

  const overlappingClasses = getOverlappingClasses();

  const toggleClassSelection = (className: string) => {
    setSelectedClassesToDelete((prev) =>
      prev.includes(className)
        ? prev.filter((c) => c !== className)
        : [...prev, className]
    );
  };

  const toggleSelectAll = () => {
    if (selectedClassesToDelete.length === overlappingClasses.length) {
      setSelectedClassesToDelete([]);
    } else {
      setSelectedClassesToDelete(overlappingClasses);
    }
  };

  const disableSubmitting = () => {
    return (
      isSubmitting ||
      isDeleting ||
      excludeClasses.length === backupClasses.length ||
      (overlappingClasses.length > 0 &&
        selectedClassesToDelete.length !== overlappingClasses.length)
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Restore Backup: {backupID}</DialogTitle>
        </DialogHeader>
        {isDeleting && (
          <div className="bg-background/80 absolute inset-0 z-50 flex items-center justify-center rounded-lg backdrop-blur-sm">
            <div className="bg-card flex flex-col items-center gap-4 rounded-lg border p-6 shadow-lg">
              <Loader2 className="text-primary h-8 w-8 animate-spin" />
              <div className="text-center">
                <p className="text-sm font-medium">Deleting collections...</p>
                <p className="text-muted-foreground text-xs">
                  {deletionProgress.current} of {deletionProgress.total} deleted
                </p>
              </div>
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          {overlappingClasses.length > 0 && (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    Existing Collections Detected
                  </h4>
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                    The following collections already exist and need to be
                    deleted before restoring:
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-amber-900 dark:text-amber-100">
                    Select collections to delete
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={toggleSelectAll}
                    className="h-auto p-1 text-xs text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
                  >
                    {selectedClassesToDelete.length ===
                    overlappingClasses.length
                      ? "Deselect all"
                      : "Select all"}
                  </Button>
                </div>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded border border-amber-200 bg-white p-2 dark:border-amber-800 dark:bg-amber-950/50">
                  {overlappingClasses.map((className) => (
                    <div
                      key={className}
                      className="flex items-center space-x-2 rounded px-2 py-1.5 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                    >
                      <input
                        type="checkbox"
                        id={`delete-${className}`}
                        checked={selectedClassesToDelete.includes(className)}
                        onChange={() => toggleClassSelection(className)}
                        className="h-4 w-4"
                      />
                      <Label
                        htmlFor={`delete-${className}`}
                        className="flex flex-1 cursor-pointer items-center gap-2 text-sm"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        {className}
                      </Label>
                    </div>
                  ))}
                </div>
                {selectedClassesToDelete.length > 0 && (
                  <div className="flex items-start gap-2 rounded-md bg-red-50 p-2 dark:bg-red-950/30">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400" />
                    <p className="text-xs text-red-700 dark:text-red-300">
                      <strong>Warning:</strong> Deleting these collections will
                      permanently remove all their data. This action cannot be
                      undone.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
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
              <div className="space-y-2">
                <Label htmlFor="include-collections">Include Collections</Label>
                <Controller
                  name="includeClasses"
                  control={control}
                  render={({ field }) => (
                    <MultiSelect
                      options={classOptions}
                      selected={field.value}
                      onChange={field.onChange}
                      placeholder="Select collections to include..."
                      emptyText="No collections found"
                      disabled={excludeClasses.length > 0}
                    />
                  )}
                />
                <p className="text-muted-foreground text-xs">
                  List of collections (classes) to include in the backup
                  restoration process.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="exclude-collections">Exclude Collections</Label>
                <Controller
                  name="excludeClasses"
                  control={control}
                  render={({ field }) => (
                    <MultiSelect
                      options={classOptions}
                      selected={field.value}
                      onChange={field.onChange}
                      placeholder="Select collections to exclude..."
                      emptyText="No collections found"
                      disabled={includeClasses.length > 0}
                    />
                  )}
                />
                <p className="text-muted-foreground text-xs">
                  List of collections (classes) to exclude from the backup
                  restoration process.
                </p>
              </div>
              <div className="flex items-start space-x-2">
                <Controller
                  name="includeRBACAndUsers"
                  control={control}
                  render={({ field }) => (
                    <input
                      type="checkbox"
                      id="include-rbac-users"
                      checked={field.value}
                      onChange={field.onChange}
                      className="mt-0.5 h-4 w-4"
                    />
                  )}
                />
                <div className="flex-1">
                  <Label
                    htmlFor="include-rbac-users"
                    className="cursor-pointer"
                  >
                    Include RBAC and Users
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Include roles, permissions, and users in the restore
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <Controller
                  name="overwriteAlias"
                  control={control}
                  render={({ field }) => (
                    <input
                      type="checkbox"
                      id="overwrite-alias"
                      checked={field.value}
                      onChange={field.onChange}
                      className="mt-0.5 h-4 w-4"
                    />
                  )}
                />
                <div className="flex-1">
                  <Label htmlFor="overwrite-alias" className="cursor-pointer">
                    Overwrite Alias
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Overwrite existing collection aliases during restore
                  </p>
                </div>
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
              disabled={isSubmitting || isDeleting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={disableSubmitting()}>
              {isDeleting
                ? "Deleting..."
                : isSubmitting
                  ? "Restoring..."
                  : "Restore"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
