import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { DeleteRole } from "wailsjs/go/weaviate/Weaviate";
import { errorReporting } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { rolesQueryKey } from "../constants";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roleName: string;
  connectionID: number;
}

export function DeleteRoleDialog({
  open,
  onOpenChange,
  roleName,
  connectionID,
}: Props) {
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState("");

  const isConfirmed = confirmationInput.trim() === roleName.trim();

  const handleDelete = async () => {
    if (!isConfirmed) return;
    setIsDeleting(true);
    try {
      await DeleteRole(connectionID, roleName);
      await queryClient.invalidateQueries({
        queryKey: rolesQueryKey(connectionID),
      });
      onOpenChange(false);
      setConfirmationInput("");
    } catch (error) {
      errorReporting(`Failed to delete role: ${error}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setConfirmationInput("");
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="text-destructive h-5 w-5" />
            Delete Role
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              Are you sure you want to delete role{" "}
              <strong>&quot;{roleName}&quot;</strong>?
            </p>
            <p className="text-destructive font-medium">
              This action cannot be undone. All users assigned to this role will
              lose the associated permissions immediately.
            </p>
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleDelete();
          }}
        >
          <div className="space-y-2 py-2">
            <Label htmlFor="confirm-role-name">
              Type <span className="font-mono font-semibold">{roleName}</span>{" "}
              to confirm
            </Label>
            <Input
              id="confirm-role-name"
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              disabled={isDeleting}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={isDeleting || !isConfirmed}
            >
              {isDeleting ? "Deleting..." : "Yes, delete role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
