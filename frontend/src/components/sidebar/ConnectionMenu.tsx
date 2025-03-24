import type { Connection } from "@/types";
import { ConnectionStatus } from "@/types/enums";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Ellipsis, Link2Off, Pencil, Star, Trash2 } from "lucide-react";
import { useConnectionStore } from "@/store/connection-store";
import { useShallow } from "zustand/shallow";
import { toast } from "sonner";
import { useTabStore } from "@/store/tab-store";

interface Props {
  connection: Connection;
  setIsCollapsibleOpen: (v: boolean) => void;
}

export const ConnectionMenu: React.FC<Props> = ({
  connection,
  setIsCollapsibleOpen,
}) => {
  const { favorite, status, id } = connection;
  const { removeConnection, setFavoriteConnection, disconnect } =
    useConnectionStore(
      useShallow((state) => ({
        removeConnection: state.remove,
        setFavoriteConnection: state.setFavorite,
        disconnect: state.disconnect,
        connect: state.connect,
      }))
    );

  const removeTabsByConnectionID = useTabStore(
    (state) => state.removeByConnection
  );

  const handleDisconnect = async () => {
    try {
      await disconnect(id);

      setIsCollapsibleOpen(false);
      removeTabsByConnectionID(id);
    } catch (error) {
      toast.error(String(error), {
        dismissible: true,
        duration: 5000,
        closeButton: true,
      });
    }
  };

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

  return (
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
  );
};

export const ConnectionMenuTrigger: React.FC<{
  hovered: boolean;
}> = ({ hovered }) => (
  <DropdownMenuTrigger>
    <div
      className="cursor-pointer hover:bg-gray-200 transform opacity-0 transition-opacity duration-300 ease-in-out rounded-full"
      style={{ opacity: hovered ? 1 : 0 }}
    >
      <Ellipsis className="w-4 h-4" />
    </div>
  </DropdownMenuTrigger>
);
