import { Button } from "@/components/ui/button";
import {
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { useTabStore } from "@/store/tab-store";
import { ChevronRight } from "lucide-react";
import CollectionTabLabel from "../../../tabs/components/CollectionTabLabel";
import type { Collection } from "@/types";
import { useShallow } from "zustand/shallow";
import CollectionTab from "../../../tabs/Collection/HOCollection";
import { useQueryClient } from "@tanstack/react-query";
import { isGeneralTab } from "../../../tabs/util";
import CollectionComponent from "./components/Collection";
import { InnerTabs } from "@/components/tabs/Collection/types";

export const ConnectionCollapsibleTrigger: React.FC<{
  connected: boolean;
  open: boolean;
  color: string;
}> = ({ connected, color, open }) => (
  <CollapsibleTrigger asChild disabled={!connected}>
    <Button variant="ghost" className={`${color} !pr-0`} size="sm">
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
  color: string;
}> = ({ collections, color }) => {
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

      if (collection.multiTenancyConfig?.enabled && !isGeneralTab(activeTab)) {
        await queryClient.resetQueries({
          queryKey: ["tenants", activeTab.connection!.id, activeTab.name],
        });

        await queryClient.resetQueries({
          queryKey: ["objects", activeTab.connection!.id, activeTab.name],
        });
      }

      updateActiveTab({
        label: (
          <CollectionTabLabel
            name={collection.name}
            connectionName={collection.connection.name}
            connectionID={collection.connection.id}
            color={collection.connection.color}
            tooltip
          />
        ),
        connection: collection.connection,
        children: <CollectionTab collection={collection} />,
        name: collection.name,
      });

      return;
    }

    handleAddNewTab(collection);
  };

  const handleAddNewTab = (
    collection: Collection,
    selectedInnerTab?: InnerTabs
  ) => {
    add({
      label: (
        <CollectionTabLabel
          name={collection.name}
          connectionName={collection.connection.name}
          connectionID={collection.connection.id}
          color={collection.connection.color}
          tooltip
        />
      ),
      connection: collection.connection,
      children: (
        <CollectionTab collection={collection} selectedTab={selectedInnerTab} />
      ),
      name: collection.name,
    });
  };

  return (
    <CollapsibleContent>
      {collections?.map((collection, idx) => (
        <CollectionComponent
          addNewTab={handleAddNewTab}
          key={idx}
          onClick={handleClick}
          collection={collection}
          color={color}
        />
      ))}
    </CollapsibleContent>
  );
};
