import { Tab } from "@/types";
import { WelcomeName } from "./Welcome";
import { NewTabName } from "./NewTab";
import { ClusterName } from "./Cluster/Cluster";

export const isGeneralTab = (tab: Tab): boolean =>
  [WelcomeName, NewTabName, ClusterName].includes(tab.name);
