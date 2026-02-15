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
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";
import { weaviate } from "wailsjs/go/models";
import { DeactivateApiKey } from "wailsjs/go/weaviate/Weaviate";
import { errorReporting } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { usersQueryKey } from "../constants";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  connectionID: number;
}

export function DeactivateUserDialog({
  open,
  onOpenChange,
  userId,
  connectionID,
}: Props) {
  const queryClient = useQueryClient();
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState("");
  const [revokeKey, setRevokeKey] = useState(false);

  const isConfirmed = confirmationInput.trim() === userId.trim();

  const handleDeactivate = async () => {
    if (!isConfirmed) return;
    setIsDeactivating(true);
    try {
      await DeactivateApiKey(connectionID, userId, revokeKey);
      queryClient.setQueryData(
        usersQueryKey(connectionID),
        (oldData: weaviate.w_UserInfo[] | undefined) =>
          oldData?.map((u) =>
            u.userID === userId ? { ...u, active: false } : u
          )
      );
      onOpenChange(false);
    } catch (error) {
      errorReporting(`Failed to deactivate user: ${error}`);
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setTimeout(() => {
        setConfirmationInput("");
        setRevokeKey(false);
        setIsDeactivating(false);
      }, 150);
    }
    onOpenChange(newOpen);
  };

  if (isDeactivating) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            <p className="text-muted-foreground mt-4 text-sm">
              Deactivating user...
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Deactivate User
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              Are you sure you want to deactivate user{" "}
              <strong>&quot;{userId}&quot;</strong>? The user will no longer be
              able to authenticate with their API key.
            </p>
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleDeactivate();
          }}
        >
          <div className="space-y-4 py-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="revoke-key"
                checked={revokeKey}
                onCheckedChange={(checked: boolean | "indeterminate") =>
                  setRevokeKey(checked === true)
                }
              />
              <Label
                htmlFor="revoke-key"
                className="text-sm leading-none font-normal peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Revoke current API key
              </Label>
            </div>
            {revokeKey && (
              <p className="text-muted-foreground pl-6 text-xs">
                If you reactivate this user, they will need a new API key to
                access the database.
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="confirm-user-id">
                Type <span className="font-mono font-semibold">{userId}</span>{" "}
                to confirm
              </Label>
              <Input
                id="confirm-user-id"
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                disabled={isDeactivating}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isDeactivating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isDeactivating || !isConfirmed}>
              Deactivate User
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
