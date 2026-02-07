export const usersQueryKey = (connectionID: number) => ["users", connectionID];

export const usersRefetchInterval = 5 * 60000; // 5 minutes

export const rolesQueryKey = (connectionID: number) => ["roles", connectionID];
