import type { Connection } from "@/types";
import { ConnectionStatus } from "@/types/enums";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Ellipsis, Info, Link2Off, Pencil, Star, Trash2 } from "lucide-react";
import { useConnectionStore } from "@/store/connection-store";
import { useShallow } from "zustand/shallow";
import { useTabStore } from "@/store/tab-store";
import { errorReporting } from "@/lib/utils";
import TabLabel from "../tabs/components/TabLabel";
import ClusterInformation, {
  ClusterInformationName,
} from "../tabs/ClusterInformation";

interface Props {
  connection: Connection;
  setIsCollapsibleOpen: (v: boolean) => void;
}

export const ConnectionMenu: React.FC<Props> = ({
  connection,
  setIsCollapsibleOpen,
}) => {
  const { favorite, status, id } = connection;
  const addTab = useTabStore(useShallow((state) => state.add));
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
      errorReporting(error);
    }
  };

  const deleteConnection = async () => {
    try {
      await removeConnection(id);
    } catch (error) {
      errorReporting(error);
    }
  };

  const setFavorite = async () => {
    try {
      await setFavoriteConnection(id, !favorite);
    } catch (error) {
      errorReporting(error);
    }
  };

  const handleClusterInformation = () => {
    addTab({
      label: <TabLabel name={"Cluster Information" + id.toString()} />,
      name: ClusterInformationName,
      children: <ClusterInformation connectionID={id} />,
    });
  };

  return (
    <DropdownMenuContent align="end">
      {status === ConnectionStatus.Connected && (
        <>
          <DropdownMenuItem onClick={handleDisconnect}>
            <Link2Off /> Disconnect
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleClusterInformation}>
            <Info /> Cluster Information
          </DropdownMenuItem>
        </>
      )}
      <DropdownMenuItem>
        <Pencil /> Edit
      </DropdownMenuItem>
      <DropdownMenuItem onClick={setFavorite}>
        <Star />
        {favorite ? "Unfavorite" : "Favorite"}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
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
