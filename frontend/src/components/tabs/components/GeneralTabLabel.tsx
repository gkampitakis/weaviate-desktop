import logo from "@/assets/images/weaviate-logo.svg";
import { borderColor } from "@/lib/dynamic-colors";
import { LucideIcon } from "lucide-react";

interface Props {
  name: string;
  icon?: LucideIcon;
  color?: string;
}

const GeneralTabLabel = ({ name, icon: Icon, color }: Props) => {
  return (
    <div
      style={{
        color: "#00a142",
      }}
      className="flex flex-row items-center"
    >
      {!Icon ? (
        <img className="mr-2 w-[15px] flex-shrink-0" src={logo} />
      ) : (
        <Icon className="mr-2 flex-shrink-0" size="1.1em" />
      )}
      <div className="max-w-sm flex-1 overflow-x-hidden text-ellipsis">
        {name}
      </div>
      {color && (
        <div
          className={`absolute right-0 bottom-0 left-0 border-b-4 ${borderColor[color]}`}
        />
      )}
    </div>
  );
};

export default GeneralTabLabel;
