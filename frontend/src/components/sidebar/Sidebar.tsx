import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";
import { NewConnection } from "./NewConnection";
import { useConnectionStore } from "@/store/connection-store";
import { Connection } from "./Connection";
import logo from "@/assets/images/weaviate-logo.png";
import Fuse from "fuse.js";

const Sidebar: React.FC = () => {
  const connections = useConnectionStore((state) => state.connections);
  const [search, setSearch] = useState("");
  const [openNewConnection, setOpenConnection] = useState(false);

  const fuse = new Fuse(connections, {
    keys: ["name", "collections.name"],
    threshold: 0.3, // Adjust for sensitivity
  });

  const filteredList = !search
    ? connections
    : fuse.search(search).map(({ item }) => {
        if (!item.collections) {
          return item;
        }

        // Filter collections to only include matching ones
        const collectionFuse = new Fuse(item.collections, {
          keys: ["name"],
          threshold: 0.3,
        });

        const filteredCollections = collectionFuse
          .search(search)
          .map((res) => res.item);

        return {
          ...item,
          collections: filteredCollections, // Replace with filtered collections
        };
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
          <Plus
            size={"1.6em"}
            className="cursor-pointer p-1 rounded-full hover:bg-gray-200 transition"
            onClick={() => setOpenConnection(true)}
          />
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
      <div className="overflow-y-auto flex-1">
        {filteredList.map((connection) => (
          <Connection key={connection.id} connection={connection} />
        ))}
      </div>
      <NewConnection open={openNewConnection} setOpen={setOpenConnection} />
    </>
  );
};

export default Sidebar;
