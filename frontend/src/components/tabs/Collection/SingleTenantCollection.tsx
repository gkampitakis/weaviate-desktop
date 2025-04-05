import type { Collection as SingleTenantCollection } from "@/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import {
  GetObjectsPaginated,
  GetTotalObjects,
} from "wailsjs/go/weaviate/Weaviate";
import TabContainer from "../components/TabContainer";
import ObjectsList from "./components/ObjectsList";
import { models } from "wailsjs/go/models";
import Pagination from "./components/Pagination";

interface Props {
  collection: SingleTenantCollection;
}

const SingleTenantCollection: React.FC<Props> = ({ collection }) => {
  const { connectionID, name } = collection;

  const [totalObjects, setTotalObjects] = useState(0);
  const [objects, setObjects] = useState<models.Object[]>([]);
  const [pageSize, setPageSize] = useState(25);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const totalPages = Math.ceil(totalObjects / pageSize);

  // Retrieve total objects
  useEffect(() => {
    const effect = async () => {
      try {
        setLoading(true);
        const totalObjects = await GetTotalObjects(connectionID, name, "");

        setTotalObjects(totalObjects);
      } catch (error) {
        reportError(error);
      } finally {
        setLoading(false);
      }
    };

    // resets
    setCursorHistory([]);
    setTotalObjects(0);
    setPageSize(25);
    setObjects([]);

    effect();
  }, [connectionID, name]);

  // Retrieve objects
  useEffect(() => {
    retrieveObjects("", "first");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionID, pageSize, name]);

  const retrieveObjects = async (
    cursor: string,
    action: "next" | "previous" | "first"
  ) => {
    try {
      setLoading(true);

      const { Objects: objects } = await GetObjectsPaginated(
        connectionID,
        pageSize,
        name,
        cursor,
        ""
      );

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      setObjects(objects.map(({ class: _, ...object }) => object));

      if (action === "first" && objects.length > 0) {
        setCursorHistory([objects.at(-1)!.id!]);
      }
      if (action === "next" && objects.length > 0) {
        setCursorHistory((state) => [...state, objects.at(-1)!.id!]);
      }
      if (action === "previous") {
        setCursorHistory((state) => state.slice(0, -1));
      }
    } catch (error) {
      reportError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    if (cursorHistory.length === totalPages) {
      return;
    }
    await retrieveObjects(cursorHistory.at(-1) || "", "next");
  };

  const handlePrevious = async () => {
    if (cursorHistory.length <= 1) {
      return;
    }
    await retrieveObjects(cursorHistory.at(-3) || "", "previous");
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
          <div className="flex flex-row flex-2 justify-end">
            <Pagination
              pageSize={pageSize}
              setPageSize={handlePageSizeChange}
              next={handleNext}
              previous={handlePrevious}
              currentPage={cursorHistory.length}
              totalPages={totalPages}
              loading={loading}
            />
          </div>
        </div>
        <TabsContent value="objects">
          <ObjectsList objects={objects} />
        </TabsContent>
        <TabsContent value="indexes">Not yet implemented</TabsContent>
        <TabsContent value="schema">Not yet implemented</TabsContent>
      </Tabs>
    </TabContainer>
  );
};

export default SingleTenantCollection;
