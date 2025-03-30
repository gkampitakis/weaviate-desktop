import { models } from "wailsjs/go/models";
import JsonView from "@uiw/react-json-view";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

interface Props {
  objects: models.Object[];
}

const ObjectsList: React.FC<Props> = ({ objects }) => {
  return (
    <div className="overflow-y-auto" style={{ height: "calc(100vh - 120px)" }}>
      {objects.map((object, id) => (
        <Object key={id} object={object} />
      ))}
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
