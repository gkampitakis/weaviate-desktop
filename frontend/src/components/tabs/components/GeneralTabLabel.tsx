import logo from "@/assets/images/weaviate-logo.svg";
import { LucideIcon } from "lucide-react";

interface Props {
  name: string;
  icon?: LucideIcon;
}

const GeneralTabLabel = ({ name, icon: Icon }: Props) => {
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
    </div>
  );
};

export default GeneralTabLabel;
