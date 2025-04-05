import { models } from "wailsjs/go/models";
import JsonView from "@uiw/react-json-view";
import { Check, Copy, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DeleteObject } from "wailsjs/go/weaviate/Weaviate";
import { errorReporting } from "@/lib/utils";

interface Props {
  objects: models.Object[];
  tenant?: string;
  connectionID: number;
  refetch: () => void;
}

const ObjectsList: React.FC<Props> = ({
  objects,
  tenant,
  connectionID,
  refetch,
}) => {
  return (
    <div className="overflow-y-auto" style={{ height: "calc(100vh - 120px)" }}>
      {objects.map((object, id) => (
        <Object
          connectionID={connectionID}
          key={id}
          object={object}
          tenant={tenant}
          refetch={refetch}
        />
      ))}
    </div>
  );
};

interface ObjectActionsProps {
  object: models.Object;
  tenant?: string;
  connectionID: number;
  refetch: () => void;
}

const Object: React.FC<ObjectActionsProps> = ({
  object,
  tenant = "",
  connectionID,
  refetch,
}) => {
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [open, setOpen] = useState(false);
  const Icon = copied ? Check : Copy;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { class: _, ...jsonValue } = object;

  const handleCopy = () => {
    if (copied) {
      return;
    }

    setCopied(true);
    navigator.clipboard.writeText(JSON.stringify(object, null, "  "));
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const handleDelete = () =>
    DeleteObject(connectionID, object.class!, object.id!, tenant)
      .catch(errorReporting)
      .finally(() => {
        refetch();
        setOpen(false);
      });

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove</DialogTitle>
            <DialogDescription>
              This will remove the object from the collection. This action
              cannot be undone. Are you sure you want to proceed?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="justify-between!">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div
        className="bg-gray-100/80 my-2 rounded-md border-red-200 flex flex-row justify-between"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <JsonView
          className="select-text"
          displayDataTypes={false}
          displayObjectSize={false}
          enableClipboard={false}
          collapsed={2}
          shortenTextAfterLength={120}
          value={jsonValue}
          highlightUpdates={false}
        />
        <div
          className="px-10 py-4 flex flex-row transform opacity-0 transition-opacity ease-in-out gap-2"
          style={{ opacity: isHovered ? 1 : 0 }}
        >
          <Icon
            onClick={handleCopy}
            size={"1.4em"}
            className={`cursor-pointer ${copied ? "text-green-600" : ""}`}
          />
          <Trash2
            onClick={() => setOpen(true)}
            size={"1.4em"}
            className="cursor-pointer text-red-600"
          />
        </div>
      </div>
    </>
  );
};

export default ObjectsList;
