import type { Connection as ConnectionI } from "@/types";
import { ConnectionStatus } from "@/types/enums";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  Ellipsis,
  Layers3,
  Link2Off,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConnectionStore } from "@/store/connection-store";
import { useShallow } from "zustand/shallow";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@radix-ui/react-collapsible";

interface Props {
  connection: ConnectionI;
}

export const Connection: React.FC<Props> = ({ connection }) => {
  const { favorite, name, status, id, collections } = connection;
  const [isHovered, setIsHovered] = useState(false);
  const [isCollapsibleOpen, setIsCollapsibleOpen] = useState(false);
  const { removeConnection, setFavoriteConnection, connect, disconnect } =
    useConnectionStore(
      useShallow((state) => ({
        removeConnection: state.remove,
        setFavoriteConnection: state.setFavorite,
        disconnect: state.disconnect,
        connect: state.connect,
      }))
    );

  const deleteConnection = async () => {
    try {
      await removeConnection(id);
    } catch (error) {
      console.error(error);

      toast.error(String(error), {
        dismissible: true,
        duration: 5000,
        closeButton: true,
      });
    }
  };

  const setFavorite = async () => {
    try {
      await setFavoriteConnection(id, !favorite);
    } catch (error) {
      console.error(error);

      toast.error(String(error), {
        dismissible: true,
        duration: 5000,
        closeButton: true,
      });
    }
  };

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

      toast.error(String(error), {
        dismissible: true,
        duration: 5000,
        closeButton: true,
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect(id);

      setIsCollapsibleOpen(false);
    } catch (error) {
      toast.error(String(error), {
        dismissible: true,
        duration: 5000,
        closeButton: true,
      });
    }
  };

  return (
    <Collapsible open={isCollapsibleOpen} onOpenChange={setIsCollapsibleOpen}>
      <DropdownMenu>
        <div
          className={`flex items-center justify-between pr-3 bg-gray-100 relative ${
            status !== ConnectionStatus.Connected ? "opacity-70" : ""
          }`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="flex items-center truncate">
            <CollapsibleTrigger
              asChild
              disabled={status !== ConnectionStatus.Connected}
            >
              <Button variant="ghost" className="!pr-0" size="sm">
                <ChevronRight
                  size={"1.1em"}
                  className={`transition-transform duration-300 ${
                    isCollapsibleOpen ? "rotate-90" : ""
                  }`}
                />
              </Button>
            </CollapsibleTrigger>
            {favorite && (
              <Star
                size="1.1em"
                className="mr-2 text-yellow-400 flex-shrink-0"
                fill="currentColor"
              />
            )}
            {!favorite && (
              <Layers3 size="1.1em" className="mr-2 flex-shrink-0" />
            )}
            <span className="text-xs truncate">{name}</span>
          </div>
          {status !== ConnectionStatus.Connected && (
            <Button
              className="absolute end-10 transform opacity-0 transition-opacity duration-300 ease-in-out !bg-white !text-black"
              style={{ opacity: isHovered ? 1 : 0 }}
              size="sm"
              onClick={handleConnect}
            >
              Connect
            </Button>
          )}
          <DropdownMenuTrigger>
            <div
              className="cursor-pointer hover:bg-gray-200 transform opacity-0 transition-opacity duration-300 ease-in-out rounded-full "
              style={{ opacity: isHovered ? 1 : 0 }}
            >
              <Ellipsis className="w-4 h-4" />
            </div>
          </DropdownMenuTrigger>
        </div>
        <DropdownMenuContent align="end">
          {status === ConnectionStatus.Connected && (
            <DropdownMenuItem onClick={handleDisconnect}>
              <Link2Off /> Disconnect
            </DropdownMenuItem>
          )}
          <DropdownMenuItem>
            <Pencil /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={setFavorite}>
            <Star />
            {favorite ? "Unfavorite" : "Favorite"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={deleteConnection} variant="destructive">
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CollapsibleContent>
        {collections?.map((collection) => (
          <div key={collection} className="text-xs text-gray-500 ml-1">
            {collection}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};
