import type { Tab } from "@/types";
import { create } from "zustand";
import Welcome, { WelcomeName } from "@/components/tabs/Welcome";
import GeneralTabLabel from "@/components/tabs/components/GeneralTabLabel";
import CollectionTabLabel from "@/components/tabs/components/CollectionTabLabel";
import { arrayMove } from "@dnd-kit/sortable";

let globalIdx = 1;

interface TabStore {
  tabs: Tab[];
  active?: string;
  add: (tab: Omit<Tab, "key">) => void;
  remove: (key: string) => void;
  setActive: (key?: string) => void;
  updateActiveTab(tab: Omit<Tab, "key">): void;
  removeByConnection(id: number): void;
  updateByConnection(id: number, name: string, color: string): void;
  getActiveTab(): Tab | undefined;
  reorderTabs(activeIndex: string, overIndex: string): void;
}

export const useTabStore = create<TabStore>((set, get) => ({
  reorderTabs: (activeId: string, overId: string) => {
    set((state) => {
      const activeIndex = state.tabs.findIndex((i) => i.key === activeId);
      const overIndex = state.tabs.findIndex((i) => i.key === overId);

      return { tabs: arrayMove(state.tabs, activeIndex, overIndex) };
    });
  },
  add: (tab) => {
    return set((state) => {
      const key = (globalIdx++).toString();
      return { tabs: [...state.tabs, { ...tab, key }], active: key };
    });
  },
  getActiveTab: () => {
    const { active, tabs } = get();
    if (!active) return undefined;
    const tab = tabs.find((t) => t.key === active);
    return tab;
  },
  remove: (key) => {
    return set((state) => {
      const tabs = state.tabs.filter((t) => t.key !== key);
      let newActiveKey = state.active;

      if (tabs.length > 0 && key === newActiveKey) {
        newActiveKey = tabs[tabs.length - 1].key;
      }

      return { tabs, active: newActiveKey };
    });
  },
  active: "0",
  setActive: (key) => set((state) => ({ ...state, active: key })),
  updateByConnection: (id, name, color) => {
    return set((state) => {
      return {
        tabs: state.tabs.map((t) =>
          t.connection?.id === id
            ? {
                ...t,
                label: (
                  <CollectionTabLabel
                    name={t.name}
                    connectionName={name}
                    connectionID={t.connection.id}
                    color={color}
                    tooltip
                  />
                ),
              }
            : t
        ),
      };
    });
  },
  removeByConnection: (id) => {
    return set((state) => {
      // filter out all tabs that are not part of the connection
      const tabs = state.tabs.filter(
        ({ connection = {} }) => connection.id !== id
      );
      // if from the remaining tabs none of them are the active ones
      // we need to find an active one
      if (tabs.findIndex((t) => t.key === state.active) === -1) {
        let newActiveKey = state.active;

        if (tabs.length > 0) {
          newActiveKey = tabs[tabs.length - 1].key;
        }

        return { tabs, active: newActiveKey };
      }

      return {
        tabs,
      };
    });
  },
  updateActiveTab: (tab) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.key === state.active ? { ...t, ...tab } : t
      ),
    })),
  tabs: [
    {
      key: "0",
      label: <GeneralTabLabel name={WelcomeName} />,
      name: WelcomeName,
      children: <Welcome />,
    },
  ],
}));
