import { PropsWithChildren } from "react";

const TabContainer: React.FC<PropsWithChildren<{ className?: string }>> = ({
  children,
  className,
}) => {
  return (
    <div
      className={`flex flex-1 flex-col overflow-hidden bg-white p-5 ${className ? className : ""}`}
    >
      {children}
    </div>
  );
};

export default TabContainer;
