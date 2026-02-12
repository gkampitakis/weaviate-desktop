import { Button } from "@/components/ui/button";
import RefreshButton from "@/components/ui/refresh-button";
import { errorReporting } from "@/lib/utils";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ListRoles } from "wailsjs/go/weaviate/Weaviate";
import { rolesQueryKey, rolesRefetchInterval } from "./constants";
import { SearchInput } from "@/components/ui/search-input";
import { SearchX } from "lucide-react";
import { VirtualRoleList } from "./components/VirtualRoleList";
import { RoleDialog } from "./components/RoleDialog";

interface Props {
  connectionID: number;
}

const Roles = ({ connectionID }: Props) => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: roles,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: rolesQueryKey(connectionID),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => {
      // Stop refetching if there's an error
      if (query.state.error) {
        return false;
      }
      return rolesRefetchInterval;
    },
    retry: false, // Don't automatically retry on error
    queryFn: async () => {
      try {
        return await ListRoles(connectionID);
      } catch (error) {
        errorReporting(error);
        throw error;
      }
    },
  });

  const filteredRoles = !searchQuery
    ? roles
    : roles?.filter((role) =>
        role.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loading roles...</p>
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
        <p className="text-lg font-medium text-red-600">Failed loading roles</p>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? "Retrying..." : "Retry"}
        </Button>
      </div>
    );
  }

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
          New Role
        </Button>
      </div>
      {roles && roles.length >= 5 && (
        <div className="flex items-center gap-4">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by role name..."
            className="w-64"
          />
        </div>
      )}
      <div className="flex-1">
        {filteredRoles && filteredRoles.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <SearchX className="text-muted-foreground h-12 w-12" />
            <div className="text-center">
              <p className="text-lg font-medium">No results found</p>
              <p className="text-muted-foreground text-sm">
                Try adjusting your search
              </p>
            </div>
          </div>
        ) : (
          <VirtualRoleList
            roles={filteredRoles || []}
            connectionID={connectionID}
            height="calc(100vh - 250px)"
            estimatedItemHeight={140}
          />
        )}
      </div>
      <RoleDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        connectionID={connectionID}
        mode="create"
      />
    </div>
  );
};

export default Roles;
