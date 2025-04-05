import { PropsWithChildren } from "react";
import logo from "@/assets/images/weaviate-logo.svg";

const TabLabel: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <div
      style={{
        color: "#00a142",
      }}
      className="flex flex-row gap-2"
    >
      <img className="w-[15px]" src={logo} />
      <div className="flex-1 overflow-x-hidden max-w-[100px] text-ellipsis">
        {children}
      </div>
    </div>
  );
};

export default TabLabel;
