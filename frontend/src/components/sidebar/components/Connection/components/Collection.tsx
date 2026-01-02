import { InnerTabs } from "@/components/tabs/Collection/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { Collection } from "@/types";
import {
  Box,
  Boxes,
  Ellipsis,
  SquareArrowOutUpRight,
  Trash,
} from "lucide-react";
import { useState } from "react";

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

  const Icon = collection.multiTenancyConfig?.enabled ? (
    <Boxes size="1.1em" className="mr-2 flex-shrink-0" />
  ) : (
    <Box size="1.1em" className="mr-2 flex-shrink-0" />
  );

  return (
    <DropdownMenu>
      <div
        className={`relative flex cursor-pointer items-center justify-between pr-3 ${color}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => onClick(collection)}
      >
        <div className="flex flex-row py-2 pl-13 text-xs">
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
          <DropdownMenuItem variant="destructive">
            <Trash /> Delete (unimplemented)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </div>
    </DropdownMenu>
  );
};

export default Collection;
