import { Badge } from "@/components/ui/badge";

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  moduleConfig?: any;
}

export const ModuleConfigSection = ({ moduleConfig }: Props) => {
  if (!moduleConfig || Object.keys(moduleConfig).length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No module configuration available.
      </p>
    );
  }

  const modules = Object.entries(moduleConfig);

  return (
    <div className="space-y-2">
      {modules.map(([moduleName, config]) => (
        <div
          key={moduleName}
          className="flex items-center justify-between rounded-md border p-2"
        >
          <Badge variant="outline" className="font-mono text-xs">
            {moduleName}
          </Badge>
          {config &&
          typeof config === "object" &&
          Object.keys(config as object).length > 0 ? (
            <span className="text-muted-foreground text-xs">
              {Object.keys(config as object).length} setting(s)
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">
              Default config
            </span>
          )}
        </div>
      ))}
    </div>
  );
};
