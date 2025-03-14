import { sql } from "wailsjs/go/models";

export enum ConnectionStatus {
  Connected,
  Disconnected,
}

export interface Connection extends sql.Connection {
  status?: ConnectionStatus;
}
