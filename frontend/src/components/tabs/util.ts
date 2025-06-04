import { Tab } from "@/types";
import { WelcomeName } from "./Welcome";
import { NewTabName } from "./NewTab";
import { ClusterInformationName } from "./ClusterInformation/ClusterInformation";

export const isGeneralTab = (tab: Tab): boolean =>
  [WelcomeName, NewTabName, ClusterInformationName].includes(tab.name);
