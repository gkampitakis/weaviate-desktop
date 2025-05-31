import type { Collection } from "@/types";
import { useState } from "react";
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
import { useDebouncedCallback } from "use-debounce";
import { Tabs as AntdTabs } from "antd";
import type { TabsProps } from "antd";

interface Props {
  collection: Collection;
}

const MultiTenantCollection: React.FC<Props> = ({ collection }) => {
  const { connection, name } = collection;

  const [pageSize, setPageSize] = useState(25);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

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
    enabled: !!selectedTenant && !!tenants?.length && !searchQuery,
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

        return objects;
      } catch (error) {
        errorReporting(error);
        throw error;
      }
    },
    // when changing page we need to make sure we have fetched the tenants again
    enabled: !!selectedTenant && !!tenants?.length && !searchQuery,
  });

  // Retrieve search results
  const { data: searchResults, isLoading: loadingSearch } = useQuery({
    queryKey: ["search", connection.id, name, searchQuery],
    queryFn: async () => {
      if (!searchQuery) return null;
      try {
        const results = await Search(
          connection.id,
          // FIXME:
          pageSize,
          0,
          name,
          selectedTenant,
          searchQuery
        );
        return results?.Objects || [];
      } catch (error) {
        errorReporting(error);
        throw error;
      }
    },
    enabled: !!searchQuery, // Only run this query if searchQuery is not empty
  });

  const loading =
    loadingTenant ||
    loadingObject ||
    isPlaceholderData ||
    loadingTotal ||
    loadingSearch;

  // Use search results if available, otherwise use regular objects
  const displayedObjects = searchQuery ? searchResults : objects || [];

  const refetch = () => {
    refetchObjects();
    refetchTotal();
  };

  // FIXME: to handle searching
  const handleNext = async () => {
    // If searching, don't allow pagination
    if (searchQuery || cursorHistory.length + 1 === totalPages || loading) {
      return;
    }

    setCursorHistory((state) => [...state, objects!.at(-1)!.id!]);
  };

  // FIXME: to handle searching
  const handlePrevious = async () => {
    // If searching, don't allow pagination
    if (searchQuery || cursorHistory.length <= 0 || loading) {
      return;
    }

    setCursorHistory((state) => state.slice(0, -1));
  };

  const handlePageSizeChange = (p: number) => {
    setPageSize(p);
    setCursorHistory([]);
  };

  const items: TabsProps["items"] = [
    {
      key: "1",
      label: "Objects",
      children: (
        <div className="flex h-full w-full flex-col overflow-hidden p-2">
          <div className="relative mb-4">
            <input
              type="text"
              className="focus:ring-primary w-full rounded-md border py-2 pr-4 pl-10 focus:ring-2 focus:outline-none"
              placeholder="Search"
              onChange={useDebouncedCallback((e) => {
                setSearchQuery(e.target.value);
              }, 300)}
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 transform text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
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
          <div className="flex-1 overflow-hidden">
            <ObjectsList
              loading={loading}
              objects={displayedObjects || []}
              connectionID={connection.id}
              isSearch={!!searchQuery}
              refetch={refetch}
            />
          </div>
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
