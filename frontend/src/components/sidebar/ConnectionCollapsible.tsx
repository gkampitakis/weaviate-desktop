import { Button } from "@/components/ui/button";
import {
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { useTabStore } from "@/store/tab-store";
import { Box, Boxes, ChevronRight } from "lucide-react";
import TabLabel from "../tabs/components/TabLabel";
import type { Collection } from "@/types";
import { useShallow } from "zustand/shallow";
import CollectionTab from "../tabs/Collection/HOCollection";

export const ConnectionCollapsibleTrigger: React.FC<{
  connected: boolean;
  open: boolean;
}> = ({ connected, open }) => (
  <CollapsibleTrigger asChild disabled={!connected}>
    <Button variant="ghost" className="!pr-0" size="sm">
      <ChevronRight
        size={"1.1em"}
        className={`transition-transform duration-300 ${
          open ? "rotate-90" : ""
        }`}
      />
    </Button>
  </CollapsibleTrigger>
);

export const ConnectionCollapsibleContent: React.FC<{
  collections?: Collection[];
}> = ({ collections }) => {
  const { updateActiveTab, add, tabs } = useTabStore(
    useShallow((state) => ({
      updateActiveTab: state.updateActiveTab,
      add: state.add,
      tabs: state.tabs,
    }))
  );

  const handleClick = (collection: Collection) => {
    if (tabs.length) {
      updateActiveTab({
        label: <TabLabel>{collection.name}</TabLabel>,
        connectionID: collection.connectionID,
        children: <CollectionTab collection={collection} />,
      });

      return;
    }

    add({
      label: <TabLabel>{collection.name}</TabLabel>,
      connectionID: collection.connectionID,
      children: <CollectionTab collection={collection} />,
    });
  };

  return (
    <CollapsibleContent>
      {collections?.map((collection, idx) => (
        <div
          key={idx}
          className="text-xs pl-13 py-2 flex flex-row cursor-pointer hover:bg-gray-200"
          onClick={() => handleClick(collection)}
        >
          {collection.multiTenancyConfig?.enabled ? (
            <Boxes size="1.1em" className="mr-2 flex-shrink-0" />
          ) : (
            <Box size="1.1em" className="mr-2 flex-shrink-0" />
          )}
          {collection.name}
        </div>
      ))}
    </CollapsibleContent>
  );
};
