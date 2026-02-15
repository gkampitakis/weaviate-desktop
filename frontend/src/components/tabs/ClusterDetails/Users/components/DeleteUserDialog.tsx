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
import { DeleteUser } from "wailsjs/go/weaviate/Weaviate";
import { errorReporting } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { usersQueryKey } from "../constants";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  connectionID: number;
}

export function DeleteUserDialog({
  open,
  onOpenChange,
  userId,
  connectionID,
}: Props) {
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState("");

  const isConfirmed = confirmationInput.trim() === userId.trim();

  const handleDelete = async () => {
    if (!isConfirmed) return;
    setIsDeleting(true);
    try {
      await DeleteUser(connectionID, userId);
      await queryClient.invalidateQueries({
        queryKey: usersQueryKey(connectionID),
      });
      onOpenChange(false);
    } catch (error) {
      errorReporting(`Failed to delete user: ${error}`);
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
            Delete User
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              Are you sure you want to delete user{" "}
              <strong>&quot;{userId}&quot;</strong>?
            </p>
            <p className="text-destructive font-medium">
              This action cannot be undone. API Key associated with this user
              will be permanently revoked, and the user will lose access to the
              database immediately.
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
            <Label htmlFor="confirm-user-id">
              Type <span className="font-mono font-semibold">{userId}</span> to
              confirm
            </Label>
            <Input
              id="confirm-user-id"
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
              {isDeleting ? "Deleting..." : "Yes, delete user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
