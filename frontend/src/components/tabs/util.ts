import { Tab } from "@/types";
import { WelcomeName } from "./Welcome";
import { NewTabName } from "./NewTab";
import { ClusterDetailsName } from "./ClusterDetails/ClusterDetails";

export const isGeneralTab = (tab: Tab): boolean =>
  [WelcomeName, NewTabName, ClusterDetailsName].includes(tab.name);
