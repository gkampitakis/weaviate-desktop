import { useEffect, useState } from "react";
import { models } from "wailsjs/go/models";
import { GetObjectsPaginated } from "wailsjs/go/weaviate/Weaviate";
import JsonView from "@uiw/react-json-view";
import { Check, Copy } from "lucide-react";

interface Props {
  connectionID: number;
  name: string;
  tenant?: string;
}

const pageSize = 25;

const ObjectsList: React.FC<Props> = ({ connectionID, name, tenant = "" }) => {
  const [objects, setObjects] = useState<models.Object[]>([]);
  const [cursor, setCursor] = useState("");

  useEffect(() => {
    const effect = async () => {
      try {
        const { Objects: objects } = await GetObjectsPaginated(
          connectionID,
          pageSize,
          name,
          cursor,
          tenant
        );

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        setObjects(objects.map(({ class: _, ...object }) => object));
        setCursor(objects.at(-1)?.id || "");
      } catch (error) {
        console.error(error);
      }
    };

    effect();
  }, [connectionID, name, tenant]);

  return (
    <div className="overflow-y-auto" style={{ height: "calc(100vh - 150px)" }}>
      {objects &&
        objects.map((object, id) => <Object key={id} object={object} />)}
    </div>
  );
};

interface ObjectActionsProps {
  object: models.Object;
}

const Object: React.FC<ObjectActionsProps> = ({ object }) => {
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const Icon = copied ? Check : Copy;

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

  return (
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
        value={object}
        highlightUpdates={false}
      />
      <div
        className="px-10 py-4 flex flex-row transform opacity-0 transition-opacity ease-in-out"
        style={{ opacity: isHovered ? 1 : 0 }}
      >
        <Icon
          onClick={handleCopy}
          size={"1.4em"}
          className={`cursor-pointer ${copied ? "text-green-600" : ""}`}
        />
      </div>
    </div>
  );
};

export default ObjectsList;
