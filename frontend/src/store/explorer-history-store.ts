import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type { SearchOptions, SearchType } from "@/components/tabs/Collection/components/Search";

export type RecentSearch = {
  id: string;
  connectionId: number;
  collectionName: string;
  tenant?: string;
  searchType: SearchType;
  query: string;
  options: SearchOptions;
  timestamp: number;
};

const MAX_TOTAL = 30;
const MAX_DISPLAY = 10;

type NewEntry = Omit<RecentSearch, "id" | "timestamp">;

export type ResultsViewMode = "json" | "table";

const viewModeKey = (
  connectionId: number,
  collectionName: string,
  tenant?: string
) => `${connectionId}:${collectionName}:${tenant || ""}`;

interface ExplorerHistoryStore {
  entries: RecentSearch[];
  viewMode: Record<string, ResultsViewMode>;
  pushSearch: (entry: NewEntry) => void;
  clearForCollection: (
    connectionId: number,
    collectionName: string,
    tenant?: string
  ) => void;
  clearAll: () => void;
  setViewMode: (
    connectionId: number,
    collectionName: string,
    tenant: string | undefined,
    mode: ResultsViewMode
  ) => void;
}

const sameCollection = (
  a: { connectionId: number; collectionName: string; tenant?: string },
  b: { connectionId: number; collectionName: string; tenant?: string }
) =>
  a.connectionId === b.connectionId &&
  a.collectionName === b.collectionName &&
  (a.tenant || "") === (b.tenant || "");

const sameSearch = (a: RecentSearch, b: NewEntry) =>
  sameCollection(a, b) &&
  a.searchType === b.searchType &&
  a.query === b.query &&
  JSON.stringify(a.options) === JSON.stringify(b.options);

const makeId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const useExplorerHistoryStore = create<ExplorerHistoryStore>()(
  persist(
    (set) => ({
      entries: [],
      viewMode: {},
      pushSearch: (entry) =>
        set((state) => {
          const now = Date.now();

          // Find the most recent entry for this collection
          const collectionEntries = state.entries.filter((e) =>
            sameCollection(e, entry)
          );
          const lastForCollection = collectionEntries[0];

          // If the latest entry for this collection is identical, bump timestamp
          if (lastForCollection && sameSearch(lastForCollection, entry)) {
            return {
              entries: state.entries.map((e) =>
                e.id === lastForCollection.id ? { ...e, timestamp: now } : e
              ),
            };
          }

          const next: RecentSearch = {
            ...entry,
            id: makeId(),
            timestamp: now,
          };

          // Prepend, then enforce global cap
          return {
            entries: [next, ...state.entries].slice(0, MAX_TOTAL),
          };
        }),
      clearForCollection: (connectionId, collectionName, tenant) =>
        set((state) => ({
          entries: state.entries.filter(
            (e) =>
              !sameCollection(e, {
                connectionId,
                collectionName,
                tenant,
              })
          ),
        })),
      clearAll: () => set({ entries: [] }),
      setViewMode: (connectionId, collectionName, tenant, mode) =>
        set((state) => ({
          viewMode: {
            ...state.viewMode,
            [viewModeKey(connectionId, collectionName, tenant)]: mode,
          },
        })),
    }),
    {
      name: "weaviate-gui:explorer-history",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);

/**
 * Selector that returns the most recent (up to 10) searches matching the
 * provided connection/collection/tenant scope, sorted newest first.
 */
export const useRecentSearches = (
  connectionId: number,
  collectionName: string,
  tenant?: string
): RecentSearch[] =>
  useExplorerHistoryStore(
    useShallow((state) =>
      state.entries
        .filter((e) =>
          sameCollection(e, { connectionId, collectionName, tenant })
        )
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_DISPLAY)
    )
  );

/**
 * Selector that returns the persisted view mode for a collection. Defaults
 * to "json" to preserve the legacy behaviour for first-time users.
 */
export const useResultsViewMode = (
  connectionId: number,
  collectionName: string,
  tenant?: string
): ResultsViewMode =>
  useExplorerHistoryStore(
    (state) =>
      state.viewMode[viewModeKey(connectionId, collectionName, tenant)] ?? "json"
  );
