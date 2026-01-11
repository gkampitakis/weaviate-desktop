import { errorReporting } from "@/lib/utils";
import { useConnectionStore } from "@/store/connection-store";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { GetRestoreStatus } from "wailsjs/go/weaviate/Weaviate";
import { useShallow } from "zustand/shallow";

interface Props {
  connectionID: number;
  backupRestore: {
    id: string;
    backend: string;
    include?: string[];
    exclude?: string[];
    includeRBACAndUsers?: boolean;
    overwriteAlias?: boolean;
  };
}

export function RestoreInProgressBanner({
  connectionID,
  backupRestore,
}: Props) {
  const queryClient = useQueryClient();
  const queryKey = ["restore-in-progress", connectionID, backupRestore.id];

  const { patchConnection, updateCollections } = useConnectionStore(
    useShallow((state) => ({
      patchConnection: state.patch,
      updateCollections: state.updateCollections,
    }))
  );

  // Cleanup: Remove query from cache when component unmounts
  useEffect(() => {
    return () => {
      queryClient.removeQueries({ queryKey });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey.join(""), backupRestore.id]);

  const { data: statusResponse } = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        const status = await GetRestoreStatus(
          connectionID,
          backupRestore.backend,
          backupRestore.id
        );

        return status;
      } catch (error) {
        errorReporting(error);
        throw error;
      }
    },
    refetchInterval: (query) => {
      const status = query.state.data;
      return status?.status === "STARTED" ? 5000 : false;
    },
  });

  useEffect(() => {
    if (statusResponse && statusResponse.status !== "STARTED") {
      patchConnection(connectionID, { backupRestore: undefined });
      updateCollections(connectionID).catch(errorReporting);

      if (statusResponse.status === "FAILED") {
        errorReporting(
          `Restore operation for backup "${backupRestore?.id}" has failed. Error: ${statusResponse.error || "Unknown error"}`
        );
      }
    }
  }, [
    statusResponse,
    connectionID,
    backupRestore.id,
    patchConnection,
    updateCollections,
  ]);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
      <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            Restore in Progress
          </p>
        </div>
        <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
          Restoring backup &quot;{backupRestore.id}&quot;
          {backupRestore.include &&
            backupRestore.include.length > 0 &&
            ` (${backupRestore.include.length} collection${backupRestore.include.length !== 1 ? "s" : ""})`}
        </p>
      </div>
    </div>
  );
}
