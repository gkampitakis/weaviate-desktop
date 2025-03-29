import type { Collection } from "@/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { GetTenants, GetTotalObjects } from "wailsjs/go/weaviate/Weaviate";
import TabContainer from "./TabContainer";
import ObjectsList from "../objects-list/ObjectsList";
import { models } from "wailsjs/go/models";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  collection: Collection;
}

const MultiTenancyCollection: React.FC<Props> = ({ collection }) => {
  const { connectionID, name } = collection;
  const [selectedTenant, setSelectedTenant] = useState("");
  const [open, setOpen] = useState(false);
  const [totalObjects, setTotalObjects] = useState(0);
  const [tenants, setTenants] = useState<models.Tenant[]>();

  useEffect(() => {
    const effect = async () => {
      try {
        const tenants = await GetTenants(connectionID, name);

        tenants.sort((a, b) =>
          a.name!.localeCompare(b.name!, undefined, {
            numeric: true,
            sensitivity: "base",
          })
        );

        if (tenants.length > 0) {
          setSelectedTenant(tenants[0].name!);
        }

        setTenants(tenants);
      } catch (error) {
        console.error(error);
      }
    };

    effect();
  }, [connectionID, name]);

  useEffect(() => {
    const effect = async () => {
      try {
        const totalObjects = await GetTotalObjects(
          connectionID,
          name,
          selectedTenant
        );

        setTotalObjects(totalObjects);
      } catch (error) {
        console.error(error);
      }
    };

    effect();
  }, [connectionID, name, selectedTenant]);

  return (
    <TabContainer>
      <Tabs defaultValue="objects">
        <div className="flex flex-row gap-2">
          <TabsList className="h-[30px] w-1/3">
            <TabsTrigger
              value="objects"
              className="data-[state=active]:text-primary cursor-pointer"
            >
              Objects ({totalObjects})
            </TabsTrigger>
            <TabsTrigger
              value="indexes"
              className="data-[state=active]:text-primary cursor-pointer"
            >
              Indexes
            </TabsTrigger>
            <TabsTrigger
              value="schema"
              className="data-[state=active]:text-primary cursor-pointer"
            >
              Schema
            </TabsTrigger>
          </TabsList>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild className="h-[30px]">
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-[200px] justify-between"
              >
                {selectedTenant
                  ? tenants?.find((tenant) => tenant.name === selectedTenant)
                      ?.name
                  : "Select tenant..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
              <Command>
                <CommandInput placeholder="Search tenant..." />
                <CommandList>
                  <CommandEmpty>No tenant found.</CommandEmpty>
                  <CommandGroup>
                    {tenants?.map((tenant) => (
                      <CommandItem
                        key={tenant.name}
                        value={tenant.name}
                        onSelect={(currentValue) => {
                          setSelectedTenant(
                            currentValue === selectedTenant ? "" : currentValue
                          );
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedTenant === tenant.name
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        {tenant.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <TabsContent value="objects">
          {tenants && (
            <ObjectsList
              connectionID={collection.connectionID}
              name={collection.name}
              tenant={selectedTenant}
            />
          )}
        </TabsContent>
        <TabsContent value="indexes">Not yet implemented</TabsContent>
        <TabsContent value="schema">Not yet implemented</TabsContent>
      </Tabs>
    </TabContainer>
  );
};

export default MultiTenancyCollection;
