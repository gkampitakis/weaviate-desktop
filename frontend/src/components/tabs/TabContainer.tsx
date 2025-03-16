import { PropsWithChildren } from "react";

const TabContainer: React.FC<PropsWithChildren> = ({ children }) => {
  return <div className="bg-white">{children}</div>;
};

export default TabContainer;
