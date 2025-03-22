import { models } from "wailsjs/go/models";
import { Tab as TabComponent } from "rc-tabs/lib/interface";

export interface Connection extends models.Connection {
  status?: ConnectionStatus;
  collections?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Tab extends TabComponent {
  // will be added later
}
