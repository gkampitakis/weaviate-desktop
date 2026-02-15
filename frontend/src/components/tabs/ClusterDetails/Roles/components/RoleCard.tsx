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
  MoreVertical,
  Trash2,
  Shield,
  Database,
  Server,
  Users,
  FolderArchive,
  Copy,
  Layers,
  Eye,
  Pencil,
} from "lucide-react";
import { useState } from "react";
import { weaviate } from "wailsjs/go/models";
import { DeleteRoleDialog } from "./DeleteRoleDialog";
import { RoleDialog, RoleDialogMode } from "./RoleDialog";

interface Props {
  role: weaviate.w_Role;
  connectionID: number;
}

// Count total permissions across all permission types
const countPermissions = (role: weaviate.w_Role): number => {
  let count = 0;
  if (role.backups) count += role.backups.length;
  if (role.cluster) count += role.cluster.length;
  if (role.collections) count += role.collections.length;
  if (role.data) count += role.data.length;
  if (role.nodes) count += role.nodes.length;
  if (role.roles) count += role.roles.length;
  if (role.replicate) count += role.replicate.length;
  if (role.alias) count += role.alias.length;
  if (role.tenants) count += role.tenants.length;
  if (role.users) count += role.users.length;
  return count;
};

// Get permission categories that have permissions
const getPermissionCategories = (
  role: weaviate.w_Role
): { name: string; count: number; icon: React.ReactNode }[] => {
  const categories: { name: string; count: number; icon: React.ReactNode }[] =
    [];

  if (role.collections && role.collections.length > 0) {
    categories.push({
      name: "Collections",
      count: role.collections.length,
      icon: <Database className="h-3 w-3" />,
    });
  }
  if (role.data && role.data.length > 0) {
    categories.push({
      name: "Data",
      count: role.data.length,
      icon: <Layers className="h-3 w-3" />,
    });
  }
  if (role.backups && role.backups.length > 0) {
    categories.push({
      name: "Backups",
      count: role.backups.length,
      icon: <FolderArchive className="h-3 w-3" />,
    });
  }
  if (role.cluster && role.cluster.length > 0) {
    categories.push({
      name: "Cluster",
      count: role.cluster.length,
      icon: <Server className="h-3 w-3" />,
    });
  }
  if (role.nodes && role.nodes.length > 0) {
    categories.push({
      name: "Nodes",
      count: role.nodes.length,
      icon: <Server className="h-3 w-3" />,
    });
  }
  if (role.users && role.users.length > 0) {
    categories.push({
      name: "Users",
      count: role.users.length,
      icon: <Users className="h-3 w-3" />,
    });
  }
  if (role.roles && role.roles.length > 0) {
    categories.push({
      name: "Roles",
      count: role.roles.length,
      icon: <Shield className="h-3 w-3" />,
    });
  }
  if (role.tenants && role.tenants.length > 0) {
    categories.push({
      name: "Tenants",
      count: role.tenants.length,
      icon: <Users className="h-3 w-3" />,
    });
  }
  if (role.replicate && role.replicate.length > 0) {
    categories.push({
      name: "Replicate",
      count: role.replicate.length,
      icon: <Copy className="h-3 w-3" />,
    });
  }
  if (role.alias && role.alias.length > 0) {
    categories.push({
      name: "Alias",
      count: role.alias.length,
      icon: <Database className="h-3 w-3" />,
    });
  }

  return categories;
};

export function RoleCard({ role, connectionID }: Props) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleDialogMode, setRoleDialogMode] = useState<RoleDialogMode>("view");
  const [isExpanded, setIsExpanded] = useState(false);

  const isBuiltInRole = role.name === "admin" || role.name === "viewer";

  const openRoleDialog = (mode: RoleDialogMode) => {
    setRoleDialogMode(mode);
    setRoleDialogOpen(true);
  };

  const totalPermissions = countPermissions(role);
  const categories = getPermissionCategories(role);
  const visibleCategories = isExpanded ? categories : categories.slice(0, 5);
  const hasMore = categories.length > 5;

  return (
    <Card className="p-4 transition-shadow hover:shadow-md">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Shield className="text-muted-foreground h-4 w-4" />
            <h3 className="truncate text-sm font-semibold">{role.name}</h3>
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
                onClick={() => {
                  setIsDropdownOpen(false);
                  openRoleDialog("view");
                }}
              >
                <Eye className="h-4 w-4" />
                View Permissions
              </DropdownMenuItem>
              {!isBuiltInRole && (
                <DropdownMenuItem
                  onClick={() => {
                    setIsDropdownOpen(false);
                    openRoleDialog("edit");
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {!isBuiltInRole && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Role
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {totalPermissions} permission{totalPermissions !== 1 ? "s" : ""}
          </Badge>
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {visibleCategories.map((category) => (
              <Badge
                key={category.name}
                variant="outline"
                className="gap-1 text-xs"
              >
                {category.icon}
                {category.name} ({category.count})
              </Badge>
            ))}
            {hasMore && (
              <Badge
                variant="outline"
                className="hover:bg-secondary cursor-pointer text-xs"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? "Show less" : `+${categories.length - 5} more`}
              </Badge>
            )}
          </div>
        )}

        {categories.length === 0 && (
          <p className="text-muted-foreground text-xs">
            No permissions defined
          </p>
        )}
      </div>
      <RoleDialog
        open={roleDialogOpen}
        onOpenChange={setRoleDialogOpen}
        connectionID={connectionID}
        mode={roleDialogMode}
        role={role}
      />
      <DeleteRoleDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        roleName={role.name}
        connectionID={connectionID}
      />
    </Card>
  );
}
