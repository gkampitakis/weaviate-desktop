import React, { useState, useCallback } from "react";
import { SearchInput } from "@/components/ui/search-input";
import { Plus, ChevronsDownUp, Network } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";
import { ConnectionDetails } from "./components/Connection/ConnectionDetails";
import { useConnectionStore } from "@/store/connection-store";
import { Connection } from "./components/Connection/Connection";
import { VersionManager } from "./components/VersionManager";
import logo from "@/assets/images/weaviate-logo.png";
import { connectionSearch } from "@/lib/connection-search";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const Sidebar: React.FC = () => {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [openNewConnection, setOpenConnection] = useState(false);
  const [collapseAll, setCollapseAll] = useState(false);
  const connections = connectionSearch(
    useConnectionStore((state) => state.connections),
    search
  );

  const triggerCollapseAll = useCallback(() => {
    if (collapseAll) return;

    setCollapseAll(true);
    setTimeout(() => {
      setCollapseAll(false);
    }, 100);
  }, [collapseAll]);

  const handleSearch = useDebouncedCallback((value: string) => {
    setSearch(value);
  }, 300);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    handleSearch(value);
  };

  return (
    <>
      <div className="flex justify-center border-b p-4">
        <img
          src={logo}
          className="pointer-events-none w-[160px] select-none opacity-90"
          alt="Weaviate logo"
        />
      </div>

      <div className="flex flex-col gap-3 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Connections
          </span>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={triggerCollapseAll}
                >
                  <ChevronsDownUp className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Collapse all</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setOpenConnection(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">New connection</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <SearchInput
          value={searchInput}
          onChange={handleSearchChange}
          placeholder="Search connections..."
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {connections.length === 0 && !search ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
            <Network className="h-8 w-8 text-muted-foreground/50" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">No connections yet</p>
              <p className="text-xs text-muted-foreground">
                Add a connection to get started
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-1 gap-1.5"
              onClick={() => setOpenConnection(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              New connection
            </Button>
          </div>
        ) : connections.length === 0 && search ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">No results found</p>
          </div>
        ) : (
          connections.map((connection) => (
            <Connection
              key={connection.id}
              connection={connection}
              collapse={collapseAll}
            />
          ))
        )}
      </div>

      <VersionManager />
      <ConnectionDetails open={openNewConnection} setOpen={setOpenConnection} />
    </>
  );
};

export default Sidebar;
