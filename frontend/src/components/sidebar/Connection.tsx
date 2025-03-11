import { ConnectionStatus, type Connection as ConnectionI } from "@/types";
import { Button } from "@/components/ui/button";
import { Ellipsis, Layers3, Star } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  connection: ConnectionI;
}

// TODO: add more options
// TODO: add connect option
// TODO: add simple state management as movie
// FIXME: bigger side when starred

export const Connection: React.FC<Props> = ({ connection }) => {
  const { starred, name, status } = connection;
  const [isHovered, setIsHovered] = useState(false);

  return (
    <DropdownMenu>
      <div
        className="flex items-center justify-between p-3 bg-gray-100 relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-center">
          {starred && (
            <Star
              size="1.1em"
              className="mr-2 text-yellow-400"
              fill="currentColor"
            />
          )}
          {!starred && <Layers3 size="1.1em" className="mr-2" />}
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
        {/* FIXME: the background color here to be bigger */}
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
        <DropdownMenuItem>Edit</DropdownMenuItem>
        <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
