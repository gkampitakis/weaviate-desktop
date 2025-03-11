import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Connection as ConnectionI } from "@/types/index";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { Connection } from "./Connection";
import { useDebouncedCallback } from "use-debounce";
import { useFuzzySearchList } from "@nozbe/microfuzz/react";
import { NewConnection } from "./NewConnection";

interface SidebarProps {
  connections: ConnectionI[];
}

// FIXME: put starred connection on top

const Sidebar: React.FC<SidebarProps> = ({ connections }) => {
  const [search, setSearch] = useState("");
  const [openNewConnection, setOpenConnection] = useState(false);

  const filteredList = useFuzzySearchList({
    list: connections,
    queryText: search,
    getText: (item) => [item.name],
    mapResultItem: ({ item }) => item,
  });

  const handleSearch = useDebouncedCallback((value: string) => {
    setSearch(value);
  }, 300);

  return (
    <div className="h-screen min-w-64 bg-gray-100 border-r border-gray-200 text-gray-700 left-0 top-0 flex-1 flex-col">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold">Weaviate</h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="flex flex-column justify-between items-center">
            <h2 className="text-sm font-semibold text-gray-500 my-3">
              Connections ({connections.length})
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full hover:bg-gray-200"
              onClick={() => setOpenConnection(true)}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <Input
            type="search"
            placeholder="Search connections"
            defaultValue={search}
            className="p4 rounded-none bg-white"
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        {filteredList.map((connection) => (
          <Connection key={connection.id} connection={connection} />
        ))}
        <NewConnection open={openNewConnection} setOpen={setOpenConnection} />
      </div>
    </div>
  );
};

export default Sidebar;
