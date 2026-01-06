import { Card } from "@/components/ui/card";
import { formatGibToReadable, errorReporting } from "@/lib/utils";
import { weaviate } from "wailsjs/go/models";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Calendar,
  Database,
  HardDrive,
  Clock,
  ChevronDown,
  ChevronUp,
  StopCircle,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GetCreationStatus, CancelBackup } from "wailsjs/go/weaviate/Weaviate";
import { toast } from "sonner";
import { RestoreBackupDialog } from "./RestoreBackupDialog";
import { useConnectionStore } from "@/store/connection-store";

interface Props {
  backup: weaviate.w_Backup;
  connectionID: number;
}

const getStatusColor = (status?: string) => {
  switch (status) {
    case "SUCCESS":
      return "text-green-500";
    case "FAILED":
      return "text-red-500";
    case "STARTED":
    case "TRANSFERRING":
    case "TRANSFERRED":
      return "text-blue-500";
    case "CANCELED":
      return "text-gray-500";
    default:
      return "text-gray-500";
  }
};

const formatDate = (dateString?: string) => {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleString();
  } catch {
    return dateString;
  }
};

export function BackupCard({ backup, connectionID }: Props) {
  const [showAllClasses, setShowAllClasses] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const queryClient = useQueryClient();
  const classLimit = 5;
  const hasMoreClasses = backup.classes && backup.classes.length > classLimit;
  const displayedClasses = showAllClasses
    ? backup.classes
    : backup.classes?.slice(0, classLimit);
  const connection = useConnectionStore((state) => state.get(connectionID));

  useQuery({
    queryKey: ["backup-creation-status", connectionID, backup.id],
    queryFn: async () => {
      try {
        const status = await GetCreationStatus(connectionID, {
          backend: backup.backend,
          id: backup.id,
        });

        if (status !== "STARTED") {
          await queryClient.invalidateQueries({
            queryKey: ["backups", connectionID],
          });
        }

        return status;
      } catch (error) {
        errorReporting(error);
        throw error;
      }
    },
    enabled: backup.status === "STARTED",
    refetchInterval: (query) => {
      // Stop polling if status is no longer STARTED
      const status = query.state.data;
      return status === "STARTED" ? 10000 : false; // Poll every 10 seconds
    },
    retry: false,
  });

  const handleCancelBackup = async () => {
    setIsCanceling(true);
    try {
      await CancelBackup(connectionID, backup.backend, backup.id);
      toast.success(`Backup "${backup.id}" cancelled successfully`);
      setShowCancelDialog(false);

      // Invalidate queries to refresh the list
      await queryClient.invalidateQueries({
        queryKey: ["backups", connectionID],
      });
    } catch (error) {
      errorReporting(error);
    } finally {
      setIsCanceling(false);
    }
  };

  return (
    <Card className="p-4 transition-shadow hover:shadow-md">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-sm font-semibold">
            {backup.id || "Unnamed Backup"}
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {backup.classes && backup.classes.length > 0 && (
            <div className="flex items-start gap-2">
              <Database className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-muted-foreground text-xs">
                    Classes{" "}
                    {backup.classes.length > 1 && `(${backup.classes.length})`}
                  </p>
                  {hasMoreClasses && (
                    <button
                      onClick={() => setShowAllClasses(!showAllClasses)}
                      className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
                    >
                      {showAllClasses ? (
                        <>
                          Show less
                          <ChevronUp className="h-3 w-3" />
                        </>
                      ) : (
                        <>
                          +{backup.classes.length - classLimit} more
                          <ChevronDown className="h-3 w-3" />
                        </>
                      )}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {displayedClasses?.map((cls: string, idx: number) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {cls}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="flex items-start gap-2">
            <div className="mt-0.5 h-4 w-4 flex-shrink-0">
              <div
                className={`h-2 w-2 rounded-full ${getStatusColor(backup.status).replace("text-", "bg-")}`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs">Status</p>
              <p
                className={`text-xs font-medium ${getStatusColor(backup.status)}`}
              >
                {backup.status || "UNKNOWN"}
              </p>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-start gap-2">
            <Clock className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs">Started</p>
              <p
                className="truncate text-xs font-medium"
                title={formatDate(backup.startedAt)}
              >
                {formatDate(backup.startedAt)}
              </p>
            </div>
          </div>

          {backup.completedAt && (
            <div className="flex items-start gap-2">
              <Calendar className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-xs">Completed</p>
                <p
                  className="truncate text-xs font-medium"
                  title={formatDate(backup.completedAt)}
                >
                  {formatDate(backup.completedAt)}
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <HardDrive className="text-muted-foreground h-4 w-4 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-muted-foreground text-xs">Size</p>
              <p className="text-xs font-medium">
                {formatGibToReadable(backup.size)}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {backup.status === "SUCCESS" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRestoreDialog(true)}
                className="border-border/50 hover:border-primary/50 hover:bg-primary/10 hover:text-primary h-7 gap-1.5 rounded-md shadow-sm transition-all"
                disabled={
                  connection?.backupInProgress || !!connection?.backupRestore
                }
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Restore</span>
              </Button>
            )}
            {backup.status === "STARTED" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCancelDialog(true)}
                disabled={isCanceling}
                className="border-border/50 hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive h-7 gap-1.5 rounded-md shadow-sm transition-all"
              >
                <StopCircle className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Cancel</span>
              </Button>
            )}
          </div>
        </div>
      </div>
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Backup</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel the backup &quot;{backup.id}
              &quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              disabled={isCanceling}
            >
              No, keep it
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelBackup}
              disabled={isCanceling}
            >
              {isCanceling ? "Cancelling..." : "Yes, cancel backup"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {backup.status === "SUCCESS" && (
        <RestoreBackupDialog
          open={showRestoreDialog}
          onOpenChange={setShowRestoreDialog}
          connectionID={connectionID}
          backend={backup.backend}
          backupID={backup.id}
          backupClasses={backup.classes || []}
        />
      )}
    </Card>
  );
}
