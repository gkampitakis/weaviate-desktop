import React, { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Plus, ChevronsDownUp } from "lucide-react";
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
  const [collapseAll, setCollapseAll] = useState(false);
  const connections = connectionSearch(
    useConnectionStore((state) => state.connections),
    search
  );

  const triggerCollapseAll = useCallback(() => {
    if (collapseAll) return; // Prevent multiple triggers

    setCollapseAll(true);
    // Reset collapse flag after a short delay
    setTimeout(() => {
      setCollapseAll(false);
    }, 100);
  }, [collapseAll]);

  const handleSearch = useDebouncedCallback((value: string) => {
    setSearch(value);
  }, 300);

  return (
    <>
      <div className="flex justify-center border-b border-gray-200 p-4">
        <img
          src={logo}
          className="pointer-events-none w-[200px] select-none"
          alt="Weaviate logo"
        />
      </div>
      <div className="p-4">
        <div className="flex-column flex items-center justify-between">
          <h2 className="my-3 text-sm font-semibold text-gray-500">
            Connections ({connections.length})
          </h2>
          <div className="flex space-x-1">
            <Button
              variant="outline"
              size="icon"
              className="br-[10px] h-[24px] w-[24px]"
              onClick={triggerCollapseAll}
            >
              <ChevronsDownUp />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="br-[10px] h-[24px] w-[24px]"
              onClick={() => setOpenConnection(true)}
            >
              <Plus />
            </Button>
          </div>
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
          <Connection
            key={connection.id}
            connection={connection}
            collapse={collapseAll}
          />
        ))}
      </div>
      <VersionManager />
      <ConnectionDetails open={openNewConnection} setOpen={setOpenConnection} />
    </>
  );
};

export default Sidebar;
