import { models } from "wailsjs/go/models";
import { Tab as TabComponent } from "rc-tabs/lib/interface";

export interface Connection extends models.Connection {
  status?: ConnectionStatus;
  collections?: Collection[];
}

export interface Tab extends TabComponent {
  // which connection relates to this tab if so.
  connectionID?: number;
}

export interface Collection {
  name: string;
  connectionID: number;
  multiTenancyConfig?: models.MultiTenancyConfig;
}
