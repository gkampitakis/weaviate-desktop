import { Collection } from "@/types";

export interface Props {
  collection: Collection;
  selectedTab?: InnerTabs;
}

export type InnerTabs = "objects" | "details" | "tenants";
