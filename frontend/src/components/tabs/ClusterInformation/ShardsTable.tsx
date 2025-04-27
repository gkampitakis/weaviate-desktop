import { ChevronDown, ChevronUp, Check, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { models } from "wailsjs/go/models";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  shards: models.w_NodeShardStatus[];
}

export const ShardsTable = ({ shards: shard }: Props) => {
  const [open, setOpen] = useState(false);

  shard.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );

  return (
    <Collapsible
      open={open}
      onOpenChange={() => setOpen((prev) => !prev)}
      className="w-full"
    >
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="flex justify-start">
          <span>View Shards</span>
          {open ? <ChevronUp size="1em" /> : <ChevronDown size="1em" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="relative h-[300px] overflow-y-auto">
          <Table className="w-full text-left text-xs" scrollable>
            <TableHeader className="sticky top-0 bg-gray-100">
              <TableRow>
                <TableHead className="font-medium">Shard Name</TableHead>
                <TableHead className="font-medium">Collection Name</TableHead>
                <TableHead className="font-medium">Loaded</TableHead>
                <TableHead className="font-medium">Objects</TableHead>
                <TableHead className="font-medium">Vector Status</TableHead>
                <TableHead className="font-medium">Queue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shard.map((shard, idx) => (
                <TableRow key={idx} className="border-t">
                  <TableCell>{shard.name}</TableCell>
                  <TableCell>{shard.class}</TableCell>
                  <TableCell>
                    {shard.loaded ? (
                      <Check className="text-green-500" size="1.1em" />
                    ) : (
                      <X className="text-red-500" size="1.1em" />
                    )}
                  </TableCell>
                  <TableCell>{shard.objectCount}</TableCell>
                  <TableCell>{shard.vectorIndexingStatus}</TableCell>
                  <TableCell>{shard.vectorQueueLength}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
