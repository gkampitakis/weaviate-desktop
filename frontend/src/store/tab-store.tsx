import type { Tab } from "@/types";
import { create } from "zustand";
import Welcome from "@/components/tabs/Welcome";
import TabLabel from "@/components/tabs/TabLabel";

interface TabStore {
  tabs: Tab[];
  add: (tab: Tab) => void;
  remove: (id: string) => void;
}

export const useTabStore = create<TabStore>((set) => ({
  add: (tab) => set((state) => ({ tabs: [...state.tabs, tab] })),
  remove: (key) =>
    set((state) => ({ tabs: state.tabs.filter((t) => t.key !== key) })),
  tabs: [
    {
      key: "0",
      label: <TabLabel>Welcome</TabLabel>,
      children: <Welcome />,
    },
  ],
}));
