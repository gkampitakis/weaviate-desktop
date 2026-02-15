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
import { AlertTriangle, Check, Copy, KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import { RotateUserApiKey } from "wailsjs/go/weaviate/Weaviate";
import { errorReporting } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { usersQueryKey } from "../constants";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  connectionID: number;
}

export function RotateApiKeyDialog({
  open,
  onOpenChange,
  userId,
  connectionID,
}: Props) {
  const queryClient = useQueryClient();
  const [isRotating, setIsRotating] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState("");
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isConfirmed = confirmationInput.trim() === userId.trim();

  const handleRotate = async () => {
    if (!isConfirmed) return;
    setIsRotating(true);
    try {
      const apiKey = await RotateUserApiKey(connectionID, userId);
      setNewApiKey(apiKey);
      await queryClient.invalidateQueries({
        queryKey: usersQueryKey(connectionID),
      });
    } catch (error) {
      errorReporting(`Failed to rotate API key: ${error}`);
      setIsRotating(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Delay reset to avoid flash when closing
      setTimeout(() => {
        setConfirmationInput("");
        setNewApiKey(null);
        setCopied(false);
        setIsRotating(false);
      }, 150);
    }
    onOpenChange(newOpen);
  };

  const handleCopyApiKey = async () => {
    if (newApiKey) {
      await navigator.clipboard.writeText(newApiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isRotating && !newApiKey) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            <p className="text-muted-foreground mt-4 text-sm">
              Rotating API key...
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (newApiKey) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-green-500" />
              API Key Rotated Successfully
            </DialogTitle>
            <DialogDescription>
              Copy and save this new API key now. You won&apos;t be able to see
              it again. The old API key has been revoked.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="bg-muted rounded-lg p-4">
              <Label className="text-muted-foreground mb-2 block text-xs">
                New API Key
              </Label>
              <div className="flex items-center gap-2">
                <code className="bg-background flex-1 rounded border p-2 font-mono text-sm break-all">
                  {newApiKey}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopyApiKey}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          </DialogFooter>
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
            Rotate API Key
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              Are you sure you want to rotate the API key for user{" "}
              <strong>&quot;{userId}&quot;</strong>? Any applications using the
              old key will lose access.
            </p>
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRotate();
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
              disabled={isRotating}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isRotating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isRotating || !isConfirmed}>
              {isRotating ? "Rotating..." : "Rotate API Key"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
