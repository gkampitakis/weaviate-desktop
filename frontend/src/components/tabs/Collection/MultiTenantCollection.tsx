import type { Collection } from "@/types";
import { useRef, useState } from "react";
import {
  GetObjectsPaginated,
  GetTenants,
  GetTotalObjects,
  Search,
} from "wailsjs/go/weaviate/Weaviate";
import "./components/custom-tabs.css";
import TabContainer from "../components/TabContainer";
import ObjectsList from "./components/ObjectsList";
import TenantList from "./components/TenantList";
import Pagination from "./components/Pagination";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { errorReporting } from "@/lib/utils";
import { Tabs as AntdTabs } from "antd";
import type { TabsProps } from "antd";
import { weaviate } from "wailsjs/go/models";
import SearchComponent from "./components/Search";

interface Props {
  collection: Collection;
}

const MultiTenantCollection: React.FC<Props> = ({ collection }) => {
  const { connection, name } = collection;

  const [pageSize, setPageSize] = useState(25);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [searching, setSearching] = useState(false);
  const [objects, setObjects] = useState<
    weaviate.w_WeaviateObject[] | undefined
  >();
  const [searchExecutionTime, setSearchExecutionTime] = useState<string>();
  const objectsContainerRef = useRef<HTMLDivElement>(null);

  const scrollToTop = () => {
    // Use the ref to scroll to top smoothly
    if (objectsContainerRef.current) {
      objectsContainerRef.current.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  const selectTenant = (tenant: string) => {
    setSelectedTenant(tenant);
    // reset cursor history when changing tenant
    setCursorHistory([]);
  };

  // Fetch tenants
  const { data: tenants, isLoading: loadingTenant } = useQuery({
    queryKey: ["tenants", connection.id, name],
    queryFn: async () => {
      try {
        const tenants = await GetTenants(connection.id, name);
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
    queryKey: ["totalObjects", connection.id, name, selectedTenant],
    initialData: 0,
    queryFn: async () => {
      try {
        const total = await GetTotalObjects(
          connection.id,
          name,
          selectedTenant
        );

        return total;
      } catch (error) {
        errorReporting(error);
        throw error;
      }
    },
    // when changing page we need to make sure we have fetched the tenants again
    enabled: !!selectedTenant && !!tenants?.length && !searching,
  });

  const totalPages = Math.ceil(totalObjects / pageSize);

  // Retrieve objects
  const {
    isLoading: loadingObject,
    isPlaceholderData,
    refetch: refetchObjects,
  } = useQuery({
    placeholderData: keepPreviousData,
    queryKey: [
      "objects",
      connection.id,
      name,
      pageSize,
      selectedTenant,
      cursorHistory.at(-1),
    ],
    queryFn: async () => {
      try {
        const { Objects: objects } = await GetObjectsPaginated(
          connection.id,
          pageSize,
          name,
          cursorHistory.at(-1) || "",
          selectedTenant
        );

        setObjects(objects);
        scrollToTop();
        return objects;
      } catch (error) {
        errorReporting(error);
        throw error;
      }
    },
    // when changing page we need to make sure we have fetched the tenants again
    enabled: !!selectedTenant && !!tenants?.length && !searching,
  });

  const loading =
    loadingTenant || loadingObject || isPlaceholderData || loadingTotal;

  const refetch = () => {
    refetchObjects();
    refetchTotal();
  };

  const handleNext = async () => {
    // If searching, don't allow pagination
    if (searching || cursorHistory.length + 1 === totalPages || loading) {
      return;
    }

    setCursorHistory((state) => [...state, objects!.at(-1)!.id!]);
  };

  const handlePrevious = async () => {
    // If searching, don't allow pagination
    if (searching || cursorHistory.length <= 0 || loading) {
      return;
    }

    setCursorHistory((state) => state.slice(0, -1));
  };

  const handlePageSizeChange = (p: number) => {
    setPageSize(p);
    setCursorHistory([]);
  };

  const handleSearch = async (v: string) => {
    setSearching(true);

    try {
      const { ExecutionTime, Objects } = await Search(
        connection.id,
        name,
        selectedTenant,
        v
      );

      setObjects(Objects);
      scrollToTop();
      setSearchExecutionTime(ExecutionTime);
    } catch (error) {
      errorReporting(error);
      setSearching(false);
    }
  };

  const resetSearch = () => {
    setSearching(false);
    setSearchExecutionTime(undefined);
  };

  const items: TabsProps["items"] = [
    {
      key: "1",
      label: "Objects",
      children: (
        <div className="flex h-full w-full flex-col overflow-hidden p-2">
          <SearchComponent
            handleSearch={handleSearch}
            resetSearch={resetSearch}
            searchObjects={objects?.length || 0}
            executionTime={searchExecutionTime || ""}
            changeId={`${connection.id}-${name}`}
          >
            <div className="mb-2 flex flex-row items-center justify-between">
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
                totalCount={totalObjects}
                totalPages={totalPages}
                loading={loading}
              />
            </div>
            <ObjectsList
              loading={loading}
              objects={objects || []}
              connectionID={connection.id}
              isSearch={searching}
              refetch={refetch}
              ref={objectsContainerRef}
            />
          </SearchComponent>
        </div>
      ),
    },
    {
      key: "2",
      label: "Tenants",
      children: (
        <div className="p-4">
          <p className="text-gray-500"></p>
        </div>
      ),
    },
  ];

  return (
    <TabContainer>
      <AntdTabs
        defaultActiveKey="1"
        items={items}
        className="custom-green-tabs flex h-full flex-col"
        tabBarStyle={{
          marginBottom: "16px",
        }}
      />
    </TabContainer>
  );
};

export default MultiTenantCollection;
