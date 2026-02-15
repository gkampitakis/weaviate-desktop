import { useForm, useFieldArray, Controller } from "react-hook-form";
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
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { errorReporting } from "@/lib/utils";
import {
  CreateRole,
  GetCollections,
  AddRolePermissions,
  RemoveRolePermissions,
} from "wailsjs/go/weaviate/Weaviate";
import { weaviate } from "wailsjs/go/models";
import { rolesQueryKey } from "../constants";
import { collectionsQueryKey } from "../../Backups/constants";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import {
  ChevronRight,
  Database,
  Server,
  Users,
  FolderArchive,
  Copy,
  Layers,
  Shield,
  Link,
  Plus,
  Trash2,
  Loader2,
  Eye,
  Pencil,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type RoleDialogMode = "view" | "create" | "edit";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionID: number;
  mode: RoleDialogMode;
  role?: weaviate.w_Role;
}

// Permission type definitions with their available actions and scope fields
interface ScopeField {
  key: string;
  label: string;
  placeholder: string;
  options?: readonly string[];
}

interface PermissionTypeConfig {
  label: string;
  icon: typeof Database;
  actions: readonly string[];
  scopeFields: readonly ScopeField[];
}

const PERMISSION_TYPES: Record<string, PermissionTypeConfig> = {
  collections: {
    label: "Collections",
    icon: Database,
    actions: [
      "create_collections",
      "read_collections",
      "update_collections",
      "delete_collections",
    ],
    scopeFields: [{ key: "collection", label: "Collection", placeholder: "*" }],
  },
  data: {
    label: "Data",
    icon: Layers,
    actions: ["create_data", "read_data", "update_data", "delete_data"],
    scopeFields: [{ key: "collection", label: "Collection", placeholder: "*" }],
  },
  backups: {
    label: "Backups",
    icon: FolderArchive,
    actions: ["manage_backups"],
    scopeFields: [{ key: "collection", label: "Collection", placeholder: "*" }],
  },
  cluster: {
    label: "Cluster",
    icon: Server,
    actions: ["read_cluster"],
    scopeFields: [],
  },
  nodes: {
    label: "Nodes",
    icon: Server,
    actions: ["read_nodes"],
    scopeFields: [
      { key: "collection", label: "Collection", placeholder: "*" },
      {
        key: "verbosity",
        label: "Verbosity",
        placeholder: "verbose",
        options: ["minimal", "verbose"],
      },
    ],
  },
  users: {
    label: "Users",
    icon: Users,
    actions: ["read_users", "assign_and_revoke_users"],
    scopeFields: [],
  },
  roles: {
    label: "Roles",
    icon: Shield,
    actions: ["create_roles", "read_roles", "update_roles", "delete_roles"],
    scopeFields: [
      { key: "role", label: "Role", placeholder: "*" },
      {
        key: "scope",
        label: "Scope",
        placeholder: "matching",
        options: ["matching", "all"],
      },
    ],
  },
  tenants: {
    label: "Tenants",
    icon: Users,
    actions: ["create_tenants", "read_tenants"],
    scopeFields: [],
  },
  replicate: {
    label: "Replicate",
    icon: Copy,
    actions: ["read_replicate", "update_replicate"],
    scopeFields: [
      { key: "collection", label: "Collection", placeholder: "*" },
      { key: "shard", label: "Shard", placeholder: "*" },
    ],
  },
  alias: {
    label: "Aliases",
    icon: Link,
    actions: ["read_aliases", "update_aliases"],
    scopeFields: [
      { key: "alias", label: "Alias", placeholder: "*" },
      { key: "collection", label: "Collection", placeholder: "*" },
    ],
  },
};

type PermissionType = keyof typeof PERMISSION_TYPES;

interface PermissionEntry {
  actions: string[];
  scope: Record<string, string>;
}

interface FormData {
  name: string;
  permissions: Record<PermissionType, PermissionEntry[]>;
}

const defaultPermissions: FormData["permissions"] = {
  collections: [],
  data: [],
  backups: [],
  cluster: [],
  nodes: [],
  users: [],
  roles: [],
  tenants: [],
  replicate: [],
  alias: [],
};

// Convert role permissions to form data format
function roleToFormData(role: weaviate.w_Role): FormData {
  const permissions: FormData["permissions"] = { ...defaultPermissions };

  if (role.collections) {
    permissions.collections = role.collections.map((p) => ({
      actions: p.actions || [],
      scope: { collection: p.collection || "*" },
    }));
  }
  if (role.data) {
    permissions.data = role.data.map((p) => ({
      actions: p.actions || [],
      scope: { collection: p.collection || "*" },
    }));
  }
  if (role.backups) {
    permissions.backups = role.backups.map((p) => ({
      actions: p.actions || [],
      scope: { collection: p.collection || "*" },
    }));
  }
  if (role.cluster) {
    permissions.cluster = role.cluster.map((p) => ({
      actions: p.actions || [],
      scope: {},
    }));
  }
  if (role.nodes) {
    permissions.nodes = role.nodes.map((p) => ({
      actions: p.actions || [],
      scope: {
        collection: p.collection || "*",
        verbosity: p.verbosity || "verbose",
      },
    }));
  }
  if (role.users) {
    permissions.users = role.users.map((p) => ({
      actions: p.actions || [],
      scope: {},
    }));
  }
  if (role.roles) {
    permissions.roles = role.roles.map((p) => ({
      actions: p.actions || [],
      scope: { role: p.role || "*", scope: p.scope || "matching" },
    }));
  }
  if (role.tenants) {
    permissions.tenants = role.tenants.map((p) => ({
      actions: p.actions || [],
      scope: {},
    }));
  }
  if (role.replicate) {
    permissions.replicate = role.replicate.map((p) => ({
      actions: p.actions || [],
      scope: { collection: p.collection || "*", shard: p.shard || "*" },
    }));
  }
  if (role.alias) {
    permissions.alias = role.alias.map((p) => ({
      actions: p.actions || [],
      scope: { alias: p.alias || "*", collection: p.collection || "*" },
    }));
  }

  return {
    name: role.name || "",
    permissions,
  };
}

// Convert form data to role format
function formDataToRole(data: FormData): weaviate.w_Role {
  const roleInput = {
    name: data.name,
    collections: data.permissions.collections
      .filter((p) => p.actions.length > 0)
      .map((p) => ({
        actions: p.actions,
        collection: p.scope.collection || "*",
      })),
    data: data.permissions.data
      .filter((p) => p.actions.length > 0)
      .map((p) => ({
        actions: p.actions,
        collection: p.scope.collection || "*",
      })),
    backups: data.permissions.backups
      .filter((p) => p.actions.length > 0)
      .map((p) => ({
        actions: p.actions,
        collection: p.scope.collection || "*",
      })),
    cluster: data.permissions.cluster
      .filter((p) => p.actions.length > 0)
      .map((p) => ({ actions: p.actions })),
    nodes: data.permissions.nodes
      .filter((p) => p.actions.length > 0)
      .map((p) => ({
        actions: p.actions,
        collection: p.scope.collection || "*",
        verbosity: p.scope.verbosity || "verbose",
      })),
    users: data.permissions.users
      .filter((p) => p.actions.length > 0)
      .map((p) => ({ actions: p.actions })),
    roles: data.permissions.roles
      .filter((p) => p.actions.length > 0)
      .map((p) => ({
        actions: p.actions,
        role: p.scope.role || "*",
        scope: p.scope.scope || "match",
      })),
    tenants: data.permissions.tenants
      .filter((p) => p.actions.length > 0)
      .map((p) => ({ actions: p.actions })),
    replicate: data.permissions.replicate
      .filter((p) => p.actions.length > 0)
      .map((p) => ({
        actions: p.actions,
        collection: p.scope.collection || "*",
        shard: p.scope.shard || "*",
      })),
    alias: data.permissions.alias
      .filter((p) => p.actions.length > 0)
      .map((p) => ({
        actions: p.actions,
        alias: p.scope.alias || "*",
        collection: p.scope.collection || "*",
      })),
  };

  return weaviate.w_Role.createFrom(roleInput);
}

// Compare two permission entries to check if they are the same
function permissionEntryEquals(
  a: PermissionEntry,
  b: PermissionEntry
): boolean {
  if (a.actions.length !== b.actions.length) return false;
  const sortedA = [...a.actions].sort();
  const sortedB = [...b.actions].sort();
  if (!sortedA.every((v, i) => v === sortedB[i])) return false;

  const aKeys = Object.keys(a.scope).sort();
  const bKeys = Object.keys(b.scope).sort();
  if (aKeys.length !== bKeys.length) return false;
  if (!aKeys.every((k, i) => k === bKeys[i])) return false;
  return aKeys.every((k) => (a.scope[k] || "*") === (b.scope[k] || "*"));
}

// Calculate diff between original and new permissions
function calculatePermissionsDiff(
  original: FormData["permissions"],
  updated: FormData["permissions"]
): { added: FormData["permissions"]; removed: FormData["permissions"] } {
  const added: FormData["permissions"] = { ...defaultPermissions };
  const removed: FormData["permissions"] = { ...defaultPermissions };

  for (const type of Object.keys(PERMISSION_TYPES) as PermissionType[]) {
    const origPerms = original[type] || [];
    const newPerms = updated[type] || [];

    // Find added permissions (in new but not in original)
    added[type] = newPerms.filter(
      (newPerm) =>
        newPerm.actions.length > 0 &&
        !origPerms.some((origPerm) => permissionEntryEquals(origPerm, newPerm))
    );

    // Find removed permissions (in original but not in new)
    removed[type] = origPerms.filter(
      (origPerm) =>
        origPerm.actions.length > 0 &&
        !newPerms.some((newPerm) => permissionEntryEquals(origPerm, newPerm))
    );
  }

  return { added, removed };
}

interface PermissionSectionProps {
  type: PermissionType;
  control: ReturnType<typeof useForm<FormData>>["control"];
  errors: ReturnType<typeof useForm<FormData>>["formState"]["errors"];
  collections: string[];
  usedCollections: string[];
  readOnly: boolean;
}

function PermissionSection({
  type,
  control,
  errors,
  collections,
  usedCollections,
  readOnly,
}: PermissionSectionProps) {
  const config = PERMISSION_TYPES[type];
  const Icon = config.icon;

  const { fields, append, remove } = useFieldArray({
    control,
    name: `permissions.${type}`,
  });

  // For readOnly mode, auto-open sections that have permissions
  const [isOpen, setIsOpen] = useState(() => false);

  const addPermission = () => {
    const defaultScope: Record<string, string> = {};
    config.scopeFields.forEach((field) => {
      defaultScope[field.key] = "";
    });
    append({ actions: [], scope: defaultScope });
    setIsOpen(true);
  };

  // Compute effective open state: in readOnly mode, sections with fields are always open
  const effectiveIsOpen = (readOnly && fields.length > 0) || isOpen;

  if (readOnly && fields.length === 0) {
    return null;
  }

  return (
    <Collapsible open={effectiveIsOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="hover:bg-secondary/50 flex w-full items-center gap-2 rounded-md p-2 transition-colors">
        <ChevronRight
          className={`h-4 w-4 transition-transform ${effectiveIsOpen ? "rotate-90" : ""}`}
        />
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className="font-medium">{config.label}</span>
        </span>
        {fields.length > 0 && (
          <Badge variant="secondary" className="ml-auto text-xs">
            {fields.length}
          </Badge>
        )}
        {!readOnly && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation();
              addPermission();
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1 pl-6">
        <div className="border-muted space-y-2 border-l-2 py-2 pl-4">
          {fields.length === 0 ? (
            <p className="text-muted-foreground py-2 text-sm">
              No permissions added. Click + to add one.
            </p>
          ) : (
            fields.map((field, index) => (
              <div
                key={field.id}
                className="bg-muted/50 space-y-3 rounded-md p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-3">
                    {/* Actions */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Actions</Label>
                      <Controller
                        control={control}
                        name={`permissions.${type}.${index}.actions`}
                        rules={
                          !readOnly
                            ? { required: "Select at least one action" }
                            : undefined
                        }
                        render={({ field: actionField }) => (
                          <div className="flex flex-wrap gap-1">
                            {config.actions.map((action) => {
                              const isSelected =
                                actionField.value?.includes(action);
                              return (
                                <Badge
                                  key={action}
                                  variant={isSelected ? "default" : "outline"}
                                  className={`text-xs ${!readOnly ? "cursor-pointer" : ""}`}
                                  onClick={() => {
                                    if (readOnly) return;
                                    if (isSelected) {
                                      actionField.onChange(
                                        actionField.value.filter(
                                          (a: string) => a !== action
                                        )
                                      );
                                    } else {
                                      actionField.onChange([
                                        ...(actionField.value || []),
                                        action,
                                      ]);
                                    }
                                  }}
                                >
                                  {action}
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      />
                      {errors.permissions?.[type]?.[index]?.actions && (
                        <p className="text-xs text-red-500">
                          {errors.permissions[type]?.[index]?.actions?.message}
                        </p>
                      )}
                    </div>

                    {/* Scope fields */}
                    {config.scopeFields.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {config.scopeFields.map((scopeField) => (
                          <div key={scopeField.key} className="space-y-1">
                            <Label className="text-xs">
                              {scopeField.label}
                            </Label>
                            <Controller
                              control={control}
                              name={`permissions.${type}.${index}.scope.${scopeField.key}`}
                              render={({ field: inputField }) => {
                                if (readOnly) {
                                  return (
                                    <div className="bg-background rounded px-2 py-1 text-xs">
                                      <code>{inputField.value || "*"}</code>
                                    </div>
                                  );
                                }
                                // For collection fields, use a dropdown with available collections
                                if (scopeField.key === "collection") {
                                  // Filter out collections already used in other permissions
                                  const availableCollections =
                                    collections.filter(
                                      (c) =>
                                        !usedCollections.includes(c) ||
                                        c === inputField.value
                                    );
                                  return (
                                    <Select
                                      value={inputField.value || ""}
                                      onValueChange={inputField.onChange}
                                    >
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue
                                          placeholder={scopeField.placeholder}
                                        />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="*">
                                          * (All)
                                        </SelectItem>
                                        {availableCollections.map((c) => (
                                          <SelectItem key={c} value={c}>
                                            {c}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  );
                                }
                                // For fields with predefined options
                                if (scopeField.options) {
                                  return (
                                    <Select
                                      value={inputField.value || ""}
                                      onValueChange={inputField.onChange}
                                    >
                                      <SelectTrigger className="h-8 text-xs">
                                        <SelectValue
                                          placeholder={scopeField.placeholder}
                                        />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {scopeField.options.map((option) => (
                                          <SelectItem
                                            key={option}
                                            value={option}
                                          >
                                            {option}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  );
                                }
                                // Default to text input
                                return (
                                  <Input
                                    {...inputField}
                                    placeholder={scopeField.placeholder}
                                    className="h-8 text-xs"
                                  />
                                );
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 shrink-0 p-0 text-red-500 hover:text-red-600"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function RoleDialog({
  open,
  onOpenChange,
  connectionID,
  mode,
  role,
}: Props) {
  const isReadOnly = mode === "view";
  const isEdit = mode === "edit";
  const isCreate = mode === "create";

  const initialFormData = useMemo(() => {
    if (role && (isEdit || isReadOnly)) {
      return roleToFormData(role);
    }
    return {
      name: "",
      permissions: defaultPermissions,
    };
  }, [role, isEdit, isReadOnly]);

  const {
    control,
    handleSubmit,
    register,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<FormData>({
    defaultValues: initialFormData,
  });

  // Reset form when role changes or dialog opens
  useEffect(() => {
    if (open) {
      reset(initialFormData);
    }
  }, [open, initialFormData, reset]);

  const queryClient = useQueryClient();

  // Fetch collections when dialog is open
  const { data: collectionsData } = useQuery({
    queryKey: collectionsQueryKey(connectionID),
    queryFn: async () => {
      const classes = await GetCollections(connectionID);
      return classes.filter((c) => c.class).map((c) => c.class!);
    },
    enabled: open && !isReadOnly,
  });

  const collections = collectionsData || [];

  // Watch permissions to track used collections
  const permissions = watch("permissions");

  const onSubmit = async (data: FormData) => {
    try {
      if (isCreate) {
        const r = formDataToRole(data);
        await CreateRole(connectionID, r);
      } else if (isEdit && role) {
        // Calculate diff and apply changes
        const originalData = roleToFormData(role);
        const { added, removed } = calculatePermissionsDiff(
          originalData.permissions,
          data.permissions
        );

        // Remove permissions first
        const removedRole = formDataToRole({
          name: role.name,
          permissions: removed,
        });
        const hasRemovedPermissions = Object.values(removed).some(
          (perms) => perms.length > 0
        );
        if (hasRemovedPermissions) {
          await RemoveRolePermissions(connectionID, role.name, removedRole);
        }

        // Then add new permissions
        const addedRole = formDataToRole({
          name: role.name,
          permissions: added,
        });
        const hasAddedPermissions = Object.values(added).some(
          (perms) => perms.length > 0
        );
        if (hasAddedPermissions) {
          await AddRolePermissions(connectionID, role.name, addedRole);
        }
      }

      await queryClient.invalidateQueries({
        queryKey: rolesQueryKey(connectionID),
      });

      onOpenChange(false);
      reset();
    } catch (error) {
      errorReporting(
        `Failed to ${isCreate ? "create" : "update"} role: ${error}`
      );
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setTimeout(() => {
        reset();
      }, 200);
    }
    onOpenChange(newOpen);
  };

  const getTitle = () => {
    if (isCreate) return "Create New Role";
    if (isEdit) return `Edit: ${role?.name}`;
    return role?.name || "View Role";
  };

  const getIcon = () => {
    if (isCreate) return <Shield className="h-5 w-5" />;
    if (isEdit) return <Pencil className="h-5 w-5" />;
    return <Eye className="h-5 w-5" />;
  };

  const getDescription = () => {
    if (isCreate) return "Define a new role with custom permissions";
    if (isEdit) return "Modify role permissions";
    return undefined;
  };

  // Count total permissions for view mode
  const totalPermissions = Object.values(permissions).reduce(
    (acc, perms) => acc + perms.filter((p) => p.actions.length > 0).length,
    0
  );

  const permissionCategories = Object.keys(PERMISSION_TYPES).filter(
    (type) => (permissions[type as PermissionType] || []).length > 0
  ).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIcon()}
            {getTitle()}
          </DialogTitle>
          {getDescription() && (
            <DialogDescription>{getDescription()}</DialogDescription>
          )}
          {isReadOnly && (
            <p className="text-muted-foreground text-sm">
              {totalPermissions} permission{totalPermissions !== 1 ? "s" : ""}{" "}
              across {permissionCategories} categor
              {permissionCategories !== 1 ? "ies" : "y"}
            </p>
          )}
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="-mx-6 flex-1 space-y-4 overflow-y-auto px-6 py-2">
            {/* Role Name - only editable in create mode */}
            {isCreate && (
              <div className="space-y-2">
                <Label htmlFor="name">Role Name</Label>
                <Input
                  id="name"
                  placeholder="Enter role name"
                  {...register("name", {
                    required: "Role name is required",
                    pattern: {
                      value: /^[a-zA-Z0-9_-]+$/,
                      message:
                        "Role name can only contain letters, numbers, underscores, and hyphens",
                    },
                  })}
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>
            )}

            {/* Permissions */}
            <div className="space-y-2">
              {!isReadOnly && <Label>Permissions</Label>}
              <div
                className={`border-muted rounded-md ${!isReadOnly ? "border p-2" : ""}`}
              >
                {isReadOnly && totalPermissions === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Shield className="text-muted-foreground mb-4 h-12 w-12" />
                    <p className="text-muted-foreground">
                      No permissions defined for this role
                    </p>
                  </div>
                ) : (
                  (Object.keys(PERMISSION_TYPES) as PermissionType[]).map(
                    (type) => {
                      // Get collections already used in this permission type
                      const usedCollections = (permissions[type] || [])
                        .map((p) => p.scope?.collection || "*")
                        .filter((c): c is string => !!c);
                      return (
                        <PermissionSection
                          key={type}
                          type={type}
                          control={control}
                          errors={errors}
                          collections={collections}
                          usedCollections={usedCollections}
                          readOnly={isReadOnly}
                        />
                      );
                    }
                  )
                )}
              </div>
            </div>
          </div>

          {!isReadOnly && (
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isCreate ? "Create Role" : "Save Changes"}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
