import { useForm, Controller } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { errorReporting } from "@/lib/utils";
import {
  AssignRolesToUser,
  CreateUser,
  ListRoles,
} from "wailsjs/go/weaviate/Weaviate";
import { rolesQueryKey, usersQueryKey } from "../constants";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Copy, KeyRound, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userIDs: string[];
  connectionID: number;
}

interface FormData {
  userId: string;
  roleNames: string[];
}

export function CreateUserDialog({
  open,
  onOpenChange,
  userIDs,
  connectionID,
}: Props) {
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormData>({
    defaultValues: {
      userId: "",
      roleNames: [],
    },
  });
  const queryClient = useQueryClient();

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

  const onSubmit = async (data: FormData) => {
    try {
      const apiKey = await CreateUser(connectionID, data.userId);
      setCreatedApiKey(apiKey);

      if (data.roleNames.length > 0) {
        await AssignRolesToUser(
          connectionID,
          data.userId,
          data.roleNames
        ).catch((error) => {
          errorReporting(`User created but failed to assign roles: ${error}`);
        });
      }

      await queryClient.invalidateQueries({
        queryKey: usersQueryKey(connectionID),
      });
    } catch (error) {
      errorReporting(`Failed to create user: ${error}`);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Delay reset to avoid flash when closing
      setTimeout(() => {
        reset();
        setCreatedApiKey(null);
        setCopied(false);
      }, 150);
    }
    onOpenChange(newOpen);
  };

  const handleCopyApiKey = async () => {
    if (createdApiKey) {
      await navigator.clipboard.writeText(createdApiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isSubmitting) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            <p className="text-muted-foreground mt-4 text-sm">
              Creating user...
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (createdApiKey) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-green-500" />
              User Created Successfully
            </DialogTitle>
            <DialogDescription>
              Copy and save this API key now. You won't be able to see it again.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="bg-muted rounded-lg p-4">
              <Label className="text-muted-foreground mb-2 block text-xs">
                API Key
              </Label>
              <div className="flex items-center gap-2">
                <code className="bg-background flex-1 rounded border p-2 font-mono text-sm break-all">
                  {createdApiKey}
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="user-id">
              Username <span className="text-destructive">*</span>
            </Label>
            <Controller
              name="userId"
              control={control}
              rules={{
                required: "User name is required",
                pattern: {
                  value: /^[a-zA-Z0-9_-]+$/,
                  message:
                    "Only letters, numbers, underscore, and minus characters are allowed",
                },
                validate: (value) => {
                  if (userIDs.includes(value)) {
                    return "A user with this username already exists";
                  }
                  return true;
                },
              }}
              render={({ field }) => (
                <Input
                  {...field}
                  id="user-id"
                  placeholder="Enter username"
                  className={errors.userId ? "border-destructive" : ""}
                />
              )}
            />
            {errors.userId && (
              <p className="text-destructive text-sm">
                {errors.userId.message}
              </p>
            )}
            <p className="text-muted-foreground text-xs">
              This will be the user's unique identifier
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="roles">Roles (Optional)</Label>
            <Controller
              name="roleNames"
              control={control}
              render={({ field }) => (
                <MultiSelect
                  options={roleOptions}
                  selected={field.value}
                  onChange={field.onChange}
                  placeholder={
                    isLoadingRoles ? "Loading roles..." : "Select roles..."
                  }
                  emptyText="No roles available"
                  disabled={isLoadingRoles}
                />
              )}
            />
            <p className="text-muted-foreground text-xs">
              Assign roles to this user. You can also assign roles later.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
