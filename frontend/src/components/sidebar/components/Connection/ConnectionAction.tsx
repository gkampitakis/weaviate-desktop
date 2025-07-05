import { LucideProps } from "lucide-react";

interface Props {
  color: string;
  hovered: boolean;
  icon: React.ForwardRefExoticComponent<
    Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>
  >;
}

const ConnectionAction: React.FC<Props> = ({ color, hovered, icon: Icon }) => {
  return (
    <div
      className={`transform cursor-pointer rounded-full opacity-0 transition-opacity duration-300 bg-${color}-300`}
      style={{ opacity: hovered ? 1 : 0 }}
    >
      <Icon className="h-4 w-4" />
    </div>
  );
};

export default ConnectionAction;
