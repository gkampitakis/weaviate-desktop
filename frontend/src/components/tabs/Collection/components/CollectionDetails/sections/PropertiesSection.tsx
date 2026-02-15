import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { models } from "wailsjs/go/models";
import { BooleanBadge } from "../helpers";

interface Props {
  properties: models.w_Property[];
}

export const PropertiesSection = ({ properties }: Props) => {
  if (!properties || properties.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No properties defined.</p>
    );
  }

  return (
    <div className="max-h-80 overflow-auto rounded-md border">
      <Table scrollable>
        <TableHeader className="bg-muted/50 sticky top-0">
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Data Type</TableHead>
            <TableHead>Tokenization</TableHead>
            <TableHead>Filterable</TableHead>
            <TableHead>Searchable</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {properties.map((prop) => (
            <TableRow key={prop.name}>
              <TableCell className="font-mono text-sm">{prop.name}</TableCell>
              <TableCell>
                <Badge variant="outline" className="font-mono text-xs">
                  {prop.dataType?.join(", ") || "-"}
                </Badge>
              </TableCell>
              <TableCell>
                {prop.tokenization ? (
                  <Badge variant="secondary" className="text-xs">
                    {prop.tokenization}
                  </Badge>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell>
                <BooleanBadge value={prop.indexFilterable} />
              </TableCell>
              <TableCell>
                <BooleanBadge value={prop.indexSearchable} />
              </TableCell>
              <TableCell className="max-w-xs truncate text-sm">
                {prop.description || "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
