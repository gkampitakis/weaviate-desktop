import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";
import { ConnectionDetails } from "./components/Connection/ConnectionDetails";
import { useConnectionStore } from "@/store/connection-store";
import { Connection } from "./components/Connection/Connection";
import { VersionManager } from "./components/VersionManager";
import logo from "@/assets/images/weaviate-logo.png";
import { connectionSearch } from "@/lib/connection-search";
import { Button } from "@/components/ui/button";

const Sidebar: React.FC = () => {
  const [search, setSearch] = useState("");
  const [openNewConnection, setOpenConnection] = useState(false);
  const connections = connectionSearch(
    useConnectionStore((state) => state.connections),
    search
  );

  const handleSearch = useDebouncedCallback((value: string) => {
    setSearch(value);
  }, 300);

  return (
    <>
      <div className="flex justify-center border-b border-gray-200 p-4">
        <img
          src={logo}
          className="pointer-events-none w-[200px] select-none"
          alt="Weaviate log"
        />
      </div>
      <div className="p-4">
        <div className="flex-column flex items-center justify-between">
          <h2 className="my-3 text-sm font-semibold text-gray-500">
            Connections ({connections.length})
          </h2>
          <Button
            variant="outline"
            size="icon"
            className="br-[10px] h-[24px] w-[24px]"
            onClick={() => setOpenConnection(true)}
          >
            <Plus />
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
      <div className="flex-1 overflow-y-auto">
        {connections.map((connection) => (
          <Connection key={connection.id} connection={connection} />
        ))}
      </div>
      <VersionManager />
      <ConnectionDetails open={openNewConnection} setOpen={setOpenConnection} />
    </>
  );
};

export default Sidebar;
