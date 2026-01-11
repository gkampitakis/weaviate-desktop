import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListBackups } from "wailsjs/go/weaviate/Weaviate";
import { VirtualBackupList } from "./components/VirtualBackupList";
import { CreateBackupDialog } from "./components/CreateBackupDialog";
import { RestoreInProgressBanner } from "./components/RestoreInProgressBanner";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { errorReporting } from "@/lib/utils";
import { useState, useEffect } from "react";
import RefreshButton from "@/components/ui/refresh-button";
import { useConnectionStore } from "@/store/connection-store";
import { useShallow } from "zustand/shallow";
import { backupsQueryKey, backupRefetchInterval } from "./constants";

interface Props {
  connectionID: number;
  backends: string[];
}

const Backups = ({ connectionID, backends }: Props) => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const { connection, patchConnection } = useConnectionStore(
    useShallow((state) => ({
      connection: state.get(connectionID),
      patchConnection: state.patch,
    }))
  );

  const {
    data: backups,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: backupsQueryKey(connectionID),
    placeholderData: keepPreviousData,
    refetchInterval: backupRefetchInterval,
    queryFn: async () => {
      try {
        return await ListBackups(connectionID, backends);
      } catch (error) {
        errorReporting(error);
        throw error;
      }
    },
  });

  // Calculate status counts
  const statusCounts =
    backups?.reduce(
      (acc, backup) => {
        acc[backup.status] = (acc[backup.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    ) || {};

  // Filter backups based on selected status
  const filteredBackups =
    statusFilter && statusCounts[statusFilter]
      ? backups?.filter((b) => b.status === statusFilter)
      : backups;

  useEffect(() => {
    if (backups) {
      const hasBackupInProgress = backups.some(
        (backup) => backup.status === "STARTED"
      );

      patchConnection(connectionID, { backupInProgress: hasBackupInProgress });
    }
  }, [backups, connectionID, patchConnection]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loading backups...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4">
        <svg
          className="h-10 w-10 text-red-500"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
          />
          <line
            x1="12"
            y1="8"
            x2="12"
            y2="13"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle cx="12" cy="16" r="1" fill="currentColor" />
        </svg>
        <p className="text-lg font-medium text-red-600">
          Failed loading backups
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-4 p-4">
      {connection?.backupRestore && (
        <RestoreInProgressBanner
          key={connection.backupRestore.id}
          connectionID={connectionID}
          backupRestore={connection.backupRestore}
        />
      )}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex flex-row items-center gap-2">
            <h2 className="text-xl font-semibold">Backups</h2>
            <RefreshButton
              isRefreshing={isFetching}
              refresh={() => refetch({ cancelRefetch: false })}
              tooltipText="Refresh backups"
            />
          </div>
          <p className="text-muted-foreground text-sm">
            {filteredBackups?.length} backup
            {filteredBackups?.length !== 1 ? "s" : ""} found
          </p>
        </div>
        <Button
          variant="default"
          onClick={() => setCreateDialogOpen(true)}
          disabled={connection?.backupInProgress || !!connection?.backupRestore}
        >
          New Backup
        </Button>
      </div>
      {backups && backups.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm font-medium">
            Filter:
          </span>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={
                statusFilter === null || !statusCounts[statusFilter]
                  ? "default"
                  : "outline"
              }
              className={`cursor-pointer transition-all ${
                statusFilter === null || !statusCounts[statusFilter]
                  ? "hover:opacity-90"
                  : "hover:bg-secondary"
              }`}
              onClick={() => setStatusFilter(null)}
            >
              All ({backups.length})
            </Badge>
            {Object.entries(statusCounts).map(([status, count]) => (
              <Badge
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                className={`cursor-pointer transition-all ${
                  statusFilter === status
                    ? "hover:opacity-90"
                    : "hover:bg-secondary"
                }`}
                onClick={() => setStatusFilter(status)}
              >
                {status} ({count})
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1">
        <VirtualBackupList
          backups={filteredBackups || []}
          connectionID={connectionID}
          height="calc(100vh - 250px)"
          estimatedItemHeight={280}
        />
      </div>
      <CreateBackupDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        connectionID={connectionID}
        backends={backends}
        backupIds={backups?.map((b) => b.id) || []}
        onSuccess={refetch}
      />
    </div>
  );
};

export default Backups;
