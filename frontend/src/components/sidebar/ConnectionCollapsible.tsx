import { Button } from "@/components/ui/button";
import {
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { useTabStore } from "@/store/tab-store";
import { ChevronRight, Database } from "lucide-react";
import TabLabel from "../tabs/TabLabel";
import type { Collection } from "@/types";
import { useShallow } from "zustand/shallow";

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
  const { updateActiveTab, add, nextIndex, setActiveTab, tabs } = useTabStore(
    useShallow((state) => ({
      updateActiveTab: state.updateActiveTab,
      add: state.add,
      tabs: state.tabs,
      nextIndex: state.nextIndex,
      setActiveTab: state.setActive,
    }))
  );

  const handleClick = ({ name, connectionID }: Collection) => {
    if (tabs.length) {
      updateActiveTab({
        label: <TabLabel>{name}</TabLabel>,
        children: <div>Content of new collection {name}</div>,
        connectionID,
      });

      return;
    }

    const newTabIndex = nextIndex().toString();

    add({
      label: <TabLabel>{name}</TabLabel>,
      key: newTabIndex,
      children: <div>Content of new collection {name}</div>,
    });

    setActiveTab(newTabIndex);
  };

  return (
    <CollapsibleContent>
      {collections?.map((collection, idx) => (
        <div
          key={idx}
          className="text-xs pl-13 py-2 flex flex-row cursor-pointer hover:bg-gray-200"
          onClick={() => handleClick(collection)}
        >
          <Database size="1.1em" className="mr-2 flex-shrink-0" />
          {collection.name}
        </div>
      ))}
    </CollapsibleContent>
  );
};
