import { Button } from "@/components/ui/button";
import { ListBackups } from "wailsjs/go/weaviate/Weaviate";
import { VirtualBackupList } from "./components/VirtualBackupList";
import { CreateBackupDialog } from "./components/CreateBackupDialog";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { errorReporting } from "@/lib/utils";
import { useState } from "react";
import RefreshButton from "@/components/ui/refresh-button";

interface Props {
  connectionID: number;
  backends: string[];
}

/*
Functionality to add:
- Create new backup. If we have multiple backends, we need to select which backend to use. ✅
- add a refresh button to the backups list ✅
- can we have a nice duration calculated from startedAt and completedAt
- start polling for backup status when started
- Restore from backup and check status.
- Show progress of in-progress backups (polling). Allow cancelling in-progress backups.
- Add filtering options by status

FIXES: 
- started completed at date is wrong ✅
- use same feeling list for nodes
- improve the "custom made" multi select inside the create backup dialog

Open questions:
- what happens if no classes exist. Technically, we should be able to backup even if no classes exist but backup users and roles right?
*/

const Backups = ({ connectionID, backends }: Props) => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const {
    data: backups,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["backups", connectionID],
    placeholderData: keepPreviousData,
    // 5 minutes
    refetchInterval: 5 * 60000,
    queryFn: async () => {
      try {
        return await ListBackups(connectionID, backends);
      } catch (error) {
        errorReporting(error);
        throw error;
      }
    },
  });

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
            {backups?.length} backup{backups?.length !== 1 ? "s" : ""} found
          </p>
        </div>
        <Button variant="default" onClick={() => setCreateDialogOpen(true)}>
          New Backup
        </Button>
      </div>
      <div className="flex-1">
        <VirtualBackupList
          backups={backups || []}
          connectionID={connectionID}
          height="calc(100vh - 200px)"
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
