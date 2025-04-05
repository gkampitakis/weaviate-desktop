import type { Collection } from "@/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import {
  GetObjectsPaginated,
  GetTenants,
  GetTotalObjects,
} from "wailsjs/go/weaviate/Weaviate";
import TabContainer from "../components/TabContainer";
import ObjectsList from "./components/ObjectsList";
import TenantList from "./components/TenantList";
import Pagination from "./components/Pagination";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { errorReporting } from "@/lib/utils";

interface Props {
  collection: Collection;
}

const MultiTenantCollection: React.FC<Props> = ({ collection }) => {
  const { connectionID, name } = collection;
  const queryClient = useQueryClient();

  const [pageSize, setPageSize] = useState(25);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");

  const selectTenant = (tenant: string) => {
    setSelectedTenant(tenant);
    // reset cursor history when changing tenant
    setCursorHistory([]);
  };

  // Fetch tenants
  const { data: tenants } = useQuery({
    queryKey: ["tenants", connectionID, name],
    initialData: [],
    queryFn: async () => {
      try {
        const tenants = await GetTenants(connectionID, name);
        tenants.sort((a, b) =>
          a.name!.localeCompare(b.name!, undefined, {
            numeric: true,
            sensitivity: "base",
          })
        );

        setSelectedTenant(tenants.length > 0 ? tenants[0].name! : "");
        setCursorHistory([]);
        setPageSize(25);

        return tenants;
      } catch (error) {
        errorReporting(error);
        throw error;
      }
    },
  });

  // Fetch total objects count
  const {
    data: totalObjects,
    isLoading: loadingTotal,
    refetch: refetchTotal,
  } = useQuery({
    queryKey: ["totalObjects", connectionID, name, selectedTenant],
    initialData: 0,
    queryFn: async () => {
      try {
        const total = await GetTotalObjects(connectionID, name, selectedTenant);

        return total;
      } catch (error) {
        errorReporting(error);
        throw error;
      }
    },
    // when changing page we need to make sure we have fetched the tenants again
    enabled: !!selectedTenant && !!tenants.length,
  });

  const totalPages = Math.ceil(totalObjects / pageSize);

  // Retrieve objects
  const {
    data: objects = [],
    isLoading: loadingObject,
    refetch: refetchObjects,
  } = useQuery({
    queryKey: [
      "objects",
      connectionID,
      name,
      pageSize,
      selectedTenant,
      cursorHistory.at(-1),
    ],
    queryFn: async () => {
      try {
        const { Objects: objects } = await GetObjectsPaginated(
          connectionID,
          pageSize,
          name,
          cursorHistory.at(-1) || "",
          selectedTenant
        );

        return objects;
      } catch (error) {
        errorReporting(error);
        throw error;
      }
    },
    // when changing page we need to make sure we have fetched the tenants again
    enabled: !!selectedTenant && !!tenants.length,
  });

  const refetch = () => {
    refetchObjects();
    refetchTotal();
  };

  const handleNext = async () => {
    if (cursorHistory.length + 1 === totalPages || loadingObject) {
      return;
    }

    setCursorHistory((state) => [...state, objects.at(-1)!.id!]);

    await queryClient.invalidateQueries({
      queryKey: ["objects", connectionID, name, pageSize, selectedTenant],
    });
  };

  const handlePrevious = async () => {
    if (cursorHistory.length <= 0 || loadingObject) {
      return;
    }

    setCursorHistory((state) => state.slice(0, -1));

    await queryClient.invalidateQueries({
      queryKey: ["objects", connectionID, name, pageSize, selectedTenant],
    });
  };

  const handlePageSizeChange = (p: number) => {
    setPageSize(p);
    setCursorHistory([]);
  };

  return (
    <TabContainer>
      <Tabs defaultValue="objects">
        <div className="flex flex-row gap-2">
          <TabsList className="h-[30px] flex-3">
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
          <div className="flex flex-row flex-2 justify-between">
            <TenantList
              selected={selectedTenant}
              setTenant={selectTenant}
              tenants={tenants}
            />
            <Pagination
              pageSize={pageSize}
              setPageSize={handlePageSizeChange}
              next={handleNext}
              previous={handlePrevious}
              currentPage={cursorHistory.length + 1}
              totalPages={totalPages}
              loading={loadingTotal || loadingObject}
            />
          </div>
        </div>
        <TabsContent value="objects">
          <ObjectsList
            objects={objects}
            tenant={selectedTenant}
            connectionID={connectionID}
            refetch={refetch}
          />
        </TabsContent>
        <TabsContent value="indexes">Not yet implemented</TabsContent>
        <TabsContent value="schema">Not yet implemented</TabsContent>
      </Tabs>
    </TabContainer>
  );
};

export default MultiTenantCollection;
