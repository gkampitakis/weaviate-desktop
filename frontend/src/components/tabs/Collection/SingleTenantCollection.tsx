import type { Collection as SingleTenantCollection } from "@/types";
import { useRef, useState } from "react";
import {
  GetObjectsPaginated,
  GetTotalObjects,
  Search,
} from "wailsjs/go/weaviate/Weaviate";
import "./components/custom-tabs.css";
import TabContainer from "../components/TabContainer";
import ObjectsList from "./components/ObjectsList";
import Pagination from "./components/Pagination";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { errorReporting } from "@/lib/utils";
import { Tabs as AntdTabs } from "antd";
import type { TabsProps } from "antd";
import { weaviate } from "wailsjs/go/models";
import SearchComponent from "./components/Search";
import { Props } from "./types";
import CollectionDetails from "./components/CollectionDetails";
import { objectsQueryKey, totalObjectsQueryKey } from "../constants";

const SingleTenantCollection: React.FC<Props> = ({
  collection,
  selectedTab,
}) => {
  const { connection, name } = collection;

  const [pageSize, setPageSize] = useState(25);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
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

  // Fetch total objects count
  const {
    data: totalObjects,
    isLoading: loadingTotal,
    refetch: refetchTotal,
  } = useQuery({
    queryKey: totalObjectsQueryKey(connection.id, name),
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
    enabled: !searching && !objects, // Only run this query if searchQuery is empty
  });

  const totalPages = Math.ceil(totalObjects / pageSize);

  // Retrieve objects
  const {
    isLoading: loadingObject,
    isPlaceholderData,
    refetch: refetchObjects,
  } = useQuery({
    placeholderData: keepPreviousData,
    queryKey: objectsQueryKey(
      connection.id,
      name,
      cursorHistory.at(-1),
      pageSize
    ),
    queryFn: async () => {
      try {
        const { Objects: objects } = await GetObjectsPaginated(
          connection.id,
          pageSize,
          name,
          cursorHistory.at(-1) || "",
          ""
        );

        setObjects(objects);
        scrollToTop();

        return objects;
      } catch (error) {
        errorReporting(error);
        throw error;
      }
    },
    enabled: !searching, // Only run this query if searchQuery is empty
  });

  const loading = loadingTotal || loadingObject || isPlaceholderData;

  const handleNext = async () => {
    // If searching, don't allow pagination
    if (searching || cursorHistory.length + 1 === totalPages || loading) {
      return;
    }

    setCursorHistory((state) => [...state, objects!.at(-1)!.id!]);
  };

  const refetch = () => {
    refetchObjects();
    refetchTotal();
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
        "",
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
      key: "objects",
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
            <div className="mb-2 flex flex-row items-center justify-end">
              <Pagination
                pageSize={pageSize}
                setPageSize={handlePageSizeChange}
                next={handleNext}
                previous={handlePrevious}
                currentPage={cursorHistory.length + 1}
                totalCount={totalObjects}
                totalPages={totalPages}
                loading={loading}
                disabled={searching}
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
      key: "details",
      label: "Details",
      children: <CollectionDetails />,
    },
  ];

  return (
    <TabContainer>
      <AntdTabs
        defaultActiveKey={selectedTab || "objects"}
        items={items}
        className="custom-green-tabs flex h-full flex-col"
        tabBarStyle={{
          marginBottom: "16px",
        }}
      />
    </TabContainer>
  );
};

export default SingleTenantCollection;
