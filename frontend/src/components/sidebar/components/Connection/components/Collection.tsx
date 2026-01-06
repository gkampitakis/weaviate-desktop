import { InnerTabs } from "@/components/tabs/Collection/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useConnectionStore } from "@/store/connection-store";
import { useTabStore } from "@/store/tab-store";
import type { Collection } from "@/types";
import {
  Box,
  Boxes,
  Ellipsis,
  SquareArrowOutUpRight,
  Trash,
} from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/shallow";
import { errorReporting } from "@/lib/utils";

interface Props {
  collection: Collection;
  color: string;
  onClick: (collection: Collection) => void;
  addNewTab: (collection: Collection, selectedInnerTab?: InnerTabs) => void;
}

const Collection: React.FC<Props> = ({
  onClick,
  addNewTab,
  collection,
  color,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { deleteCollection } = useConnectionStore(
    useShallow((state) => ({
      deleteCollection: state.deleteCollection,
    }))
  );
  const removeByConnectionAndCollection = useTabStore(
    (state) => state.removeByConnectionAndCollection
  );

  const Icon = collection.multiTenancyConfig?.enabled ? (
    <Boxes size="1.1em" className="mr-2 flex-shrink-0" />
  ) : (
    <Box size="1.1em" className="mr-2 flex-shrink-0" />
  );

  const handleCollectionDeletion = async () => {
    setIsDeleting(true);
    try {
      await deleteCollection(collection.connection.id, collection.name);
      removeByConnectionAndCollection(
        collection.connection.id,
        collection.name
      );
      setShowDeleteDialog(false);
    } catch (error) {
      errorReporting(error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <DropdownMenu>
      <div
        className={`relative flex items-center justify-between pr-3 ${color}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className="flex w-full cursor-pointer flex-row py-2 pl-13 text-xs"
          onClick={() => onClick(collection)}
        >
          {Icon}
          <span className="truncate">{collection.name}</span>
        </div>
        <DropdownMenuTrigger>
          <div
            className={`transform cursor-pointer rounded-full opacity-0 bg-${color}-300`}
            style={{ opacity: isHovered ? 1 : 0 }}
          >
            <Ellipsis className="h-4 w-4" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => addNewTab(collection)}>
            <SquareArrowOutUpRight /> Open in new tab
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => addNewTab(collection, "details")}>
            Details
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </div>
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Collection</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the collection &quot;
              {collection.name}&quot;? This action cannot be undone and all data
              will be permanently lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleCollectionDeletion}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DropdownMenu>
  );
};

export default Collection;
