import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";

interface Props {
  value: boolean | undefined;
}

export const BooleanBadge = ({ value }: Props) => (
  <Badge variant={value ? "default" : "secondary"} className="text-xs">
    {value ? (
      <Check className="mr-1 h-3 w-3" />
    ) : (
      <X className="mr-1 h-3 w-3" />
    )}
    {value ? "Yes" : "No"}
  </Badge>
);
