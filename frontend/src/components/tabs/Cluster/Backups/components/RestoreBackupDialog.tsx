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
import { ChevronDown, ChevronUp } from "lucide-react";
import { errorReporting } from "@/lib/utils";
import { GetCollections, RestoreBackup } from "wailsjs/go/weaviate/Weaviate";
import { toast } from "sonner";
import { useConnectionStore } from "@/store/connection-store";
import { useQuery } from "@tanstack/react-query";

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
  backupClasses: classes,
}: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const patchConnection = useConnectionStore((state) => state.patch);

  // Convert classes array to options for multi-select
  const classOptions = classes.map((c) => ({
    label: c,
    value: c,
  }));

  const { data: collectionData } = useQuery({
    queryKey: ["collections", connectionID],
    queryFn: async () => {
      const classes = await GetCollections(connectionID);
      return classes
        .filter((c) => c.class)
        .map((c) => ({
          label: c.class!,
          value: c.class!,
        }));
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

  // FIXME:
  const getOverlappingClasses = () => {
    if (includeClasses.length === 0 || excludeClasses.length === 0) {
      const all = new Set([...collections]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Restore Backup: {backupID}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          {/* Warning section with orange text like the errors*/}
          <div className="rounded-md bg-yellow-50 p-4">
            <p className="text-yellow-800">
              Warning: You need to delete existing classes that you want to
              restore.
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
                  Specific collections to include in the restore. If not set,
                  all collections from the backup will be restored.
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
                  Specific collections to exclude from the restore
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
                  CPU usage limit (1-80, default: 50)
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
              {isSubmitting ? "Restoring..." : "Restore"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
