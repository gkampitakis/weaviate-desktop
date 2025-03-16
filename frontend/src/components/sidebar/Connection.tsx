import type { Connection as ConnectionI } from "@/types";
import { ConnectionStatus } from "@/types/enums";
import { Button } from "@/components/ui/button";
import { Ellipsis, Layers3, Pencil, Star, Trash2 } from "lucide-react";
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

interface Props {
  connection: ConnectionI;
}

export const Connection: React.FC<Props> = ({ connection }) => {
  const { favorite, name, status, id } = connection;
  const [isHovered, setIsHovered] = useState(false);
  const { removeConnection, setFavoriteConnection } = useConnectionStore(
    useShallow((state) => ({
      removeConnection: state.remove,
      setFavoriteConnection: state.setFavorite,
    }))
  );

  const deleteConnection = async () => {
    try {
      removeConnection(id);
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
      setFavoriteConnection(id, !favorite);
    } catch (error) {
      console.error(error);

      toast.error(String(error), {
        dismissible: true,
        duration: 5000,
        closeButton: true,
      });
    }
  };

  return (
    <DropdownMenu>
      <div
        className="flex items-center justify-between p-3 bg-gray-100 relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-center">
          {favorite && (
            <Star
              size="1.1em"
              className="mr-2 text-yellow-400"
              fill="currentColor"
            />
          )}
          {!favorite && <Layers3 size="1.1em" className="mr-2" />}
          <span className="text-xs">{name}</span>
        </div>
        {status !== ConnectionStatus.Connected && (
          <Button
            className="absolute end-10 transform opacity-0 transition-opacity duration-300 ease-in-out !bg-white !text-black"
            style={{ opacity: isHovered ? 1 : 0 }}
            size="sm"
          >
            Connect
          </Button>
        )}
        <DropdownMenuTrigger>
          <div className="cursor-pointer hover:bg-gray-200">
            <Ellipsis className="w-4 h-4" />
          </div>
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent>
        {status === ConnectionStatus.Connected && (
          <DropdownMenuItem>Disconnect</DropdownMenuItem>
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
  );
};
