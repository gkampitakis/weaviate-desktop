import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";
import { useFuzzySearchList } from "@nozbe/microfuzz/react";
import { NewConnection } from "./NewConnection";
import { useConnectionStore } from "@/store/connection-store";
import { Connection } from "./Connection";
import type { Connection as ConnectionI } from "@/types";
import logo from "@/assets/images/weaviate-logo.png";

const sortConnections = (a: ConnectionI, b: ConnectionI) => {
  if (a.favorite && !b.favorite) {
    return -1;
  }
  if (!a.favorite && b.favorite) {
    return 1;
  }

  return a.name.localeCompare(b.name, undefined, { numeric: true });
};

const Sidebar: React.FC = () => {
  const connections = useConnectionStore((state) => state.connections);
  const [search, setSearch] = useState("");
  const [openNewConnection, setOpenConnection] = useState(false);

  const filteredList = useFuzzySearchList({
    list: connections.sort(sortConnections),
    queryText: search,
    getText: (item) => [item.name],
    mapResultItem: ({ item }) => item,
  });

  const handleSearch = useDebouncedCallback((value: string) => {
    setSearch(value);
  }, 300);

  return (
    <>
      <div className="p-4 border-b border-gray-200 flex justify-center">
        <img
          src={logo}
          className="w-[200px] select-none pointer-events-none"
          alt="Weaviate log"
        />
      </div>
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
          autoComplete="off"
          defaultValue={search}
          className="p4 rounded-none bg-white"
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>
      {filteredList.map((connection) => (
        <Connection key={connection.id} connection={connection} />
      ))}
      <NewConnection open={openNewConnection} setOpen={setOpenConnection} />
    </>
  );
};

export default Sidebar;
