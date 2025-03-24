import { PropsWithChildren } from "react";

const TabContainer: React.FC<PropsWithChildren<{ className: string }>> = ({
  children,
  className,
}) => {
  return <div className={`bg-white flex-1 p-10 ${className}`}>{children}</div>;
};

export default TabContainer;
