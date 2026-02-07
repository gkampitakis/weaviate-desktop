import { Button } from "@/components/ui/button";
import RefreshButton from "@/components/ui/refresh-button";
import { useState } from "react";

interface Props {
  connectionID: number;
}

const Roles = ({ connectionID }: Props) => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const isFetching = false; // Placeholder for fetching state
  const refetch = ({ cancelRefetch }: { cancelRefetch: boolean }) => {};

  return (
    <div className="flex h-full w-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex flex-row items-center gap-2">
            <h2 className="text-xl font-semibold">Roles</h2>
            <RefreshButton
              isRefreshing={isFetching}
              refresh={() => refetch({ cancelRefetch: false })}
              tooltipText="Refresh roles"
            />
          </div>
        </div>
        <Button
          variant="default"
          onClick={() => setCreateDialogOpen(true)}
          disabled={false}
        >
          New User
        </Button>
      </div>
    </div>
  );
};

export default Roles;
