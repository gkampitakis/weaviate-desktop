import type { Connection } from "@/types";
import { ConnectionStatus } from "@/types/enums";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Database,
  Ellipsis,
  Info,
  Link2Off,
  Pencil,
  RefreshCcw,
  Star,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useConnectionStore } from "@/store/connection-store";
import { useShallow } from "zustand/shallow";
import { useTabStore } from "@/store/tab-store";
import { errorReporting } from "@/lib/utils";
import ClusterInformation, {
  ClusterInformationName,
} from "../../../tabs/ClusterInformation/ClusterInformation";
import GeneralTabLabel from "../../../tabs/components/GeneralTabLabel";
import { useState } from "react";
import { ConnectionDetails } from "./ConnectionDetails";

interface Props {
  connection: Connection;
  setIsCollapsibleOpen: (v: boolean) => void;
}

export const ConnectionMenu: React.FC<Props> = ({
  connection,
  setIsCollapsibleOpen,
}) => {
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [openNewConnection, setOpenConnection] = useState(false);
  const { favorite, status, id, name } = connection;
  const addTab = useTabStore(useShallow((state) => state.add));
  const { removeConnection, setFavoriteConnection, disconnect, connect } =
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

  const handleRefresh = async () => {
    try {
      await connect(id);
    } catch (error) {
      errorReporting(error);
    }
  };

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
      await Promise.all([handleDisconnect(), removeConnection(id)]);
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
      label: (
        <GeneralTabLabel
          icon={Database}
          name={"Cluster Information for " + name}
          color={connection.color}
        />
      ),
      connection: connection,
      name: ClusterInformationName,
      children: <ClusterInformation connectionID={id} />,
    });
  };

  return (
    <>
      {isConfirmationOpen && (
        <Dialog open={isConfirmationOpen} onOpenChange={setIsConfirmationOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Remove</DialogTitle>
              <DialogDescription>
                This will remove connection &quot;{connection.name}&quot; from
                your list. This action cannot be undone. Are you sure you want
                to proceed?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="justify-between!">
              <Button
                variant="outline"
                onClick={() => setIsConfirmationOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={deleteConnection}
              >
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {openNewConnection && (
        <ConnectionDetails
          open={openNewConnection}
          setOpen={setOpenConnection}
          connection={connection}
        />
      )}
      <DropdownMenuContent align="end">
        {status === ConnectionStatus.Connected && (
          <>
            <DropdownMenuItem onClick={handleDisconnect}>
              <Link2Off /> Disconnect
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleRefresh}>
              <RefreshCcw /> Refresh
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleClusterInformation}>
              <Info /> Cluster Information
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem onClick={() => setOpenConnection(true)}>
          <Pencil /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={setFavorite}>
          <Star />
          {favorite ? "Unfavorite" : "Favorite"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setIsConfirmationOpen(true)}
          variant="destructive"
        >
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </>
  );
};

export const ConnectionMenuTrigger: React.FC<{
  hovered: boolean;
  color: string;
}> = ({ hovered, color }) => (
  <DropdownMenuTrigger>
    <div
      className={`transform cursor-pointer rounded-full opacity-0 transition-opacity duration-300 bg-${color}-300`}
      style={{ opacity: hovered ? 1 : 0 }}
    >
      <Ellipsis className="h-4 w-4" />
    </div>
  </DropdownMenuTrigger>
);
