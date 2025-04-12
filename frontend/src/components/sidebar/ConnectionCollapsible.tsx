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
import { useQueryClient } from "@tanstack/react-query";
import { WelcomeName } from "../tabs/Welcome";
import { NewTabName } from "../tabs/NewTab";

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
  const queryClient = useQueryClient();
  const { updateActiveTab, add, getActiveTab, tabs } = useTabStore(
    useShallow((state) => ({
      updateActiveTab: state.updateActiveTab,
      add: state.add,
      tabs: state.tabs,
      getActiveTab: state.getActiveTab,
    }))
  );

  const handleClick = async (collection: Collection) => {
    if (tabs.length) {
      const activeTab = getActiveTab()!;

      if (
        activeTab.connection?.id === collection.connection.id &&
        activeTab.name === collection.name
      ) {
        return;
      }

      if (
        collection.multiTenancyConfig?.enabled &&
        ![WelcomeName, NewTabName].includes(activeTab.name)
      ) {
        queryClient.resetQueries({
          queryKey: ["tenants", activeTab.connection!.id, activeTab.name],
        });
      }

      updateActiveTab({
        label: (
          <TabLabel
            name={collection.name}
            connectionName={collection.connection.name}
            tooltip
          />
        ),
        connection: collection.connection,
        children: <CollectionTab collection={collection} />,
        name: collection.name,
      });

      return;
    }

    add({
      label: (
        <TabLabel
          name={collection.name}
          connectionName={collection.connection.name}
          tooltip
        />
      ),
      connection: collection.connection,
      children: <CollectionTab collection={collection} />,
      name: collection.name,
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
