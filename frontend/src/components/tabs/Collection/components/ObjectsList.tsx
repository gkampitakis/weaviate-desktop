import { models } from "wailsjs/go/models";
import JsonView from "@uiw/react-json-view";
import { Check, Copy, LoaderCircle, Trash2 } from "lucide-react";
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
import logo from "@/assets/images/no-data.svg";

interface Props {
  objects: models.w_Object[];
  tenant?: string;
  connectionID: number;
  refetch: () => void;
  loading: boolean;
}

const ObjectsList: React.FC<Props> = ({
  objects,
  tenant,
  connectionID,
  loading,
  refetch,
}) => {
  if (!objects.length) {
    return (
      <div
        className="item-center flex flex-col items-center justify-center"
        style={{ height: "70vh" }}
      >
        {loading ? (
          <LoaderCircle size="1.3em" className="animate-spin text-green-600" />
        ) : (
          <>
            <img
              className="pointer-events-none w-[200px] select-none"
              alt="No Data Image"
              src={logo}
            />
            <h2 className="text-primary mt-10 scroll-m-20 pb-2 text-2xl font-semibold tracking-tight transition-colors first:mt-0">
              This collection has no data
            </h2>
            <p className="text-primary">You can import data with ....</p>
          </>
        )}
      </div>
    );
  }

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
  object: models.w_Object;
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
        className="my-2 flex flex-row justify-between rounded-md border-red-200 bg-gray-100/80"
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
          className="flex transform flex-row gap-2 px-10 py-4 opacity-0 transition-opacity ease-in-out"
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
