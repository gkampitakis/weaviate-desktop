import type { Connection as ConnectionI } from "@/types";
import { ConnectionStatus } from "@/types/enums";
import { Button } from "@/components/ui/button";
import { Layers3, Star } from "lucide-react";
import { useState } from "react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { useConnectionStore } from "@/store/connection-store";
import { useShallow } from "zustand/shallow";
import { toast } from "sonner";
import { Collapsible } from "@/components/ui/collapsible";
import { ConnectionMenu, ConnectionMenuTrigger } from "./ConnectionMenu";
import {
  ConnectionCollapsibleContent,
  ConnectionCollapsibleTrigger,
} from "./ConnectionCollapsible";
import { errorReporting } from "@/lib/utils";

interface Props {
  connection: ConnectionI;
}

export const Connection: React.FC<Props> = ({ connection }) => {
  const { favorite, name, status, id, collections } = connection;
  const [isHovered, setIsHovered] = useState(false);
  const [isCollapsibleOpen, setIsCollapsibleOpen] = useState(false);
  const { connect } = useConnectionStore(
    useShallow((state) => ({
      connect: state.connect,
    }))
  );
  const isConnected = status === ConnectionStatus.Connected;

  const handleConnect = async () => {
    const loadingId = toast.loading(`Connecting to ${name}`, {
      dismissible: true,
    });

    try {
      await connect(id);

      toast.dismiss(loadingId);
      toast.success(`Connected to ${name}`, {
        dismissible: true,
        duration: 5000,
        closeButton: true,
      });

      setIsCollapsibleOpen(true);
    } catch (error) {
      toast.dismiss(loadingId);

      errorReporting(error);
    }
  };

  return (
    <Collapsible open={isCollapsibleOpen} onOpenChange={setIsCollapsibleOpen}>
      <DropdownMenu>
        <div
          className={`flex items-center justify-between pr-3 bg-gray-100 relative hover:bg-gray-200 ${
            !isConnected ? "opacity-70" : "font-bold"
          }`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="flex items-center truncate">
            <ConnectionCollapsibleTrigger
              connected={isConnected}
              open={isCollapsibleOpen}
            />
            {favorite ? (
              <Star
                size="1.1em"
                className="mr-2 text-yellow-400 flex-shrink-0"
                fill="currentColor"
              />
            ) : (
              <Layers3 size="1.1em" className="mr-2 flex-shrink-0" />
            )}
            <span className="text-xs truncate">{name}</span>
          </div>
          {!isConnected && (
            <Button
              className="absolute end-10 transform opacity-0 transition-opacity duration-300 ease-in-out !bg-white !text-black"
              style={{ opacity: isHovered ? 1 : 0 }}
              size="sm"
              onClick={handleConnect}
            >
              Connect
            </Button>
          )}
          <ConnectionMenuTrigger hovered={isHovered} />
        </div>
        <ConnectionMenu
          connection={connection}
          setIsCollapsibleOpen={setIsCollapsibleOpen}
        />
      </DropdownMenu>
      <ConnectionCollapsibleContent collections={collections} />
    </Collapsible>
  );
};
