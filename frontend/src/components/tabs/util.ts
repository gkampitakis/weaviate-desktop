import { Tab } from "@/types";
import { WelcomeName } from "./Welcome";
import { ClusterDetailsName } from "./ClusterDetails/ClusterDetails";

export const isGeneralTab = (tab: Tab): boolean =>
  [WelcomeName, ClusterDetailsName].includes(tab.name);
