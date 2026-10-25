export const refetchNodeStatusInterval = 5 * 60000;

export const refetchClusterStatusInterval = 10000;

export const clusterStatusQueryKey = (connectionID: number) => [
  "cluster-status",
  connectionID,
];

export const tenantsQueryKey = (
  connectionID: number,
  collectionName: string
) => ["tenants", connectionID, collectionName];

export const objectsQueryKey = (
  connectionID: number,
  collectionName: string,
  cursor?: string,
  pageSize?: number,
  tenant?: string
) => {
  const items = ["objects", connectionID, collectionName];

  if (cursor) {
    items.push(cursor);
  }

  if (pageSize) {
    items.push(pageSize);
  }

  if (tenant) {
    items.push(tenant);
  }

  return items;
};

export const totalObjectsQueryKey = (
  connectionID: number,
  collectionName: string,
  tenant?: string,
  where?: unknown
) => {
  const items: unknown[] = ["totalObjects", connectionID, collectionName];

  if (tenant) {
    items.push(tenant);
  }

  if (where) {
    items.push(where);
  }

  return items;
};

export const nodeStatusQueryKey = (connectionID: number) => [
  "node-status",
  connectionID,
];
