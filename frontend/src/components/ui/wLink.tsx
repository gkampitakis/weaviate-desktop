import { PropsWithChildren } from "react";
import { BrowserOpenURL } from "wailsjs/runtime/runtime";

interface Props {
  href: string;
  className?: string;
}

const WLink: React.FC<PropsWithChildren<Props>> = ({
  href,
  children,
  className,
}) => {
  return (
    <span
      className={`cursor-pointer text-xs underline ${className}`}
      onClick={() => BrowserOpenURL(href)}
    >
      {children}
    </span>
  );
};

export { WLink };
