export const backupsQueryKey = (connectionID: number) => [
  "backups",
  connectionID,
];

export const backupRefetchInterval = 5 * 60000; // 5 minutes

export const backupCreationStatusQueryKey = (
  connectionID: number,
  backupID: string
) => ["backup-creation-status", connectionID, backupID];

export const collectionsQueryKey = (connectionID: number) => [
  "collections",
  connectionID,
];
