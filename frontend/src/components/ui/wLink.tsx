import { PropsWithChildren } from "react";
import { BrowserOpenURL } from "wailsjs/runtime/runtime";

interface Props {
  href: string;
}

const WLink: React.FC<PropsWithChildren<Props>> = ({ href, children }) => {
  return (
    <span
      className="cursor-pointer text-xs underline"
      onClick={() => BrowserOpenURL(href)}
    >
      {children}
    </span>
  );
};

export { WLink };
