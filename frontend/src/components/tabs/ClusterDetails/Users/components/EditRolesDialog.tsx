import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { Loader2, Shield } from "lucide-react";
import { useState } from "react";
import { weaviate } from "wailsjs/go/models";
import {
  AssignRolesToUser,
  ListRoles,
  RevokeRolesFromUser,
} from "wailsjs/go/weaviate/Weaviate";
import { errorReporting } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usersQueryKey } from "../constants";
import { rolesQueryKey } from "../../Roles/constants";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  currentRoles: string[];
  connectionID: number;
}

export function EditRolesDialog({
  open,
  onOpenChange,
  userId,
  currentRoles,
  connectionID,
}: Props) {
  const queryClient = useQueryClient();
  const [selectedRoles, setSelectedRoles] = useState<string[]>(currentRoles);
  const [isSaving, setIsSaving] = useState(false);

  const { data: roles, isLoading: isLoadingRoles } = useQuery({
    queryKey: rolesQueryKey(connectionID),
    queryFn: () => ListRoles(connectionID),
    enabled: open,
  });

  const roleOptions =
    roles?.map((role) => ({
      value: role.name,
      label: role.name,
    })) ?? [];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const rolesToAssign = selectedRoles.filter(
        (role) => !currentRoles.includes(role)
      );
      const rolesToRevoke = currentRoles.filter(
        (role) => !selectedRoles.includes(role)
      );

      if (rolesToAssign.length > 0) {
        await AssignRolesToUser(connectionID, userId, rolesToAssign);
      }

      if (rolesToRevoke.length > 0) {
        await RevokeRolesFromUser(connectionID, userId, rolesToRevoke);
      }

      queryClient.setQueryData(
        usersQueryKey(connectionID),
        (oldData: weaviate.w_UserInfo[] | undefined) =>
          oldData?.map((u) =>
            u.userID === userId
              ? {
                  ...u,
                  roles: selectedRoles.map((name) => ({ name })),
                }
              : u
          )
      );
      onOpenChange(false);
    } catch (error) {
      errorReporting(`Failed to update roles: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Delay reset to avoid flash when closing
      setTimeout(() => {
        setSelectedRoles(currentRoles);
        setIsSaving(false);
      }, 150);
    } else {
      // Reset to current roles when opening
      setSelectedRoles(currentRoles);
    }
    onOpenChange(newOpen);
  };

  const hasChanges =
    selectedRoles.length !== currentRoles.length ||
    selectedRoles.some((role) => !currentRoles.includes(role));

  if (isSaving) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            <p className="text-muted-foreground mt-4 text-sm">
              Updating roles...
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Edit Roles
          </DialogTitle>
          <DialogDescription>
            Update roles for user <strong>&quot;{userId}&quot;</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Roles</Label>
            <MultiSelect
              options={roleOptions}
              selected={selectedRoles}
              onChange={setSelectedRoles}
              placeholder={
                isLoadingRoles ? "Loading roles..." : "Select roles..."
              }
              emptyText="No roles available"
              disabled={isLoadingRoles}
            />
            <p className="text-muted-foreground text-xs">
              Select the roles you want to assign to this user.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
