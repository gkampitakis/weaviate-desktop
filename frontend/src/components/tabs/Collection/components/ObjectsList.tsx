import { weaviate } from "wailsjs/go/models";
import JsonView from "@uiw/react-json-view";
import { Check, Copy, LoaderCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import "./json-view-styles.css";
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
import { Card, CardContent, CardTitle } from "@/components/ui/card";

interface Props {
  objects: weaviate.w_WeaviateObject[];
  tenant?: string;
  connectionID: number;
  refetch: () => void;
  loading: boolean;
  isSearch: boolean;
}

const ObjectsList: React.FC<Props> = ({
  objects,
  tenant,
  connectionID,
  loading,
  isSearch,
  refetch,
}) => {
  if (!objects.length) {
    return (
      <div className="item-center flex w-full flex-col items-center justify-center">
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
              {isSearch ? "No results" : "This collection has no data"}
            </h2>
            <p className="text-primary">
              {isSearch
                ? "You can refine your query"
                : "You can import data with ...."}
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-y-auto">
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
  object: weaviate.w_WeaviateObject;
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
      <Card className="mb-2 gap-0 py-0">
        <CardTitle className="flex flex-row items-center justify-end gap-2 px-2 pt-4">
          <Icon
            onClick={handleCopy}
            size="1.2em"
            className={`cursor-pointer ${copied ? "text-green-600" : ""}`}
          />
          <Trash2
            onClick={() => setOpen(true)}
            size="1.2em"
            className="cursor-pointer text-red-600"
          />
        </CardTitle>
        <CardContent className="px-2">
          <div className="object-container">
            <div className="json-content">
              <div className="json-view-wrapper">
                <JsonView
                  className="select-text"
                  displayDataTypes={false}
                  displayObjectSize={false}
                  enableClipboard={false}
                  collapsed={2}
                  shortenTextAfterLength={120}
                  value={jsonValue}
                  highlightUpdates={false}
                  style={{
                    maxWidth: "100%",
                    overflowWrap: "break-word",
                    wordBreak: "break-all",
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default ObjectsList;
