import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Calendar,
  Clock,
  Key,
  MoreVertical,
  Shield,
  UserCog,
  Trash2,
  RotateCw,
} from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { weaviate } from "wailsjs/go/models";
import { ActivateApiKey } from "wailsjs/go/weaviate/Weaviate";
import { DeactivateUserDialog } from "./DeactivateUserDialog";
import { DeleteUserDialog } from "./DeleteUserDialog";
import { EditRolesDialog } from "./EditRolesDialog";
import { RotateApiKeyDialog } from "./RotateApiKeyDialog";
import { usersQueryKey } from "../constants";

interface Props {
  user: weaviate.w_UserInfo;
  showUserType: boolean;
  connectionID: number;
}

const getStatusColor = (active: boolean) => {
  return active ? "bg-green-500" : "bg-gray-500";
};

const formatDate = (dateString: string) => {
  if (!dateString || dateString === "N/A") return "N/A";
  try {
    return new Date(dateString).toLocaleString();
  } catch {
    return dateString;
  }
};

export function UserCard({ user, showUserType, connectionID }: Props) {
  const queryClient = useQueryClient();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rotateDialogOpen, setRotateDialogOpen] = useState(false);
  const [editRolesDialogOpen, setEditRolesDialogOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);

  return (
    <Card className="p-4 transition-shadow hover:shadow-md">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex gap-2">
            <h3 className="truncate text-sm font-semibold">{user.userID}</h3>
            {showUserType && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {user.userType}
                </Badge>
              </div>
            )}
          </div>
          <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={async () => {
                  setIsDropdownOpen(false);
                  if (user.active) {
                    setDeactivateDialogOpen(true);
                  } else {
                    await ActivateApiKey(connectionID, user.userID);
                    queryClient.setQueryData(
                      usersQueryKey(connectionID),
                      (oldData: weaviate.w_UserInfo[] | undefined) =>
                        oldData?.map((u) =>
                          u.userID === user.userID ? { ...u, active: true } : u
                        )
                    );
                  }
                }}
              >
                <UserCog className="h-4 w-4" />
                {user.active ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setIsDropdownOpen(false);
                  setRotateDialogOpen(true);
                }}
              >
                <RotateCw className="h-4 w-4" />
                Rotate Key
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setIsDropdownOpen(false);
                  setEditRolesDialogOpen(true);
                }}
              >
                <Shield className="h-4 w-4" />
                Edit Roles
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  setIsDropdownOpen(false);
                  setDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete User
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-start gap-2">
            <Key className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs">API Key</p>
              <p className="font-mono text-xs font-medium">
                {user.apiKeyFirstLetters}...
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="mt-0.5 h-4 w-4 flex-shrink-0">
              <div
                className={`h-2 w-2 rounded-full ${getStatusColor(user.active)}`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs">Status</p>
              <p className="text-xs font-medium">
                {user.active ? "Active" : "Inactive"}
              </p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-start gap-2">
            <Calendar className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs">Created</p>
              <p className="truncate text-xs font-medium">
                {formatDate(user.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs">Last Used</p>
              <p className="truncate text-xs font-medium">
                {formatDate(user.lastUsedAt)}
              </p>
            </div>
          </div>
        </div>
        {user.roles && user.roles.length > 0 && (
          <div className="flex items-start gap-2">
            <Shield className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground mb-1 text-xs">Roles</p>
              <div className="flex flex-wrap gap-1">
                {user.roles.slice(0, 5).map((role, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {role.name}
                  </Badge>
                ))}
                {user.roles.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{user.roles.length - 5} more
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <DeleteUserDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        userId={user.userID}
        connectionID={connectionID}
      />
      <RotateApiKeyDialog
        open={rotateDialogOpen}
        onOpenChange={setRotateDialogOpen}
        userId={user.userID}
        connectionID={connectionID}
      />
      <EditRolesDialog
        open={editRolesDialogOpen}
        onOpenChange={setEditRolesDialogOpen}
        userId={user.userID}
        currentRoles={user.roles?.map((r) => r.name) ?? []}
        connectionID={connectionID}
      />
      <DeactivateUserDialog
        open={deactivateDialogOpen}
        onOpenChange={setDeactivateDialogOpen}
        userId={user.userID}
        connectionID={connectionID}
      />
    </Card>
  );
}
