import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import RefreshButton from "@/components/ui/refresh-button";
import { ErrorState } from "@/components/ui/error-state";
import { useState } from "react";
import { CreateUserDialog } from "./components/CreateUserDialog";
import { VirtualUserList } from "./components/VirtualUserList";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ListUsers } from "wailsjs/go/weaviate/Weaviate";
import { errorReporting } from "@/lib/utils";
import { usersQueryKey, usersRefetchInterval } from "./constants";
import { UserPlus, SearchX } from "lucide-react";

interface Props {
  connectionID: number;
}

const Users = ({ connectionID }: Props) => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: users,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: usersQueryKey(connectionID),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => {
      // Stop refetching if there's an error
      if (query.state.error) {
        return false;
      }
      return usersRefetchInterval;
    },
    retry: false, // Don't automatically retry on error
    queryFn: async () => {
      try {
        return await ListUsers(connectionID);
      } catch (error) {
        errorReporting(error);
        throw error;
      }
    },
  });

  // Filter users based on status and search query
  const filteredUsers = users?.filter((user) => {
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && user.active) ||
      (statusFilter === "inactive" && !user.active);

    const matchesSearch =
      !searchQuery ||
      user.userID.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  // Count active and inactive users
  const activeCount = users?.filter((u) => u.active).length;
  const inactiveCount = users?.filter((u) => !u.active).length;

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loading users...</p>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        message="Failed loading users"
        onRetry={() => refetch()}
        isRetrying={isFetching}
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex flex-row items-center gap-2">
            <h2 className="text-xl font-semibold">Users</h2>
            <RefreshButton
              isRefreshing={isFetching}
              refresh={() => refetch({ cancelRefetch: false })}
              tooltipText="Refresh users"
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
      {users && users.length > 0 && (
        <div className="flex items-center gap-4">
          {users.length >= 5 && (
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by user ID..."
              className="w-64"
            />
          )}
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm font-medium">
              Filter:
            </span>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={statusFilter === "all" ? "default" : "outline"}
                className={`cursor-pointer transition-all ${
                  statusFilter === "all"
                    ? "hover:opacity-90"
                    : "hover:bg-secondary"
                }`}
                onClick={() => setStatusFilter("all")}
              >
                All ({users.length})
              </Badge>
              <Badge
                variant={statusFilter === "active" ? "default" : "outline"}
                className={`cursor-pointer transition-all ${
                  statusFilter === "active"
                    ? "hover:opacity-90"
                    : "hover:bg-secondary"
                }`}
                onClick={() => setStatusFilter("active")}
              >
                Active ({activeCount})
              </Badge>
              <Badge
                variant={statusFilter === "inactive" ? "default" : "outline"}
                className={`cursor-pointer transition-all ${
                  statusFilter === "inactive"
                    ? "hover:opacity-90"
                    : "hover:bg-secondary"
                }`}
                onClick={() => setStatusFilter("inactive")}
              >
                Inactive ({inactiveCount})
              </Badge>
            </div>
          </div>
        </div>
      )}
      <div className="flex-1">
        {!users || users.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <UserPlus className="text-muted-foreground h-12 w-12" />
            <div className="text-center">
              <p className="text-lg font-medium">No users yet</p>
              <p className="text-muted-foreground text-sm">
                Create your first user to get started
              </p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              Create User
            </Button>
          </div>
        ) : filteredUsers && filteredUsers.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <SearchX className="text-muted-foreground h-12 w-12" />
            <div className="text-center">
              <p className="text-lg font-medium">No results found</p>
              <p className="text-muted-foreground text-sm">
                Try adjusting your search or filter criteria
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <VirtualUserList
            users={filteredUsers || []}
            connectionID={connectionID}
            height="calc(100vh - 250px)"
            estimatedItemHeight={200}
          />
        )}
      </div>
      <CreateUserDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        userIDs={users?.map((u) => u.userID) || []}
        connectionID={connectionID}
      />
    </div>
  );
};

export default Users;
