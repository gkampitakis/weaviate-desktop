import type { Collection } from "@/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import {
  GetObjectsPaginated,
  GetTenants,
  GetTotalObjects,
} from "wailsjs/go/weaviate/Weaviate";
import TabContainer from "../components/TabContainer";
import ObjectsList from "./components/ObjectsList";
import { models } from "wailsjs/go/models";
import TenantList from "./components/TenantList";
import Pagination from "./components/Pagination";

interface Props {
  collection: Collection;
}

const MultiTenantCollection: React.FC<Props> = ({ collection }) => {
  const { connectionID, name } = collection;

  const [totalObjects, setTotalObjects] = useState(0);
  const [objects, setObjects] = useState<models.Object[]>([]);
  const [pageSize, setPageSize] = useState(25);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [tenants, setTenants] = useState<models.Tenant[]>();
  const [selectedTenant, setSelectedTenant] = useState("");
  const [loading, setLoading] = useState(false);

  const totalPages = Math.ceil(totalObjects / pageSize);

  // Retrieve list of tenants
  useEffect(() => {
    const effect = async () => {
      try {
        setLoading(true);

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

    // resets cursor history
    setCursorHistory([]);
    effect();
  }, [connectionID, name]);

  // After retrieve total objects
  useEffect(() => {
    if (!selectedTenant) {
      return;
    }

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

    // resets cursor history
    setCursorHistory([]);
    effect();
  }, [connectionID, name, selectedTenant]);

  // Finally retrieve objects
  useEffect(() => {
    if (!selectedTenant) {
      return;
    }

    retrieveObjects("", "next");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionID, name, pageSize, selectedTenant]);

  const retrieveObjects = async (
    cursor: string,
    action: "next" | "previous"
  ) => {
    try {
      setLoading(true);

      const { Objects: objects } = await GetObjectsPaginated(
        connectionID,
        pageSize,
        name,
        cursor,
        selectedTenant
      );

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      setObjects(objects.map(({ class: _, ...object }) => object));

      if (action === "next" && objects.length > 0) {
        setCursorHistory((state) => [...state, objects.at(-1)!.id!]);
      }
      if (action === "previous") {
        setCursorHistory((state) => state.slice(0, -1));
      }
    } catch (error) {
      console.error(error);
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
    if (cursorHistory.length === 1) {
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
          <div className="flex flex-row flex-2 justify-between">
            <TenantList
              selected={selectedTenant}
              setTenant={setSelectedTenant}
              tenants={tenants}
            />
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

export default MultiTenantCollection;
