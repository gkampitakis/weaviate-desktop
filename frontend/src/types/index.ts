export enum ConnectionStatus {
  Connected,
}

export interface Connection {
  id: string;
  name: string;
  status?: ConnectionStatus;
  starred?: boolean;
}
