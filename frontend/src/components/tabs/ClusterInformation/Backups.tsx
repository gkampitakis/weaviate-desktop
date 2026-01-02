import { Button } from "@/components/ui/button";
import { ListBackups } from "wailsjs/go/weaviate/Weaviate";
import { VirtualBackupList } from "./components/VirtualBackupList";
import { weaviate } from "wailsjs/go/models";
import { useQuery } from "@tanstack/react-query";
import { errorReporting } from "@/lib/utils";

interface Props {
  connectionID: number;
  backends: string[];
}

// FIXME: update nodes list to use the same UI as backups and have the same feeling
// FIXME: status badges
// FIXME: test the actual dates are correctly formatted
// FIXME: add support for polling if a backup is in progress
// FIXME: replace mock data with actual API call
// FIXME: add "New Backup" functionality
// FIXME: check how backup with a lot classes is rendered
// FIXME: add filtering
// FIXME: add support for all backup backends
// FIXME: for in progress we want to be able to cancel the backup action
// FIXME: add restore support (restore button on each backup card)
// FIXME: we need to hide the fact that we are consolidating multiple backends into one list

const Backups = ({ connectionID, backends }: Props) => {
  const handleNewBackup = async () => {};

  const {
    data: backups,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["backups", connectionID],
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
          <h2 className="text-xl font-semibold">Backups</h2>
          <p className="text-muted-foreground text-sm">
            {backups?.length} backup{backups?.length !== 1 ? "s" : ""} found
          </p>
        </div>
        <Button variant="default" onClick={handleNewBackup}>
          New Backup
        </Button>
      </div>
      <div className="flex-1">
        <VirtualBackupList
          backups={backups || []}
          height="calc(100vh - 200px)"
          estimatedItemHeight={280}
        />
      </div>
    </div>
  );
};

export default Backups;
