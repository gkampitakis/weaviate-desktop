import { models } from "wailsjs/go/models";
import { Tab as TabComponent } from "rc-tabs/lib/interface";

export interface Connection extends models.Connection {
  status?: ConnectionStatus;
  collections?: Collection[];
}

export interface Tab extends TabComponent {
  // which connection relates to this tab if so.
  connection?: {
    id: number;
    name: string;
  };
  name: string;
}

export interface Collection {
  name: string;
  connection: {
    id: number;
    name: string;
  };
  multiTenancyConfig?: models.MultiTenancyConfig;
}
