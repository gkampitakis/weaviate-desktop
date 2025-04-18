import type { Collection as SingleTenantCollection } from "@/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import {
  GetObjectsPaginated,
  GetTotalObjects,
} from "wailsjs/go/weaviate/Weaviate";
import TabContainer from "../components/TabContainer";
import ObjectsList from "./components/ObjectsList";
import Pagination from "./components/Pagination";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { errorReporting } from "@/lib/utils";

interface Props {
  collection: SingleTenantCollection;
}

const SingleTenantCollection: React.FC<Props> = ({ collection }) => {
  const { connection, name } = collection;

  const [pageSize, setPageSize] = useState(25);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  // Fetch total objects count
  const {
    data: totalObjects,
    isLoading: loadingTotal,
    refetch: refetchTotal,
  } = useQuery({
    queryKey: ["totalObjects", connection.id, name],
    initialData: 0,
    queryFn: async () => {
      try {
        const total = await GetTotalObjects(connection.id, name, "");

        // reset cursor history and page size
        setCursorHistory([]);
        setPageSize(25);

        return total;
      } catch (error) {
        errorReporting(error);
        throw error;
      }
    },
  });

  const totalPages = Math.ceil(totalObjects / pageSize);

  // Retrieve objects
  const {
    data: objects,
    isLoading: loadingObject,
    isPlaceholderData,
    refetch: refetchObjects,
  } = useQuery({
    placeholderData: keepPreviousData,
    queryKey: ["objects", connection.id, name, pageSize, cursorHistory.at(-1)],
    queryFn: async () => {
      try {
        const { Objects: objects } = await GetObjectsPaginated(
          connection.id,
          pageSize,
          name,
          cursorHistory.at(-1) || "",
          ""
        );

        return objects;
      } catch (error) {
        errorReporting(error);
        throw error;
      }
    },
  });

  const loading = loadingTotal || loadingObject || isPlaceholderData;

  const handleNext = async () => {
    if (cursorHistory.length + 1 === totalPages || loading) {
      return;
    }

    setCursorHistory((state) => [...state, objects!.at(-1)!.id!]);
  };

  const refetch = () => {
    refetchObjects();
    refetchTotal();
  };

  const handlePrevious = async () => {
    if (cursorHistory.length <= 0 || loading) {
      return;
    }

    setCursorHistory((state) => state.slice(0, -1));
  };

  const handlePageSizeChange = (p: number) => {
    setPageSize(p);
    setCursorHistory([]);
  };

  return (
    <TabContainer>
      <Tabs defaultValue="objects">
        <div className="flex flex-row items-center gap-2">
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
          <div className="flex flex-2 flex-row items-center justify-end">
            <Pagination
              pageSize={pageSize}
              setPageSize={handlePageSizeChange}
              next={handleNext}
              previous={handlePrevious}
              currentPage={cursorHistory.length + 1}
              totalPages={totalPages}
              loading={loading}
            />
          </div>
        </div>
        <TabsContent value="objects">
          <ObjectsList
            loading={loading}
            objects={objects || []}
            connectionID={connection.id}
            refetch={refetch}
          />
        </TabsContent>
        <TabsContent value="indexes">Not yet implemented</TabsContent>
        <TabsContent value="schema">Not yet implemented</TabsContent>
      </Tabs>
    </TabContainer>
  );
};

export default SingleTenantCollection;
