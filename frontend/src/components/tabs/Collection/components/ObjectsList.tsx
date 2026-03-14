import { weaviate } from "wailsjs/go/models";
import JsonView from "@uiw/react-json-view";
import { Check, Copy, Database, LoaderCircle, SearchX, Trash2 } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";

interface Props {
  objects: weaviate.w_WeaviateObject[];
  tenant?: string;
  connectionID: number;
  refetch: () => void;
  loading: boolean;
  isSearch: boolean;
  ref: React.Ref<HTMLDivElement> | undefined;
}

const ObjectsList: React.FC<Props> = ({
  objects,
  tenant,
  connectionID,
  loading,
  isSearch,
  refetch,
  ref,
}) => {
  if (!objects.length) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4">
        {loading ? (
          <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <>
            {isSearch ? (
              <SearchX className="h-12 w-12 text-muted-foreground" />
            ) : (
              <Database className="h-12 w-12 text-muted-foreground" />
            )}
            <div className="text-center">
              <p className="text-lg font-medium">
                {isSearch ? "No results found" : "No objects yet"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isSearch
                  ? "Try refining your query to get results back."
                  : "This collection has no data."}
              </p>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 overflow-y-auto" ref={ref}>
      {objects.map((object, id) => (
        <ObjectCard
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

const ObjectCard: React.FC<ObjectActionsProps> = ({
  object,
  tenant = "",
  connectionID,
  refetch,
}) => {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const CopyIcon = copied ? Check : Copy;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { class: _, ...jsonValue } = object;

  const handleCopy = () => {
    if (copied) return;
    setCopied(true);
    navigator.clipboard.writeText(JSON.stringify(object, null, "  "));
    setTimeout(() => setCopied(false), 2000);
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
            <DialogTitle>Remove object</DialogTitle>
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

      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <span className="truncate font-mono text-xs text-muted-foreground">
            {object.id}
          </span>
          <div className="flex flex-shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleCopy}
              title="Copy as JSON"
            >
              <CopyIcon
                className={`h-3.5 w-3.5 ${copied ? "text-green-600" : ""}`}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={() => setOpen(true)}
              title="Delete object"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <Separator />
        <div className="json-view-wrapper p-3">
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
              fontSize: "0.8rem",
              lineHeight: "1.6",
              background: "transparent",
            }}
          />
        </div>
      </div>
    </>
  );
};

export default ObjectsList;
