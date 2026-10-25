import { useRef, useState } from "react";
import {
  GetCollection,
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
import SearchComponent, {
  toWireOptions,
  SEARCH_RESULT_CAP,
  SHOW_SIMILAR_DEFAULT_OPTS,
  type SearchOptions,
  type SearchType,
} from "./components/Search";
import ObjectsTable from "./components/ObjectsTable";
import ResultsToolbar from "./components/ResultsToolbar";
import { Props } from "./types";
import CollectionDetails from "./components/CollectionDetails/index";
import {
  objectsQueryKey,
  tenantsQueryKey,
  totalObjectsQueryKey,
} from "@/components/tabs/constants";
import { collectionDetailsQueryKey } from "./components/constants";
import {
  useExplorerHistoryStore,
  useResultsViewMode,
} from "@/store/explorer-history-store";

const MultiTenantCollection: React.FC<Props> = ({
  collection,
  selectedTab,
}) => {
  const { connection, name } = collection;

  const [pageSize, setPageSize] = useState(25);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [searching, setSearching] = useState(false);
  const [objects, setObjects] = useState<
    weaviate.w_WeaviateObject[] | undefined
  >();
  const [searchExecutionTime, setSearchExecutionTime] = useState<string>();
  const [similarObjectId, setSimilarObjectId] = useState<string | undefined>();
  const [lastSearch, setLastSearch] = useState<{
    query: string;
    searchType: string;
    opts: SearchOptions;
  } | null>(null);
  const [searchPage, setSearchPage] = useState(1);
  const objectsContainerRef = useRef<HTMLDivElement>(null);
  const pushSearch = useExplorerHistoryStore((s) => s.pushSearch);
  const setViewMode = useExplorerHistoryStore((s) => s.setViewMode);
  const viewMode = useResultsViewMode(connection.id, name, selectedTenant);

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

  // Fetch collection details (shared cache key with the Details tab) to read TTL config.
  const { data: collectionDetails } = useQuery({
    queryKey: collectionDetailsQueryKey(connection.id, name),
    queryFn: () => GetCollection(connection.id, name),
    retry: false,
  });

  // Fetch tenants
  const { data: tenants, isLoading: loadingTenant } = useQuery({
    queryKey: tenantsQueryKey(connection.id, name),
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
    queryKey: totalObjectsQueryKey(connection.id, name, selectedTenant),
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
    enabled: !!selectedTenant && !!tenants?.length && !searching && !objects,
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
      pageSize,
      selectedTenant
    ),
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

  const runSearch = async (
    v: string,
    searchType: string,
    opts: SearchOptions,
    {
      pushHistory = true,
      page = 1,
      limit = pageSize,
    }: { pushHistory?: boolean; page?: number; limit?: number } = {}
  ) => {
    setSearching(true);
    setLastSearch({ query: v, searchType, opts });
    setSearchPage(page);

    try {
      const { ExecutionTime, Objects } = await Search(
        connection.id,
        name,
        selectedTenant,
        searchType,
        v,
        toWireOptions(opts, { limit, offset: (page - 1) * limit })
      );

      setObjects(Objects);
      scrollToTop();
      setSearchExecutionTime(ExecutionTime);

      if (pushHistory) {
        pushSearch({
          connectionId: connection.id,
          collectionName: name,
          tenant: selectedTenant,
          searchType: searchType as SearchType,
          query: v,
          options: opts,
        });
      }
    } catch (error) {
      errorReporting(error);
      setSearching(false);
    }
  };

  const handleSearch = (
    v: string,
    searchType: string,
    opts: SearchOptions
  ) => {
    setSimilarObjectId(undefined);
    return runSearch(v, searchType, opts, { page: 1 });
  };

  // pushHistory is on so the entry shows up in Recent Searches and the
  // user can restore it later (which re-activates the chip).
  const handleShowSimilar = (objectId: string) => {
    setSimilarObjectId(objectId);
    runSearch(objectId, "nearObject", SHOW_SIMILAR_DEFAULT_OPTS, {
      pushHistory: true,
      page: 1,
    });
  };

  const handleSearchNext = () => {
    if (!lastSearch) return;
    runSearch(lastSearch.query, lastSearch.searchType, lastSearch.opts, {
      pushHistory: false,
      page: searchPage + 1,
    });
  };

  const handleSearchPrevious = () => {
    if (!lastSearch || searchPage <= 1) return;
    runSearch(lastSearch.query, lastSearch.searchType, lastSearch.opts, {
      pushHistory: false,
      page: searchPage - 1,
    });
  };

  const handleSearchPageSizeChange = (p: number) => {
    setPageSize(p);
    if (lastSearch) {
      runSearch(lastSearch.query, lastSearch.searchType, lastSearch.opts, {
        pushHistory: false,
        page: 1,
        limit: p,
      });
    }
  };

  const resetSearch = () => {
    setSearching(false);
    setSearchExecutionTime(undefined);
    setSimilarObjectId(undefined);
    setLastSearch(null);
    setSearchPage(1);
    refetchObjects();
    refetchTotal();
  };

  const resultsOnPage = objects?.length ?? 0;
  const nextPageWithinCap =
    searchPage * pageSize + pageSize <= SEARCH_RESULT_CAP;
  const searchHasMore =
    searching && resultsOnPage === pageSize && nextPageWithinCap;
  const capReached =
    searching && resultsOnPage === pageSize && !nextPageWithinCap;

  const items: TabsProps["items"] = [
    {
      key: "objects",
      label: "Objects",
      children: (
        <div className="flex h-full w-full flex-col overflow-hidden p-2">
          <SearchComponent
            handleSearch={handleSearch}
            resetSearch={resetSearch}
            executionTime={searchExecutionTime || ""}
            changeId={`${connection.id}-${name}`}
            connectionId={connection.id}
            collectionName={name}
            tenant={selectedTenant}
            similarObjectId={similarObjectId}
            onClearSimilar={() => {
              setSimilarObjectId(undefined);
              resetSearch();
            }}
            onRestoreSimilar={handleShowSimilar}
            schemaProperties={(collectionDetails?.properties || [])
              .map((p) => ({
                name: p.name ?? "",
                dataType: p.dataType?.[0] ?? "",
              }))
              .filter((p) => p.name)}
            vectorTargets={
              collectionDetails?.vectorConfig
                ? Object.keys(collectionDetails.vectorConfig)
                : undefined
            }
          >
            <div className="mb-2 flex flex-row items-center justify-between">
              <TenantList
                selected={selectedTenant}
                setTenant={selectTenant}
                tenants={tenants}
              />
              {searching ? (
                <Pagination
                  mode="search"
                  pageSize={pageSize}
                  setPageSize={handleSearchPageSizeChange}
                  next={handleSearchNext}
                  previous={handleSearchPrevious}
                  searchPage={searchPage}
                  resultsOnPage={resultsOnPage}
                  hasMore={searchHasMore}
                  loading={loading}
                />
              ) : (
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
              )}
            </div>
            <ResultsToolbar
              viewMode={viewMode}
              onViewModeChange={(m) =>
                setViewMode(connection.id, name, selectedTenant, m)
              }
              similarObjectId={similarObjectId}
              onClearSimilar={() => {
                setSimilarObjectId(undefined);
                resetSearch();
              }}
              capReached={capReached}
              connectionID={connection.id}
              collectionName={name}
              tenant={selectedTenant}
            />
            {viewMode === "table" ? (
              <ObjectsTable
                loading={loading}
                objects={objects || []}
                connectionID={connection.id}
                isSearch={searching}
                objectTtlConfig={collectionDetails?.objectTtlConfig}
                refetch={refetch}
                ref={objectsContainerRef}
                onShowSimilar={handleShowSimilar}
              />
            ) : (
              <ObjectsList
                loading={loading}
                objects={objects || []}
                connectionID={connection.id}
                isSearch={searching}
                objectTtlConfig={collectionDetails?.objectTtlConfig}
                refetch={refetch}
                ref={objectsContainerRef}
                onShowSimilar={handleShowSimilar}
              />
            )}
          </SearchComponent>
        </div>
      ),
    },
    {
      key: "details",
      label: "Details",
      children: (
        <CollectionDetails connectionID={connection.id} collectionName={name} />
      ),
    },
    {
      key: "tenants",
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

export default MultiTenantCollection;
